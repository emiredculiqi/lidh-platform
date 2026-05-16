import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import type { KnowledgeSource } from "@lidh/db";
import { KnowledgeService } from "./knowledge.service";
import { CreateSourceDto } from "./dto/create-source.dto";
import { SourceResponseDto } from "./dto/source-response.dto";

type SourceWithCount = KnowledgeSource & { _count: { chunks: number } };

@ApiTags("Knowledge")
@Controller("knowledge/sources")
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Post()
  @HttpCode(202)
  @ApiOperation({
    summary: "Register + ingest a knowledge source",
    description:
      "**How to consume:** `POST /v1/knowledge/sources` with a tenant slug, " +
      "a kind (`url` or `sitemap`), and the URL. Returns **202** immediately " +
      "with the source in `pending`/`processing` — ingestion (crawl → chunk " +
      "→ embed → store) runs in the background. Poll `GET " +
      "/v1/knowledge/sources/:id` until `status` is `ready` or `failed`.\n\n" +
      "```bash\ncurl -X POST http://localhost:4000/v1/knowledge/sources \\\n" +
      '  -H "Content-Type: application/json" \\\n' +
      '  -d \'{"tenantSlug":"acme-coffee","kind":"url","uri":"https://example.com"}\'\n```',
  })
  @ApiOkResponse({ type: SourceResponseDto })
  create(@Body() dto: CreateSourceDto): Promise<KnowledgeSource> {
    return this.knowledge.createSource(dto);
  }

  @Get()
  @ApiOperation({
    summary: "List a tenant's knowledge sources",
    description:
      "Returns every source for the tenant with its status and chunk count.",
  })
  @ApiQuery({ name: "tenantSlug", example: "acme-coffee" })
  @ApiOkResponse({ type: SourceResponseDto, isArray: true })
  list(@Query("tenantSlug") tenantSlug: string): Promise<SourceWithCount[]> {
    return this.knowledge.listSources(tenantSlug);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get one knowledge source (poll ingestion status here)",
  })
  @ApiOkResponse({ type: SourceResponseDto })
  get(@Param("id") id: string): Promise<SourceWithCount> {
    return this.knowledge.getSource(id);
  }

  @Post(":id/reingest")
  @HttpCode(202)
  @ApiOperation({
    summary: "Re-crawl + re-embed a source",
    description:
      "Recovery / refresh: replaces the source's chunks. Use if a source is " +
      "stuck in `processing` (e.g. a process restart) or its site changed.",
  })
  reingest(
    @Param("id") id: string,
  ): Promise<{ id: string; status: "processing" }> {
    return this.knowledge.reingest(id);
  }
}
