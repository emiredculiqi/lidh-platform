import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  runAgent,
  extractContact,
  type AgentContext,
  type AgentMessage,
  type ToolInvocation,
  type ToolName,
  type ToolOutcome,
} from "@lidh/core";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CryptoService } from "../../common/crypto/crypto.service";
import { LiveService } from "../../common/live/live.service";
import { RetrievalService } from "../../chat/retrieval.service";
import {
  WHATSAPP_TRANSPORT,
  type InboundWhatsAppMessage,
  type WhatsAppTransport,
} from "./transport";
import type { AccountEvent, EchoMessage } from "./meta-webhook.parser";
import { loadTenantEntitlements } from "../../tenants/entitlements";

const ALL_TOOLS: ToolName[] = ["capture_lead", "request_human_handoff"];

/**
 * WhatsApp channel orchestration. Same brain as web (@lidh/core runAgent),
 * different envelope: non-streaming (collect the full reply, then send via
 * the WhatsAppTransport port). Provider-agnostic — knows nothing about
 * WhatChimp/Meta.
 *
 * NOTE: the parse helpers + executeTool here mirror ChatService. A shared
 * AgentOrchestrator is a deferred refactor (ADR-004) — kept separate now to
 * avoid disturbing the verified web path under autonomous build.
 */
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly retrieval: RetrievalService,
    private readonly crypto: CryptoService,
    private readonly live: LiveService,
    @Inject(WHATSAPP_TRANSPORT)
    private readonly transport: WhatsAppTransport,
  ) {}

  /** Handle one inbound WhatsApp message end-to-end. */
  async handleInbound(msg: InboundWhatsAppMessage): Promise<void> {
    const db = this.prisma.client;

    // Idempotency: Meta retries webhook deliveries within seconds. If we've
    // already stored this provider message id, skip (don't double-reply).
    if (
      msg.providerMessageId &&
      (await this.isDuplicate(msg.providerMessageId))
    ) {
      this.logger.debug(`duplicate inbound ${msg.providerMessageId} — skipped`);
      return;
    }

    // Resolve tenant via the WhatsApp channel whose config.phoneNumberId (or
    // displayPhoneNumber) matches the business number that received the msg.
    const channel = await this.findConnectedChannel(msg.businessNumber);
    if (!channel) {
      this.logger.warn(
        `inbound for unknown WhatsApp number "${msg.businessNumber}" — ignored`,
      );
      return;
    }

    const tenant = await db.tenant.findUnique({
      where: { id: channel.tenantId },
    });
    const agent = await db.agent.findFirst({
      where: { tenantId: channel.tenantId },
      orderBy: { createdAt: "asc" },
    });
    if (!tenant || !agent) {
      this.logger.error(`channel ${channel.id} has no tenant/agent`);
      return;
    }
    // Archived = subscription paused (ADR-008): drop inbound silently rather
    // than auto-reply on a paused customer's WhatsApp line.
    if (tenant.status === "archived") {
      this.logger.log(
        `inbound WhatsApp for archived tenant ${tenant.slug} — ignored`,
      );
      return;
    }

    // Contact: unified by (tenantId, phone). Same human on web + WA collapses
    // to one Contact because phone is unique per tenant.
    const contact = await db.contact.upsert({
      where: {
        tenantId_phone: { tenantId: tenant.id, phone: msg.from },
      },
      update: { lastSeenAt: new Date() },
      create: {
        tenantId: tenant.id,
        phone: msg.from,
        name: msg.senderName ?? null,
        source: "whatsapp",
      },
    });

    // One open thread per customer number on this channel.
    let conversation = await db.conversation.findFirst({
      where: {
        tenantId: tenant.id,
        channelId: channel.id,
        contactId: contact.id,
        status: "open",
      },
      orderBy: { lastMsgAt: "desc" },
    });
    const locale =
      conversation?.locale ?? agent.defaultLocale ?? tenant.defaultLocale;
    if (!conversation) {
      conversation = await db.conversation.create({
        data: {
          tenantId: tenant.id,
          channelId: channel.id,
          contactId: contact.id,
          kind: "customer",
          status: "open",
          locale,
          channelRef: msg.from,
        },
      });
      // Live: light up the dashboard inbox (parity with web chat).
      this.live.publish(tenant.id, {
        type: "conversation.started",
        conversationId: conversation.id,
        channelKind: "whatsapp",
        contactName: contact.name,
      });
      await db.event.create({
        data: {
          tenantId: tenant.id,
          conversationId: conversation.id,
          kind: "conversation_started",
        },
      });
    }

    // Persist inbound BEFORE running the agent (ADR-001 #5).
    await db.message.create({
      data: {
        conversationId: conversation.id,
        tenantId: tenant.id,
        role: "user",
        contentText: msg.text,
        providerMessageId: msg.providerMessageId ?? null,
      },
    });
    this.live.publish(tenant.id, {
      type: "message",
      conversationId: conversation.id,
      role: "user",
      preview: msg.text.slice(0, 120),
    });

    // Entitlement gate (ADR-017): the inbound is now CAPTURED (stored + shown
    // in the inbox for review) — but a frozen/expired tenant, or a Basic plan
    // (WhatsApp is Premium-only), gets NO auto-reply. Freeze on the wire, not
    // the data. (Archived was already dropped earlier, before persistence.)
    const ent = await loadTenantEntitlements(db, tenant);
    if (!ent.whatsappEnabled) {
      this.logger.log(
        `inbound WhatsApp for ${tenant.slug} captured but not answered (state=${ent.state})`,
      );
      return;
    }

    // 24h customer-service window: we are REPLYING to a just-received inbound,
    // so we are always inside the free-form window here. (Window enforcement
    // matters for proactive/template sends — out of scope; tracked for M3.)

    const persona =
      (await db.agentPersona.findUnique({
        where: { agentId_locale: { agentId: agent.id, locale } },
      })) ??
      (await db.agentPersona.findFirst({
        where: { agentId: agent.id },
        orderBy: { createdAt: "asc" },
      }));
    if (!persona) {
      this.logger.error(`agent ${agent.id} has no persona`);
      return;
    }

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

    // Human takeover: the AI is paused for this thread. The inbound is already
    // persisted (and pushed live); an operator replies from the dashboard
    // (delivered back to WhatsApp in Phase 5). Do NOT run the agent — but still
    // silently capture contact details the customer volunteers. (Parity with
    // the web path, chat.service.ts.)
    if (conversation.aiPaused) {
      void this.captureDuringTakeover(
        tenant.id,
        conversation.id,
        contact.id,
        history,
        msg.text,
        agent.modelOverride ?? undefined,
      );
      return;
    }

    const knowledgeChunks = await this.retrieval.retrieve(
      tenant.id,
      msg.text,
    );

    const ctx: AgentContext = {
      locale,
      persona: persona.content,
      businessFacts: readBusinessFacts(tenant.settings),
      knowledgeChunks,
      history, // already includes this inbound (persisted above, re-read)
      toolsEnabled: parseToolsEnabled(agent.toolsEnabled),
      model: agent.modelOverride ?? undefined,
    };

    let reply = "";
    let tokensIn = 0;
    let tokensOut = 0;
    try {
      for await (const ev of runAgent(ctx, {
        anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
        executeTool: this.makeToolExecutor(
          tenant.id,
          conversation.id,
          contact.id,
        ),
      })) {
        if (ev.type === "text") reply += ev.delta;
        else if (ev.type === "usage") {
          tokensIn +=
            ev.tokensIn + ev.cacheReadTokens + ev.cacheWriteTokens;
          tokensOut += ev.tokensOut;
        } else if (ev.type === "error") {
          this.logger.error(`agent error: ${ev.message}`);
        }
      }
    } catch (err) {
      this.logger.error(
        `runAgent failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }

    if (!reply) {
      reply =
        locale === "al"
          ? "Më vjen keq, pati një problem teknik. Provoni sërish."
          : "Sorry, a technical issue occurred. Please try again.";
    }

    await db.message.create({
      data: {
        conversationId: conversation.id,
        tenantId: tenant.id,
        role: "assistant",
        contentText: reply,
        tokensIn,
        tokensOut,
      },
    });
    this.live.publish(tenant.id, {
      type: "message",
      conversationId: conversation.id,
      role: "assistant",
      preview: reply.slice(0, 120),
    });
    await db.conversation.update({
      where: { id: conversation.id },
      data: { lastMsgAt: new Date() },
    });

    // Per-tenant outbound context: the Meta phone_number_id lives on the
    // resolved Channel's config; the access token is the encrypted
    // credentialsEnc blob, decrypted here (the transport stays crypto-free).
    // Stub transport ignores ctx; MetaCloudTransport requires both.
    const cfg = (channel.config ?? {}) as { phoneNumberId?: unknown };
    const phoneNumberId =
      typeof cfg.phoneNumberId === "string" ? cfg.phoneNumberId : undefined;
    const accessToken = this.decryptToken(channel.credentialsEnc);
    await this.transport.sendText(msg.from, reply, {
      phoneNumberId,
      accessToken,
    });
  }

  /**
   * Register contact details a customer sends WHILE A HUMAN HAS TAKEN OVER.
   * The agentic loop (capture_lead) is paused during takeover, so we run a
   * cheap gated extraction instead — silently: no reply, no banner. Ported
   * from ChatService.captureDuringTakeover (WhatsApp variant persists the
   * Lead/Event but doesn't email, matching this service's capture_lead tool).
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
      if (!found.phone && !found.email) return;

      const db = this.prisma.client;
      const contact = await db.contact.findUnique({
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

      if (found.name || found.email) {
        await db.contact.update({
          where: { id: contactId },
          data: {
            name: found.name ?? undefined,
            email: found.email ?? undefined,
            lastSeenAt: new Date(),
          },
        });
      }
      await db.lead.create({
        data: {
          tenantId,
          conversationId,
          contactId,
          status: "new_",
          payload: {
            name: found.name,
            email: found.email,
            phone: found.phone,
            notes: "Captured automatically during human take-over",
          },
        },
      });
      await db.event.create({
        data: { tenantId, conversationId, kind: "lead_captured" },
      });
      this.logger.log(`take-over capture: lead saved for ${conversationId}`);
    } catch (e) {
      this.logger.error(
        `take-over capture failed: ${e instanceof Error ? e.message : "unknown"}`,
      );
    }
  }

  /** Decrypt a channel's stored Meta access token; null/invalid → undefined. */
  private decryptToken(credentialsEnc: string | null): string | undefined {
    if (!credentialsEnc) return undefined;
    try {
      return this.crypto.decrypt(credentialsEnc);
    } catch (err) {
      this.logger.error(
        `failed to decrypt channel credentials: ${
          err instanceof Error ? err.message : "unknown"
        }`,
      );
      return undefined;
    }
  }

  /** True if a message with this provider id was already recorded (dedupe). */
  private async isDuplicate(providerMessageId: string): Promise<boolean> {
    const existing = await this.prisma.client.message.findUnique({
      where: { providerMessageId },
      select: { id: true },
    });
    return existing !== null;
  }

  /** The connected whatsapp Channel whose config matches a business number. */
  private findConnectedChannel(businessNumber: string) {
    return this.prisma.client.channel.findFirst({
      where: {
        kind: "whatsapp",
        status: "connected",
        OR: [
          { config: { path: ["phoneNumberId"], equals: businessNumber } },
          { config: { path: ["displayPhoneNumber"], equals: businessNumber } },
        ],
      },
    });
  }

  /**
   * Handle a coexistence echo — a message the business OWNER sent to a
   * customer from their own WhatsApp Business App. Recorded so the dashboard
   * inbox stays in sync, but we do NOT run the agent or reply (that would
   * double-message the customer and could loop).
   */
  async handleEcho(echo: EchoMessage): Promise<void> {
    const db = this.prisma.client;
    if (
      echo.providerMessageId &&
      (await this.isDuplicate(echo.providerMessageId))
    ) {
      return;
    }
    const channel = await this.findConnectedChannel(echo.businessNumber);
    if (!channel) {
      this.logger.warn(
        `echo for unknown WhatsApp number "${echo.businessNumber}" — ignored`,
      );
      return;
    }
    const tenant = await db.tenant.findUnique({
      where: { id: channel.tenantId },
    });
    if (!tenant || tenant.status === "archived") return;

    const contact = await db.contact.upsert({
      where: { tenantId_phone: { tenantId: tenant.id, phone: echo.customer } },
      update: { lastSeenAt: new Date() },
      create: {
        tenantId: tenant.id,
        phone: echo.customer,
        source: "whatsapp",
      },
    });

    let conversation = await db.conversation.findFirst({
      where: {
        tenantId: tenant.id,
        channelId: channel.id,
        contactId: contact.id,
        status: "open",
      },
      orderBy: { lastMsgAt: "desc" },
    });
    if (!conversation) {
      conversation = await db.conversation.create({
        data: {
          tenantId: tenant.id,
          channelId: channel.id,
          contactId: contact.id,
          kind: "customer",
          status: "open",
          locale: tenant.defaultLocale,
          channelRef: echo.customer,
        },
      });
    }

    // Tag as an operator (human) message — same shape as web operator replies
    // — so the dashboard shows it as sent-by-business, not by the AI.
    await db.message.create({
      data: {
        conversationId: conversation.id,
        tenantId: tenant.id,
        role: "assistant",
        contentText: echo.text,
        contentJson: { human: true, by: "owner_device" },
        providerMessageId: echo.providerMessageId ?? null,
      },
    });
    await db.conversation.update({
      where: { id: conversation.id },
      data: { lastMsgAt: new Date() },
    });
    this.live.publish(tenant.id, {
      type: "message",
      conversationId: conversation.id,
      role: "assistant",
      preview: echo.text.slice(0, 120),
    });
  }

  /**
   * Handle a WABA lifecycle event (coexistence offboard / reconnect). Flips
   * the channel status so inbound is (not) served and the dashboard reflects
   * it. Matched by config.wabaId.
   */
  async handleAccountEvent(evt: AccountEvent): Promise<void> {
    const db = this.prisma.client;
    const channel = await db.channel.findFirst({
      where: {
        kind: "whatsapp",
        config: { path: ["wabaId"], equals: evt.wabaId },
      },
    });
    if (!channel) {
      this.logger.warn(
        `account event for unknown WABA "${evt.wabaId}" — ignored`,
      );
      return;
    }
    const e = evt.event.toLowerCase();
    if (
      e.includes("offboard") ||
      e.includes("disable") ||
      e.includes("delete")
    ) {
      await db.channel.update({
        where: { id: channel.id },
        data: { status: "disconnected" },
      });
      await db.event.create({
        data: {
          tenantId: channel.tenantId,
          kind: "channel_disconnected",
          meta: { wabaId: evt.wabaId, event: evt.event },
        },
      });
      this.logger.log(
        `WABA ${evt.wabaId} offboarded → channel ${channel.id} disconnected`,
      );
    } else if (e.includes("reconnect") || e.includes("restore")) {
      await db.channel.update({
        where: { id: channel.id },
        data: { status: "connected" },
      });
      await db.event.create({
        data: {
          tenantId: channel.tenantId,
          kind: "channel_connected",
          meta: { wabaId: evt.wabaId, event: evt.event },
        },
      });
      this.logger.log(
        `WABA ${evt.wabaId} reconnected → channel ${channel.id} connected`,
      );
    } else {
      this.logger.debug(
        `WABA ${evt.wabaId} event "${evt.event}" — no status change`,
      );
    }
  }

  private makeToolExecutor(
    tenantId: string,
    conversationId: string,
    contactId: string,
  ) {
    const db = this.prisma.client;
    return async (inv: ToolInvocation): Promise<ToolOutcome> => {
      try {
        if (inv.name === "capture_lead") {
          const { name, email, phone, notes } = inv.input as Record<
            string,
            string | undefined
          >;
          if (name || email) {
            await db.contact.update({
              where: { id: contactId },
              data: {
                name: name ?? undefined,
                email: email ?? undefined,
                lastSeenAt: new Date(),
              },
            });
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
          return {
            result:
              "Lead saved. Thank the customer and let them know someone will follow up.",
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
          return {
            result:
              "Handoff recorded. Tell the customer a teammate will reply shortly.",
            effect: { type: "human_handoff" },
          };
        }
        return { result: `Unknown tool: ${inv.name}` };
      } catch (err) {
        this.logger.error(
          `tool ${inv.name} failed: ${err instanceof Error ? err.message : "unknown"}`,
        );
        return { result: "The action could not be completed." };
      }
    };
  }
}

function parseToolsEnabled(value: unknown): ToolName[] {
  if (!value || typeof value !== "object") return ALL_TOOLS;
  const obj = value as Record<string, unknown>;
  const enabled = ALL_TOOLS.filter((t) => obj[t] !== false);
  return enabled.length ? enabled : ALL_TOOLS;
}

function readBusinessFacts(settings: unknown): string {
  if (settings && typeof settings === "object") {
    const f = (settings as Record<string, unknown>).businessFacts;
    if (typeof f === "string") return f;
  }
  return "";
}
