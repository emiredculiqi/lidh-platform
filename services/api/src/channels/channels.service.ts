import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { CryptoService } from "../common/crypto/crypto.service";
import { TenantContextService } from "../common/tenant-context/tenant-context.service";
import { assertCanAccessTenant, assertTenantRole } from "../common/auth/access";
import { MetaOnboardingService } from "./meta-onboarding.service";
import type { ChannelStatusDto, ConnectWhatsAppDto } from "./dto/channels.dto";

/**
 * Channel management — connect/disconnect a tenant's WhatsApp number via Meta
 * Embedded Signup (coexistence), and expose channel status to the dashboard.
 * All mutations require owner|admin (platform admins bypass). Reads are open
 * to any tenant member.
 */
@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly ctx: TenantContextService,
    private readonly meta: MetaOnboardingService,
  ) {}

  /** List a tenant's channels (sanitized — never returns credentials). */
  async list(tenantSlug: string): Promise<ChannelStatusDto[]> {
    const tenant = await this.prisma.client.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException("tenant_not_found");
    assertCanAccessTenant(this.ctx.get(), tenant.id);

    const channels = await this.prisma.client.channel.findMany({
      where: { tenantId: tenant.id },
      orderBy: { kind: "asc" },
    });
    return channels.map((c) => {
      const cfg = (c.config ?? {}) as {
        displayPhoneNumber?: unknown;
        coexistence?: unknown;
      };
      return {
        kind: String(c.kind),
        status: String(c.status),
        displayPhoneNumber:
          typeof cfg.displayPhoneNumber === "string"
            ? cfg.displayPhoneNumber
            : undefined,
        coexistence:
          typeof cfg.coexistence === "boolean" ? cfg.coexistence : undefined,
      };
    });
  }

  /**
   * Complete the Embedded Signup handshake and connect a WhatsApp channel.
   * Steps: plan-gate → exchange code → subscribe our app to the WABA →
   * (coexistence: skip register) → fetch display number → encrypt + store the
   * token → upsert the channel to connected.
   */
  async connectWhatsApp(
    tenantSlug: string,
    dto: ConnectWhatsAppDto,
  ): Promise<ChannelStatusDto> {
    const tenant = await this.prisma.client.tenant.findUnique({
      where: { slug: tenantSlug },
      select: {
        id: true,
        planId: true,
        trialEndsAt: true,
        planOverrides: true,
      },
    });
    if (!tenant) throw new NotFoundException("tenant_not_found");
    assertTenantRole(this.ctx.get(), tenant.id, ["owner", "admin"]);

    // Plan gate: WhatsApp is a paid capability.
    if (!(await this.effectiveWhatsAppFeature(tenant))) {
      throw new ForbiddenException("plan_lacks_whatsapp");
    }

    const coexistence = dto.coexistence ?? true;

    // 1) Exchange the single-use code for a WABA-scoped business token.
    const { accessToken, expiresIn } = await this.meta.exchangeCodeForToken(
      dto.code,
    );

    // 2) Subscribe our app to the customer's WABA (their webhooks reach us).
    await this.meta.subscribeApp(dto.wabaId, accessToken);

    // 3) Coexistence keeps the number on the owner's WhatsApp Business App —
    //    do NOT register. Standard onboarding would register with a PIN.
    if (!coexistence) {
      const pin = this.randomPin();
      await this.meta.registerPhoneNumber(
        dto.phoneNumberId,
        accessToken,
        pin,
      );
    }

    // 4) Fetch the human-readable number for the dashboard.
    const info = await this.meta
      .getPhoneNumber(dto.phoneNumberId, accessToken)
      .catch(() => ({}) as { displayPhoneNumber?: string });

    // 5) Encrypt the token; assemble non-secret config.
    const credentialsEnc = this.crypto.encrypt(accessToken);
    const tokenExpiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : undefined;
    const config = {
      phoneNumberId: dto.phoneNumberId,
      wabaId: dto.wabaId,
      displayPhoneNumber: info.displayPhoneNumber ?? null,
      coexistence,
      ...(tokenExpiresAt ? { tokenExpiresAt } : {}),
    };

    // 6) Upsert (one whatsapp channel per tenant — @@unique([tenantId, kind])).
    //    Reconnect overwrites the old token/config and flips back to connected.
    await this.prisma.client.channel.upsert({
      where: {
        tenantId_kind: { tenantId: tenant.id, kind: "whatsapp" },
      },
      update: { status: "connected", config, credentialsEnc },
      create: {
        tenantId: tenant.id,
        kind: "whatsapp",
        status: "connected",
        config,
        credentialsEnc,
      },
    });

    await this.prisma.client.event.create({
      data: { tenantId: tenant.id, kind: "channel_connected" },
    });
    this.logger.log(
      `WhatsApp connected for tenant ${tenantSlug} ` +
        `(waba=${dto.wabaId}, coexistence=${coexistence})`,
    );

    return {
      kind: "whatsapp",
      status: "connected",
      displayPhoneNumber: info.displayPhoneNumber,
      coexistence,
    };
  }

  /** Disconnect a tenant's WhatsApp channel (unsubscribe + clear the token). */
  async disconnectWhatsApp(tenantSlug: string): Promise<ChannelStatusDto> {
    const tenant = await this.prisma.client.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException("tenant_not_found");
    assertTenantRole(this.ctx.get(), tenant.id, ["owner", "admin"]);

    const channel = await this.prisma.client.channel.findUnique({
      where: { tenantId_kind: { tenantId: tenant.id, kind: "whatsapp" } },
    });
    if (!channel) throw new NotFoundException("whatsapp_channel_not_found");

    // Best-effort unsubscribe (don't block disconnect on a Graph hiccup).
    const cfg = (channel.config ?? {}) as { wabaId?: unknown };
    const token = channel.credentialsEnc
      ? this.tryDecrypt(channel.credentialsEnc)
      : undefined;
    if (typeof cfg.wabaId === "string" && token) {
      await this.meta.unsubscribeApp(cfg.wabaId, token).catch((e) =>
        this.logger.warn(
          `unsubscribe failed (continuing): ${e instanceof Error ? e.message : "unknown"}`,
        ),
      );
    }

    // Keep the row (clean reconnect), drop the secret, flip status.
    await this.prisma.client.channel.update({
      where: { id: channel.id },
      data: { status: "disconnected", credentialsEnc: null },
    });
    await this.prisma.client.event.create({
      data: { tenantId: tenant.id, kind: "channel_disconnected" },
    });
    this.logger.log(`WhatsApp disconnected for tenant ${tenantSlug}`);

    return { kind: "whatsapp", status: "disconnected" };
  }

  /**
   * Whether WhatsApp is enabled for this tenant. Mirrors
   * MembersService.effectiveMaxMembers: trial → Premium plan's flag; paid →
   * the plan's flag (with per-tenant override); no plan → false.
   */
  private async effectiveWhatsAppFeature(tenant: {
    planId: string | null;
    trialEndsAt: Date | null;
    planOverrides: unknown;
  }): Promise<boolean> {
    const db = this.prisma.client;
    const onTrial = !!tenant.trialEndsAt && tenant.trialEndsAt > new Date();
    if (onTrial) {
      const premium = await db.plan.findUnique({
        where: { slug: "premium" },
        select: { features: true },
      });
      return readFlag(premium?.features, "hasWhatsApp");
    }
    if (tenant.planId) {
      const plan = await db.plan.findUnique({
        where: { id: tenant.planId },
        select: { features: true },
      });
      const override = (
        tenant.planOverrides as { hasWhatsApp?: boolean } | null
      )?.hasWhatsApp;
      if (typeof override === "boolean") return override;
      return readFlag(plan?.features, "hasWhatsApp");
    }
    return false;
  }

  private tryDecrypt(blob: string): string | undefined {
    try {
      return this.crypto.decrypt(blob);
    } catch {
      return undefined;
    }
  }

  private randomPin(): string {
    // 6-digit numeric PIN for phone registration (non-coexistence only).
    let pin = "";
    for (let i = 0; i < 6; i++) pin += Math.floor(Math.random() * 10);
    return pin;
  }
}

function readFlag(features: unknown, key: string): boolean {
  if (features && typeof features === "object") {
    return (features as Record<string, unknown>)[key] === true;
  }
  return false;
}
