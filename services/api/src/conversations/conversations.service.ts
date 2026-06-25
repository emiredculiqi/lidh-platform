import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { TenantContextService } from "../common/tenant-context/tenant-context.service";
import { LiveService } from "../common/live/live.service";
import { assertCanAccessTenant } from "../common/auth/access";
import type {
  ConversationListItemDto,
  ThreadDto,
} from "./dto/conversation.dto";

/** Read-side for the dashboard inbox. Returns own DTO shapes (no Prisma
 *  type leak → portable .d.ts, no TS2742). */
@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContextService,
    private readonly live: LiveService,
  ) {}

  /** Take over a conversation (pause the AI) or hand it back (resume). */
  async setAi(id: string, paused: boolean): Promise<{ aiPaused: boolean }> {
    const db = this.prisma.client;
    const conv = await db.conversation.findUnique({
      where: { id },
      select: { id: true, tenantId: true },
    });
    if (!conv) throw new NotFoundException("conversation_not_found");
    assertCanAccessTenant(this.ctx.get(), conv.tenantId);
    const userId = this.ctx.get().userId ?? null;

    await db.conversation.update({
      where: { id },
      data: { aiPaused: paused, assignedToUserId: paused ? userId : null },
    });
    await db.event.create({
      data: {
        tenantId: conv.tenantId,
        conversationId: id,
        kind: paused ? "agent_paused" : "agent_resumed",
      },
    });
    // Nudge other dashboard viewers to refresh.
    this.live.publish(conv.tenantId, {
      type: paused ? "ai_paused" : "ai_resumed",
      conversationId: id,
    });
    return { aiPaused: paused };
  }

  /** A human agent sends a reply into a (taken-over) conversation. Stored as
   *  an assistant message tagged human-authored, and pushed to BOTH the
   *  dashboard live stream and the visitor's widget receive-stream. */
  async reply(id: string, text: string): Promise<{ ok: true }> {
    const db = this.prisma.client;
    const trimmed = text.trim();
    if (!trimmed) throw new BadRequestException("empty_reply");
    const conv = await db.conversation.findUnique({
      where: { id },
      select: { id: true, tenantId: true },
    });
    if (!conv) throw new NotFoundException("conversation_not_found");
    assertCanAccessTenant(this.ctx.get(), conv.tenantId);

    await db.message.create({
      data: {
        conversationId: id,
        tenantId: conv.tenantId,
        role: "assistant",
        contentText: trimmed,
        contentJson: { human: true, by: this.ctx.get().userId ?? null },
      },
    });
    await db.conversation.update({
      where: { id },
      data: { lastMsgAt: new Date() },
    });

    // Dashboard refresh:
    this.live.publish(conv.tenantId, {
      type: "message",
      conversationId: id,
      role: "assistant",
      preview: trimmed.slice(0, 120),
    });
    // Push to the visitor's widget (it subscribes to `conv:<id>`):
    this.live.publish(`conv:${id}`, {
      type: "agent_message",
      conversationId: id,
      text: trimmed,
    });
    return { ok: true };
  }

  async list(
    tenantSlug: string,
    includePreview = false,
  ): Promise<ConversationListItemDto[]> {
    const db = this.prisma.client;
    const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException("tenant_not_found");
    assertCanAccessTenant(this.ctx.get(), tenant.id);

    const rows = await db.conversation.findMany({
      where: {
        tenantId: tenant.id,
        ...(includePreview ? {} : { kind: "customer" }),
      },
      orderBy: { lastMsgAt: "desc" },
      take: 100,
      include: {
        contact: { select: { name: true, phone: true } },
        channel: { select: { kind: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { contentText: true },
        },
        _count: { select: { messages: true } },
      },
    });

    return rows.map((c) => ({
      id: c.id,
      channelKind: c.channel.kind,
      status: c.status,
      aiPaused: c.aiPaused,
      locale: c.locale,
      contactName: c.contact.name,
      contactPhone: c.contact.phone,
      lastMessagePreview: (c.messages[0]?.contentText ?? "")
        .replace(/\s+/g, " ")
        .slice(0, 120),
      messageCount: c._count.messages,
      lastMsgAt: c.lastMsgAt,
    }));
  }

  async getThread(id: string): Promise<ThreadDto> {
    const c = await this.prisma.client.conversation.findUnique({
      where: { id },
      include: {
        contact: { select: { id: true, name: true, phone: true, email: true } },
        channel: { select: { kind: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            role: true,
            contentText: true,
            toolName: true,
            createdAt: true,
          },
        },
      },
    });
    if (!c) throw new NotFoundException("conversation_not_found");
    assertCanAccessTenant(this.ctx.get(), c.tenantId);
    return {
      id: c.id,
      channelKind: c.channel.kind,
      status: c.status,
      aiPaused: c.aiPaused,
      locale: c.locale,
      contactId: c.contact.id,
      contactName: c.contact.name,
      contactPhone: c.contact.phone,
      contactEmail: c.contact.email,
      messages: c.messages.map((m) => ({
        role: m.role,
        contentText: m.contentText,
        toolName: m.toolName,
        createdAt: m.createdAt,
      })),
    };
  }
}
