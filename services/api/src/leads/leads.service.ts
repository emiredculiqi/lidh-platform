import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { TenantContextService } from "../common/tenant-context/tenant-context.service";
import { assertCanAccessTenant } from "../common/auth/access";
import type { LeadListItemDto } from "./dto/lead.dto";

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContextService,
  ) {}

  async list(tenantSlug: string): Promise<LeadListItemDto[]> {
    const db = this.prisma.client;
    const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException("tenant_not_found");
    assertCanAccessTenant(this.ctx.get(), tenant.id);

    const rows = await db.lead.findMany({
      where: { tenantId: tenant.id },
      orderBy: { capturedAt: "desc" },
      take: 200,
      include: { contact: { select: { name: true, phone: true } } },
    });

    return rows.map((l) => ({
      id: l.id,
      status: l.status,
      payload: l.payload,
      contactName: l.contact?.name ?? null,
      contactPhone: l.contact?.phone ?? null,
      contactId: l.contactId,
      conversationId: l.conversationId,
      capturedAt: l.capturedAt,
    }));
  }
}
