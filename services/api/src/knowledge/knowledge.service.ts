import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { KnowledgeSource } from "@lidh/db";
import { PrismaService } from "../common/prisma/prisma.service";
import { EmbeddingService } from "../common/embedding/embedding.service";
import { crawlSite, CrawlError } from "./crawler";
import { chunkPages } from "./chunk";
import type { CreateSourceDto } from "./dto/create-source.dto";

/** A KnowledgeSource plus the chunk count returned by list/get. The explicit
 *  types below are required so tsc can emit portable .d.ts (TS2742) — without
 *  them it tries to name pnpm-internal Prisma runtime paths. */
type SourceWithCount = KnowledgeSource & { _count: { chunks: number } };

/**
 * Knowledge ingestion (the write side of RAG; shell-owned, mirroring
 * ADR-001 #3). Pipeline: crawl URL → chunk → embed → store + status.
 *
 * Background model (ADR-002): processing runs in-process, fire-and-forget,
 * with status tracked on KnowledgeSource. The API is a long-lived Fly
 * process so this is fine for M2. A durable queue (Inngest) for
 * retries/observability/scale is deferred to M3. A reingest endpoint
 * provides manual recovery if a process restart strands a source in
 * "processing".
 */
@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService,
  ) {}

  async createSource(dto: CreateSourceDto): Promise<KnowledgeSource> {
    const db = this.prisma.client;
    const tenant = await db.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });
    if (!tenant) throw new NotFoundException("tenant_not_found");

    const source = await db.knowledgeSource.create({
      data: {
        tenantId: tenant.id,
        kind: dto.kind,
        uri: dto.uri,
        status: "pending",
      },
    });

    // Fire-and-forget. Errors are captured onto the source row, never thrown
    // back to the request (which has already returned 202).
    void this.ingest(source.id).catch((err) => {
      this.logger.error(
        `ingest ${source.id} crashed: ${err instanceof Error ? err.message : "unknown"}`,
      );
    });

    return source;
  }

  async listSources(tenantSlug: string): Promise<SourceWithCount[]> {
    const db = this.prisma.client;
    const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException("tenant_not_found");
    return db.knowledgeSource.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { chunks: true } } },
    });
  }

  async getSource(id: string): Promise<SourceWithCount> {
    const source = await this.prisma.client.knowledgeSource.findUnique({
      where: { id },
      include: { _count: { select: { chunks: true } } },
    });
    if (!source) throw new NotFoundException("source_not_found");
    return source;
  }

  async reingest(id: string): Promise<{ id: string; status: "processing" }> {
    const source = await this.prisma.client.knowledgeSource.findUnique({
      where: { id },
    });
    if (!source) throw new NotFoundException("source_not_found");
    void this.ingest(id).catch((err) =>
      this.logger.error(
        `reingest ${id} crashed: ${err instanceof Error ? err.message : "unknown"}`,
      ),
    );
    return { id, status: "processing" as const };
  }

  /** The pipeline. Updates KnowledgeSource.status throughout. */
  private async ingest(sourceId: string): Promise<void> {
    const db = this.prisma.client;
    const source = await db.knowledgeSource.findUnique({
      where: { id: sourceId },
    });
    if (!source) return;

    await db.knowledgeSource.update({
      where: { id: sourceId },
      data: { status: "processing", error: null },
    });

    try {
      if (source.kind !== "url" && source.kind !== "sitemap") {
        throw new Error(
          `ingestion supports kind=url|sitemap; got "${source.kind}"`,
        );
      }

      const crawl = await crawlSite(source.uri);
      const chunks = chunkPages(crawl.pages);
      if (chunks.length === 0) throw new Error("no_content_extracted");

      const vectors = await this.embedding.embedMany(
        chunks.map((c) => c.content),
      );

      // Replace this source's chunks atomically-ish: clear then insert.
      await db.knowledgeChunk.deleteMany({ where: { sourceId } });

      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        const row = await db.knowledgeChunk.create({
          data: {
            tenantId: source.tenantId,
            sourceId,
            content: c.content,
            meta: c.meta,
            tokens: Math.ceil(c.content.length / 4),
          },
        });
        const vec = vectors?.[i];
        if (vec) {
          await db.$executeRawUnsafe(
            `UPDATE "KnowledgeChunk" SET embedding = $1::vector WHERE id = $2`,
            `[${vec.join(",")}]`,
            row.id,
          );
        }
      }

      await db.knowledgeSource.update({
        where: { id: sourceId },
        data: { status: "ready", lastCrawledAt: new Date(), error: null },
      });
      await db.event.create({
        data: {
          tenantId: source.tenantId,
          kind: "knowledge_source_indexed",
          meta: {
            sourceId,
            pages: crawl.pages.length,
            chunks: chunks.length,
            embedded: vectors ? chunks.length : 0,
          },
        },
      });
      this.logger.log(
        `ingested ${sourceId}: ${crawl.pages.length} pages → ${chunks.length} chunks (${vectors ? "embedded" : "NO embeddings — set OPENAI_API_KEY"})`,
      );
    } catch (err) {
      const message =
        err instanceof CrawlError
          ? `${err.code}: ${err.message}`
          : err instanceof Error
            ? err.message
            : "unknown_error";
      await db.knowledgeSource.update({
        where: { id: sourceId },
        data: { status: "failed", error: message },
      });
      await db.event.create({
        data: {
          tenantId: source.tenantId,
          kind: "knowledge_source_failed",
          meta: { sourceId, error: message },
        },
      });
      this.logger.error(`ingest ${sourceId} failed: ${message}`);
    }
  }
}
