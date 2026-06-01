import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MinLength } from "class-validator";

/**
 * Self-serve business onboarding payload (ADR-013). The logged-in Clerk user
 * becomes the tenant's owner — their userId is taken from req.auth, not the
 * body, so a client can't onboard "on behalf of" someone else.
 */
export class OnboardBusinessDto {
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
  })
  @IsOptional()
  @IsString()
  businessFacts?: string;

  @ApiPropertyOptional({
    description:
      "Apply a persona preset from the library (id from " +
      "GET /v1/persona-presets). Either this or a custom persona is required.",
    example: "support",
  })
  @IsOptional()
  @IsString()
  presetId?: string;

  @ApiPropertyOptional({
    description:
      "Custom Albanian persona text. Use either this or `presetId`. " +
      "Most users should pick a preset.",
  })
  @IsOptional()
  @IsString()
  customAlbanianPersona?: string;
}

/** Shape of GET /v1/me — what the dashboard reads on first paint. */
export class MeResponseDto {
  @ApiProperty() user!: {
    id: string;
    email: string;
    name: string | null;
    isPlatformAdmin: boolean;
  };
  @ApiProperty({ isArray: true })
  memberships!: Array<{
    role: string;
    tenant: { id: string; slug: string; name: string };
  }>;
}
