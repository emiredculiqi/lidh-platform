import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/** POST /v1/knowledge/text — paste content directly (no crawl, no file). */
export class TextSourceDto {
  @ApiProperty({ example: "acme-coffee" })
  @IsString()
  @MinLength(1)
  tenantSlug!: string;

  @ApiPropertyOptional({
    description: "Short label for this note (shown in the sources list).",
    example: "Spring price list",
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @ApiProperty({
    description: "The content to ingest verbatim (chunked + embedded).",
    example:
      "We deliver across Tirana 9am–9pm. Espresso 150 ALL. Group bookings via WhatsApp.",
  })
  @IsString()
  @MinLength(20)
  content!: string;
}

/** POST /v1/knowledge/upload — a document as base64. */
export class UploadDocDto {
  @ApiProperty({ example: "acme-coffee" })
  @IsString()
  @MinLength(1)
  tenantSlug!: string;

  @ApiProperty({
    description: "Original filename — its extension selects the extractor.",
    example: "menu.pdf",
  })
  @IsString()
  @MinLength(3)
  filename!: string;

  @ApiProperty({
    description:
      "Base64-encoded file bytes. Supported: pdf, docx, xlsx, xls, txt, md, csv.",
    example: "JVBERi0xLjQK… (base64)",
  })
  @IsString()
  @MinLength(4)
  contentBase64!: string;
}
