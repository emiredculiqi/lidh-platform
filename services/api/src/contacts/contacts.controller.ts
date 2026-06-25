import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ContactsService } from "./contacts.service";
import { ContactDetailDto, ContactListItemDto } from "./dto/contact.dto";

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
}
