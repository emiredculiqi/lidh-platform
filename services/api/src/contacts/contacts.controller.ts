import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ContactsService } from "./contacts.service";
import {
  AddContactNoteDto,
  ContactDetailDto,
  ContactListItemDto,
  ContactListQueryDto,
  ContactNoteDto,
  SetContactStageDto,
} from "./dto/contact.dto";

@ApiTags("Contacts")
@Controller("contacts")
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  @ApiOperation({
    summary: "List a tenant's contacts",
    description:
      "Search (q over name/phone/email), filter (stage, has=phone|email) and " +
      "sort (name = A–Z by display name, default; recent = last seen first). " +
      "Max 300 rows. Backs the Contacts section.",
  })
  @ApiQuery({ name: "tenantSlug", example: "acme-coffee" })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "stage", required: false, enum: ["new", "lead", "client", "not_a_fit"] })
  @ApiQuery({ name: "has", required: false, enum: ["phone", "email"] })
  @ApiQuery({ name: "sort", required: false, enum: ["name", "recent"] })
  @ApiOkResponse({ type: ContactListItemDto, isArray: true })
  list(@Query() query: ContactListQueryDto): Promise<ContactListItemDto[]> {
    return this.contacts.list(query);
  }

  @Get(":id")
  @ApiOperation({
    summary: "A contact with all their conversations and leads",
  })
  @ApiOkResponse({ type: ContactDetailDto })
  get(@Param("id") id: string): Promise<ContactDetailDto> {
    return this.contacts.get(id);
  }

  @Post(":id/notes")
  @ApiOperation({
    summary: "Add a manual note to a contact",
    description: "Free text by a team member; appears in the contact's notes timeline next to the assistant's intent notes (ADR-023).",
  })
  @ApiOkResponse({ type: ContactNoteDto })
  addNote(@Param("id") id: string, @Body() dto: AddContactNoteDto): Promise<ContactNoteDto> {
    return this.contacts.addNote(id, dto.body);
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
