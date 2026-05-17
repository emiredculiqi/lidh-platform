import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import {
  TenantContext,
  TenantContextService,
} from "./tenant-context.service";

/**
 * Resolves the current tenant for every request and seeds TenantContextService.
 *
 * M1 STATUS: stub. Auth isn't wired yet (Clerk lands in Phase 4 / M2). For now
 * this interceptor:
 *   - reads optional debug headers `x-tenant-id` and `x-user-id` so we can
 *     manually exercise tenant-scoped endpoints during dev,
 *   - does not enforce auth — every route is public until Clerk is in place.
 *
 * M2 PLAN (when auth lands):
 *   1. Verify Clerk session JWT (via @clerk/backend or shared verify helper).
 *   2. Look up User by clerkId in @lidh/db.
 *   3. Resolve tenantId from one of (in priority order):
 *        a. JWT `org_id` (if using Clerk Organizations for tenants), OR
 *        b. URL parameter (e.g. /v1/tenants/:tenantSlug/...), OR
 *        c. `x-tenant-id` header (for service-to-service calls).
 *   4. Verify the user has a Membership for that tenant; load their role.
 *   5. Call tenantContext.run(...) — done.
 *   6. (After RLS migration) wrap the handler in a Prisma $transaction that
 *      runs `SET LOCAL app.tenant_id = $1` on the connection.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantContextInterceptor.name);

  constructor(private readonly tenantContext: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      auth?: {
        userId: string;
        email: string;
        isPlatformAdmin: boolean;
      };
    }>();

    // Seed from req.auth, set by the global AuthGuard after verifying the
    // Clerk token + JIT-provisioning the User (ADR-006). Public routes have
    // no req.auth → empty context (anonymous visitor / webhook).
    const ctx: TenantContext = {
      userId: req.auth?.userId,
      isPlatformAdmin: req.auth?.isPlatformAdmin,
    };

    if (ctx.userId) {
      this.logger.debug(
        `auth: userId=${ctx.userId} admin=${ctx.isPlatformAdmin ?? false}`,
      );
    }

    // Run the rest of the request inside the AsyncLocalStorage scope so any
    // downstream service can read this context via tenantContext.get().
    return new Observable<unknown>((subscriber) => {
      this.tenantContext.run(ctx, () => {
        const subscription = next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
        return () => subscription.unsubscribe();
      });
    });
  }
}
