import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import {
  IsArray,
  IsEmail,
  IsInt,
  IsString,
  Max,
  Min,
  MinLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Public } from "../common/auth/public.decorator";
import { PlatformAdminOnly } from "../common/auth/platform-admin.decorator";
import { TenantsService } from "./tenants.service";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import {
  FunnelResolveResponseDto,
  TenantResponseDto,
} from "./dto/tenant-response.dto";

class GrantPlanDto {
  @ApiProperty({
    description: "FK to Plan.id. The plan must exist and be active.",
  })
  @IsString()
  @MinLength(1)
  planId!: string;
}

class ExtendTrialDto {
  @ApiProperty({
    description: "Days from *now*. Resets the trial window.",
    minimum: 1,
    maximum: 365,
  })
  @IsInt()
  @Min(1)
  @Max(365)
  days!: number;
}

class WebOriginsDto {
  @ApiProperty({
    type: [String],
    description:
      "Origins (scheme://host[:port]) allowed to embed the chat widget. " +
      "Empty = open to any site. Lidh.al's own pages are always allowed.",
    example: ["https://shpresabeauty.com", "https://www.shpresabeauty.com"],
  })
  @IsArray()
  @IsString({ each: true })
  allowedOrigins!: string[];
}

class SetOwnerDto {
  @ApiProperty({
    description:
      "Owner's email. Bound immediately if a User with this email exists; " +
      "otherwise stored as Tenant.pendingOwnerEmail for AuthGuard to bind " +
      "on first sign-in. Case-insensitive.",
    example: "owner@bar-roma.al",
  })
  @IsEmail()
  email!: string;
}

