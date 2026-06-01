import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { expandPersonas } from "@lidh/core";
import { PrismaService } from "../common/prisma/prisma.service";
import { StorageService } from "../common/storage/storage.service";
import { TenantContextService } from "../common/tenant-context/tenant-context.service";
import { assertCanAccessTenant } from "../common/auth/access";
import type { CreateTenantDto } from "./dto/create-tenant.dto";
import type {
  FunnelResolveResponseDto,
  TenantResponseDto,
} from "./dto/tenant-response.dto";

// Read at call-time, NOT module top-level: @nestjs/config loads .env during
// bootstrap, after this module is imported. A top-level const captures undef.
function appBaseUrl(): string {
  return (
    process.env.APP_BASE_URL?.replace(/\/$/, "") ?? "https://app.lidh.al"
  );
}

/** Default free-trial window for newly created tenants. */
const TRIAL_DAYS = 15;
const TRIAL_MS = TRIAL_DAYS * 86_400_000;

/**
 * Tenant lifecycle + the funnel URL flow (ADR-014).
 *
 * Every tenant — self-registered or admin-created — gets a permanent funnel
 * page at `${APP_BASE_URL}/b/<slug>` from creation. The agent answers on
 * that page while the tenant is *active*; otherwise the page shows a soft
 * "currently offline" message. Active = status=active AND
 * (trialEndsAt > now OR planId is set).
 *
 * The earlier "demo URL" concept (demo.lidh.al/<token>, expiring) is gone —
 * the URL is the SMB's storefront and must be permanent. Trial pressure is
 * applied via the agent going quiet, not the URL breaking.
 */
