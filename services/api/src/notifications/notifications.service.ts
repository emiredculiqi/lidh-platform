import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { TenantContextService } from "../common/tenant-context/tenant-context.service";
import { assertCanAccessTenant } from "../common/auth/access";
import type { NotificationDto } from "./dto/notification.dto";

// Activity kinds surfaced in the bell. Other Event kinds (handoff, channel,
// knowledge…) stay out of the feed to keep it focused on inbox activity.
const FEED_KINDS = [
  "conversation_started",
  "contact_registered",
  "lead_captured",
] as const;

/** Read-side for the notifications bell: a feed derived from the Event log. */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContextService,
  ) {}

  async list(tenantSlug: string): Promise<NotificationDto[]> {
    const db = this.prisma.client;
    const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException("tenant_not_found");
    assertCanAccessTenant(this.ctx.get(), tenant.id);

    const events = await db.event.findMany({
      where: { tenantId: tenant.id, kind: { in: [...FEED_KINDS] } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        conversation: {
          select: { contact: { select: { name: true, phone: true } } },
        },
      },
    });

    return events.map((e) => ({
      id: e.id,
      kind: e.kind,
      conversationId: e.conversationId,
      contactName:
        e.conversation?.contact.name ?? e.conversation?.contact.phone ?? null,
      createdAt: e.createdAt,
    }));
  }
}
