import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { MAX_MESSAGE_CHARS } from "@lidh/core";

/**
 * Body for POST /v1/chat/web — the public web-channel chat endpoint.
 *
 * Auth is deferred to a later M2 step; the tenant is identified by slug (the
 * embeddable widget knows its own tenant). `sessionRef` lets the same browser
 * session resume its conversation without an account.
 */
export class ChatWebRequestDto {
  @ApiProperty({
    description: "Tenant slug (which business's agent to talk to).",
    example: "acme-coffee",
  })
  @IsString()
  @MinLength(1)
  tenantSlug!: string;

  @ApiProperty({
    description: "The visitor's new message.",
    example: "Do you deliver to Tirana on Sundays?",
  })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_MESSAGE_CHARS)
  message!: string;

  @ApiPropertyOptional({
    description:
      "Continue an existing conversation. Omit to start a new one (the " +
      "response's first `meta` event returns the new conversationId).",
    example: "clxyz123",
  })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiPropertyOptional({
    description:
      "Stable per-browser-session id (the widget generates + persists it). " +
      "Used to resume the same anonymous visitor's thread.",
    example: "sess_8f3a1c",
  })
  @IsOptional()
  @IsString()
  sessionRef?: string;

  @ApiPropertyOptional({
    description:
      "Locale for the reply (Lidh.al code). Defaults to the tenant's " +
      "defaultLocale when omitted.",
    example: "al",
  })
  @IsOptional()
  @IsString()
  locale?: string;
}
