import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
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

  @ApiPropertyOptional({
    description:
      "The widget already showed the intake opener (from GET /chat/opener) " +
      "before this first message, so the message answers \"what's your " +
      "name?\". Only honoured when this call creates the conversation; the " +
      "opener is then stored as its first message so the transcript matches.",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  intakeAsked?: boolean;
}

/** GET /chat/opener response. */
export class ChatOpenerDto {
  @ApiProperty({ example: "Përshëndetje, mirë se vini te Bela Shoes! …" }) text!: string;
  @ApiProperty({ example: "Bela Shoes" }) businessName!: string;
  @ApiProperty({ example: "al" }) locale!: string;
  @ApiProperty({
    enum: ["human", "ai"],
    description: "Who answers new conversations right now (business setting + schedule; no thread override yet).",
  })
  responder!: "human" | "ai";
  @ApiProperty({ description: "False when the business is offline (trial lapsed, archived)." })
  isActive!: boolean;
}
