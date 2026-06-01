import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
} from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { PrismaService } from "../common/prisma/prisma.service";
import { TenantsService } from "../tenants/tenants.service";
import { TenantResponseDto } from "../tenants/dto/tenant-response.dto";
import type { RequestAuth } from "../common/auth/auth.guard";
import {
  MeResponseDto,
  OnboardBusinessDto,
} from "./dto/onboarding.dto";

/**
 * Self-serve business signup (ADR-013). `/me` is the dashboard's "who am I,
 * which tenant do I own" probe — drives the layout redirect to /onboarding
 * for brand-new users. `/onboarding/business` is the one-step create:
 * Tenant + Agent + Persona(s) + web Channel + Membership(owner) in one tx.
 *
 * Both routes require Clerk auth (AuthGuard) but are NOT platform-admin
 * gated — that's the whole point: any signed-in user can hit them.
 */
@ApiTags("Onboarding")
@Controller()
export class OnboardingController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("me")
  @ApiOperation({
    summary: "The current user + their memberships",
    description:
      "Dashboard reads this on first paint to decide where to send the " +
      "user: platform admin → /tenants (all-tenants view); brand-new user " +
      "with no membership → /onboarding; existing business user → " +
      "/tenants/<their-slug>.",
  })
  @ApiOkResponse({ type: MeResponseDto })
  async me(
    @Req() req: FastifyRequest & { auth: RequestAuth },
  ): Promise<MeResponseDto> {
    const auth = req.auth;
    const user = await this.prisma.client.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, email: true, name: true, isPlatformAdmin: true },
    });
    if (!user) {
      // AuthGuard JIT-creates the user, so this should never happen.
      throw new BadRequestException("user_missing");
    }
    const memberships = await this.prisma.client.membership.findMany({
      where: { userId: auth.userId },
      select: {
        role: true,
        tenant: { select: { id: true, slug: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return {
      user,
      memberships: memberships.map((m) => ({
        role: String(m.role),
        tenant: m.tenant,
      })),
    };
  }

  @Post("onboarding/business")
  @ApiOperation({
    summary: "Create the caller's business (Tenant + Agent + Membership)",
    description:
      "Self-serve, atomic create. Rejects if the user is already a member " +
      "of any tenant (v1 = one business per user; platform admins use " +
      "`POST /v1/tenants` to provision multiple). Role assigned = `owner`.",
  })
  @ApiCreatedResponse({ type: TenantResponseDto })
  async onboardBusiness(
    @Body() dto: OnboardBusinessDto,
    @Req() req: FastifyRequest & { auth: RequestAuth },
  ): Promise<TenantResponseDto> {
    const userId = req.auth.userId;

    // v1: one tenant per business user.
    const existing = await this.prisma.client.membership.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        "already_a_member — your account already owns a business",
      );
    }

    // Normalise into the existing CreateTenantDto shape.
    const personas = dto.customAlbanianPersona
      ? [{ locale: "al", content: dto.customAlbanianPersona }]
      : undefined;

    return this.tenants.createTenant(
      {
        name: dto.name,
        slug: dto.slug,
        defaultLocale: dto.defaultLocale,
        businessFacts: dto.businessFacts,
        presetId: dto.presetId,
        personas,
        isDemo: dto.isDemo ?? false,
      },
      userId,
    );
  }
}
