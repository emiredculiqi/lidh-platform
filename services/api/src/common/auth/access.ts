import { ForbiddenException } from "@nestjs/common";
import type { TenantContext } from "../tenant-context/tenant-context.service";

/**
 * Tenant-access helpers used by services that resolve a tenant from a slug.
 * Read TenantContext (AsyncLocalStorage seeded by the interceptor) — no
 * controller-level plumbing needed.
 *
 * Usage:
 *   const tenant = await db.tenant.findUnique({ where: { slug } });
 *   if (!tenant) throw new NotFoundException("tenant_not_found");
 *   assertCanAccessTenant(this.ctx.get(), tenant.id);
 */

/**
 * Throws 403 unless the request is from a platform admin OR a member of the
 * given tenant. Anonymous requests (no TenantContext) are rejected.
 */
export function assertCanAccessTenant(
  ctx: TenantContext,
  tenantId: string,
): void {
  if (ctx.isPlatformAdmin) return;
  if (ctx.memberships?.some((m) => m.tenantId === tenantId)) return;
  throw new ForbiddenException("not_a_member");
}

/**
 * Like assertCanAccessTenant but also requires the user's membership role on
 * that tenant to be one of the allowed roles. Platform admins bypass the
 * role check. Use for tenant-level mutations (archive, delete, transfer).
 */
export function assertTenantRole(
  ctx: TenantContext,
  tenantId: string,
  allowed: Array<"owner" | "admin" | "agent">,
): void {
  if (ctx.isPlatformAdmin) return;
  const m = ctx.memberships?.find((x) => x.tenantId === tenantId);
  if (!m) throw new ForbiddenException("not_a_member");
  if (!allowed.includes(m.role as "owner" | "admin" | "agent")) {
    throw new ForbiddenException("role_not_allowed");
  }
}
