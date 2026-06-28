import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { IsBoolean, IsString, MaxLength, MinLength } from "class-validator";
import { ConversationsService } from "./conversations.service";
import {
  ConversationListItemDto,
  ThreadDto,
  UnreadSummaryDto,
} from "./dto/conversation.dto";

class SetAiDto {
  @ApiProperty({ description: "true = pause AI (human takes over)." })
  @IsBoolean()
  paused!: boolean;
}

class ReplyDto {
  @ApiProperty({ description: "The human agent's reply to the visitor." })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text!: string;
}

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

  @Get("unread")
  @ApiOperation({
    summary: "Unread summary for the sidebar badge + bell",
    description: "Conversations with unread visitor messages (newest first).",
  })
  @ApiQuery({ name: "tenantSlug", example: "acme-coffee" })
  @ApiOkResponse({ type: UnreadSummaryDto })
  unread(@Query("tenantSlug") tenantSlug: string): Promise<UnreadSummaryDto> {
    return this.conversations.unreadSummary(tenantSlug);
  }

  @Get(":id")
  @ApiOperation({ summary: "Full conversation thread (messages)" })
  @ApiOkResponse({ type: ThreadDto })
  thread(@Param("id") id: string): Promise<ThreadDto> {
    return this.conversations.getThread(id);
  }

  @Post(":id/read")
  @ApiOperation({ summary: "Mark a conversation read (operator opened it)" })
  markRead(@Param("id") id: string): Promise<{ ok: true }> {
    return this.conversations.markRead(id);
  }

  @Post(":id/ai")
  @ApiOperation({
    summary: "Pause/resume the AI on a conversation (human takeover)",
  })
  setAi(
    @Param("id") id: string,
    @Body() dto: SetAiDto,
  ): Promise<{ aiPaused: boolean }> {
    return this.conversations.setAi(id, dto.paused);
  }

  @Post(":id/reply")
  @ApiOperation({ summary: "Send a human reply into a conversation" })
  reply(
    @Param("id") id: string,
    @Body() dto: ReplyDto,
  ): Promise<{ ok: true }> {
    return this.conversations.reply(id, dto.text);
  }
}
