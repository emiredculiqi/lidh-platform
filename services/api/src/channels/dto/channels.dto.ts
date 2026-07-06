import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

/**
 * Payload from the dashboard's Embedded Signup flow. `code` comes from the
 * Facebook Login callback; `wabaId` + `phoneNumberId` come from the Embedded
 * Signup `message` event. The backend exchanges the code for a token and
 * wires the channel.
 */
export class ConnectWhatsAppDto {
  @ApiProperty({ description: "Embedded Signup auth code (single-use)." })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty({ description: "Meta WhatsApp Business Account id." })
  @IsString()
  @MinLength(1)
  wabaId!: string;

  @ApiProperty({ description: "Meta phone_number_id for the connected number." })
  @IsString()
  @MinLength(1)
  phoneNumberId!: string;

  @ApiPropertyOptional({
    description:
      "True for coexistence (owner keeps the WhatsApp Business App; we skip " +
      "phone registration). Defaults to true.",
  })
  @IsOptional()
  @IsBoolean()
  coexistence?: boolean;
}

/** Sanitized channel status for the dashboard (never exposes credentials). */
export class ChannelStatusDto {
  @ApiProperty({ enum: ["web", "whatsapp", "instagram"] })
  kind!: string;

  @ApiProperty({ enum: ["pending", "connected", "disconnected", "error"] })
  status!: string;

  @ApiPropertyOptional({ description: "Display phone number (whatsapp)." })
  displayPhoneNumber?: string;

  @ApiPropertyOptional({ description: "Whether coexistence mode is on." })
  coexistence?: boolean;
}
