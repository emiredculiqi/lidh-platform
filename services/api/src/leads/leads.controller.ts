import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { LeadsService } from "./leads.service";
import { LeadListItemDto } from "./dto/lead.dto";

@ApiTags("Leads")
@Controller("leads")
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  @ApiOperation({
    summary: "List a tenant's captured leads",
    description: "Newest first, max 200. Backs the dashboard leads table.",
  })
  @ApiQuery({ name: "tenantSlug", example: "acme-coffee" })
  @ApiOkResponse({ type: LeadListItemDto, isArray: true })
  list(@Query("tenantSlug") tenantSlug: string): Promise<LeadListItemDto[]> {
    return this.leads.list(tenantSlug);
  }
}
