import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString, MinLength } from "class-validator";

/**
 * The exact payload WhatChimp POSTs to our webhook URL when a customer
 * messages the business's WhatsApp number. Verified against a live test
 * — see `WhatChimpInboundDto.toNormalized()` for the mapping into our
 * provider-agnostic InboundWhatsAppMessage.
 *
 * Example payload:
 *   {
 *     "whatsapp_bot_name": "Lidh.al",
 *     "whatsapp_bot_id": 401550,
 *     "subscriber_id": "355693113543-401550",
 *     "wa_message_id": "wamid.HBg…",
 *     "label_names": "",
 *     "first_name": "Redi",
 *     "chat_id": "355693113543",
 *     "user_message": "Hello",
 *     "whatsapp_bot_username": "+355 69 520 1250"
 *   }
 */
export class WhatChimpInboundDto {
  @ApiProperty({ example: "355693113543" })
  @IsString()
  @MinLength(5)
  chat_id!: string;

  @ApiProperty({ example: "Hello" })
  @IsString()
  user_message!: string;

  @ApiProperty({ example: "+355 69 520 1250" })
  @IsString()
  whatsapp_bot_username!: string;

  @ApiPropertyOptional({ example: 401550 })
  @IsOptional()
  @IsNumber()
  whatsapp_bot_id?: number;

  @ApiPropertyOptional({ example: "wamid.HBg…" })
  @IsOptional()
  @IsString()
  wa_message_id?: string;

  @ApiPropertyOptional({ example: "Redi" })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ example: "Lidh.al" })
  @IsOptional()
  @IsString()
  whatsapp_bot_name?: string;

  @ApiPropertyOptional({ example: "355693113543-401550" })
  @IsOptional()
  @IsString()
  subscriber_id?: string;

  @ApiPropertyOptional({ example: "" })
  @IsOptional()
  @IsString()
  label_names?: string;
}
