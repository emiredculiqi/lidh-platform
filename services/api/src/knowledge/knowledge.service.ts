import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { KnowledgeSource } from "@lidh/db";
import { PrismaService } from "../common/prisma/prisma.service";
import { EmbeddingService } from "../common/embedding/embedding.service";
import { StorageService } from "../common/storage/storage.service";
import { crawlSite, CrawlError } from "./crawler";
import {
  playwrightFetch,
  closePlaywrightBrowser,
} from "./fetch/playwright-fetcher";
import { chunkPages, type Chunk } from "./chunk";
import {
  extractText,
  isSupportedDoc,
  SUPPORTED_DOC_EXTS,
} from "./extract";
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
    private readonly storage: StorageService,
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

  /** Paste raw text as a knowledge source — no crawl, no file, always works
   *  (the manual hand-tuning lever, ADR-005). kind=faq. */
  async addTextSource(dto: {
    tenantSlug: string;
    title?: string;
    content: string;
  }): Promise<KnowledgeSource> {
    const db = this.prisma.client;
    const tenant = await db.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });
    if (!tenant) throw new NotFoundException("tenant_not_found");

    const title = (dto.title?.trim() || "Pasted note").slice(0, 80);
    const source = await db.knowledgeSource.create({
      data: {
        tenantId: tenant.id,
        kind: "faq",
        uri: `paste:${Date.now()}`,
        status: "pending",
        meta: { title },
      },
    });
    void this.runIngest(source.id, async () =>
      chunkPages([{ url: source.uri, title, text: dto.content }]),
    ).catch((e) =>
      this.logger.error(`text ingest ${source.id} crashed: ${e}`),
    );
    return source;
  }

  /** Upload a document. Stores the original in S3 if configured (enables
   *  reingest); extracts text per type → chunk → embed regardless. */
  async addDocumentSource(dto: {
    tenantSlug: string;
    filename: string;
    contentBase64: string;
  }): Promise<KnowledgeSource> {
    const db = this.prisma.client;
    const tenant = await db.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });
    if (!tenant) throw new NotFoundException("tenant_not_found");
    if (!isSupportedDoc(dto.filename)) {
      throw new BadRequestException(
        `unsupported file type — supported: ${SUPPORTED_DOC_EXTS.join(", ")}`,
      );
    }

    const buf = Buffer.from(dto.contentBase64, "base64");
    if (buf.length === 0) throw new BadRequestException("empty file");

    const safeName = dto.filename.replace(/[^\w.\-]/g, "_");
    const key = `tenants/${tenant.id}/docs/${Date.now()}-${safeName}`;
    let storedKey: string | null = null;
    try {
      storedKey = await this.storage.put(
        key,
        buf,
        "application/octet-stream",
      );
    } catch (e) {
      this.logger.error(`S3 put failed (continuing without original): ${e}`);
    }

    const source = await db.knowledgeSource.create({
      data: {
        tenantId: tenant.id,
        kind: "file",
        uri: storedKey ?? `upload:${dto.filename}`,
        status: "pending",
        meta: { filename: dto.filename, stored: !!storedKey },
      },
    });
    void this.runIngest(source.id, async () => {
      const text = await extractText(dto.filename, buf);
      return chunkPages([
        { url: source.uri, title: dto.filename, text },
      ]);
    }).catch((e) =>
      this.logger.error(`doc ingest ${source.id} crashed: ${e}`),
    );
    return source;
  }

  async reingest(id: string): Promise<{ id: string; status: "processing" }> {
    const db = this.prisma.client;
    const source = await db.knowledgeSource.findUnique({ where: { id } });
    if (!source) throw new NotFoundException("source_not_found");

    if (source.kind === "url" || source.kind === "sitemap") {
      void this.ingest(id).catch((err) =>
        this.logger.error(`reingest ${id} crashed: ${String(err)}`),
      );
    } else if (source.kind === "file") {
      // Re-pull the original from storage (only possible if it was retained).
      void this.runIngest(id, async (s) => {
        const buf = await this.storage.get(s.uri);
        if (!buf) {
          throw new Error("original_not_retained");
        }
        const filename =
          (s.meta as { filename?: string })?.filename ?? s.uri;
        const text = await extractText(filename, buf);
        return chunkPages([{ url: s.uri, title: filename, text }]);
      }).catch((err) =>
        this.logger.error(`reingest ${id} crashed: ${String(err)}`),
      );
    } else {
      throw new BadRequestException(
        "pasted-text sources can't be re-ingested — paste the content again",
      );
    }
    return { id, status: "processing" as const };
  }

  /**
   * Shared tail for every source kind: produce chunks → embed → replace
   * chunks → status ready|failed → events → Playwright cleanup. `produce`
   * is the kind-specific bit (crawl / text / document).
   */
  private async runIngest(
    sourceId: string,
    produce: (source: KnowledgeSource) => Promise<Chunk[]>,
  ): Promise<void> {
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
      const chunks = await produce(source);
      if (chunks.length === 0) throw new Error("no_content_extracted");

      const vectors = await this.embedding.embedMany(
        chunks.map((c) => c.content),
      );

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
            chunks: chunks.length,
            embedded: vectors ? chunks.length : 0,
          },
        },
      });
      this.logger.log(
        `ingested ${sourceId}: ${chunks.length} chunks (${vectors ? "embedded" : "NO embeddings — set OPENAI_API_KEY"})`,
      );
    } catch (err) {
      const code = err instanceof CrawlError ? err.code : "error";
      const rawMsg = err instanceof Error ? err.message : "";
      // Specific, already-friendly messages pass through; everything else
      // maps via the crawl-error table.
      const message =
        err instanceof CrawlError
          ? friendlyCrawlError(code)
          : rawMsg.startsWith("unsupported file type")
            ? rawMsg
            : rawMsg === "original_not_retained"
              ? "The original file wasn't retained (storage not configured when uploaded). Re-upload the document."
              : rawMsg === "no_content_extracted"
                ? friendlyCrawlError("no_content_extracted")
                : friendlyCrawlError("error");
      await db.knowledgeSource.update({
        where: { id: sourceId },
        data: { status: "failed", error: message, meta: { failureCode: code } },
      });
      await db.event.create({
        data: {
          tenantId: source.tenantId,
          kind: "knowledge_source_failed",
          meta: { sourceId, error: message },
        },
      });
      this.logger.error(`ingest ${sourceId} failed: ${message}`);
    } finally {
      await closePlaywrightBrowser();
    }
  }

  /** Crawl producer (kind=url|sitemap): Tier-1 plain → Tier-2 Playwright. */
  private ingest(sourceId: string): Promise<void> {
    return this.runIngest(sourceId, async (source) => {
      if (source.kind !== "url" && source.kind !== "sitemap") {
        throw new Error(
          `crawl supports kind=url|sitemap; got "${source.kind}"`,
        );
      }
      let crawl;
      try {
        crawl = await crawlSite(source.uri);
      } catch (e) {
        if (
          e instanceof CrawlError &&
          (e.code === "bot_protected" || e.code === "empty")
        ) {
          this.logger.warn(
            `[${sourceId}] plain fetch hit "${e.code}" — escalating to Playwright`,
          );
          crawl = await crawlSite(source.uri, { fetcher: playwrightFetch });
        } else {
          throw e;
        }
      }
      return chunkPages(crawl.pages);
    });
  }

}

/** Map a crawl failure code to a clear, actionable message for the dashboard.
 *  Every "we can't read this site" case points the user at the fallbacks
 *  (document upload / paste) that always work. */
function friendlyCrawlError(code: string): string {
  switch (code) {
    case "bot_protected":
      return "This site is behind bot protection (e.g. Cloudflare) and couldn't be read automatically. Upload the content as a document, or paste it manually.";
    case "unreachable":
      return "The site couldn't be reached (it may be down, slow, or blocking us). Try again later, or upload/paste the content instead.";
    case "blocked":
      return "This address can't be crawled (non-public host). Use a public URL, or upload/paste the content.";
    case "invalid_url":
      return "That doesn't look like a valid website address. Check the URL, or upload/paste the content instead.";
    case "too_large":
      return "The site is too large to process automatically. Upload the key documents, or paste the important content.";
    case "empty":
    case "no_content_extracted":
      return "We reached the site but found no readable text (it may be image-only or JavaScript-heavy). Upload a document or paste the content instead.";
    default:
      return "Couldn't process this source automatically. Upload a document or paste the content instead.";
  }
}