@ApiTags("Tenants")
@Controller()
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Post("tenants")
  @PlatformAdminOnly()
  @ApiOperation({
    summary: "Create a tenant (+ agent, personas, web channel)",
    description:
      "Creates the full tenant in one transaction: tenant + agent + one " +
      "persona per language + a web channel. Every tenant starts with a " +
      "30-day trial (`trialEndsAt = now + 30d`) and gets a permanent " +
      "funnel page at `funnelUrl`. To promote the tenant to paid, hit " +
      "`/grant-plan` later.",
  })
  @ApiCreatedResponse({ type: TenantResponseDto })
  create(@Body() dto: CreateTenantDto): Promise<TenantResponseDto> {
    return this.tenants.createTenant(dto);
  }

  @Get("tenants")
  @PlatformAdminOnly()
  @ApiOperation({
    summary: "List all tenants (platform-admin)",
    description: "Every tenant, newest first. Backs the dashboard tenants list.",
  })
  @ApiOkResponse({ type: TenantResponseDto, isArray: true })
  list(): Promise<TenantResponseDto[]> {
    return this.tenants.listTenants();
  }

  @Get("tenants/:slug")
  @ApiOperation({ summary: "Get a tenant by slug" })
  @ApiOkResponse({ type: TenantResponseDto })
  get(@Param("slug") slug: string): Promise<TenantResponseDto> {
    return this.tenants.getTenant(slug);
  }

  @Get("tenants/:slug/web-origins")
  @PlatformAdminOnly()
  @ApiOperation({
    summary: "Get the chat widget's allowed origins (platform admin)",
    description:
      "Origins permitted to embed this tenant's widget (empty = open). " +
      "Managed from the admin console's Channels tab.",
  })
  getWebOrigins(
    @Param("slug") slug: string,
  ): Promise<{ allowedOrigins: string[] }> {
    return this.tenants.getWebOrigins(slug);
  }

  @Put("tenants/:slug/web-origins")
  @PlatformAdminOnly()
  @ApiOperation({
    summary: "Set the chat widget's allowed origins (platform admin)",
    description:
      "Replaces the allow-list. Empty array = open to any site. Lidh.al's " +
      "own funnel/dashboard origins are always allowed regardless.",
  })
  setWebOrigins(
    @Param("slug") slug: string,
    @Body() dto: WebOriginsDto,
  ): Promise<{ allowedOrigins: string[] }> {
    return this.tenants.setWebOrigins(slug, dto.allowedOrigins);
  }

  @Post("tenants/:id/grant-plan")
  @PlatformAdminOnly()
  @ApiOperation({
    summary: "Assign a paid plan (trial → paid)",
    description:
      "After the SMB pays (bank transfer / cash — no Stripe yet), admin " +
      "assigns the plan. Clears `trialEndsAt` (a tenant has a trial OR a " +
      "plan, never both). Idempotent.",
  })
  @ApiOkResponse({ type: TenantResponseDto })
  grantPlan(
    @Param("id") id: string,
    @Body() dto: GrantPlanDto,
  ): Promise<TenantResponseDto> {
    return this.tenants.grantPlan(id, dto.planId);
  }

  @Post("tenants/:id/extend-trial")
  @PlatformAdminOnly()
  @ApiOperation({
    summary: "Extend (or set) the trial by N days from now",
    description:
      "Used by admin when a customer needs more time before signing. " +
      "Clears `planId` (trial and plan are mutually exclusive).",
  })
  @ApiOkResponse({ type: TenantResponseDto })
  extendTrial(
    @Param("id") id: string,
    @Body() dto: ExtendTrialDto,
  ): Promise<TenantResponseDto> {
    return this.tenants.extendTrial(id, dto.days);
  }

  @Post("tenants/:id/set-owner")
  @PlatformAdminOnly()
  @ApiOperation({
    summary: "Set / change the tenant's intended business owner by email",
    description:
      "Binds the email as owner: immediately via Membership(owner) if a " +
      "User exists with that email, else stashed as Tenant.pendingOwnerEmail " +
      "and bound on first sign-in (ADR-015). Idempotent for the same email. " +
      "Does not remove existing memberships.",
  })
  @ApiOkResponse({ type: TenantResponseDto })
  setOwner(
    @Param("id") id: string,
    @Body() dto: SetOwnerDto,
  ): Promise<TenantResponseDto> {
    return this.tenants.setOwner(id, dto.email);
  }

  @Post("tenants/:id/archive")
  @PlatformAdminOnly()
  @ApiOperation({
    summary: "Archive a tenant (pause the subscription)",
    description:
      "Stops the agent from serving end-customers on *every* channel " +
      "(web widget, funnel page, WhatsApp). No data is deleted; the " +
      "dashboard stays readable so admin can review/export. Fully " +
      "reversible with `/reactivate`. Idempotent.",
  })
  @ApiOkResponse({ type: TenantResponseDto })
  archive(@Param("id") id: string): Promise<TenantResponseDto> {
    return this.tenants.archive(id);
  }

  @Post("tenants/:id/reactivate")
  @PlatformAdminOnly()
  @ApiOperation({
    summary: "Reactivate an archived tenant",
    description:
      "Reverse of `/archive`: `status` → active. Idempotent.",
  })
  @ApiOkResponse({ type: TenantResponseDto })
  reactivate(@Param("id") id: string): Promise<TenantResponseDto> {
    return this.tenants.reactivate(id);
  }

  @Delete("tenants/:id")
  @PlatformAdminOnly()
  @ApiOperation({
    summary: "Delete a tenant — IRREVERSIBLE, purges everything",
    description:
      "Permanently removes the tenant and **every** related row (DB " +
      "`onDelete: Cascade`) plus stored documents (best-effort). " +
      "**There is no undo.** Prefer `/archive` if you might restore.",
  })
  @ApiOkResponse({
    schema: {
      example: { id: "clx_tenant123", slug: "bar-roma", deleted: true },
    },
  })
  remove(
    @Param("id") id: string,
  ): Promise<{ id: string; slug: string; deleted: true }> {
    return this.tenants.remove(id);
  }

  @Public()
  @Get("funnel/:slug")
  @ApiOperation({
    summary: "Resolve a tenant's funnel page (public)",
    description:
      "**Public.** The funnel page at `app.lidh.al/b/:slug` calls this to " +
      "render. Returns tenant name + locales + `isActive`. When `isActive` " +
      "is false (trial expired, no plan, or archived), the page shows the " +
      "soft 'currently offline' message instead of booting the chat. " +
      "Records a `funnel_visited` event.",
  })
  @ApiOkResponse({ type: FunnelResolveResponseDto })
  resolveFunnel(
    @Param("slug") slug: string,
  ): Promise<FunnelResolveResponseDto> {
    return this.tenants.getFunnel(slug);
  }
}
