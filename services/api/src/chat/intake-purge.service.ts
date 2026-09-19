import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

/** Abandoned web intakes older than this are deleted. */
export const INTAKE_PURGE_AFTER_DAYS = 7;
const HOUR_MS = 3_600_000;

/**
 * Purge of abandoned web intakes (ADR-021): conversations that never got a
 * name + email are invisible to the business and worthless after a week, so
 * they are deleted — messages cascade, and the placeholder contact goes with
 * them when nothing else references it.
 *
 * This is the first scheduled job in the codebase. It is an in-process hourly
 * timer, which is adequate because the API deliberately runs as ONE Fly
 * machine (see CLAUDE.md, "Real-time is single-instance"). If that ever
 * changes, two machines would each run it — harmless, since the delete is
 * idempotent — but a real scheduler should own it by then, together with the
 * retention policy (todo #8).
 */
@Injectable()
export class IntakePurgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IntakePurgeService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    // Not under Vitest, and not until the first hour has passed — boot should
    // never race the release-command migration that adds the column.
    if (process.env.VITEST) return;
    this.timer = setInterval(() => void this.runOnce(), HOUR_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** One pass. Exposed for ops scripts and tests. */
  async runOnce(now: Date = new Date()): Promise<{ conversations: number; contacts: number }> {
    const db = this.prisma.client;
    const cutoff = new Date(now.getTime() - INTAKE_PURGE_AFTER_DAYS * 86_400_000);
    try {
      const stale = await db.conversation.findMany({
        where: { intakePending: true, lastMsgAt: { lt: cutoff } },
        select: { id: true, contactId: true },
        take: 1000,
      });
      if (stale.length === 0) return { conversations: 0, contacts: 0 };

      const conv = await db.conversation.deleteMany({
        where: { id: { in: stale.map((c) => c.id) } },
      });
      // Placeholder contacts: no identity and no remaining conversations.
      const contacts = await db.contact.deleteMany({
        where: {
          id: { in: [...new Set(stale.map((c) => c.contactId))] },
          name: null,
          email: null,
          phone: null,
          igHandle: null,
          conversations: { none: {} },
        },
      });
      this.logger.log(
        `purged ${conv.count} abandoned intake(s) and ${contacts.count} placeholder contact(s)`,
      );
      return { conversations: conv.count, contacts: contacts.count };
    } catch (err) {
      this.logger.error(
        `intake purge failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
      return { conversations: 0, contacts: 0 };
    }
  }
}
