import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBooleanString, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { CONTACT_STAGES, type ContactStageValue } from "../../contacts/dto/contact.dto";
import { LIST_CHANNELS, LIST_ONLY, type ListChannel, type ListOnly } from "../list-query";

/** Query for GET /conversations. Everything optional except the tenant. */
export class ConversationListQueryDto {
  @ApiProperty({ example: "acme-coffee" })
  @IsString()
  @MinLength(1)
  tenantSlug!: string;

  @ApiPropertyOptional({ description: "Include preview/test threads.", example: "false" })
  @IsOptional()
  @IsBooleanString()
  includePreview?: string;

  @ApiPropertyOptional({ description: "Search contact name, phone, email and message text (case-insensitive substring)." })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: LIST_CHANNELS })
  @IsOptional()
  @IsIn(LIST_CHANNELS)
  channel?: ListChannel;

  @ApiPropertyOptional({ enum: CONTACT_STAGES })
  @IsOptional()
  @IsIn(CONTACT_STAGES)
  stage?: ContactStageValue;

  @ApiPropertyOptional({ enum: LIST_ONLY, description: "unanswered = the customer spoke last; favorites = starred by the caller." })
  @IsOptional()
  @IsIn(LIST_ONLY)
  only?: ListOnly;
}

export class ConversationListItemDto {
  @ApiProperty({ example: "clx_conv1" }) id!: string;
  @ApiProperty({ example: "web", enum: ["web", "whatsapp", "instagram"] })
  channelKind!: string;
  @ApiProperty({ example: "open" }) status!: string;
  @ApiProperty({ example: null, nullable: true, enum: ["human", "ai"] })
  aiOverride!: "human" | "ai" | null;
  @ApiProperty({ example: "human", enum: ["human", "ai"], description: "Who answers this thread right now." })
  aiEffective!: "human" | "ai";
  @ApiProperty({ example: "al", nullable: true, type: String })
  locale!: string | null;
  @ApiProperty({ example: "Ana B.", nullable: true, type: String })
  contactName!: string | null;
  @ApiProperty({ example: "+355699998877", nullable: true, type: String })
  contactPhone!: string | null;
  @ApiProperty({ example: "ana@example.com", nullable: true, type: String })
  contactEmail!: string | null;
  @ApiProperty({ example: "new", enum: ["new", "lead", "client", "not_a_fit"] })
  contactStage!: string;
  @ApiProperty({
    example: "user",
    nullable: true,
    type: String,
    description:
      "Role of the latest message. \"user\" = the customer spoke last and is waiting on a reply.",
  })
  lastMessageRole!: string | null;
  @ApiProperty({ example: "A bëni dërgesa të dielën?" })
  lastMessagePreview!: string;
  @ApiProperty({ example: 4 }) messageCount!: number;
  @ApiProperty({ example: 2, description: "Unread visitor messages" })
  unreadCount!: number;
  @ApiProperty({ example: false, description: "Starred by the calling user (personal)." })
  starred!: boolean;
  @ApiProperty({ example: "2026-05-16T13:00:00.000Z" }) lastMsgAt!: Date;
}

export class ConversationListDto {
  @ApiProperty({ type: [ConversationListItemDto] }) items!: ConversationListItemDto[];
  @ApiProperty({
    example: 3,
    description:
      "Tenant-wide count of open threads where the customer spoke last, " +
      "regardless of the filters applied to `items`.",
  })
  awaitingCount!: number;
}

export class UnreadItemDto {
  @ApiProperty({ example: "clx_conv1" }) conversationId!: string;
  @ApiProperty({ example: "Ana B.", nullable: true, type: String })
  contactName!: string | null;
  @ApiProperty({ example: "web" }) channelKind!: string;
  @ApiProperty({ example: 2 }) unreadCount!: number;
  @ApiProperty({ example: "2026-05-16T13:00:00.000Z" }) lastMsgAt!: Date;
}

export class UnreadSummaryDto {
  @ApiProperty({ example: 3, description: "Conversations with unread messages" })
  total!: number;
  @ApiProperty({ type: [UnreadItemDto] }) items!: UnreadItemDto[];
}

export class ThreadMessageDto {
  @ApiProperty({ example: "user", enum: ["user", "assistant", "tool"] })
  role!: string;
  @ApiProperty({ example: "A bëni dërgesa të dielën?", nullable: true, type: String })
  contentText!: string | null;
  @ApiProperty({ example: "capture_lead", nullable: true, type: String })
  toolName!: string | null;
  @ApiProperty({ example: "2026-05-16T13:00:00.000Z" }) createdAt!: Date;
}

export class ThreadDto {
  @ApiProperty({ example: "clx_conv1" }) id!: string;
  @ApiProperty({ example: "web" }) channelKind!: string;
  @ApiProperty({ example: "open" }) status!: string;
  @ApiProperty({ example: null, nullable: true, enum: ["human", "ai"] })
  aiOverride!: "human" | "ai" | null;
  @ApiProperty({ example: "human", enum: ["human", "ai"], description: "Who answers this thread right now." })
  aiEffective!: "human" | "ai";
  @ApiProperty({ example: "human", enum: ["human", "ai"], description: "What the business setting resolves to right now, ignoring the override." })
  aiDefault!: "human" | "ai";
  @ApiProperty({ example: "al", nullable: true, type: String })
  locale!: string | null;
  @ApiProperty({ example: "clx_contact1" }) contactId!: string;
  @ApiProperty({ example: "Ana B.", nullable: true, type: String })
  contactName!: string | null;
  @ApiProperty({ example: "+355699998877", nullable: true, type: String })
  contactPhone!: string | null;
  @ApiProperty({ example: "ana@example.com", nullable: true, type: String })
  contactEmail!: string | null;
  @ApiProperty({ example: "new", enum: ["new", "lead", "client", "not_a_fit"] })
  contactStage!: string;
  @ApiProperty({ example: false, description: "Starred by the calling user (personal)." })
  starred!: boolean;
  @ApiProperty({ type: [ThreadMessageDto] }) messages!: ThreadMessageDto[];
}