@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ctx: TenantContextService,
  ) {}

  async createTenant(
    dto: CreateTenantDto,
    /** If set, also creates a Membership(owner) for this user in the same
     *  transaction — used by the self-serve onboarding flow (ADR-013).
     *  Platform-admin calls don't pass this (they create tenants without
     *  assigning ownership). */
    ownerUserId?: string,
  ): Promise<TenantResponseDto> {
    const db = this.prisma.client;
    const defaultLocale = dto.defaultLocale ?? "al";

    // Resolve personas: a standard preset (ADR-010 — resolved from the
    // editable DB library, not code) expands to one row per supported
    // language with {business} filled in, OR caller-supplied custom
    // personas. Exactly one path must yield content.
    let personas: { locale: string; content: string }[];
    if (dto.presetId) {
      const preset = await db.personaPreset.findUnique({
        where: { id: dto.presetId },
      });
      if (!preset || !preset.active) {
        throw new BadRequestException(
          `unknown or inactive persona preset "${dto.presetId}"`,
        );
      }
      const expanded = expandPersonas(
        preset.personas as Record<string, unknown>,
        dto.name,
      );
      if (expanded.length === 0) {
        throw new BadRequestException(
          `persona preset "${dto.presetId}" has no usable persona text`,
        );
      }
      personas = expanded;
    } else if (dto.personas && dto.personas.length > 0) {
      personas = dto.personas;
    } else {
      throw new BadRequestException("provide either presetId or personas");
    }

    // Every new tenant starts with a 15-day trial. Admin-created tenants
    // can be promoted immediately afterwards via /grant-plan; self-serve
    // tenants live on the trial until they pay.
    const trialEndsAt = new Date(Date.now() + TRIAL_MS);

    // ADR-015: owner-email binding. If the admin provided an ownerEmail,
    // try to resolve it to an existing User now — if found, bind them
    // immediately as `owner`. Otherwise stash the email on Tenant so the
    // AuthGuard JIT-creates path binds them on their first sign-in.
    // Self-serve flows (ownerUserId set) ignore ownerEmail — the signer is
    // already the owner.
    let directOwnerUserId: string | null = ownerUserId ?? null;
    let pendingOwnerEmail: string | null = null;
    if (!ownerUserId && dto.ownerEmail) {
      const existing = await db.user.findFirst({
        where: { email: { equals: dto.ownerEmail, mode: "insensitive" } },
        select: { id: true },
      });
      if (existing) {
        directOwnerUserId = existing.id;
      } else {
        pendingOwnerEmail = dto.ownerEmail;
      }
    }

    try {
      const tenant = await db.$transaction(async (tx) => {
        const t = await tx.tenant.create({
          data: {
            slug: dto.slug,
            name: dto.name,
            defaultLocale,
            settings: dto.businessFacts
              ? { businessFacts: dto.businessFacts }
              : {},
            trialEndsAt,
            pendingOwnerEmail,
          },
        });

        const agent = await tx.agent.create({
          data: {
            tenantId: t.id,
            name: dto.agentName ?? `${dto.name} Assistant`,
            defaultLocale,
            toolsEnabled: {
              capture_lead: true,
              request_human_handoff: true,
            },
          },
        });

        await tx.agentPersona.createMany({
          data: personas.map((p) => ({
            agentId: agent.id,
            tenantId: t.id,
            locale: p.locale,
            content: p.content,
          })),
        });

        // Every tenant starts with a web channel (the funnel page). WA/IG
        // are added later via ChannelsModule once the SMB connects them.
        await tx.channel.create({
          data: {
            tenantId: t.id,
            kind: "web",
            status: "connected",
            config: { allowedOrigins: dto.webAllowedOrigins ?? [] },
          },
        });

        // Owner binding (ADR-013 self-serve OR ADR-015 admin-resolved):
        // create the Membership(owner) in the same transaction so the user
        // is owner from the very first request.
        if (directOwnerUserId) {
          await tx.membership.create({
            data: { userId: directOwnerUserId, tenantId: t.id, role: "owner" },
          });
        }

        return t;
      });

      return this.toTenantResponse(tenant);
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "P2002"
      ) {
        throw new ConflictException(`slug "${dto.slug}" is already taken`);
      }
      this.logger.error(
        `createTenant failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
      throw err;
    }
  }

  async listTenants(): Promise<TenantResponseDto[]> {
    const rows = await this.prisma.client.tenant.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map((t) => this.toTenantResponse(t));
  }

  async getTenant(slug: string): Promise<TenantResponseDto> {
    const t = await this.prisma.client.tenant.findUnique({ where: { slug } });
    if (!t) throw new NotFoundException("tenant_not_found");
    assertCanAccessTenant(this.ctx.get(), t.id);
    return this.toTenantResponse(t);
  }

  /**
   * Public: what the funnel page at /b/<slug> needs to render. Always
   * returns tenant info if the slug exists (so we can show a branded
   * "currently offline" page) — caller decides what to do with isActive.
   */
  async getFunnel(slug: string): Promise<FunnelResolveResponseDto> {
    const db = this.prisma.client;
    const t = await db.tenant.findUnique({ where: { slug } });
    if (!t) throw new NotFoundException("tenant_not_found");

    const personas = await db.agentPersona.findMany({
      where: { tenantId: t.id },
      select: { locale: true },
      distinct: ["locale"],
    });

    // Fire-and-forget the visit event. If it fails (DB hiccup, foreign key
    // race) we still want to serve the page.
    db.event
      .create({
        data: { tenantId: t.id, kind: "funnel_visited", meta: { slug } },
      })
      .catch((err) =>
        this.logger.warn(
          `funnel_visited event failed for ${slug}: ${
            err instanceof Error ? err.message : "unknown"
          }`,
        ),
      );

    return {
      tenantSlug: t.slug,
      name: t.name,
      defaultLocale: t.defaultLocale,
      locales: personas.map((p) => p.locale),
      isActive: isTenantActive(t),
    };
  }

  /**
   * Admin: assign a paid plan. Also clears `trialEndsAt` (the tenant is now
   * paying, the trial is moot). Idempotent: re-assigning the same plan is a
   * no-op.
   */
  async grantPlan(id: string, planId: string): Promise<TenantResponseDto> {
    const db = this.prisma.client;
    const t = await db.tenant.findUnique({ where: { id } });
    if (!t) throw new NotFoundException("tenant_not_found");
    const plan = await db.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      throw new BadRequestException("plan_not_found_or_inactive");
    }
    const updated = await db.tenant.update({
      where: { id },
      data: { planId, trialEndsAt: null },
    });
    this.logger.log(`tenant ${t.slug} (${id}) → plan ${plan.slug}`);
    return this.toTenantResponse(updated);
  }

  /**
   * Admin: extend (or set) the trial by N days from *now*. Useful when a
   * customer needs more time before signing, or to grant a one-off trial
   * extension after a sales call. Clears planId — a tenant either has a
   * trial OR a plan, never both.
   */
  async extendTrial(
    id: string,
    days: number,
  ): Promise<TenantResponseDto> {
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      throw new BadRequestException("days_out_of_range_1_365");
    }
    const db = this.prisma.client;
    const t = await db.tenant.findUnique({ where: { id } });
    if (!t) throw new NotFoundException("tenant_not_found");
    const updated = await db.tenant.update({
      where: { id },
      data: {
        trialEndsAt: new Date(Date.now() + days * 86_400_000),
        planId: null,
      },
    });
    this.logger.log(`tenant ${t.slug} (${id}) trial extended by ${days}d`);
    return this.toTenantResponse(updated);
  }

  /**
   * Archive a tenant (pause the subscription). The agent stops serving on
   * every channel; all data is retained and the dashboard stays readable.
   * Idempotent: archiving an archived tenant is a no-op.
   */
  async archive(id: string): Promise<TenantResponseDto> {
    const db = this.prisma.client;
    const t = await db.tenant.findUnique({ where: { id } });
    if (!t) throw new NotFoundException("tenant_not_found");
    if (t.status === "archived") return this.toTenantResponse(t);
    const updated = await db.tenant.update({
      where: { id },
      data: { status: "archived", archivedAt: new Date() },
    });
    this.logger.log(`tenant ${t.slug} (${id}) archived`);
    return this.toTenantResponse(updated);
  }

  /** Reactivate an archived tenant — the agent serves again. Idempotent. */
  async reactivate(id: string): Promise<TenantResponseDto> {
    const db = this.prisma.client;
    const t = await db.tenant.findUnique({ where: { id } });
    if (!t) throw new NotFoundException("tenant_not_found");
    if (t.status === "active") return this.toTenantResponse(t);
    const updated = await db.tenant.update({
      where: { id },
      data: { status: "active", archivedAt: null },
    });
    this.logger.log(`tenant ${t.slug} (${id}) reactivated`);
    return this.toTenantResponse(updated);
  }

  /**
   * Hard delete. IRREVERSIBLE. The DB does the heavy lifting: every child
   * (agent, channels, knowledge, conversations, messages, leads, contacts,
   * events, usage, memberships) has onDelete: Cascade, so one row delete
   * purges the tenant entirely. S3-stored original documents are NOT reached
   * by the DB cascade, so purge them first (best-effort — never blocks).
   */
  async remove(id: string): Promise<{ id: string; slug: string; deleted: true }> {
    const db = this.prisma.client;
    const t = await db.tenant.findUnique({ where: { id } });
    if (!t) throw new NotFoundException("tenant_not_found");

    const purged = await this.storage.deleteByPrefix(`tenants/${id}/`);
    await db.tenant.delete({ where: { id } });
    this.logger.warn(
      `tenant ${t.slug} (${id}) HARD DELETED (cascade) — ` +
        `${purged} stored object(s) purged`,
    );
    return { id, slug: t.slug, deleted: true };
  }

  private toTenantResponse(t: {
    id: string;
    slug: string;
    name: string;
    defaultLocale: string;
    planId: string | null;
    trialEndsAt: Date | null;
    pendingOwnerEmail: string | null;
    status: string;
    archivedAt: Date | null;
    createdAt: Date;
  }): TenantResponseDto {
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      defaultLocale: t.defaultLocale,
      funnelUrl: `${appBaseUrl()}/b/${t.slug}`,
      trialEndsAt: t.trialEndsAt,
      planId: t.planId,
      isActive: isTenantActive(t),
      status: t.status,
      archivedAt: t.archivedAt,
      pendingOwnerEmail: t.pendingOwnerEmail,
      createdAt: t.createdAt,
    };
  }
}

/**
 * Single source of truth for "is the funnel/widget allowed to serve?". Used
 * by getFunnel and (eventually) by the chat runtime to gate replies.
 *
 * Active iff:
 *   - status !== archived (admin hasn't paused), AND
 *   - (trialEndsAt > now)  OR  (planId is set)
 *
 * planId-by-itself means active for now — once subscriptions get real
 * billing cycles, add a `Tenant.planExpiresAt` check here. Until then, a
 * planId is treated as a permanent grant (admin manually assigned it after
 * payment, admin will revoke it if the customer stops paying).
 */
export function isTenantActive(t: {
  status: string;
  trialEndsAt: Date | null;
  planId: string | null;
}): boolean {
  if (t.status === "archived") return false;
  if (t.trialEndsAt && t.trialEndsAt.getTime() > Date.now()) return true;
  if (t.planId) return true;
  return false;
}
