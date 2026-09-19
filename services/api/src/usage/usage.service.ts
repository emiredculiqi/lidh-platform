import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { TenantContextService } from "../common/tenant-context/tenant-context.service";
import { assertCanAccessTenant } from "../common/auth/access";
import type { UsageDto } from "./dto/usage.dto";

/**
 * Live usage figures for a tenant (MVP). Computed on the fly with COUNT/SUM —
 * no rollup job yet (the UsageDaily table is a later optimization). Always
 * excludes preview/test conversations (`kind != customer`) so the SMB isn't
 * shown — or billed for — the operator's own test sessions.
 */
@Injectable()
export class UsageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContextService,
  ) {}

  async getUsage(tenantSlug: string): Promise<UsageDto> {
    const db = this.prisma.client;
    const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException("tenant_not_found");
    assertCanAccessTenant(this.ctx.get(), tenant.id);

    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const tenantId = tenant.id;
    const customer = { kind: "customer" as const };

    const [
      conversations,
      messagesIn,
      messagesOut,
      leads,
      handoffs,
      tokenAgg,
      awaitingReply,
      avgResponseSeconds,
    ] = await Promise.all([
      db.conversation.count({
        where: { tenantId, ...customer, lastMsgAt: { gte: monthStart } },
      }),
      db.message.count({
        where: {
          tenantId,
          role: "user",
          createdAt: { gte: monthStart },
          conversation: customer,
        },
      }),
      db.message.count({
        where: {
          tenantId,
          role: "assistant",
          createdAt: { gte: monthStart },
          conversation: customer,
        },
      }),
      db.lead.count({
        where: { tenantId, capturedAt: { gte: monthStart } },
      }),
      db.event.count({
        where: {
          tenantId,
          kind: "human_handoff_requested",
          createdAt: { gte: monthStart },
        },
      }),
      db.message.aggregate({
        where: {
          tenantId,
          role: "assistant",
          createdAt: { gte: monthStart },
          conversation: customer,
        },
        _sum: { tokensIn: true, tokensOut: true },
      }),
      this.countAwaitingReply(tenantId),
      this.avgResponseSeconds(tenantId, monthStart),
    ]);

    return {
      monthStart: monthStart.toISOString(),
      conversations,
      messagesIn,
      messagesOut,
      leads,
      handoffs,
      tokensIn: tokenAgg._sum.tokensIn ?? 0,
      tokensOut: tokenAgg._sum.tokensOut ?? 0,
      awaitingReply,
      avgResponseSeconds,
    };
  }

  /**
   * "Who is waiting on us right now": open customer conversations whose latest
   * message came from the customer. Channel- and responder-agnostic — if the
   * assistant answered, the latest message is the assistant's and the thread
   * does not count; if a human took over and hasn't replied yet, it does.
   */
  private async countAwaitingReply(tenantId: string): Promise<number> {
    const rows = await this.prisma.client.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n
        FROM "Conversation" c
       WHERE c."tenantId" = ${tenantId}
         AND c.kind = 'customer'
         AND c.status = 'open'
         AND (
           SELECT m.role::text
             FROM "Message" m
            WHERE m."conversationId" = c.id
            ORDER BY m."createdAt" DESC
            LIMIT 1
         ) = 'user'
    `;
    return rows[0]?.n ?? 0;
  }

  /**
   * Average time from a customer message to the reply that followed it, this
   * month. Only user→assistant adjacent pairs count, so a customer sending
   * three messages in a row contributes once (from the last of them). Replies
   * by the assistant and by a human are both stored as role "assistant", so
   * this measures the business's speed regardless of who answered.
   */
  private async avgResponseSeconds(
    tenantId: string,
    since: Date,
  ): Promise<number | null> {
    const rows = await this.prisma.client.$queryRaw<
      { avg_seconds: number | null }[]
    >`
      WITH msgs AS (
        SELECT m.role::text AS role,
               m."createdAt",
               LEAD(m.role::text)   OVER w AS next_role,
               LEAD(m."createdAt")  OVER w AS next_at
          FROM "Message" m
          JOIN "Conversation" c ON c.id = m."conversationId"
         WHERE m."tenantId" = ${tenantId}
           AND c.kind = 'customer'
           AND m."createdAt" >= ${since}
        WINDOW w AS (PARTITION BY m."conversationId" ORDER BY m."createdAt")
      )
      SELECT AVG(EXTRACT(EPOCH FROM (next_at - "createdAt")))::float8 AS avg_seconds
        FROM msgs
       WHERE role = 'user' AND next_role = 'assistant'
    `;
    const v = rows[0]?.avg_seconds;
    return v == null ? null : Math.round(v);
  }
}
