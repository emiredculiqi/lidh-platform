import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export const CONTACT_STAGES = ["new", "lead", "client", "not_a_fit"] as const;
export type ContactStageValue = (typeof CONTACT_STAGES)[number];

/** Query for GET /contacts. Everything optional except the tenant. */
export class ContactListQueryDto {
  @ApiProperty({ example: "acme-coffee" })
  @IsString()
  @MinLength(1)
  tenantSlug!: string;

  @ApiPropertyOptional({ description: "Search name, phone and email (case-insensitive substring)." })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: CONTACT_STAGES })
  @IsOptional()
  @IsIn(CONTACT_STAGES)
  stage?: ContactStageValue;

  @ApiPropertyOptional({ enum: ["phone", "email"], description: "Only contacts that have this detail." })
  @IsOptional()
  @IsIn(["phone", "email"])
  has?: "phone" | "email";

  @ApiPropertyOptional({ enum: ["name", "recent"], description: "name = A–Z by display name (default); recent = last seen first." })
  @IsOptional()
  @IsIn(["name", "recent"])
  sort?: "name" | "recent";
}

export class SetContactStageDto {
  @ApiProperty({ enum: CONTACT_STAGES, example: "lead" })
  @IsIn(CONTACT_STAGES)
  stage!: ContactStageValue;
}

export class ContactListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: CONTACT_STAGES, example: "new" }) stage!: string;
  @ApiProperty({ nullable: true, type: String }) name!: string | null;
  @ApiProperty({ nullable: true, type: String }) phone!: string | null;
  @ApiProperty({ nullable: true, type: String }) email!: string | null;
  @ApiProperty({ nullable: true, type: String }) source!: string | null;
  @ApiProperty() conversationCount!: number;
  @ApiProperty() noteCount!: number;
  @ApiProperty() lastSeenAt!: Date;
}

export class ContactConversationDto {
  @ApiProperty() id!: string;
  @ApiProperty() channelKind!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ nullable: true, type: String }) locale!: string | null;
  @ApiProperty() lastMessagePreview!: string;
  @ApiProperty() messageCount!: number;
  @ApiProperty() lastMsgAt!: Date;
}

export const CONTACT_NOTE_KINDS = ["intent", "manual"] as const;

export class ContactNoteDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: CONTACT_NOTE_KINDS, description: "intent = written by the assistant when it detected interest; manual = typed by the team." })
  kind!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ nullable: true, type: String }) conversationId!: string | null;
  @ApiProperty({ nullable: true, type: String, description: "Team member's name for manual notes." })
  authorName!: string | null;
  @ApiProperty() createdAt!: Date;
}

export class AddContactNoteDto {
  @ApiProperty({ example: "Called back — prefers mornings." })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}

export class ContactDetailDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: CONTACT_STAGES, example: "new" }) stage!: string;
  @ApiProperty({ nullable: true, type: String }) name!: string | null;
  @ApiProperty({ nullable: true, type: String }) phone!: string | null;
  @ApiProperty({ nullable: true, type: String }) email!: string | null;
  @ApiProperty({ nullable: true, type: String }) source!: string | null;
  @ApiProperty({ nullable: true, type: String }) locale!: string | null;
  @ApiProperty() firstSeenAt!: Date;
  @ApiProperty() lastSeenAt!: Date;
  @ApiProperty({ type: [ContactConversationDto] })
  conversations!: ContactConversationDto[];
  @ApiProperty({ type: [ContactNoteDto] }) notes!: ContactNoteDto[];
}
