import { ApiProperty } from "@nestjs/swagger";

export class SourceResponseDto {
  @ApiProperty({ example: "clxabc123" })
  id!: string;

  @ApiProperty({ example: "url" })
  kind!: string;

  @ApiProperty({ example: "https://example.com" })
  uri!: string;

  @ApiProperty({
    description:
      "Lifecycle: pending → processing → ready | failed. Poll this after " +
      "creating a source; ingestion is asynchronous.",
    enum: ["pending", "processing", "ready", "failed"],
    example: "processing",
  })
  status!: string;

  @ApiProperty({
    description: "Error detail when status=failed.",
    example: null,
    nullable: true,
    type: String,
  })
  error!: string | null;

  @ApiProperty({
    description: "When the source was last successfully crawled.",
    example: "2026-05-16T12:00:00.000Z",
    nullable: true,
    type: String,
  })
  lastCrawledAt!: Date | null;

  @ApiProperty({ example: "2026-05-16T11:59:00.000Z" })
  createdAt!: Date;
}
