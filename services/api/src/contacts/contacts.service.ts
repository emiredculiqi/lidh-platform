import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { TenantContextService } from "../common/tenant-context/tenant-context.service";
import { assertCanAccessTenant } from "../common/auth/access";
import type {
  ContactDetailDto,
  ContactListItemDto,
} from "./dto/contact.dto";

const preview = (s: string | null | undefined): string =>
  (s ?? "").replace(/\s+/g, " ").slice(0, 120);

/** Read-side for the dashboard Contacts section + the inbox/leads detail. */
@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContextService,
  ) {}

  async list(tenantSlug: string): Promise<ContactListItemDto[]> {
    const db = this.prisma.client;
    const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException("tenant_not_found");
    assertCanAccessTenant(this.ctx.get(), tenant.id);

    const rows = await db.contact.findMany({
      // Only contacts who actually gave us a way to reach them — exclude
      // anonymous chat sessions (no name/phone/email/handle).
      where: {
        tenantId: tenant.id,
        OR: [
          { name: { not: null } },
          { phone: { not: null } },
          { email: { not: null } },
          { igHandle: { not: null } },
        ],
      },
      orderBy: { lastSeenAt: "desc" },
      take: 300,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        source: true,
        lastSeenAt: true,
        _count: { select: { conversations: true, leads: true } },
      },
    });

    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      source: c.source,
      conversationCount: c._count.conversations,
      leadCount: c._count.leads,
      lastSeenAt: c.lastSeenAt,
    }));
  }

  async get(id: string): Promise<ContactDetailDto> {
    const c = await this.prisma.client.contact.findUnique({
      where: { id },
      include: {
        conversations: {
          orderBy: { lastMsgAt: "desc" },
          take: 50,
          include: {
            channel: { select: { kind: true } },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { contentText: true },
            },
            _count: { select: { messages: true } },
          },
        },
        leads: { orderBy: { capturedAt: "desc" }, take: 50 },
      },
    });
    if (!c) throw new NotFoundException("contact_not_found");
    assertCanAccessTenant(this.ctx.get(), c.tenantId);

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      source: c.source,
      locale: c.conversations[0]?.locale ?? null,
      firstSeenAt: c.firstSeenAt,
      lastSeenAt: c.lastSeenAt,
      conversations: c.conversations.map((cv) => ({
        id: cv.id,
        channelKind: cv.channel.kind,
        status: cv.status,
        locale: cv.locale,
        lastMessagePreview: preview(cv.messages[0]?.contentText),
        messageCount: cv._count.messages,
        lastMsgAt: cv.lastMsgAt,
      })),
      leads: c.leads.map((l) => ({
        id: l.id,
        status: l.status,
        payload: (l.payload ?? {}) as Record<string, unknown>,
        capturedAt: l.capturedAt,
      })),
    };
  }
}
