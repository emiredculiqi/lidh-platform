import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ConversationsService } from "./conversations.service";
import {
  ConversationListItemDto,
  ThreadDto,
} from "./dto/conversation.dto";

@ApiTags("Conversations")
@Controller("conversations")
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  @ApiOperation({
    summary: "List a tenant's conversations (inbox)",
    description:
      "Newest first, max 100. Excludes preview/test threads unless " +
      "`includePreview=true`. Backs the dashboard inbox.",
  })
  @ApiQuery({ name: "tenantSlug", example: "acme-coffee" })
  @ApiQuery({ name: "includePreview", required: false, example: false })
  @ApiOkResponse({ type: ConversationListItemDto, isArray: true })
  list(
    @Query("tenantSlug") tenantSlug: string,
    @Query("includePreview") includePreview?: string,
  ): Promise<ConversationListItemDto[]> {
    return this.conversations.list(tenantSlug, includePreview === "true");
  }

  @Get(":id")
  @ApiOperation({ summary: "Full conversation thread (messages)" })
  @ApiOkResponse({ type: ThreadDto })
  thread(@Param("id") id: string): Promise<ThreadDto> {
    return this.conversations.getThread(id);
  }
}
