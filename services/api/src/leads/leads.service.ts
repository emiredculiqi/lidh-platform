import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import type { LeadListItemDto } from "./dto/lead.dto";

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantSlug: string): Promise<LeadListItemDto[]> {
    const db = this.prisma.client;
    const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException("tenant_not_found");

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
      conversationId: l.conversationId,
      capturedAt: l.capturedAt,
    }));
  }
}
