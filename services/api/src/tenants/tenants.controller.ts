import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Public } from "../common/auth/public.decorator";
import { PlatformAdminOnly } from "../common/auth/platform-admin.decorator";
import { TenantsService } from "./tenants.service";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import {
  DemoResolveResponseDto,
  TenantResponseDto,
} from "./dto/tenant-response.dto";

@ApiTags("Tenants")
@Controller()
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Post("tenants")
  @PlatformAdminOnly()
  @ApiOperation({
    summary: "Create a tenant (+ agent, personas, web channel)",
    description:
      "**How to consume:** `POST /v1/tenants`. Creates the full tenant in " +
      "one transaction: tenant + agent + one persona per language + a web " +
      "channel. Set `isDemo:true` to get an unguessable, expiring demo link " +
      "back in `demoUrl` — hand that to a prospect.\n\n" +
      "_Admin endpoint — unauthenticated in M2 (see ADR-003); Clerk gating " +
      "lands later._\n\n" +
      "```bash\ncurl -X POST http://localhost:4000/v1/tenants \\\n" +
      '  -H "Content-Type: application/json" \\\n' +
      '  -d \'{"name":"Bar Roma","slug":"bar-roma","isDemo":true,' +
      '"personas":[{"locale":"al","content":"Ti je asistenti i Bar Roma…"}]}\'\n```',
  })
  @ApiCreatedResponse({ type: TenantResponseDto })
  create(@Body() dto: CreateTenantDto): Promise<TenantResponseDto> {
    return this.tenants.createTenant(dto);
  }

  @Get("tenants")
  @PlatformAdminOnly()
  @ApiOperation({
    summary: "List all tenants (platform-admin)",
    description:
      "Every tenant, newest first. Demos include their demoUrl. Backs the " +
      "dashboard tenants list. _Admin endpoint — see ADR-003._",
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

  @Post("tenants/:id/graduate")
  @PlatformAdminOnly()
  @ApiOperation({
    summary: "Graduate a demo → paid tenant",
    description:
      "Clears the demo flags (isDemo=false, demoToken/expiry nulled). " +
      "Idempotent for already-paid tenants. Conversations/leads/knowledge " +
      "are preserved — same tenant, just no longer a demo.",
  })
  @ApiOkResponse({ type: TenantResponseDto })
  graduate(@Param("id") id: string): Promise<TenantResponseDto> {
    return this.tenants.graduate(id);
  }

  @Post("tenants/:id/archive")
  @PlatformAdminOnly()
  @ApiOperation({
    summary: "Archive a tenant (pause the subscription)",
    description:
      "**How to consume:** `POST /v1/tenants/{id}/archive`. Stops the agent " +
      "from serving end-customers on *every* channel (web widget, demo link, " +
      "WhatsApp) — they get a polite 'unavailable' instead of a reply. " +
      "**No data is deleted**: conversations, leads and knowledge are " +
      "retained, and the dashboard stays fully readable so you can review or " +
      "export. Fully reversible with `/reactivate`. Idempotent — archiving " +
      "an already-archived tenant is a no-op.\n\n" +
      "Use this when a customer stops paying but you may resume them, or " +
      "before deleting so service halts immediately while you decide.",
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
      "Reverse of `/archive`: `status` → active, the agent serves again on " +
      "all channels immediately. Idempotent for already-active tenants.",
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
      "**How to consume:** `DELETE /v1/tenants/{id}`. Permanently removes the " +
      "tenant and **every** related row — agent, personas, channels, " +
      "knowledge sources + chunks, contacts, conversations, messages, leads, " +
      "events, usage, memberships (DB `onDelete: Cascade`) — plus the " +
      "tenant's original uploaded documents in object storage (best-effort). " +
      "**There is no undo.** Prefer `/archive` if you might restore the " +
      "customer. UI requires typing the slug to confirm.",
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
  @Get("demo/:token")
  @ApiOperation({
    summary: "Resolve a demo link (public)",
    description:
      "**Public.** The demo page calls this with the token from " +
      "`demo.lidh.al/{token}`. Returns the tenantSlug to use with " +
      "`POST /v1/chat/web`, plus name/locales. 404 if unknown, 410 if " +
      "expired. Records a `demo_link_visited` event.",
  })
  @ApiOkResponse({ type: DemoResolveResponseDto })
  resolveDemo(
    @Param("token") token: string,
  ): Promise<DemoResolveResponseDto> {
    return this.tenants.resolveDemo(token);
  }
}
