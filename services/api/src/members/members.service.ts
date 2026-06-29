import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { TenantContextService } from "../common/tenant-context/tenant-context.service";
import { MailService } from "../common/mail/mail.service";
import { assertTenantRole } from "../common/auth/access";
import type { TeamOverviewDto } from "./dto/member.dto";

const INVITE_EXPIRY_DAYS = 14;
// Used when a tenant is on trial but the Premium plan hasn't been seeded yet.
const TRIAL_SEATS_FALLBACK = 5;

/**
 * Team management: list members + invites, invite (plan-gated), promote/demote,
 * remove, revoke/resend. All mutations require owner|admin on the tenant
 * (platform admins bypass). Invites are accepted via the AuthGuard email-match
 * binding on the invitee's first sign-in.
 */
@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContextService,
    private readonly mail: MailService,
  ) {}

  /** Resolve the tenant by slug and require owner|admin. Returns the row. */
  private async manageable(tenantSlug: string) {
    const tenant = await this.prisma.client.tenant.findUnique({
      where: { slug: tenantSlug },
      select: {
        id: true,
        name: true,
        planId: true,
        trialEndsAt: true,
        planOverrides: true,
      },
    });
    if (!tenant) throw new NotFoundException("tenant_not_found");
    assertTenantRole(this.ctx.get(), tenant.id, ["owner", "admin"]);
    return tenant;
  }

  /** Effective seat cap: trial → Premium plan's seats; paid → its plan (with
   *  per-tenant override); otherwise owner-only (1). */
  private async effectiveMaxMembers(tenant: {
    planId: string | null;
    trialEndsAt: Date | null;
    planOverrides: unknown;
  }): Promise<number> {
    const db = this.prisma.client;
    const onTrial = !!tenant.trialEndsAt && tenant.trialEndsAt > new Date();
    if (onTrial) {
      const premium = await db.plan.findUnique({
        where: { slug: "premium" },
        select: { maxTeamMembers: true },
      });
      return premium?.maxTeamMembers ?? TRIAL_SEATS_FALLBACK;
    }
    if (tenant.planId) {
      const plan = await db.plan.findUnique({
        where: { id: tenant.planId },
        select: { maxTeamMembers: true },
      });
      const override = (
        tenant.planOverrides as { maxTeamMembers?: number } | null
      )?.maxTeamMembers;
      return (
        (typeof override === "number" ? override : plan?.maxTeamMembers) ?? 1
      );
    }
    return 1;
  }

  /** Seats consumed = active members + pending invites. */
  private async seatUsage(tenantId: string): Promise<number> {
    const db = this.prisma.client;
    const [members, pending] = await Promise.all([
      db.membership.count({ where: { tenantId } }),
      db.invitation.count({ where: { tenantId, status: "pending" } }),
    ]);
    return members + pending;
  }

  async overview(tenantSlug: string): Promise<TeamOverviewDto> {
    const tenant = await this.manageable(tenantSlug);
    const db = this.prisma.client;
    const [memberships, invitations, used, max] = await Promise.all([
      db.membership.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: "asc" },
        include: { user: { select: { email: true, name: true } } },
      }),
      db.invitation.findMany({
        where: { tenantId: tenant.id, status: "pending" },
        orderBy: { createdAt: "desc" },
      }),
      this.seatUsage(tenant.id),
      this.effectiveMaxMembers(tenant),
    ]);
    return {
      seats: { used, max },
      members: memberships.map((m) => ({
        userId: m.userId,
        email: m.user.email,
        name: m.user.name,
        role: String(m.role),
        joinedAt: m.createdAt,
      })),
      invitations: invitations.map((i) => ({
        id: i.id,
        email: i.email,
        role: String(i.role),
        status: String(i.status),
        createdAt: i.createdAt,
        expiresAt: i.expiresAt,
      })),
    };
  }

  async invite(
    tenantSlug: string,
    emailRaw: string,
    role: "admin" | "agent",
  ): Promise<{ ok: true }> {
    const tenant = await this.manageable(tenantSlug);
    const db = this.prisma.client;
    const email = emailRaw.trim().toLowerCase();

    // Already a member of this tenant?
    const existingUser = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      const m = await db.membership.findUnique({
        where: {
          userId_tenantId: { userId: existingUser.id, tenantId: tenant.id },
        },
        select: { id: true },
      });
      if (m) throw new ConflictException("already_a_member");
    }

    // Re-inviting an already-pending invite reuses its seat; anything else
    // (new, or reactivating a revoked/expired one) consumes a fresh seat.
    const existingInvite = await db.invitation.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
      select: { status: true },
    });
    if (existingInvite?.status !== "pending") {
      const [used, max] = await Promise.all([
        this.seatUsage(tenant.id),
        this.effectiveMaxMembers(tenant),
      ]);
      if (used >= max) throw new ForbiddenException("seat_limit_reached");
    }

    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 86_400_000);
    const invitedById = this.ctx.get().userId ?? null;
    await db.invitation.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email } },
      update: { role, status: "pending", invitedById, expiresAt, acceptedAt: null },
      create: { tenantId: tenant.id, email, role, status: "pending", invitedById, expiresAt },
    });

    let inviterName: string | null = null;
    if (invitedById) {
      const u = await db.user.findUnique({
        where: { id: invitedById },
        select: { name: true },
      });
      inviterName = u?.name ?? null;
    }
    void this.mail
      .sendInvitation({ to: email, businessName: tenant.name, role, inviterName })
      .catch((e) =>
        this.logger.error(
          `invite email failed: ${e instanceof Error ? e.message : "unknown"}`,
        ),
      );
    return { ok: true };
  }

  async setRole(
    tenantSlug: string,
    userId: string,
    role: "admin" | "agent",
  ): Promise<{ ok: true }> {
    const tenant = await this.manageable(tenantSlug);
    const db = this.prisma.client;
    const m = await db.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId: tenant.id } },
      select: { id: true, role: true },
    });
    if (!m) throw new NotFoundException("member_not_found");
    if (m.role === "owner") throw new ForbiddenException("cannot_change_owner");
    await db.membership.update({ where: { id: m.id }, data: { role } });
    return { ok: true };
  }

  async remove(tenantSlug: string, userId: string): Promise<{ ok: true }> {
    const tenant = await this.manageable(tenantSlug);
    const db = this.prisma.client;
    const m = await db.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId: tenant.id } },
      select: { id: true, role: true },
    });
    if (!m) throw new NotFoundException("member_not_found");
    if (m.role === "owner") throw new ForbiddenException("cannot_remove_owner");
    await db.membership.delete({ where: { id: m.id } });
    return { ok: true };
  }

  async revokeInvite(
    tenantSlug: string,
    invitationId: string,
  ): Promise<{ ok: true }> {
    const tenant = await this.manageable(tenantSlug);
    const db = this.prisma.client;
    const inv = await db.invitation.findFirst({
      where: { id: invitationId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!inv) throw new NotFoundException("invitation_not_found");
    await db.invitation.update({
      where: { id: inv.id },
      data: { status: "revoked" },
    });
    return { ok: true };
  }

  async resendInvite(
    tenantSlug: string,
    invitationId: string,
  ): Promise<{ ok: true }> {
    const tenant = await this.manageable(tenantSlug);
    const db = this.prisma.client;
    const inv = await db.invitation.findFirst({
      where: { id: invitationId, tenantId: tenant.id, status: "pending" },
      select: { id: true, email: true, role: true },
    });
    if (!inv) throw new NotFoundException("invitation_not_found");
    await db.invitation.update({
      where: { id: inv.id },
      data: { expiresAt: new Date(Date.now() + INVITE_EXPIRY_DAYS * 86_400_000) },
    });
    void this.mail
      .sendInvitation({
        to: inv.email,
        businessName: tenant.name,
        role: String(inv.role),
        inviterName: null,
      })
      .catch((e) =>
        this.logger.error(
          `resend invite email failed: ${e instanceof Error ? e.message : "unknown"}`,
        ),
      );
    return { ok: true };
  }
}
