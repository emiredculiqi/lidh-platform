import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";

// The five supported locales. `al` (Albanian) is the primary and required;
// the rest are optional secondaries (ADR-009/010). {business} is allowed.
export class PresetPersonasDto {
  @ApiProperty({ example: "Ti je asistenti dixhital i {business}…" })
  @IsString()
  @MinLength(10)
  al!: string;

  @ApiPropertyOptional({ example: "You are the digital assistant for {business}…" })
  @IsOptional()
  @IsString()
  en?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() it?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() fr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() de?: string;
}

export class CreatePersonaPresetDto {
  @ApiProperty({ example: "Restaurant, café & bar" })
  @IsString()
  @MinLength(1)
  label!: string;

  @ApiProperty({ example: "Hospitality venues — hours, menu, reservations." })
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiProperty({ type: PresetPersonasDto })
  @IsObject()
  @ValidateNested()
  @Type(() => PresetPersonasDto)
  personas!: PresetPersonasDto;
}

export class UpdatePersonaPresetDto extends PartialType(
  CreatePersonaPresetDto,
) {
  @ApiPropertyOptional({
    description: "Soft hide/show. Inactive presets are excluded from the " +
      "New-tenant picker but kept (already-created tenants are unaffected).",
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class PersonaPresetResponseDto {
  @ApiProperty({ example: "restaurant" }) id!: string;
  @ApiProperty({ example: "Restaurant, café & bar" }) label!: string;
  @ApiProperty({ example: "Hospitality venues…" }) description!: string;
  @ApiProperty({
    description: "Locale → persona text (may contain {business}).",
    example: { al: "Ti je…", en: "You are…" },
  })
  personas!: unknown;
  @ApiProperty({ example: true }) active!: boolean;
  @ApiProperty({ example: "2026-05-18T00:00:00.000Z" }) createdAt!: Date;
}
