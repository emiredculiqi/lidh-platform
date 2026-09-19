import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ContactsService } from "./contacts.service";
import {
  ContactDetailDto,
  ContactListItemDto,
  SetContactStageDto,
} from "./dto/contact.dto";

@ApiTags("Contacts")
@Controller("contacts")
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  @ApiOperation({
    summary: "List a tenant's contacts",
    description: "Newest-seen first, max 300. Backs the Contacts section.",
  })
  @ApiQuery({ name: "tenantSlug", example: "acme-coffee" })
  @ApiOkResponse({ type: ContactListItemDto, isArray: true })
  list(@Query("tenantSlug") tenantSlug: string): Promise<ContactListItemDto[]> {
    return this.contacts.list(tenantSlug);
  }

  @Get(":id")
  @ApiOperation({
    summary: "A contact with all their conversations and leads",
  })
  @ApiOkResponse({ type: ContactDetailDto })
  get(@Param("id") id: string): Promise<ContactDetailDto> {
    return this.contacts.get(id);
  }

  @Post(":id/stage")
  @ApiOperation({
    summary: "Set a contact's stage",
    description:
      "new → lead → client, or not_a_fit. Operator action from the inbox " +
      "right panel or the contacts page. Every contact starts as `new`.",
  })
  @ApiOkResponse({ schema: { example: { stage: "lead" } } })
  setStage(
    @Param("id") id: string,
    @Body() dto: SetContactStageDto,
  ): Promise<{ stage: string }> {
    return this.contacts.setStage(id, dto.stage);
  }
}
