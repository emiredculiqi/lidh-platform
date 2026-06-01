import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request "ambient" tenant context. Backed by Node's AsyncLocalStorage so
 * we can keep the service as a plain singleton (no @Scope.REQUEST overhead)
 * while still scoping values per-request automatically — including across
 * `await` boundaries inside the controller, services, Prisma calls, etc.
 *
 * Pattern in M2:
 *   - The interceptor calls `tenantContext.run({...}, () => next.handle())`
 *     to start the scope.
 *   - Any code reachable from the controller can call `tenantContext.get()`
 *     and read the current request's tenantId / userId / role / etc.
 *
 * In M2 this becomes the source of truth for:
 *   - WHERE clauses (".where: { tenantId: ctx.tenantId }")
 *   - Postgres RLS context ("SET LOCAL app.tenant_id = $1" on the txn)
 *   - Authorization decisions (only owners/admins can do certain things)
 */
@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContext>();

  run<T>(ctx: TenantContext, fn: () => T): T {
    return this.storage.run({ ...ctx }, fn);
  }

  get(): Readonly<TenantContext> {
    return this.storage.getStore() ?? {};
  }

  /** Throws if no tenant has been resolved — use in code that requires one. */
  requireTenantId(): string {
    const tenantId = this.storage.getStore()?.tenantId;
    if (!tenantId) {
      throw new Error("TenantContext: tenantId is not set for this request.");
    }
    return tenantId;
  }
}

export interface TenantContext {
  /** Resolved Tenant.id for this request. Absent on public/anonymous routes. */
  tenantId?: string;
  /** Resolved User.id (our DB id, not Clerk id). Absent on anonymous routes. */
  userId?: string;
  /** True if the user is a Lidh.al platform admin (User.isPlatformAdmin). */
  isPlatformAdmin?: boolean;
  /**
   * The membership role of userId on tenantId, if both are set.
   * Drives authorization checks in feature modules.
   */
  role?: "owner" | "admin" | "agent";
  /** All tenants this user can access (ADR-013). Empty for new users who
   *  haven't completed /onboarding; irrelevant for platform admins. */
  memberships?: Array<{ tenantId: string; role: string }>;
}
