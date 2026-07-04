import { Body, Controller, Get, Put, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AgentsService } from "./agents.service";
import { PlatformAdminOnly } from "../common/auth/platform-admin.decorator";
import {
  AgentResponseDto,
  SetBusinessFactsDto,
  SetDefaultLocaleDto,
  SetModelDto,
  SetToolsDto,
  UpsertPersonaDto,
} from "./dto/agent.dto";

@ApiTags("Agents")
@PlatformAdminOnly() // ALL agent config is platform-admin-only (managed service)
@Controller("agents")
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get()
  @ApiOperation({
    summary: "Get a tenant's agent + all language personas",
    description: "Backs the dashboard Agent page. _Admin — see ADR-003._",
  })
  @ApiQuery({ name: "tenantSlug", example: "acme-coffee" })
  @ApiOkResponse({ type: AgentResponseDto })
  get(@Query("tenantSlug") tenantSlug: string): Promise<AgentResponseDto> {
    return this.agents.getByTenant(tenantSlug);
  }

  @Put("personas")
  @ApiOperation({
    summary: "Create/update one language's persona",
    description:
      "Upserts the persona for `(tenant's agent, locale)`. Takes effect on " +
      "the next chat message (persona is read fresh per request). Use a new " +
      "`locale` to add a language.",
  })
  @ApiOkResponse({ type: AgentResponseDto })
  upsert(@Body() dto: UpsertPersonaDto): Promise<AgentResponseDto> {
    return this.agents.upsertPersona(dto.tenantSlug, dto.locale, dto.content);
  }

  @Put("model")
  @ApiOperation({
    summary: "Set the tenant's model (Haiku/Sonnet) — ADR-011",
    description:
      "Sets `Agent.modelOverride`. `model` omitted/null ⇒ platform default " +
      "(Haiku). Takes effect on the next message (chat & WhatsApp runtimes " +
      "read it per request). Sonnet costs more but handles harder " +
      "conversations better.",
  })
  @ApiOkResponse({ type: AgentResponseDto })
  setModel(@Body() dto: SetModelDto): Promise<AgentResponseDto> {
    return this.agents.setModel(dto.tenantSlug, dto.model ?? null);
  }

  @Put("tools")
  @ApiOperation({
    summary: "Set the agent's tool flags (platform admin)",
    description: "Sets Agent.toolsEnabled. Takes effect on the next message.",
  })
  @ApiOkResponse({ type: AgentResponseDto })
  setTools(@Body() dto: SetToolsDto): Promise<AgentResponseDto> {
    return this.agents.setTools(dto.tenantSlug, dto.tools);
  }

  @Put("business-facts")
  @ApiOperation({
    summary: "Set the stable business facts (platform admin)",
    description: "Merged into Tenant.settings; injected into every prompt.",
  })
  @ApiOkResponse({ type: AgentResponseDto })
  setBusinessFacts(@Body() dto: SetBusinessFactsDto): Promise<AgentResponseDto> {
    return this.agents.setBusinessFacts(dto.tenantSlug, dto.businessFacts);
  }

  @Put("default-locale")
  @ApiOperation({
    summary: "Set the agent's default locale (platform admin)",
    description: "Updates Agent + Tenant defaultLocale.",
  })
  @ApiOkResponse({ type: AgentResponseDto })
  setDefaultLocale(@Body() dto: SetDefaultLocaleDto): Promise<AgentResponseDto> {
    return this.agents.setDefaultLocale(dto.tenantSlug, dto.locale);
  }
}
