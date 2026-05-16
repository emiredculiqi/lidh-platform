import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  runAgent,
  type AgentContext,
  type AgentMessage,
  type ToolInvocation,
  type ToolName,
  type ToolOutcome,
} from "@lidh/core";
import { PrismaService } from "../../common/prisma/prisma.service";
import { RetrievalService } from "../../chat/retrieval.service";
import {
  WHATSAPP_TRANSPORT,
  type InboundWhatsAppMessage,
  type WhatsAppTransport,
} from "./transport";

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
    @Inject(WHATSAPP_TRANSPORT)
    private readonly transport: WhatsAppTransport,
  ) {}

  /** Handle one inbound WhatsApp message end-to-end. */
  async handleInbound(msg: InboundWhatsAppMessage): Promise<void> {
    const db = this.prisma.client;

    // Resolve tenant via the WhatsApp channel whose config.phoneNumberId (or
    // displayPhoneNumber) matches the business number that received the msg.
    const channel = await db.channel.findFirst({
      where: {
        kind: "whatsapp",
        status: "connected",
        OR: [
          { config: { path: ["phoneNumberId"], equals: msg.businessNumber } },
          {
            config: {
              path: ["displayPhoneNumber"],
              equals: msg.businessNumber,
            },
          },
        ],
      },
    });
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
    }

    // Persist inbound BEFORE running the agent (ADR-001 #5).
    await db.message.create({
      data: {
        conversationId: conversation.id,
        tenantId: tenant.id,
        role: "user",
        contentText: msg.text,
      },
    });

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
    await db.conversation.update({
      where: { id: conversation.id },
      data: { lastMsgAt: new Date() },
    });

    await this.transport.sendText(msg.from, reply);
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
