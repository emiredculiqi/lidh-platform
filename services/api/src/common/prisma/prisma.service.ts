import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { prisma, PrismaClient } from "@lidh/db";

/**
 * Wraps the singleton PrismaClient exported by @lidh/db.
 *
 * Why wrap instead of `extends PrismaClient`:
 *   `extends` would have NestJS instantiate a NEW client per app, defeating
 *   the connection-pool singleton in @lidh/db. Wrapping preserves one pool
 *   across the whole platform (including any other workspace that imports
 *   from @lidh/db, like dashboard route handlers).
 *
 * Use it via DI: constructor(private readonly prisma: PrismaService).
 * Then `this.prisma.client.tenant.findMany(...)` — same API as a raw client.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  /**
   * The shared, typed Prisma client. The explicit `PrismaClient` annotation
   * is required so TypeScript can emit a portable type for this property
   * (without it, `tsc` infers a path-relative type into pnpm's symlinked
   * @prisma/client and complains under `declaration: true`).
   */
  readonly client: PrismaClient = prisma;

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
