import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
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

  @ApiProperty({
    description: "At least one persona (one per language).",
    type: [PersonaInputDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PersonaInputDto)
  personas!: PersonaInputDto[];

  @ApiPropertyOptional({
    description:
      "Create as a demo (web-only). Generates an unguessable demo link " +
      "with a required expiry.",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDemo?: boolean;

  @ApiPropertyOptional({
    description: "Days until the demo link expires (only used when isDemo).",
    default: 14,
    minimum: 1,
    maximum: 180,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(180)
  demoExpiresInDays?: number;

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
