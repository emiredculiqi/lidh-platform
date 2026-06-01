import { Body, Controller, Get, Put, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AgentsService } from "./agents.service";
import {
  AgentResponseDto,
  SetModelDto,
  UpsertPersonaDto,
} from "./dto/agent.dto";

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
}
