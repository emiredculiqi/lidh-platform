import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { TenantContextService } from "../common/tenant-context/tenant-context.service";
import { assertCanAccessTenant } from "../common/auth/access";
import type {
  ContactDetailDto,
  ContactListItemDto,
  ContactListQueryDto,
  ContactNoteDto,
  ContactStageValue,
  ContactTaskDto,
} from "./dto/contact.dto";

const preview = (s: string | null | undefined): string =>
  (s ?? "").replace(/\s+/g, " ").slice(0, 120);

/** Read-side for the dashboard Contacts section + the inbox/contact detail, plus stage and notes writes. */
@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContextService,
  ) {}

  async list(query: ContactListQueryDto): Promise<ContactListItemDto[]> {
    const db = this.prisma.client;
    const tenant = await db.tenant.findUnique({
      where: { slug: query.tenantSlug },
    });
    if (!tenant) throw new NotFoundException("tenant_not_found");
    assertCanAccessTenant(this.ctx.get(), tenant.id);

    const q = query.q?.trim();
    const rows = await db.contact.findMany({
      where: {
        tenantId: tenant.id,
        // Only contacts who actually gave us a way to reach them — exclude
        // anonymous chat sessions (no name/phone/email/handle).
        OR: [
          { name: { not: null } },
          { phone: { not: null } },
          { email: { not: null } },
          { igHandle: { not: null } },
        ],
        ...(query.stage ? { stage: query.stage } : {}),
        ...(query.has === "phone" ? { phone: { not: null } } : {}),
        ...(query.has === "email" ? { email: { not: null } } : {}),
        ...(q
          ? {
              AND: [
                {
                  OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { phone: { contains: q } },
                    { email: { contains: q, mode: "insensitive" } },
                  ],
                },
              ],
            }
          : {}),
      },
      // A–Z is applied below on the DISPLAY name (name → phone → email), which
      // the database can't order by directly; "recent" is ordered here.
      orderBy: { lastSeenAt: "desc" },
      take: 300,
      select: {
        id: true,
        stage: true,
        name: true,
        phone: true,
        email: true,
        source: true,
        lastSeenAt: true,
        _count: { select: { conversations: true, notes: true } },
      },
    });

    const items = rows.map((c) => ({
      id: c.id,
      stage: c.stage,
      name: c.name,
      phone: c.phone,
      email: c.email,
      source: c.source,
      conversationCount: c._count.conversations,
      noteCount: c._count.notes,
      lastSeenAt: c.lastSeenAt,
    }));
    if ((query.sort ?? "name") === "name") {
      // Same rule as the UI's display name, so a number-only WhatsApp contact
      // sorts by its number instead of floating to the top as a blank.
      const key = (c: (typeof items)[number]) =>
        (c.name || c.phone || c.email || "").trim().toLocaleLowerCase();
      items.sort((a, b) => key(a).localeCompare(key(b), "sq"));
    }
    return items;
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
        notes: {
          orderBy: { createdAt: "desc" },
          take: 100,
          include: { author: { select: { name: true, email: true } } },
        },
        tasks: TASKS_INCLUDE,
      },
    });
    if (!c) throw new NotFoundException("contact_not_found");
    assertCanAccessTenant(this.ctx.get(), c.tenantId);

    return {
      id: c.id,
      stage: c.stage,
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
      notes: c.notes.map((n) => ({
        id: n.id,
        kind: n.kind,
        body: n.body,
        conversationId: n.conversationId,
        authorName: n.author?.name ?? n.author?.email ?? null,
        createdAt: n.createdAt,
      })),
      tasks: c.tasks.map(taskDto),
    };
  }

  /** Add a to-do on a contact (ADR-024 §4). */
  async addTask(id: string, dto: { text: string; conversationId?: string }): Promise<ContactTaskDto> {
    const db = this.prisma.client;
    const c = await db.contact.findUnique({ where: { id }, select: { tenantId: true } });
    if (!c) throw new NotFoundException("contact_not_found");
    assertCanAccessTenant(this.ctx.get(), c.tenantId);
    // A conversation reference must belong to the same contact, or it's dropped.
    let conversationId: string | null = null;
    if (dto.conversationId) {
      const conv = await db.conversation.findUnique({
        where: { id: dto.conversationId },
        select: { contactId: true },
      });
      if (conv?.contactId === id) conversationId = dto.conversationId;
    }
    const t = await db.contactTask.create({
      data: {
        tenantId: c.tenantId,
        contactId: id,
        conversationId,
        text: dto.text.trim(),
        createdByUserId: this.ctx.get().userId ?? null,
      },
      include: { createdBy: { select: { name: true, email: true } } },
    });
    return taskDto(t);
  }

  /** Tick / untick / reword a to-do. */
  async updateTask(
    id: string,
    taskId: string,
    dto: { done?: boolean; text?: string },
  ): Promise<ContactTaskDto> {
    const db = this.prisma.client;
    const t = await db.contactTask.findUnique({
      where: { id: taskId },
      select: { tenantId: true, contactId: true, done: true },
    });
    if (!t || t.contactId !== id) throw new NotFoundException("task_not_found");
    assertCanAccessTenant(this.ctx.get(), t.tenantId);
    const updated = await db.contactTask.update({
      where: { id: taskId },
      data: {
        ...(dto.text !== undefined ? { text: dto.text.trim() } : {}),
        ...(dto.done !== undefined && dto.done !== t.done
          ? { done: dto.done, doneAt: dto.done ? new Date() : null }
          : {}),
      },
      include: { createdBy: { select: { name: true, email: true } } },
    });
    return taskDto(updated);
  }

  async deleteTask(id: string, taskId: string): Promise<{ ok: true }> {
    const db = this.prisma.client;
    const t = await db.contactTask.findUnique({
      where: { id: taskId },
      select: { tenantId: true, contactId: true },
    });
    if (!t || t.contactId !== id) throw new NotFoundException("task_not_found");
    assertCanAccessTenant(this.ctx.get(), t.tenantId);
    await db.contactTask.delete({ where: { id: taskId } });
    return { ok: true };
  }

  /** A team member writes a note on a contact (ADR-023). */
  async addNote(id: string, body: string): Promise<ContactNoteDto> {
    const db = this.prisma.client;
    const c = await db.contact.findUnique({ where: { id }, select: { tenantId: true } });
    if (!c) throw new NotFoundException("contact_not_found");
    assertCanAccessTenant(this.ctx.get(), c.tenantId);
    const n = await db.contactNote.create({
      data: {
        tenantId: c.tenantId,
        contactId: id,
        kind: "manual",
        body: body.trim(),
        authorUserId: this.ctx.get().userId ?? null,
      },
      include: { author: { select: { name: true, email: true } } },
    });
    return {
      id: n.id,
      kind: n.kind,
      body: n.body,
      conversationId: n.conversationId,
      authorName: n.author?.name ?? n.author?.email ?? null,
      createdAt: n.createdAt,
    };
  }

  /**
   * Operator marks where a contact stands (new → lead → client, or not a fit).
   * Scoped through the contact's own tenant, like `get`.
   */
  async setStage(id: string, stage: ContactStageValue): Promise<{ stage: string }> {
    const db = this.prisma.client;
    const c = await db.contact.findUnique({
      where: { id },
      select: { tenantId: true },
    });
    if (!c) throw new NotFoundException("contact_not_found");
    assertCanAccessTenant(this.ctx.get(), c.tenantId);
    const updated = await db.contact.update({
      where: { id },
      data: { stage },
      select: { stage: true },
    });
    return { stage: updated.stage };
  }
}

/** Shared include + mapper so the contact page and the thread's right panel
 *  show the same checklist: open first, then done; newest first in each. */
export const TASKS_INCLUDE = {
  orderBy: [{ done: "asc" as const }, { createdAt: "desc" as const }],
  take: 100,
  include: { createdBy: { select: { name: true, email: true } } },
};

export function taskDto(t: {
  id: string;
  text: string;
  done: boolean;
  doneAt: Date | null;
  conversationId: string | null;
  createdAt: Date;
  createdBy: { name: string | null; email: string } | null;
}): ContactTaskDto {
  return {
    id: t.id,
    text: t.text,
    done: t.done,
    doneAt: t.doneAt,
    conversationId: t.conversationId,
    createdByName: t.createdBy?.name ?? t.createdBy?.email ?? null,
    createdAt: t.createdAt,
  };
}
