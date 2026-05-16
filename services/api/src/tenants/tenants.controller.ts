import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
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

  @Get("tenants/:slug")
  @ApiOperation({ summary: "Get a tenant by slug" })
  @ApiOkResponse({ type: TenantResponseDto })
  get(@Param("slug") slug: string): Promise<TenantResponseDto> {
    return this.tenants.getTenant(slug);
  }

  @Post("tenants/:id/graduate")
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
