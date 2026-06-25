import { ApiProperty } from "@nestjs/swagger";

export class ContactListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty({ nullable: true, type: String }) name!: string | null;
  @ApiProperty({ nullable: true, type: String }) phone!: string | null;
  @ApiProperty({ nullable: true, type: String }) email!: string | null;
  @ApiProperty({ nullable: true, type: String }) source!: string | null;
  @ApiProperty() conversationCount!: number;
  @ApiProperty() leadCount!: number;
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

export class ContactLeadDto {
  @ApiProperty() id!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ type: Object }) payload!: Record<string, unknown>;
  @ApiProperty() capturedAt!: Date;
}

export class ContactDetailDto {
  @ApiProperty() id!: string;
  @ApiProperty({ nullable: true, type: String }) name!: string | null;
  @ApiProperty({ nullable: true, type: String }) phone!: string | null;
  @ApiProperty({ nullable: true, type: String }) email!: string | null;
  @ApiProperty({ nullable: true, type: String }) source!: string | null;
  @ApiProperty({ nullable: true, type: String }) locale!: string | null;
  @ApiProperty() firstSeenAt!: Date;
  @ApiProperty() lastSeenAt!: Date;
  @ApiProperty({ type: [ContactConversationDto] })
  conversations!: ContactConversationDto[];
  @ApiProperty({ type: [ContactLeadDto] }) leads!: ContactLeadDto[];
}
