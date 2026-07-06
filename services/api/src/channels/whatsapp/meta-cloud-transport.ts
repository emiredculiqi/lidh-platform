import { Injectable, Logger } from "@nestjs/common";
import type { OutboundContext, WhatsAppTransport } from "./transport";

/** Default Graph API version; override with META_GRAPH_VERSION. */
const DEFAULT_GRAPH_VERSION = "v22.0";

/**
 * Error thrown when Meta's Graph API rejects a send. Carries the Graph
 * `code`/`subcode` so callers can branch:
 *   - 190             → access token expired/invalid → mark channel errored,
 *                       prompt reconnect.
 *   - 131047/131051   → outside the 24h customer-service window (a free-form
 *                       message needs the customer to message first, or a
 *                       pre-approved template) → surface to the operator.
 */
export class MetaSendError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly subcode?: number,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "MetaSendError";
  }

  /** Access token expired or revoked — the channel must be reconnected. */
  get isTokenExpired(): boolean {
    return this.code === 190;
  }

  /** Free-form send blocked because we're outside the 24h service window. */
  get isOutsideWindow(): boolean {
    return this.code === 131047 || this.code === 131051;
  }
}

/**
 * Meta WhatsApp Cloud API outbound transport (direct Tech Provider path).
 * Sends a free-form session-text reply via
 *   POST https://graph.facebook.com/{version}/{phoneNumberId}/messages
 * within the 24h customer-service window (the agent always replies to a
 * just-received inbound, so we're always inside it; operator replies may not
 * be — see MetaSendError.isOutsideWindow).
 *
 * PURE CLIENT: no DB, no crypto. The per-tenant phone_number_id and decrypted
 * access token arrive via OutboundContext (the service reads them from the
 * resolved Channel). Which business is sending is entirely in ctx.
 */
@Injectable()
export class MetaCloudTransport implements WhatsAppTransport {
  private readonly logger = new Logger("WhatsApp:MetaCloud");
  private readonly graphVersion: string;

  constructor() {
    this.graphVersion = (
      process.env.META_GRAPH_VERSION || DEFAULT_GRAPH_VERSION
    ).replace(/^\/|\/$/g, "");
  }

  async sendText(
    to: string,
    text: string,
    ctx?: OutboundContext,
  ): Promise<void> {
    const phoneNumberId = ctx?.phoneNumberId;
    const accessToken = ctx?.accessToken;
    if (!phoneNumberId) {
      throw new MetaSendError(
        "Meta send: missing phoneNumberId — set it on the tenant's " +
          "whatsapp Channel.config.phoneNumberId",
      );
    }
    if (!accessToken) {
      throw new MetaSendError(
        "Meta send: missing accessToken — the tenant's whatsapp " +
          "Channel.credentialsEnc is empty or failed to decrypt",
      );
    }
    // Graph wants the recipient in E.164 digits (no leading +).
    const recipient = to.replace(/^\+/, "").replace(/\D/g, "");
    if (!recipient) {
      throw new MetaSendError(`Meta send: invalid phone "${to}"`);
    }

    const url = `https://graph.facebook.com/${this.graphVersion}/${phoneNumberId}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient,
      type: "text",
      text: { preview_url: false, body: text },
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      throw new MetaSendError(
        `Meta send: network error (${(e as Error).message})`,
      );
    }

    const raw = await res.text();
    let parsed:
      | {
          messages?: { id?: string }[];
          error?: {
            message?: string;
            code?: number;
            error_subcode?: number;
          };
        }
      | undefined;
    try {
      parsed = raw ? JSON.parse(raw) : undefined;
    } catch {
      throw new MetaSendError(
        `Meta send: non-JSON response (HTTP ${res.status}) — ${raw.slice(0, 200)}`,
        undefined,
        undefined,
        res.status,
      );
    }

    if (!res.ok || parsed?.error) {
      const err = parsed?.error;
      throw new MetaSendError(
        `Meta send rejected (HTTP ${res.status}): ${err?.message ?? raw.slice(0, 200)}`,
        err?.code,
        err?.error_subcode,
        res.status,
      );
    }

    const waMessageId = parsed?.messages?.[0]?.id;
    this.logger.log(
      `OUTBOUND → ${recipient}: ${text.slice(0, 80)}${text.length > 80 ? "…" : ""}` +
        (waMessageId ? ` [${waMessageId}]` : ""),
    );
  }
}
