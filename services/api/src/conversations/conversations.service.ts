import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { TenantContextService } from "../common/tenant-context/tenant-context.service";
import { LiveService } from "../common/live/live.service";
import { WhatsAppOutboundService } from "../channels/whatsapp/whatsapp-outbound.service";
import { assertCanAccessTenant } from "../common/auth/access";
import {
  effectiveResponder,
  readResponderSettings,
  resolveResponder,
  type Responder,
} from "../tenants/responder";
import type {
  ConversationListDto,
  ConversationListQueryDto,
  TeamMemberRefDto,
  ThreadDto,
  UnreadSummaryDto,
} from "./dto/conversation.dto";
import { conversationListWhere } from "./list-query";
import { TASKS_INCLUDE, taskDto } from "../contacts/contacts.service";

/** Read-side for the dashboard inbox. Returns own DTO shapes (no Prisma
 *  type leak → portable .d.ts, no TS2742). */
@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContextService,
    private readonly live: LiveService,
    private readonly whatsAppOutbound: WhatsAppOutboundService,
  ) {}

  /**
   * Set who answers this thread: `human` (take over), `ai` (hand to the
   * assistant), or `inherit` (clear the override; the business setting —
   * human by default, or the schedule — decides again). A manual override
   * wins over the schedule until cleared (ADR-020).
   */
  async setResponder(
    id: string,
    mode: "human" | "ai" | "inherit",
  ): Promise<{ aiOverride: Responder | null; aiEffective: Responder }> {
    const db = this.prisma.client;
    const conv = await db.conversation.findUnique({
      where: { id },
      select: { id: true, tenantId: true, tenant: { select: { settings: true } } },
    });
    if (!conv) throw new NotFoundException("conversation_not_found");
    assertCanAccessTenant(this.ctx.get(), conv.tenantId);
    const userId = this.ctx.get().userId ?? null;

    const aiOverride: Responder | null = mode === "inherit" ? null : mode;
    await db.conversation.update({
      where: { id },
      data: {
        aiOverride,
        // Assignment follows a takeover; anything else releases it.
        assignedToUserId: aiOverride === "human" ? userId : null,
      },
    });
    const aiEffective = effectiveResponder(
      readResponderSettings(conv.tenant.settings),
      aiOverride,
    );
    await db.event.create({
      data: {
        tenantId: conv.tenantId,
        conversationId: id,
        kind: aiEffective === "human" ? "agent_paused" : "agent_resumed",
      },
    });
    // Nudge other dashboard viewers to refresh.
    this.live.publish(conv.tenantId, {
      type: aiEffective === "human" ? "ai_paused" : "ai_resumed",
      conversationId: id,
    });
    return { aiOverride, aiEffective };
  }

  /** A human agent sends a reply into a (taken-over) conversation. Stored as
   *  an assistant message tagged human-authored, and pushed to BOTH the
   *  dashboard live stream and the visitor's widget receive-stream. */
  async reply(
    id: string,
    text: string,
    suggestion?: "used" | "edited",
  ): Promise<{ ok: true }> {
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
        // `suggestion` records whether an assistant draft was behind this
        // reply (ADR-024 §5) — the raw material for learning from approved
        // replies later.
        contentJson: {
          human: true,
          by: this.ctx.get().userId ?? null,
          ...(suggestion ? { suggestion } : {}),
        },
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
    // Deliver over WhatsApp when this is a WhatsApp thread (no-op otherwise).
    // Direct call — LiveService is single-instance, so a subscriber wouldn't
    // fire reliably across machines.
    await this.whatsAppOutbound.sendForConversation(id, trimmed);
    return { ok: true };
  }

  async list(query: ConversationListQueryDto): Promise<ConversationListDto> {
    const db = this.prisma.client;
    const tenant = await db.tenant.findUnique({
      where: { slug: query.tenantSlug },
    });
    if (!tenant) throw new NotFoundException("tenant_not_found");
    assertCanAccessTenant(this.ctx.get(), tenant.id);

    // "Who is waiting on us" is computed once, tenant-wide: it feeds the
    // Unanswered tab's count AND (when that tab is active) the filter itself,
    // so the badge and the list can never disagree. Stars are the caller's
    // own (ADR-024 §2) and bounded (a person stars a handful, not hundreds).
    const [awaitingIds, starredIds] = await Promise.all([
      this.awaitingIds(tenant.id),
      this.starredIds(tenant.id),
    ]);
    const where = conversationListWhere(
      tenant.id,
      {
        q: query.q,
        channel: query.channel,
        stage: query.stage,
        only: query.only,
        includePreview: query.includePreview === "true",
      },
      { awaiting: awaitingIds, starred: starredIds },
    );
    const include = {
      contact: {
        select: { name: true, phone: true, email: true, stage: true },
      },
      channel: { select: { kind: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      messages: {
        orderBy: { createdAt: "desc" as const },
        take: 1,
        select: { contentText: true, role: true, contentJson: true },
      },
      _count: { select: { messages: true } },
    };

    const starred = new Set(starredIds);
    const [page, starredRows, unread] = await Promise.all([
      db.conversation.findMany({
        where,
        orderBy: { lastMsgAt: "desc" },
        take: 100,
        include,
      }),
      // Starred threads must surface even when older than the newest page.
      // A second, small query (bounded by the star count) instead of an
      // ORDER BY the database can't express for "starred by THIS user".
      starredIds.length && query.only !== "favorites"
        ? db.conversation.findMany({
            where: { AND: [where, { id: { in: starredIds } }] },
            include,
          })
        : Promise.resolve([]),
      this.unreadCounts(tenant.id),
    ]);
    const seen = new Set<string>();
    const rows = [...starredRows, ...page]
      .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
      .sort((a, b) => {
        const sa = starred.has(a.id) ? 1 : 0;
        const sb = starred.has(b.id) ? 1 : 0;
        if (sa !== sb) return sb - sa; // starred first
        return b.lastMsgAt.getTime() - a.lastMsgAt.getTime();
      })
      .slice(0, 100);

    const responderSettings = readResponderSettings(tenant.settings);
    const now = new Date();
    const team = await this.teamNames(tenant.id);
    const items = rows.map((c) => ({
      id: c.id,
      channelKind: c.channel.kind,
      status: c.status,
      aiOverride: c.aiOverride,
      aiEffective: effectiveResponder(responderSettings, c.aiOverride, now),
      locale: c.locale,
      contactName: c.contact.name,
      contactPhone: c.contact.phone,
      contactEmail: c.contact.email,
      contactStage: c.contact.stage,
      // Who spoke last. "user" means the customer is waiting on the business —
      // the inbox's "Unanswered" filter and the dashboard's "Awaiting reply"
      // tile both key off this.
      lastMessageRole: c.messages[0]?.role ?? null,
      lastMessagePreview: (c.messages[0]?.contentText ?? "")
        .replace(/\s+/g, " ")
        .slice(0, 120),
      messageCount: c._count.messages,
      unreadCount: unread.get(c.id) ?? 0,
      starred: starred.has(c.id),
      lastReplyBy: c.messages[0] ? humanAuthor(c.messages[0], team) : null,
      assignedTo: c.assignedTo ? memberRef(c.assignedTo) : null,
      viewers: this.live.viewers(c.id),
      lastMsgAt: c.lastMsgAt,
    }));
    return {
      items,
      awaitingCount: awaitingIds.length,
      viewerUserId: this.ctx.get().userId ?? null,
    };
  }

  /** id → display ref for everyone on the team (a handful of rows). Human
   *  replies store only the author's id in contentJson. */
  private async teamNames(tenantId: string): Promise<Map<string, TeamMemberRefDto>> {
    const users = await this.prisma.client.user.findMany({
      where: { memberships: { some: { tenantId } } },
      select: { id: true, name: true, email: true },
    });
    return new Map(users.map((u) => [u.id, memberRef(u)]));
  }

  /** The calling user, as a viewer ref (for presence). */
  private async me(): Promise<TeamMemberRefDto | null> {
    const userId = this.ctx.get().userId;
    if (!userId) return null;
    const u = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
    return u ? memberRef(u) : null;
  }

  /** Presence heartbeat / leave for the calling user (ADR-024 §3). Returns
   *  who is on the thread now (including the caller). */
  async presence(
    id: string,
    opts: { typing?: boolean; leave?: boolean },
  ): Promise<{ viewers: { userId: string; name: string | null; typing: boolean }[] }> {
    const conv = await this.prisma.client.conversation.findUnique({
      where: { id },
      select: { tenantId: true },
    });
    if (!conv) throw new NotFoundException("conversation_not_found");
    assertCanAccessTenant(this.ctx.get(), conv.tenantId);
    const me = await this.me();
    if (!me) throw new BadRequestException("no_user");
    if (opts.leave) {
      this.live.leave(conv.tenantId, id, me.userId);
      return { viewers: this.live.viewers(id) };
    }
    return {
      viewers: this.live.heartbeat(conv.tenantId, id, me, Boolean(opts.typing)),
    };
  }

  /** The calling user's starred conversation ids in this tenant. */
  private async starredIds(tenantId: string): Promise<string[]> {
    const userId = this.ctx.get().userId;
    if (!userId) return [];
    const rows = await this.prisma.client.conversationStar.findMany({
      where: { tenantId, userId },
      select: { conversationId: true },
      take: 500,
    });
    return rows.map((r) => r.conversationId);
  }

  /** Star / unstar a thread for the calling user (ADR-024 §2). Idempotent. */
  async setStar(id: string, starred: boolean): Promise<{ starred: boolean }> {
    const db = this.prisma.client;
    const conv = await db.conversation.findUnique({
      where: { id },
      select: { tenantId: true },
    });
    if (!conv) throw new NotFoundException("conversation_not_found");
    assertCanAccessTenant(this.ctx.get(), conv.tenantId);
    const userId = this.ctx.get().userId;
    if (!userId) throw new BadRequestException("no_user");
    if (starred) {
      await db.conversationStar.upsert({
        where: { userId_conversationId: { userId, conversationId: id } },
        create: { tenantId: conv.tenantId, userId, conversationId: id },
        update: {},
      });
    } else {
      await db.conversationStar.deleteMany({
        where: { userId, conversationId: id },
      });
    }
    return { starred };
  }

  /** Open customer threads whose LATEST message is the customer's — the same
   *  definition as the dashboard's "Awaiting reply" tile (usage.service). */
  private async awaitingIds(tenantId: string): Promise<string[]> {
    const rows = await this.prisma.client.$queryRaw<{ id: string }[]>`
      SELECT c.id
        FROM "Conversation" c
       WHERE c."tenantId" = ${tenantId}
         AND c.kind = 'customer'
         AND c."intakePending" = false
         AND c.status = 'open'
         AND (
           SELECT m.role::text
             FROM "Message" m
            WHERE m."conversationId" = c.id
            ORDER BY m."createdAt" DESC
            LIMIT 1
         ) = 'user'
    `;
    return rows.map((r) => r.id);
  }

  /** Per-conversation count of unread VISITOR messages (role=user newer than
   *  the conversation's shared `lastReadAt`). One grouped query — not N+1. */
  private async unreadCounts(tenantId: string): Promise<Map<string, number>> {
    const rows = await this.prisma.client.$queryRaw<
      { conversationId: string; unread: number }[]
    >`
      SELECT m."conversationId" AS "conversationId", COUNT(*)::int AS unread
      FROM "Message" m
      JOIN "Conversation" c ON c.id = m."conversationId"
      WHERE c."tenantId" = ${tenantId}
        AND c.kind::text = 'customer'
        AND c."intakePending" = false
        AND m.role::text = 'user'
        AND (c."lastReadAt" IS NULL OR m."createdAt" > c."lastReadAt")
      GROUP BY m."conversationId"
    `;
    return new Map(rows.map((r) => [r.conversationId, Number(r.unread)]));
  }

  /** Mark a conversation read (operator opened the thread) — moves the shared
   *  read marker to now, clearing its unread count. */
  async markRead(id: string): Promise<{ ok: true }> {
    const db = this.prisma.client;
    const conv = await db.conversation.findUnique({
      where: { id },
      select: { tenantId: true },
    });
    if (!conv) throw new NotFoundException("conversation_not_found");
    assertCanAccessTenant(this.ctx.get(), conv.tenantId);
    await db.conversation.update({
      where: { id },
      data: { lastReadAt: new Date() },
    });
    return { ok: true };
  }

  /** Tenant-wide unread summary for the sidebar badge + bell:
   *  `total` = number of conversations with unread visitor messages. */
  async unreadSummary(tenantSlug: string): Promise<UnreadSummaryDto> {
    const db = this.prisma.client;
    const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException("tenant_not_found");
    assertCanAccessTenant(this.ctx.get(), tenant.id);

    const counts = await this.unreadCounts(tenant.id);
    const ids = [...counts.keys()];
    if (ids.length === 0) return { total: 0, items: [] };

    const convs = await db.conversation.findMany({
      where: { id: { in: ids } },
      orderBy: { lastMsgAt: "desc" },
      select: {
        id: true,
        lastMsgAt: true,
        contact: { select: { name: true, phone: true } },
        channel: { select: { kind: true } },
      },
    });
    const items = convs.map((c) => ({
      conversationId: c.id,
      contactName: c.contact.name ?? c.contact.phone ?? null,
      channelKind: c.channel.kind,
      unreadCount: counts.get(c.id) ?? 0,
      lastMsgAt: c.lastMsgAt,
    }));
    return { total: items.length, items };
  }

  async getThread(id: string): Promise<ThreadDto> {
    const c = await this.prisma.client.conversation.findUnique({
      where: { id },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            stage: true,
            tasks: TASKS_INCLUDE,
          },
        },
        channel: { select: { kind: true } },
        tenant: { select: { settings: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        stars: {
          where: { userId: this.ctx.get().userId ?? "" },
          select: { id: true },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            role: true,
            contentText: true,
            toolName: true,
            contentJson: true,
            createdAt: true,
          },
        },
      },
    });
    if (!c) throw new NotFoundException("conversation_not_found");
    assertCanAccessTenant(this.ctx.get(), c.tenantId);
    const responderSettings = readResponderSettings(c.tenant.settings);
    const team = await this.teamNames(c.tenantId);
    // Newest human reply, if any (scan from the end; threads are short).
    let lastHumanReplyBy: TeamMemberRefDto | null = null;
    let lastHumanReplyAt: Date | null = null;
    for (let i = c.messages.length - 1; i >= 0; i--) {
      const by = humanAuthor(c.messages[i], team);
      if (by) {
        lastHumanReplyBy = by;
        lastHumanReplyAt = c.messages[i].createdAt;
        break;
      }
    }
    return {
      id: c.id,
      channelKind: c.channel.kind,
      status: c.status,
      aiOverride: c.aiOverride,
      aiEffective: effectiveResponder(responderSettings, c.aiOverride),
      // What the business setting resolves to right now, ignoring the
      // override — lets the UI say "back to business default (human)".
      aiDefault: resolveResponder(responderSettings),
      locale: c.locale,
      contactId: c.contact.id,
      contactName: c.contact.name,
      contactPhone: c.contact.phone,
      contactEmail: c.contact.email,
      contactStage: c.contact.stage,
      starred: c.stars.length > 0,
      viewerUserId: this.ctx.get().userId ?? null,
      assignedTo: c.assignedTo ? memberRef(c.assignedTo) : null,
      lastHumanReplyBy,
      lastHumanReplyAt,
      viewers: this.live.viewers(c.id),
      tasks: c.contact.tasks.map(taskDto),
      messages: c.messages.map((m) => ({
        role: m.role,
        contentText: m.contentText,
        toolName: m.toolName,
        createdAt: m.createdAt,
      })),
    };
  }
}

/** Display ref for a team member: name, else the email. */
function memberRef(u: { id: string; name: string | null; email: string }): TeamMemberRefDto {
  return { userId: u.id, name: u.name || u.email };
}

/** If this message is a human reply (see `reply()`), who wrote it. A member
 *  who has since left the team resolves to a nameless ref, not to nothing —
 *  the reply was still a person's. */
function humanAuthor(
  m: { role: string; contentJson: unknown },
  team: Map<string, TeamMemberRefDto>,
): TeamMemberRefDto | null {
  if (m.role !== "assistant") return null;
  const j = m.contentJson as { human?: unknown; by?: unknown } | null;
  if (!j || j.human !== true) return null;
  const by = typeof j.by === "string" ? j.by : null;
  if (!by) return { userId: "", name: null };
  return team.get(by) ?? { userId: by, name: null };
}
