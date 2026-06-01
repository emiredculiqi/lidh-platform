import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { expandPersonas } from "@lidh/core";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../common/prisma/prisma.service";
import { StorageService } from "../common/storage/storage.service";
import { TenantContextService } from "../common/tenant-context/tenant-context.service";
import { assertCanAccessTenant } from "../common/auth/access";
import type { CreateTenantDto } from "./dto/create-tenant.dto";
import type {
  DemoResolveResponseDto,
  TenantResponseDto,
} from "./dto/tenant-response.dto";

// Read at call-time, NOT module top-level: @nestjs/config loads .env during
// bootstrap, after this module is imported. A top-level const would capture
// undefined and always fall back to the prod URL.
function demoBaseUrl(): string {
  return (
    process.env.DEMO_BASE_URL?.replace(/\/$/, "") ?? "https://demo.lidh.al"
  );
}

/**
 * Tenant lifecycle + the demo flow.
 *
 * A demo is a real Tenant with isDemo=true, an unguessable demoToken, and a
 * required demoExpiresAt — web-only. The DB CHECK constraint
 * `tenant_demo_consistency_check` enforces the (isDemo ⇔ token+expiry)
 * invariant; this service is written to always satisfy it.
 *
 * NOTE: these are admin endpoints. They are currently UNAUTHENTICATED,
 * consistent with the rest of M2 (Clerk gating is a later M2 step — see
 * ADR-003). Do not expose publicly before that lands.
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
    const isDemo = dto.isDemo ?? false;
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

    const demoToken = isDemo ? randomBytes(24).toString("base64url") : null;
    const demoExpiresAt = isDemo
      ? new Date(Date.now() + (dto.demoExpiresInDays ?? 14) * 86_400_000)
      : null;

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
            isDemo,
            demoToken,
            demoExpiresAt,
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

        // Demos are web-only (schema comment + this guard). Non-demos also
        // start with a web channel; WA/IG are added later via ChannelsModule.
        await tx.channel.create({
          data: {
            tenantId: t.id,
            kind: "web",
            status: "connected",
            config: { allowedOrigins: dto.webAllowedOrigins ?? [] },
          },
        });

        // Self-serve onboarding (ADR-013): the creating user becomes the
        // tenant's owner. Atomic with the rest of the create.
        if (ownerUserId) {
          await tx.membership.create({
            data: { userId: ownerUserId, tenantId: t.id, role: "owner" },
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

  /** Public: resolve a demo token to the info a demo page needs to boot. */
  async resolveDemo(token: string): Promise<DemoResolveResponseDto> {
    const db = this.prisma.client;
    const t = await db.tenant.findUnique({ where: { demoToken: token } });
    if (!t || !t.isDemo) throw new NotFoundException("demo_not_found");
    if (t.demoExpiresAt && t.demoExpiresAt.getTime() < Date.now()) {
      throw new GoneException("demo_expired");
    }
    if (t.status === "archived") throw new GoneException("demo_inactive");

    const personas = await db.agentPersona.findMany({
      where: { tenantId: t.id },
      select: { locale: true },
      distinct: ["locale"],
    });

    await db.event.create({
      data: {
        tenantId: t.id,
        kind: "demo_link_visited",
        meta: { token },
      },
    });

    return {
      tenantSlug: t.slug,
      name: t.name,
      defaultLocale: t.defaultLocale,
      locales: personas.map((p) => p.locale),
      expiresAt: t.demoExpiresAt as Date,
    };
  }

  /** Demo → paid: clears demo flags (satisfies the CHECK: !isDemo ⇒ nulls). */
  async graduate(id: string): Promise<TenantResponseDto> {
    const db = this.prisma.client;
    const t = await db.tenant.findUnique({ where: { id } });
    if (!t) throw new NotFoundException("tenant_not_found");
    if (!t.isDemo) {
      return this.toTenantResponse(t); // idempotent no-op
    }
    const updated = await db.tenant.update({
      where: { id },
      data: { isDemo: false, demoToken: null, demoExpiresAt: null },
    });
    // No EventKind for graduation yet — add `tenant_graduated` in a later
    // schema migration rather than misuse an unrelated enum value.
    return this.toTenantResponse(updated);
  }

  /**
   * Archive a tenant (pause the subscription). The agent stops serving on
   * every channel (enforced in chat.runWeb / whatsapp.handleInbound /
   * resolveDemo); all data is retained and the dashboard stays readable.
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
    isDemo: boolean;
    demoToken: string | null;
    demoExpiresAt: Date | null;
    status: string;
    archivedAt: Date | null;
    createdAt: Date;
  }): TenantResponseDto {
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      defaultLocale: t.defaultLocale,
      isDemo: t.isDemo,
      demoUrl: t.demoToken ? `${demoBaseUrl()}/${t.demoToken}` : null,
      demoExpiresAt: t.demoExpiresAt,
      status: t.status,
      archivedAt: t.archivedAt,
      createdAt: t.createdAt,
    };
  }
}
