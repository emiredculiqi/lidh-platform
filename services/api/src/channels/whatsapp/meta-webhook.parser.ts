import type { InboundWhatsAppMessage } from "./transport";

/**
 * Meta WhatsApp Cloud API webhook parser (pure, unit-testable).
 *
 * Meta delivers a nested envelope:
 *   { object: "whatsapp_business_account",
 *     entry: [ { id: <WABA_ID>, changes: [ { field, value } ] } ] }
 *
 * `value` carries one of several payloads; we untangle them into normalized
 * buckets the service can act on. One POST may batch many entries/changes/
 * messages — we flatten them all.
 */

/** A message the business OWNER sent from their own WhatsApp Business App.
 *  Coexistence echoes these to us so the dashboard inbox stays in sync — we
 *  persist them as human messages but must NOT run the agent or reply. */
export interface EchoMessage {
  /** The business phone_number_id that sent it (identifies the tenant). */
  businessNumber: string;
  /** The customer the owner messaged (E.164, e.g. +355691112222). */
  customer: string;
  text: string;
  providerMessageId?: string;
}

/** A WABA-level lifecycle event (coexistence offboard/reconnect, etc.). */
export interface AccountEvent {
  wabaId: string;
  /** e.g. "account_offboarded" | "account_reconnected" | "PARTNER_ADDED". */
  event: string;
}

/**
 * One historical message replayed by the coexistence `history` webhook.
 *
 * Direction rule (from Meta's payload reference): a thread message carries `to`
 * ONLY when it is an SMB message echo — i.e. something the business sent. A
 * customer's own message has `from` but no `to`. We use that as the primary
 * signal and fall back to comparing `from` against the business number.
 */
export interface HistoryMessage {
  businessNumber: string;
  /** The customer on the other end of the thread (E.164). */
  customer: string;
  text: string;
  providerMessageId?: string;
  /** True when the business sent it (owner or a previous tool), else customer. */
  fromBusiness: boolean;
  /** Device timestamp Meta reports, when parseable. */
  sentAt?: Date;
}

/**
 * A chunk of history. Meta delivers 180 days in three phases (0: day 0–1,
 * 1: day 1–90, 2: day 90–180), each possibly split into ordered chunks.
 * `progress` reaching 100 means the sync is complete.
 */
export interface HistoryChunk {
  businessNumber: string;
  phase?: number;
  chunkOrder?: number;
  progress?: number;
  messages: HistoryMessage[];
}

/** A contact row from the `smb_app_state_sync` webhook. */
export interface ContactSyncEntry {
  businessNumber: string;
  /** E.164. */
  phone: string;
  fullName?: string;
  /** "add" | "remove" (Meta may add others — kept as a string). */
  action: string;
}

export interface ParsedWebhook {
  messages: InboundWhatsAppMessage[];
  echoes: EchoMessage[];
  /** Count of delivery/read receipts (logged, not acted on in v1). */
  statusCount: number;
  accountEvents: AccountEvent[];
  /** Coexistence history sync chunks (field: "history"). */
  historyChunks: HistoryChunk[];
  /** Coexistence contact sync rows (field: "smb_app_state_sync"). */
  contactSync: ContactSyncEntry[];
}

type Json = Record<string, unknown>;

