import { ApiProperty } from "@nestjs/swagger";

export class TenantResponseDto {
  @ApiProperty({ example: "clx_tenant123" })
  id!: string;

  @ApiProperty({ example: "bar-roma" })
  slug!: string;

  @ApiProperty({ example: "Bar Roma" })
  name!: string;

  @ApiProperty({ example: "al" })
  defaultLocale!: string;

  @ApiProperty({ example: false })
  isDemo!: boolean;

  @ApiProperty({
    description: "Demo link (only when isDemo). Send this to the prospect.",
    example: "https://demo.lidh.al/Xa9k…",
    nullable: true,
    type: String,
  })
  demoUrl!: string | null;

  @ApiProperty({
    description: "When the demo link stops working (only when isDemo).",
    example: "2026-05-30T00:00:00.000Z",
    nullable: true,
    type: String,
  })
  demoExpiresAt!: Date | null;

  @ApiProperty({
    description:
      "Service state. `archived` = subscription paused: the agent stops " +
      "serving on every channel, data retained, reversible via reactivate.",
    example: "active",
    enum: ["active", "archived"],
  })
  status!: string;

  @ApiProperty({
    description: "When the tenant was archived (null while active).",
    example: null,
    nullable: true,
    type: String,
  })
  archivedAt!: Date | null;

  @ApiProperty({ example: "2026-05-16T12:00:00.000Z" })
  createdAt!: Date;
}

export class DemoResolveResponseDto {
  @ApiProperty({
    description: "Slug to pass to POST /v1/chat/web as tenantSlug.",
    example: "bar-roma",
  })
  tenantSlug!: string;

  @ApiProperty({ example: "Bar Roma" })
  name!: string;

  @ApiProperty({ example: "al" })
  defaultLocale!: string;

  @ApiProperty({
    description: "Languages the agent has personas for.",
    example: ["al", "en"],
    type: [String],
  })
  locales!: string[];

  @ApiProperty({ example: "2026-05-30T00:00:00.000Z" })
  expiresAt!: Date;
}
