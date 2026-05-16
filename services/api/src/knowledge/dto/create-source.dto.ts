import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsString, MinLength } from "class-validator";

/** Kinds the ingestion pipeline can process today. */
export const INGESTABLE_KINDS = ["url", "sitemap"] as const;
export type IngestableKind = (typeof INGESTABLE_KINDS)[number];

export class CreateSourceDto {
  @ApiProperty({
    description: "Tenant slug that owns this knowledge source.",
    example: "acme-coffee",
  })
  @IsString()
  @MinLength(1)
  tenantSlug!: string;

  @ApiProperty({
    description:
      "How to ingest. `url` crawls that page + prioritized internal pages; " +
      "`sitemap` follows the site's sitemap.xml.",
    enum: INGESTABLE_KINDS,
    example: "url",
  })
  @IsIn(INGESTABLE_KINDS)
  kind!: IngestableKind;

  @ApiProperty({
    description: "The URL to crawl (scheme optional — https assumed).",
    example: "https://example.com",
  })
  @IsString()
  @MinLength(3)
  uri!: string;
}
