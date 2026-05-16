import { ApiProperty } from "@nestjs/swagger";

export class LeadListItemDto {
  @ApiProperty({ example: "clx_lead1" }) id!: string;
  @ApiProperty({ example: "new", enum: ["new", "contacted", "won", "lost"] })
  status!: string;
  @ApiProperty({
    description: "Captured fields { name, email, phone, notes }.",
    example: { name: "Ana", phone: "+355699998877", notes: "Wants a group booking" },
  })
  payload!: unknown;
  @ApiProperty({ example: "Ana B.", nullable: true, type: String })
  contactName!: string | null;
  @ApiProperty({ example: "+355699998877", nullable: true, type: String })
  contactPhone!: string | null;
  @ApiProperty({ example: "clx_conv1", nullable: true, type: String })
  conversationId!: string | null;
  @ApiProperty({ example: "2026-05-16T13:00:00.000Z" }) capturedAt!: Date;
}
