import { ApiProperty } from "@nestjs/swagger";

export class ConversationListItemDto {
  @ApiProperty({ example: "clx_conv1" }) id!: string;
  @ApiProperty({ example: "web", enum: ["web", "whatsapp", "instagram"] })
  channelKind!: string;
  @ApiProperty({ example: "open" }) status!: string;
  @ApiProperty({ example: false }) aiPaused!: boolean;
  @ApiProperty({ example: "al", nullable: true, type: String })
  locale!: string | null;
  @ApiProperty({ example: "Ana B.", nullable: true, type: String })
  contactName!: string | null;
  @ApiProperty({ example: "+355699998877", nullable: true, type: String })
  contactPhone!: string | null;
  @ApiProperty({ example: "A bëni dërgesa të dielën?" })
  lastMessagePreview!: string;
  @ApiProperty({ example: 4 }) messageCount!: number;
  @ApiProperty({ example: "2026-05-16T13:00:00.000Z" }) lastMsgAt!: Date;
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
  @ApiProperty({ example: false }) aiPaused!: boolean;
  @ApiProperty({ example: "Ana B.", nullable: true, type: String })
  contactName!: string | null;
  @ApiProperty({ example: "+355699998877", nullable: true, type: String })
  contactPhone!: string | null;
  @ApiProperty({ type: [ThreadMessageDto] }) messages!: ThreadMessageDto[];
}
