import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { SELECTABLE_MODELS } from "@lidh/core";

const MODEL_IDS = SELECTABLE_MODELS.map((m) => m.id);

export class AgentPersonaDto {
  @ApiProperty({ example: "al" }) locale!: string;
  @ApiProperty({ example: "Ti je asistenti i ..." }) content!: string;
}

export class AgentResponseDto {
  @ApiProperty({ example: "clx_agent1" }) id!: string;
  @ApiProperty({ example: "ACME Coffee Assistant" }) name!: string;
  @ApiProperty({ example: "al" }) defaultLocale!: string;
  @ApiProperty({
    description: "Per-tenant tool flags.",
    example: { capture_lead: true, request_human_handoff: true },
  })
  toolsEnabled!: unknown;
  @ApiPropertyOptional({
    description:
      "Per-tenant model (ADR-011). null ⇒ platform default (Haiku). " +
      "Allowed: " + MODEL_IDS.join(", ") + ".",
    example: null,
    nullable: true,
    type: String,
  })
  modelOverride!: string | null;
  @ApiProperty({
    description: "Stable business facts injected into every prompt.",
    nullable: true,
    type: String,
    example: "Open Mon–Sat 9–18. Address: Rr. Myslym Shyri, Tirana.",
  })
  businessFacts!: string | null;
  @ApiProperty({ type: [AgentPersonaDto] }) personas!: AgentPersonaDto[];
}

export class SetModelDto {
  @ApiProperty({ example: "acme-coffee" })
  @IsString()
  @MinLength(1)
  tenantSlug!: string;

  @ApiProperty({
    description:
      "Model id, or null/empty for the platform default (Haiku). " +
      "Allowed: " + MODEL_IDS.join(", ") + ".",
    example: "claude-sonnet-4-6",
    nullable: true,
  })
  @IsOptional()
  @IsIn(MODEL_IDS)
  model?: string | null;
}

export class UpsertPersonaDto {
  @ApiProperty({ example: "acme-coffee" })
  @IsString()
  @MinLength(1)
  tenantSlug!: string;

  @ApiProperty({
    description: "Lidh.al locale code. New locale → persona created.",
    example: "en",
  })
  @IsString()
  @MinLength(1)
  locale!: string;

  @ApiProperty({
    description: "The full persona / system-prompt text for that language.",
    example: "You are the assistant for ACME Coffee. Warm, concise…",
  })
  @IsString()
  @MinLength(10)
  content!: string;
}

export class SetToolsDto {
  @ApiProperty({ example: "acme-coffee" })
  @IsString()
  @MinLength(1)
  tenantSlug!: string;

  @ApiProperty({
    description: "Tool on/off flags to persist on the agent.",
    example: {
      capture_lead: true,
      request_human_handoff: true,
      search_properties: false,
    },
  })
  @IsObject()
  tools!: Record<string, boolean>;
}

export class SetBusinessFactsDto {
  @ApiProperty({ example: "acme-coffee" })
  @IsString()
  @MinLength(1)
  tenantSlug!: string;

  @ApiProperty({
    description:
      "Stable facts injected into every prompt (hours, address, policies). " +
      "Empty string clears it.",
    example: "Open Mon–Sat 9–18. Free delivery over €30.",
  })
  @IsString()
  businessFacts!: string;
}

export class SetDefaultLocaleDto {
  @ApiProperty({ example: "acme-coffee" })
  @IsString()
  @MinLength(1)
  tenantSlug!: string;

  @ApiProperty({ description: "Lidh.al locale code.", example: "al" })
  @IsString()
  @MinLength(2)
  locale!: string;
}
