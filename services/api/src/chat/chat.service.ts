import { Injectable, Logger } from "@nestjs/common";
import {
  runAgent,
  extractContact,
  type AgentContext,
  type AgentMessage,
  type ToolName,
  type ToolInvocation,
  type ToolOutcome,
} from "@lidh/core";
import { PrismaService } from "../common/prisma/prisma.service";
import { MailService } from "../common/mail/mail.service";
import { LiveService } from "../common/live/live.service";
import { RetrievalService } from "./retrieval.service";
import {
  PropertySearchService,
  type PropertyFilters,
} from "./property-search.service";
import type { ChatWebRequestDto } from "./dto/chat-web-request.dto";
import { loadTenantEntitlements } from "../tenants/entitlements";

/** Client-facing stream events (controller maps these to SSE). `usage` is
 *  handled internally for token billing and never reaches the client. */
export type ChatStreamEvent =
  | { kind: "meta"; conversationId: string }
  | { kind: "text"; delta: string }
  | { kind: "effect"; effect: { type: string; takeover?: boolean } }
  | { kind: "done" }
  | { kind: "error"; message: string };

// Default-on tools (opt-out: included unless explicitly set false on the
// tenant's Agent.toolsEnabled). The vertical tool `search_properties` is NOT
// here — it's opt-IN (see OPT_IN_TOOLS) so only real-estate tenants get it.
const DEFAULT_ON_TOOLS: ToolName[] = ["capture_lead", "request_human_handoff"];
const OPT_IN_TOOLS: ToolName[] = ["search_properties"];

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly retrieval: RetrievalService,
    private readonly propertySearch: PropertySearchService,
    private readonly mail: MailService,
    private readonly live: LiveService,
  ) {}

  /**
   * Orchestrates one web chat turn end-to-end:
   *   resolve tenant → channel → conversation/contact → persist user msg →
   *   RAG retrieve → run @lidh/core → persist assistant msg + tokens.
   * Yields client events; consumes core's `usage`/persistence internally.
   */
  async *runWeb(
    dto: ChatWebRequestDto,
    origin?: string,
  ): AsyncGenerator<ChatStreamEvent> {
    const db = this.prisma.client;

    const tenant = await db.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });
    if (!tenant) {
      yield { kind: "error", message: "tenant_not_found" };
      return;
    }
    // Entitlement gate (ADR-017): the web widget + funnel serve only when the
    // tenant is live — trialing, in grace, or on any paid plan. Archived, or an
    // expired trial past its grace window, gets the "offline" signal and no
    // agent run (parity with getFunnel's isActive). Replaces the old
    // archived-only check, which let lapsed trials keep replying for free.
    const ent = await loadTenantEntitlements(db, tenant);
    if (!ent.chatEnabled) {
      yield { kind: "error", message: "tenant_inactive" };
      return;
    }

    const channel = await db.channel.findUnique({
      where: { tenantId_kind: { tenantId: tenant.id, kind: "web" } },
    });
    if (!channel) {
      yield { kind: "error", message: "web_channel_not_configured" };
      return;
    }

    // Per-tenant widget origin gate. The chat endpoint is CORS-open (the
    // preflight can't carry the tenant slug), so we enforce the tenant's
    // allow-list here instead. Empty list = open to any site; Lidh.al's own
    // origins (funnel + dashboard) and localhost always pass.
    const allowedOrigins = readAllowedOrigins(channel.config);
    if (
      allowedOrigins.length > 0 &&
      origin &&
      !isOriginAllowed(origin, allowedOrigins)
    ) {
      yield { kind: "error", message: "origin_not_allowed" };
      return;
    }

    const agent = await db.agent.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "asc" },
    });
    if (!agent) {
      yield { kind: "error", message: "agent_not_configured" };
      return;
    }

    const locale = dto.locale || agent.defaultLocale || tenant.defaultLocale;

    // Persona: requested locale → agent default → any. Error if none exist.
    const persona =
      (await db.agentPersona.findUnique({
        where: { agentId_locale: { agentId: agent.id, locale } },
      })) ??
      (await db.agentPersona.findFirst({
        where: { agentId: agent.id },
        orderBy: { createdAt: "asc" },
      }));
    if (!persona) {
      yield { kind: "error", message: "agent_persona_missing" };
      return;
    }

    // ── Resolve or create the conversation + contact ──────────────────────
    let conversation = dto.conversationId
      ? await db.conversation.findFirst({
          where: {
            id: dto.conversationId,
            tenantId: tenant.id,
            channelId: channel.id,
          },
        })
      : dto.sessionRef
        ? await db.conversation.findFirst({
            where: {
              tenantId: tenant.id,
              channelId: channel.id,
              channelRef: dto.sessionRef,
              status: "open",
            },
            orderBy: { lastMsgAt: "desc" },
          })
        : null;

    if (!conversation) {
      const contact = await db.contact.create({
        data: {
          tenantId: tenant.id,
          source: "web",
          meta: dto.sessionRef ? { sessionRef: dto.sessionRef } : {},
        },
      });
      conversation = await db.conversation.create({
        data: {
          tenantId: tenant.id,
          channelId: channel.id,
          contactId: contact.id,
          kind: "customer",
          status: "open",
          locale,
          channelRef: dto.sessionRef ?? null,
        },
      });
      // Live: a brand-new conversation just started.
      this.live.publish(tenant.id, {
        type: "conversation.started",
        conversationId: conversation.id,
        channelKind: channel.kind,
      });
      // Persist it to the activity log (powers the notifications feed).
      await db.event.create({
        data: {
          tenantId: tenant.id,
          conversationId: conversation.id,
          kind: "conversation_started",
        },
      });
    }

    yield { kind: "meta", conversationId: conversation.id };

    // ── Load history (user/assistant text only) ───────────────────────────
    const priorMsgs = await db.message.findMany({
      where: {
        conversationId: conversation.id,
        role: { in: ["user", "assistant"] },
      },
      orderBy: { createdAt: "asc" },
      take: 40,
    });
    const history: AgentMessage[] = priorMsgs
      .filter((m) => m.contentText)
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.contentText as string,
      }));

    // ── Persist the user message BEFORE running the agent (ADR-001 #5) ────
    await db.message.create({
      data: {
        conversationId: conversation.id,
        tenantId: tenant.id,
        role: "user",
        contentText: dto.message,
      },
    });
    this.live.publish(tenant.id, {
      type: "message",
      conversationId: conversation.id,
      role: "user",
      preview: dto.message.slice(0, 120),
    });

    // Human takeover: the AI is paused for this conversation. Store the
    // visitor's message (done above) and stop — a human replies from the
    // dashboard, delivered to the widget via its receive-stream.
    if (conversation.aiPaused) {
      // The agent loop won't run, but still register contact details the
      // visitor provides — gated extraction, persisted silently in the
      // background (no reply, no banner). Fire-and-forget so it adds no
      // latency to the handoff stream.
      void this.captureDuringTakeover(
        tenant.id,
        conversation.id,
        conversation.contactId,
        [...history, { role: "user", content: dto.message }],
        dto.message,
        agent.modelOverride ?? undefined,
      );
      // `takeover: true` tells the widget a human is ALREADY handling this
      // thread (their reply arrives via the receive-stream), so it suppresses
      // the "connecting you to a person" banner — that's only meaningful for an
      // AI-initiated handoff, not while an operator is actively replying.
      yield { kind: "effect", effect: { type: "human_handoff", takeover: true } };
      yield { kind: "done" };
      return;
    }

    // ── RAG retrieval (shell-side) ────────────────────────────────────────
    // Use the last couple of user turns as context so a short follow-up
    // ("for my face, anti-wrinkle") still retrieves against what the visitor
    // asked for earlier in the thread ("a cream") — otherwise the attribute-
    // only message embeds poorly and matches the wrong products.
    const recentUserText = history
      .filter((m) => m.role === "user")
      .slice(-2)
      .map((m) => m.content)
      .join(" ");
    const retrievalQuery = `${recentUserText} ${dto.message}`.trim().slice(0, 1000);
    const knowledgeChunks = await this.retrieval.retrieve(
      tenant.id,
      retrievalQuery,
    );

    // ── Build core context ───────────────────────────────────────────────
    const toolsEnabled = parseToolsEnabled(agent.toolsEnabled);
    const businessFacts = readBusinessFacts(tenant.settings);

    const ctx: AgentContext = {
      locale,
      persona: persona.content,
      businessFacts,
      knowledgeChunks,
      history: [...history, { role: "user", content: dto.message }],
      toolsEnabled,
      model: agent.modelOverride ?? undefined,
    };

    const executeTool = this.makeToolExecutor(
      tenant.id,
      conversation.id,
      conversation.contactId,
      locale,
    );

    // ── Run the agent; stream + accumulate for persistence ────────────────
    let assistantText = "";
    let tokensIn = 0;
    let tokensOut = 0;

    try {
      for await (const ev of runAgent(ctx, {
        anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
        executeTool,
      })) {
        if (ev.type === "text") {
          assistantText += ev.delta;
          yield { kind: "text", delta: ev.delta };
        } else if (ev.type === "effect") {
          yield { kind: "effect", effect: ev.effect };
        } else if (ev.type === "usage") {
          tokensIn += ev.tokensIn + ev.cacheReadTokens + ev.cacheWriteTokens;
          tokensOut += ev.tokensOut;
        } else if (ev.type === "error") {
          yield { kind: "error", message: ev.message };
        }
        // "done" handled after the loop
      }
    } catch (err) {
      this.logger.error(
        `runAgent failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
      yield { kind: "error", message: "chat_failed" };
    }

    // ── Persist the assistant message AFTER (ADR-001 #5) ──────────────────
    if (assistantText) {
      await db.message.create({
        data: {
          conversationId: conversation.id,
          tenantId: tenant.id,
          role: "assistant",
          contentText: assistantText,
          tokensIn,
          tokensOut,
        },
      });
      this.live.publish(tenant.id, {
        type: "message",
        conversationId: conversation.id,
        role: "assistant",
        preview: assistantText.slice(0, 120),
      });
    }
    await db.conversation.update({
      where: { id: conversation.id },
      data: { lastMsgAt: new Date() },
    });

    yield { kind: "done" };
  }

  /** The injected port (ADR-001 #2). Persists Lead/Event; no email in 2.1
   *  (the SMB reviews leads in the dashboard — email notify is a later step). */
  private makeToolExecutor(
    tenantId: string,
    conversationId: string,
    contactId: string,
    locale: string,
  ) {
    const db = this.prisma.client;
    return async (inv: ToolInvocation): Promise<ToolOutcome> => {
      try {
        if (inv.name === "capture_lead") {
          const { name, email, phone, notes } = inv.input as Record<
            string,
            string | undefined
          >;
          await this.persistLead(
            tenantId,
            conversationId,
            contactId,
            { name, email, phone, notes },
            inv.transcript,
          );
          return {
            result:
              "Lead saved to the business dashboard. Thank the visitor and let them know someone will follow up.",
            effect: { type: "lead_captured" },
          };
        }

        if (inv.name === "request_human_handoff") {
          const { reason, summary } = inv.input as Record<string, string>;
          await db.event.create({
            data: {
              tenantId,
              conversationId,
              kind: "human_handoff_requested",
              meta: { reason, summary },
            },
          });
          void this.mail
            .notifyHandoff(tenantId, { reason, summary }, inv.transcript)
            .catch((e) =>
              this.logger.error(
                `handoff email failed: ${e instanceof Error ? e.message : "unknown"}`,
              ),
            );
          return {
            result:
              "Handoff recorded for the team. Tell the visitor a teammate will reply shortly; do not promise an exact time.",
            effect: { type: "human_handoff" },
          };
        }

        if (inv.name === "search_properties") {
          // Read-only structured search over the tenant's Property inventory.
          // The model passes typed filters; the service returns a compact,
          // model-ready text block (with verbatim listing URLs + a header
          // saying whether results are exact or widened alternatives).
          const result = await this.propertySearch.search(
            tenantId,
            coercePropertyFilters(inv.input),
            locale,
          );
          return { result };
        }

        return { result: `Unknown tool: ${inv.name}` };
      } catch (err) {
        this.logger.error(
          `tool ${inv.name} failed: ${err instanceof Error ? err.message : "unknown"}`,
        );
        return {
          result:
            "The action could not be completed. Apologize briefly and suggest the visitor leave their email.",
        };
      }
    };
  }

  /** Shared lead persistence used by both the `capture_lead` tool and the
   *  silent take-over capture: enrich the conversation's contact, create the
   *  Lead + Event, and notify the business by email (fire-and-forget). */
  private async persistLead(
    tenantId: string,
    conversationId: string,
    contactId: string,
    fields: { name?: string; email?: string; phone?: string; notes?: string },
    transcript: string,
  ): Promise<void> {
    const db = this.prisma.client;
    const { name, email, phone, notes } = fields;
    if (name || email || phone) {
      // Was this contact still anonymous before now? If so, this write is the
      // moment it becomes a real contact → emit a `contact_registered` event.
      const before = await db.contact.findUnique({
        where: { id: contactId },
        select: { name: true, phone: true, email: true },
      });
      const wasAnonymous = !before?.name && !before?.phone && !before?.email;
      await db.contact.update({
        where: { id: contactId },
        data: {
          name: name ?? undefined,
          email: email ?? undefined,
          phone: phone ?? undefined,
          lastSeenAt: new Date(),
        },
      });
      if (wasAnonymous) {
        await db.event.create({
          data: { tenantId, conversationId, kind: "contact_registered" },
        });
        this.live.publish(tenantId, { type: "contact_registered", conversationId });
      }
    }
    await db.lead.create({
      data: {
        tenantId,
        conversationId,
        contactId,
        status: "new_",
        payload: { name, email, phone, notes },
      },
    });
    await db.event.create({
      data: { tenantId, conversationId, kind: "lead_captured" },
    });
    this.live.publish(tenantId, { type: "lead_captured", conversationId });
    // Notify the business by email (fire-and-forget — must not block or fail
    // the reply if email is down/unconfigured).
    void this.mail
      .notifyLead(tenantId, { name, email, phone, notes }, transcript)
      .catch((e) =>
        this.logger.error(
          `lead email failed: ${e instanceof Error ? e.message : "unknown"}`,
        ),
      );
  }

  /**
   * Register contact details a visitor types WHILE A HUMAN HAS TAKEN OVER.
   * The agentic loop (and thus `capture_lead`) is paused during a take-over,
   * so we run a cheap, gated extraction here instead — silently: no reply and
   * no visitor-facing banner, since an operator is already in the thread.
   *
   * Fire-and-forget from the request path; errors are swallowed and logged so
   * they never disturb the handoff stream.
   */
  private async captureDuringTakeover(
    tenantId: string,
    conversationId: string,
    contactId: string,
    messages: AgentMessage[],
    latestMessage: string,
    model: string | undefined,
  ): Promise<void> {
    try {
      // Cost gate: only spend an extraction call when the latest message
      // actually carries a contact signal — an email or a 6+ digit run.
      const hasSignal =
        /\S+@\S+\.\S+/.test(latestMessage) ||
        /\d[\d\s().+-]{5,}\d/.test(latestMessage);
      if (!hasSignal) return;

      const found = await extractContact({
        anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
        messages,
        model,
      });
      // Need at least a reachable detail for the lead to be worth creating.
      if (!found.phone && !found.email) return;

      // Dedup: skip if neither field adds anything new to the contact (e.g.
      // the visitor just repeated a number they already gave).
      const contact = await this.prisma.client.contact.findUnique({
        where: { id: contactId },
        select: { phone: true, email: true },
      });
      const digits = (s?: string | null) => s?.replace(/\D/g, "") || undefined;
      const lower = (s?: string | null) => s?.trim().toLowerCase() || undefined;
      const addsPhone =
        !!found.phone && digits(found.phone) !== digits(contact?.phone);
      const addsEmail =
        !!found.email && lower(found.email) !== lower(contact?.email);
      if (!addsPhone && !addsEmail) return;

      const transcript = messages
        .slice(-12)
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n");
      await this.persistLead(
        tenantId,
        conversationId,
        contactId,
        {
          name: found.name,
          email: found.email,
          phone: found.phone,
          notes: "Captured automatically during human take-over",
        },
        transcript,
      );
      this.logger.log(`take-over capture: lead saved for ${conversationId}`);
    } catch (e) {
      this.logger.error(
        `take-over capture failed: ${e instanceof Error ? e.message : "unknown"}`,
      );
    }
  }
}

function parseToolsEnabled(value: unknown): ToolName[] {
  if (!value || typeof value !== "object") return DEFAULT_ON_TOOLS;
  const obj = value as Record<string, unknown>;
  // Default-on tools are included unless explicitly disabled.
  const enabled = DEFAULT_ON_TOOLS.filter((t) => obj[t] !== false);
  // Opt-in tools (vertical) only when explicitly enabled.
  for (const t of OPT_IN_TOOLS) if (obj[t] === true) enabled.push(t);
  return enabled.length ? enabled : DEFAULT_ON_TOOLS;
}

/** Coerce the model's free-form tool input into typed PropertyFilters,
 *  dropping empties and clamping numbers so a bad value can't break the SQL. */
function coercePropertyFilters(input: Record<string, unknown>): PropertyFilters {
  const str = (v: unknown): string | undefined => {
    const s = typeof v === "string" ? v.trim() : "";
    return s.length ? s : undefined;
  };
  const num = (v: unknown): number | undefined => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const listingType =
    input.listingType === "sale" || input.listingType === "rent"
      ? input.listingType
      : undefined;
  return {
    listingType,
    city: str(input.city),
    area: str(input.area),
    propertyType: str(input.propertyType),
    minPrice: num(input.minPrice),
    maxPrice: num(input.maxPrice),
    bedrooms: num(input.bedrooms),
    bathrooms: num(input.bathrooms),
    minAreaSqm: num(input.minAreaSqm),
    maxAreaSqm: num(input.maxAreaSqm),
  };
}

/** Read allowedOrigins out of a web channel's JSON config. */
function readAllowedOrigins(config: unknown): string[] {
  if (config && typeof config === "object") {
    const v = (config as Record<string, unknown>).allowedOrigins;
    if (Array.isArray(v)) {
      return v.filter((x): x is string => typeof x === "string");
    }
  }
  return [];
}

/** Is this request Origin allowed to embed the widget? Lidh.al's own pages
 *  and localhost always pass; otherwise the origin must be in the list. */
function isOriginAllowed(origin: string, allowed: string[]): boolean {
  const o = origin.replace(/\/+$/, "");
  try {
    const host = new URL(o).hostname;
    if (
      host === "lidh.al" ||
      host.endsWith(".lidh.al") ||
      host === "localhost" ||
      host === "127.0.0.1"
    ) {
      return true;
    }
  } catch {
    // not a parseable origin — fall through to an exact match
  }
  return allowed.some((a) => a.replace(/\/+$/, "") === o);
}

function readBusinessFacts(settings: unknown): string {
  if (settings && typeof settings === "object") {
    const f = (settings as Record<string, unknown>).businessFacts;
    if (typeof f === "string") return f;
  }
  return "";
}
