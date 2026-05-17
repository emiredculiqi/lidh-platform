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

/** What the guard attaches to the request for the TenantContextInterceptor. */
export interface RequestAuth {
  userId: string; // our User.id
  clerkId: string;
  email: string;
  isPlatformAdmin: boolean;
}

/**
 * Global guard (ADR-006). @Public() routes pass through. Otherwise: verify
 * the Clerk Bearer token → JIT-provision our User from Clerk → require
 * isPlatformAdmin (M2.4 reality: every non-public route is founder/admin) →
 * attach req.auth.
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

    // JIT provisioning: first verified request for this clerkId.
    if (!user) {
      const cu = await this.clerk.users.getUser(clerkId);
      const email =
        cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId)
          ?.emailAddress ??
        cu.emailAddresses[0]?.emailAddress ??
        `${clerkId}@no-email.local`;
      const name =
        [cu.firstName, cu.lastName].filter(Boolean).join(" ") || null;
      user = await db.user.create({
        data: {
          clerkId,
          email,
          name,
          imageUrl: cu.imageUrl ?? null,
          isPlatformAdmin: this.isAdminEmail(email),
        },
      });
      this.logger.log(`JIT-provisioned user ${email} (clerkId=${clerkId})`);
    }

    // Keep admin flag in sync with the allowlist cheaply (no Clerk call).
    const shouldBeAdmin = this.isAdminEmail(user.email);
    if (shouldBeAdmin !== user.isPlatformAdmin) {
      user = await db.user.update({
        where: { id: user.id },
        data: { isPlatformAdmin: shouldBeAdmin },
      });
    }

    if (!user.isPlatformAdmin) {
      // M2.4: no Membership/team flow yet → non-admins can't use admin
      // endpoints. Relaxed when team roles land (ADR-006).
      throw new ForbiddenException("not_a_platform_admin");
    }

    const auth: RequestAuth = {
      userId: user.id,
      clerkId,
      email: user.email,
      isPlatformAdmin: user.isPlatformAdmin,
    };
    (req as unknown as { auth: RequestAuth }).auth = auth;
    return true;
  }

  private isAdminEmail(email: string): boolean {
    return this.adminEmails.includes(email.trim().toLowerCase());
  }
}
