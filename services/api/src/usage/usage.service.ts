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
    };
  }
}
