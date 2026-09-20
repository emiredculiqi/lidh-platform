import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { ConversationsService } from "./conversations.service";
import { ChatService } from "../chat/chat.service";
import {
  ConversationListDto,
  ConversationListQueryDto,
  PresenceDto,
  ThreadDto,
  UnreadSummaryDto,
  ViewerDto,
} from "./dto/conversation.dto";

const RESPONDER_MODES = ["human", "ai", "inherit"] as const;
type ResponderChoice = (typeof RESPONDER_MODES)[number];

class SetResponderDto {
  @ApiProperty({
    enum: RESPONDER_MODES,
    description:
      "human = take over (assistant off for this thread); ai = hand the thread " +
      "to the assistant; inherit = clear the override and follow the business " +
      "setting (human by default, or the schedule).",
  })
  @IsIn(RESPONDER_MODES)
  mode!: ResponderChoice;
}

class SetStarDto {
  @ApiProperty({ example: true, description: "true = star, false = unstar (personal to the caller)." })
  @IsBoolean()
  starred!: boolean;
}

const SUGGESTION_OUTCOMES = ["used", "edited"] as const;
type SuggestionOutcome = (typeof SUGGESTION_OUTCOMES)[number];

class ReplyDto {
  @ApiProperty({ description: "The human agent's reply to the visitor." })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text!: string;

  @ApiProperty({
    required: false,
    enum: SUGGESTION_OUTCOMES,
    description:
      "When the reply started from an assistant draft: used = sent as-is, " +
      "edited = changed first. Omitted for a reply typed from scratch.",
  })
  @IsOptional()
  @IsIn(SUGGESTION_OUTCOMES)
  suggestion?: SuggestionOutcome;
}

class SuggestResponseDto {
  @ApiProperty({ example: "Po, dërgojmë në Durrës çdo ditë…" }) text!: string;
  @ApiProperty({ example: 1840 }) tokensIn!: number;
  @ApiProperty({ example: 92 }) tokensOut!: number;
}

@ApiTags("Conversations")
@Controller("conversations")
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly chat: ChatService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "List a tenant's conversations (inbox)",
    description:
      "Newest first, max 100. Search (q over contact name/phone/email and " +
      "message text), filter by channel, contact stage and only=unanswered. " +
      "Excludes preview/test threads unless `includePreview=true`. Also " +
      "returns the tenant-wide awaiting-reply count. Backs the dashboard inbox.",
  })
  @ApiQuery({ name: "tenantSlug", example: "acme-coffee" })
  @ApiQuery({ name: "includePreview", required: false, example: false })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "channel", required: false, enum: ["web", "whatsapp", "instagram"] })
  @ApiQuery({ name: "stage", required: false, enum: ["new", "lead", "client", "not_a_fit"] })
  @ApiQuery({ name: "only", required: false, enum: ["unanswered"] })
  @ApiOkResponse({ type: ConversationListDto })
  list(@Query() query: ConversationListQueryDto): Promise<ConversationListDto> {
    return this.conversations.list(query);
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
    summary: "Set who answers this conversation",
    description:
      "Per-thread override of the business's responder setting. A manual " +
      "override wins over the schedule until cleared with `inherit`.",
  })
  @ApiOkResponse({ schema: { example: { aiOverride: "human", aiEffective: "human" } } })
  setResponder(
    @Param("id") id: string,
    @Body() dto: SetResponderDto,
  ): Promise<{ aiOverride: "human" | "ai" | null; aiEffective: "human" | "ai" }> {
    return this.conversations.setResponder(id, dto.mode);
  }

  @Post(":id/star")
  @ApiOperation({
    summary: "Star or unstar this conversation for the calling user",
    description:
      "Personal: other team members don't see it. Starred threads are " +
      "always returned first and the inbox shows them as their own section.",
  })
  @ApiOkResponse({ schema: { example: { starred: true } } })
  setStar(
    @Param("id") id: string,
    @Body() dto: SetStarDto,
  ): Promise<{ starred: boolean }> {
    return this.conversations.setStar(id, dto.starred);
  }

  @Post(":id/presence")
  @ApiOperation({
    summary: "Presence heartbeat: I'm on this thread (typing or not), or leaving",
    description:
      "Dashboards call this every ~20 s while a thread is open, on typing " +
      "changes, and with leave=true on close. In-memory, single-instance; " +
      "a viewer expires 45 s after its last heartbeat. Other dashboards of " +
      "the tenant receive a `presence` live event on every change (ADR-024 §3).",
  })
  @ApiOkResponse({ type: ViewerDto, isArray: true })
  presence(
    @Param("id") id: string,
    @Body() dto: PresenceDto,
  ): Promise<{ viewers: ViewerDto[] }> {
    return this.conversations.presence(id, dto);
  }

  @Post(":id/suggest")
  @ApiOperation({
    summary: "Draft a reply for the team to review (nothing is sent)",
    description:
      "Runs the assistant over the thread with tools off and returns one " +
      "draft. No message is stored and the customer sees nothing; only the " +
      "token cost is recorded. 400 `nothing_to_answer` unless the customer " +
      "spoke last (ADR-024 §5).",
  })
  @ApiOkResponse({ type: SuggestResponseDto })
  suggest(@Param("id") id: string): Promise<SuggestResponseDto> {
    return this.chat.suggestReply(id);
  }

  @Post(":id/reply")
  @ApiOperation({ summary: "Send a human reply into a conversation" })
  reply(
    @Param("id") id: string,
    @Body() dto: ReplyDto,
  ): Promise<{ ok: true }> {
    return this.conversations.reply(id, dto.text, dto.suggestion);
  }
}
