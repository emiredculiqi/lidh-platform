import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { PrismaService } from "../prisma/prisma.service";
import { loadTenantEntitlements } from "../../tenants/entitlements";
import type { RequestAuth } from "./auth.guard";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Pure decision: should a WRITE be blocked for a tenant in this dashboard mode?
 *   - Reads (GET/HEAD/OPTIONS) always pass — the point of a frozen tenant is
 *     that they can still *review* their data.
 *   - Platform admins always pass — they're the ones who reactivate a frozen
 *     tenant (grant-plan / extend-trial), which are mutations.
 *   - A business user may write only when their dashboard is "full".
 *     "read_only" (expired) and "none" (archived) block every mutation.
 */
export function isWriteBlocked(
  method: string,
  isPlatformAdmin: boolean,
  dashboard: "full" | "read_only" | "none",
): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return false;
  if (isPlatformAdmin) return false;
  return dashboard !== "full";
}

/**
 * Read-only dashboard enforcement (ADR-017, Phase 3). The other half of
 * "frozen but not locked out": a frozen tenant keeps GET access to review its
 * data, but every mutation is rejected with 403 subscription_required.
 *
 * Registered as an APP_GUARD immediately AFTER AuthGuard (see AuthModule), so
 * `req.auth` is already set. Ordering matters — this guard reads what AuthGuard
 * wrote.
 *
 * The target tenant is resolved from the user's OWN memberships (one tenant per
 * user today, ADR-013), NOT the request URL — which sidesteps ADR-013's reason
 * for avoiding a generic guard (routes identify the tenant inconsistently).
 * If a user ever holds multiple tenants, any frozen one blocks their writes;
 * refining to the specific target tenant is a multi-tenant TODO.
 *
 * COST: this adds one uncached tenant lookup per membership to EVERY mutation.
 * Acceptable today — one tenant per user, and reads (the hot path) return before
 * touching the DB. If entitlements ever get cached, invalidation must cover
 * admin grant-plan / extend-trial, or a reactivated tenant stays frozen.
 */
@Injectable()
export class ReadOnlyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx
      .switchToHttp()
      .getRequest<FastifyRequest & { auth?: RequestAuth }>();
    const method = req.method ?? "GET";
    if (SAFE_METHODS.has(method.toUpperCase())) return true;

    const auth = req.auth;
    // No auth = public route (chat/webhooks/funnel): gated by the Phase 2
    // channel checks, not here. Admins bypass — they reactivate frozen tenants.
    if (!auth || auth.isPlatformAdmin) return true;

    const db = this.prisma.client;
    for (const m of auth.memberships ?? []) {
      const tenant = await db.tenant.findUnique({
        where: { id: m.tenantId },
        select: {
          status: true,
          trialEndsAt: true,
          planId: true,
          planOverrides: true,
        },
      });
      if (!tenant) continue;
      const ent = await loadTenantEntitlements(db, tenant);
      if (isWriteBlocked(method, auth.isPlatformAdmin, ent.dashboard)) {
        throw new ForbiddenException("subscription_required");
      }
    }
    return true;
  }
}
