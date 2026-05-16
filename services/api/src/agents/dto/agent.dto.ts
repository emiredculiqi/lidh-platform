import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

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
  @ApiProperty({ type: [AgentPersonaDto] }) personas!: AgentPersonaDto[];
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