function asObject(v: unknown): Json | undefined {
  return v && typeof v === "object" ? (v as Json) : undefined;
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}
/** Meta sends numeric metadata as either a number or a numeric string. */
function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}
/** Strip a phone number down to digits so "+355 69…" and "35569…" compare equal. */
function digits(v: string): string {
  return v.replace(/\D/g, "");
}
/** Meta timestamps are UNIX seconds, usually as a string. */
function asTimestamp(v: unknown): Date | undefined {
  const secs = asNumber(v);
  if (secs === undefined || secs <= 0) return undefined;
  const d = new Date(secs * 1000);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Extract readable text from a Meta message object; non-text → placeholder. */
function messageText(m: Json): string {
  const type = asString(m.type) ?? "unknown";
  if (type === "text") {
    const body = asString(asObject(m.text)?.body);
    if (body) return body;
  }
  if (type === "button") {
    const body = asString(asObject(m.button)?.text);
    if (body) return body;
  }
  if (type === "interactive") {
    const interactive = asObject(m.interactive);
    const reply =
      asObject(interactive?.button_reply) ?? asObject(interactive?.list_reply);
    const title = asString(reply?.title);
    if (title) return title;
  }
  // v1 is text-only; surface a marker so the agent can acknowledge media it
  // can't read (it will respond in the conversation's locale regardless).
  return `[${type} message]`;
}

export function parseMetaWebhook(body: unknown): ParsedWebhook {
  const out: ParsedWebhook = {
    messages: [],
    echoes: [],
    statusCount: 0,
    accountEvents: [],
    historyChunks: [],
    contactSync: [],
  };
  const root = asObject(body);
  if (!root) return out;

  for (const entryRaw of asArray(root.entry)) {
    const entry = asObject(entryRaw);
    if (!entry) continue;
    const wabaId = asString(entry.id) ?? "";

    for (const changeRaw of asArray(entry.changes)) {
      const change = asObject(changeRaw);
      if (!change) continue;
      const field = asString(change.field);
      const value = asObject(change.value);
      if (!value) continue;

      const metadata = asObject(value.metadata);
      // We store phone_number_id in Channel.config.phoneNumberId, and the
      // resolver also matches displayPhoneNumber — prefer the id.
      const businessNumber =
        asString(metadata?.phone_number_id) ??
        asString(metadata?.display_phone_number) ??
        "";

      // Sender display names, keyed by wa_id.
      const nameByWaId = new Map<string, string>();
      for (const cRaw of asArray(value.contacts)) {
        const c = asObject(cRaw);
        const waId = asString(c?.wa_id);
        const name = asString(asObject(c?.profile)?.name);
        if (waId && name) nameByWaId.set(waId, name);
      }

      // Inbound customer messages.
      for (const mRaw of asArray(value.messages)) {
        const m = asObject(mRaw);
        if (!m) continue;
        const fromDigits = asString(m.from);
        if (!fromDigits) continue;
        out.messages.push({
          from: `+${fromDigits.replace(/\D/g, "")}`,
          businessNumber,
          text: messageText(m),
          providerMessageId: asString(m.id),
          senderName: nameByWaId.get(fromDigits),
        });
      }

      // Coexistence echoes (owner's own-phone replies). Meta has used
      // `message_echoes` / `smb_message_echoes` — accept either.
      const echoArr = [
        ...asArray(value.message_echoes),
        ...asArray(value.smb_message_echoes),
      ];
      for (const eRaw of echoArr) {
        const e = asObject(eRaw);
        if (!e) continue;
        const customerDigits =
          asString(e.to) ?? asString(e.recipient_id) ?? asString(e.wa_id);
        if (!customerDigits) continue;
        out.echoes.push({
          businessNumber,
          customer: `+${customerDigits.replace(/\D/g, "")}`,
          text: messageText(e),
          providerMessageId: asString(e.id),
        });
      }

      // Delivery/read receipts — logged only in v1.
      out.statusCount += asArray(value.statuses).length;

      // Coexistence history sync (field: "history"). One webhook carries one
      // or more chunks; each chunk holds threads of past messages.
      for (const hRaw of asArray(value.history)) {
        const h = asObject(hRaw);
        if (!h) continue;
        const hMeta = asObject(h.metadata);
        const chunk: HistoryChunk = {
          businessNumber,
          phase: asNumber(hMeta?.phase),
          chunkOrder: asNumber(hMeta?.chunk_order),
          progress: asNumber(hMeta?.progress),
          messages: [],
        };
        for (const tRaw of asArray(h.threads)) {
          const thread = asObject(tRaw);
          if (!thread) continue;
          // Thread id is the customer's wa_id; individual messages may also
          // carry it, so treat it as a fallback rather than a requirement.
          const threadCustomer = asString(thread.id);
          for (const mRaw of asArray(thread.messages)) {
            const m = asObject(mRaw);
            if (!m) continue;
            const from = asString(m.from);
            const to = asString(m.to);
            // `to` present ⇒ the business sent it. Fall back to matching the
            // sender against the business number for defensive robustness.
            const fromBusiness =
              !!to || (!!from && digits(from) === digits(businessNumber));
            const counterparty = fromBusiness ? (to ?? threadCustomer) : from;
            if (!counterparty) continue;
            chunk.messages.push({
              businessNumber,
              customer: `+${digits(counterparty)}`,
              text: messageText(m),
              providerMessageId: asString(m.id),
              fromBusiness,
              sentAt: asTimestamp(m.timestamp),
            });
          }
        }
        out.historyChunks.push(chunk);
      }

      // Coexistence contact sync (field: "smb_app_state_sync").
      for (const sRaw of asArray(value.state_sync)) {
        const s = asObject(sRaw);
        if (!s) continue;
        if (asString(s.type) !== "contact") continue;
        const c = asObject(s.contact);
        const phone = asString(c?.phone_number);
        if (!phone) continue;
        out.contactSync.push({
          businessNumber,
          phone: `+${digits(phone)}`,
          fullName: asString(c?.full_name) ?? asString(c?.first_name),
          action: asString(s.action) ?? "add",
        });
      }

      // WABA lifecycle events.
      const eventName = asString(value.event);
      if (field === "account_update" && eventName) {
        out.accountEvents.push({ wabaId, event: eventName });
      }
    }
  }

  return out;
}
