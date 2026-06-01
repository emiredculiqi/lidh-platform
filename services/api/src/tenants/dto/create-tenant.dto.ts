import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from "class-validator";

export class PersonaInputDto {
  @ApiProperty({ description: 'Lidh.al locale code.', example: "al" })
  @IsString()
  @MinLength(1)
  locale!: string;

  @ApiProperty({
    description: "The system-prompt persona text for this language.",
    example:
      "Ti je asistenti dixhital i biznesit. I ngrohtë, i shkurtër. Përgjigju në gjuhën e përdoruesit.",
  })
  @IsString()
  @MinLength(10)
  content!: string;
}

export class CreateTenantDto {
  @ApiProperty({ example: "Bar Roma" })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({
    description: "URL-safe unique slug (lowercase, digits, hyphens).",
    example: "bar-roma",
  })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "slug must be lowercase letters/digits/hyphens",
  })
  slug!: string;

  @ApiPropertyOptional({ example: "al", default: "al" })
  @IsOptional()
  @IsString()
  defaultLocale?: string;

  @ApiPropertyOptional({
    description: "Stable facts injected into every prompt (hours, contact…).",
    example: "Bar Roma — Rruga e Durrësit, Tiranë. Tel +355 69 000 0000.",
  })
  @IsOptional()
  @IsString()
  businessFacts?: string;

  @ApiPropertyOptional({
    description: "Agent display name. Defaults to `<name> Assistant`.",
    example: "Bar Roma Assistant",
  })
  @IsOptional()
  @IsString()
  agentName?: string;

  @ApiPropertyOptional({
    description:
      "Apply a standard persona preset (ADR-009). Expands into one " +
      "persona per supported language (al/en/it/fr/de), with `{business}` " +
      "replaced by the tenant name. Mutually sufficient with `personas` — " +
      "provide this OR `personas`. List options at GET /v1/persona-presets.",
    example: "restaurant",
  })
  @IsOptional()
  @IsString()
  presetId?: string;

  @ApiPropertyOptional({
    description:
      "Custom personas (one per language). Provide this OR `presetId`. " +
      "Ignored when `presetId` is set.",
    type: [PersonaInputDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PersonaInputDto)
  personas?: PersonaInputDto[];

  @ApiPropertyOptional({
    description: "Origins allowed to embed the web widget.",
    example: ["https://barroma.al"],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  webAllowedOrigins?: string[];
}
