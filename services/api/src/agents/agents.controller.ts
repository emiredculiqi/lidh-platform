import { Body, Controller, Get, Put, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AgentsService } from "./agents.service";
import { AgentResponseDto, UpsertPersonaDto } from "./dto/agent.dto";

@ApiTags("Agents")
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
}
