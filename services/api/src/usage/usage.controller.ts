import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { UsageService } from "./usage.service";
import { UsageDto } from "./dto/usage.dto";

@ApiTags("Usage")
@Controller("usage")
export class UsageController {
  constructor(private readonly usage: UsageService) {}

  @Get()
  @ApiOperation({
    summary: "This-month usage for a tenant",
    description:
      "Live COUNT/SUM over customer conversations (excludes preview/test). " +
      "Backs the dashboard usage card.",
  })
  @ApiQuery({ name: "tenantSlug", example: "acme-coffee" })
  @ApiOkResponse({ type: UsageDto })
  get(@Query("tenantSlug") tenantSlug: string): Promise<UsageDto> {
    return this.usage.getUsage(tenantSlug);
  }
}
