import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";

/**
 * M4.1 accepts the *normalized* inbound shape directly so the full pipeline
 * is testable now. In M4.4 a provider adapter (WhatChimp/Meta) maps the raw
 * provider webhook payload into this before it reaches the service.
 */
export class InboundWebhookDto {
  @ApiProperty({
    description: "Customer's WhatsApp number (E.164).",
    example: "+355691112222",
  })
  @IsString()
  @MinLength(5)
  from!: string;

  @ApiProperty({
    description:
      "The business WhatsApp number/id that received the message — must " +
      "match a tenant's whatsapp Channel config.phoneNumberId.",
    example: "acme-wa-001",
  })
  @IsString()
  @MinLength(1)
  businessNumber!: string;

  @ApiProperty({ description: "Message text.", example: "Deri në çfarë ore jeni hapur?" })
  @IsString()
  @MinLength(1)
  text!: string;

  @ApiPropertyOptional({ description: "Provider message id (dedupe)." })
  @IsOptional()
  @IsString()
  providerMessageId?: string;

  @ApiPropertyOptional({ description: "Sender display name if provided." })
  @IsOptional()
  @IsString()
  senderName?: string;
}
