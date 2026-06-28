import { ApiProperty } from "@nestjs/swagger";

export class NotificationDto {
  @ApiProperty({ example: "clx_evt1" }) id!: string;
  @ApiProperty({
    example: "lead_captured",
    enum: ["conversation_started", "contact_registered", "lead_captured"],
  })
  kind!: string;
  @ApiProperty({ example: "clx_conv1", nullable: true, type: String })
  conversationId!: string | null;
  @ApiProperty({ example: "Ana B.", nullable: true, type: String })
  contactName!: string | null;
  @ApiProperty({ example: "2026-06-27T13:00:00.000Z" }) createdAt!: Date;
}
