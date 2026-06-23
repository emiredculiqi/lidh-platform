import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { verifyToken, createClerkClient } from "@clerk/backend";
import type { FastifyRequest } from "fastify";
import { PrismaService } from "../prisma/prisma.service";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { IS_PLATFORM_ADMIN_KEY } from "./platform-admin.decorator";

/** What the guard attaches to the request for the TenantContextInterceptor. */
export interface RequestAuth {
  userId: string; // our User.id
  clerkId: string;
  email: string;
  isPlatformAdmin: boolean;
  /** Tenants this user is a member of (ADR-013). Empty for brand-new users
   *  who haven't completed /onboarding yet, and irrelevant for platform
   *  admins (they see everything regardless). */
  memberships: Array<{ tenantId: string; role: string }>;
}

/**
 * Global guard (ADR-006 + ADR-013). @Public() routes pass through. Otherwise:
 * verify the Clerk Bearer token → JIT-provision our User from Clerk → load
 * memberships → attach req.auth.
 *
 * Originally rejected non-admins outright (M2.4). Since ADR-013 (business
 * onboarding) the guard accepts any authenticated user; per-tenant access
 * is enforced downstream via assertCanAccessTenant() in services, and
 * admin-only endpoints are gated with @PlatformAdminOnly().
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  private readonly secretKey = process.env.CLERK_SECRET_KEY ?? "";
  private readonly adminEmails = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  private readonly clerk = this.secretKey
    ? createClerkClient({ secretKey: this.secretKey })
    : null;

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    if (!this.secretKey || !this.clerk) {
      this.logger.error("CLERK_SECRET_KEY not set — refusing protected route");
      throw new UnauthorizedException("auth_not_configured");
    }

    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const header = req.headers["authorization"];
    const token =
      typeof header === "string" && header.startsWith("Bearer ")
        ? header.slice(7)
        : null;
    if (!token) throw new UnauthorizedException("missing_bearer_token");

    let clerkId: string;
    try {
      const claims = await verifyToken(token, { secretKey: this.secretKey });
      clerkId = claims.sub;
    } catch {
      throw new UnauthorizedException("invalid_token");
    }

    const db = this.prisma.client;
    let user = await db.user.findUnique({ where: { clerkId } });

    // JIT provisioning: first verified request for this clerkId. Wrapped so
    // a Clerk-API failure (e.g. the token verifies against the instance's
    // JWKS but the user isn't fetchable, or a network error) surfaces as a
    // logged, explicit auth error instead of an opaque 500.
    if (!user) {
      try {
        const cu = await this.clerk.users.getUser(clerkId);
        const email =
          cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId)
            ?.emailAddress ??
          cu.emailAddresses[0]?.emailAddress ??
          `${clerkId}@no-email.local`;
        const name =
          [cu.firstName, cu.lastName].filter(Boolean).join(" ") || null;
        // Upsert by EMAIL (the stable identity), not a blind create: the same
        // person can have a DIFFERENT clerkId across Clerk instances — e.g. a
        // dev/test instance on localhost vs the live instance on the prod
        // domain — while sharing ONE database. A create would then collide on
        // the User.email unique constraint and fail ("user_provisioning_failed").
        // Upserting relinks the existing row to the current clerkId instead.
        user = await db.user.upsert({
          where: { email },
          update: {
            clerkId,
            name,
            imageUrl: cu.imageUrl ?? null,
            isPlatformAdmin: this.isAdminEmail(email),
          },
          create: {
            clerkId,
            email,
            name,
            imageUrl: cu.imageUrl ?? null,
            isPlatformAdmin: this.isAdminEmail(email),
          },
        });
        this.logger.log(
          `JIT-provisioned/linked user ${email} (clerkId=${clerkId})`,
        );

        // ADR-015: bind any tenants the admin pre-assigned to this email.
        // Case-insensitive — emails are case-insensitive per RFC and admins
        // type mixed case into the form.
        const pending = await db.tenant.findMany({
          where: { pendingOwnerEmail: { equals: email, mode: "insensitive" } },
          select: { id: true, slug: true },
        });
        if (pending.length > 0) {
          await db.$transaction([
            db.membership.createMany({
              data: pending.map((t) => ({
                userId: user!.id,
                tenantId: t.id,
                role: "owner" as const,
              })),
              skipDuplicates: true,
            }),
            db.tenant.updateMany({
              where: { id: { in: pending.map((t) => t.id) } },
              data: { pendingOwnerEmail: null },
            }),
          ]);
          this.logger.log(
            `bound ${pending.length} pending tenant(s) to ${email}: ` +
              pending.map((t) => t.slug).join(", "),
          );
        }
      } catch (err) {
        this.logger.error(
          `JIT provisioning failed for clerkId=${clerkId}: ${
            err instanceof Error ? `${err.name}: ${err.message}` : String(err)
          }`,
        );
        throw new UnauthorizedException("user_provisioning_failed");
      }
    }

    // Keep admin flag in sync with the allowlist cheaply (no Clerk call).
    const shouldBeAdmin = this.isAdminEmail(user.email);
    if (shouldBeAdmin !== user.isPlatformAdmin) {
      user = await db.user.update({
        where: { id: user.id },
        data: { isPlatformAdmin: shouldBeAdmin },
      });
    }

    // ADR-013: relaxed. Any authenticated user passes; per-tenant access is
    // enforced in services. Platform admins still get the universal pass.
    const memberships = await db.membership.findMany({
      where: { userId: user.id },
      select: { tenantId: true, role: true },
    });

    const auth: RequestAuth = {
      userId: user.id,
      clerkId,
      email: user.email,
      isPlatformAdmin: user.isPlatformAdmin,
      memberships: memberships.map((m) => ({
        tenantId: m.tenantId,
        role: String(m.role),
      })),
    };
    (req as unknown as { auth: RequestAuth }).auth = auth;

    // @PlatformAdminOnly() gating — applied AFTER auth so we throw 403
    // (authorized) rather than 401 (authenticated). Business users hit this
    // on admin-only routes (managing presets, listing all tenants, etc.).
    const adminOnly = this.reflector.getAllAndOverride<boolean>(
      IS_PLATFORM_ADMIN_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (adminOnly && !auth.isPlatformAdmin) {
      throw new ForbiddenException("platform_admin_only");
    }
    return true;
  }

  private isAdminEmail(email: string): boolean {
    return this.adminEmails.includes(email.trim().toLowerCase());
  }
}
