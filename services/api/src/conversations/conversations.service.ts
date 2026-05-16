import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import type {
  ConversationListItemDto,
  ThreadDto,
} from "./dto/conversation.dto";

/** Read-side for the dashboard inbox. Returns own DTO shapes (no Prisma
 *  type leak → portable .d.ts, no TS2742). */
@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenantSlug: string,
    includePreview = false,
  ): Promise<ConversationListItemDto[]> {
    const db = this.prisma.client;
    const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException("tenant_not_found");

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
        contact: { select: { name: true, phone: true } },
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
    return {
      id: c.id,
      channelKind: c.channel.kind,
      status: c.status,
      aiPaused: c.aiPaused,
      contactName: c.contact.name,
      contactPhone: c.contact.phone,
      messages: c.messages.map((m) => ({
        role: m.role,
        contentText: m.contentText,
        toolName: m.toolName,
        createdAt: m.createdAt,
      })),
    };
  }
}
