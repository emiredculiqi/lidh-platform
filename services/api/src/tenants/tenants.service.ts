import {
  ConflictException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../common/prisma/prisma.service";
import type { CreateTenantDto } from "./dto/create-tenant.dto";
import type {
  DemoResolveResponseDto,
  TenantResponseDto,
} from "./dto/tenant-response.dto";

const DEMO_BASE_URL =
  process.env.DEMO_BASE_URL?.replace(/\/$/, "") ?? "https://demo.lidh.al";

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

  constructor(private readonly prisma: PrismaService) {}

  async createTenant(dto: CreateTenantDto): Promise<TenantResponseDto> {
    const db = this.prisma.client;
    const isDemo = dto.isDemo ?? false;
    const defaultLocale = dto.defaultLocale ?? "al";

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
          data: dto.personas.map((p) => ({
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

  private toTenantResponse(t: {
    id: string;
    slug: string;
    name: string;
    defaultLocale: string;
    isDemo: boolean;
    demoToken: string | null;
    demoExpiresAt: Date | null;
    createdAt: Date;
  }): TenantResponseDto {
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      defaultLocale: t.defaultLocale,
      isDemo: t.isDemo,
      demoUrl: t.demoToken ? `${DEMO_BASE_URL}/${t.demoToken}` : null,
      demoExpiresAt: t.demoExpiresAt,
      createdAt: t.createdAt,
    };
  }
}
