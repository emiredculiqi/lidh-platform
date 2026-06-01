import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { EmbeddingService } from "../common/embedding/embedding.service";

const TOP_K = 5;

/**
 * RAG retrieval (ADR-001 #3 — runs in the shell, not core).
 *
 * Embeds the query via the shared EmbeddingService, then cosine-searches the
 * tenant's KnowledgeChunks via pgvector. Returns [] when embeddings are
 * disabled or on failure so the agent still answers from persona + facts.
 */
@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService,
  ) {}

  async retrieve(tenantId: string, query: string): Promise<string[]> {
    const vector = await this.embedding.embedOne(query);
    if (!vector) return [];

    const vectorLiteral = `[${vector.join(",")}]`;

    try {
      const rows = await this.prisma.client.$queryRawUnsafe<
        { content: string; meta: unknown }[]
      >(
        `SELECT content, meta
           FROM "KnowledgeChunk"
          WHERE "tenantId" = $1 AND embedding IS NOT NULL
          ORDER BY embedding <=> $2::vector
          LIMIT ${TOP_K}`,
        tenantId,
        vectorLiteral,
      );
      // Prefix each passage with its real source URL (chunk.ts stores it in
      // meta.url for crawled pages). Without this the model never sees the
      // URL and fabricates plausible-looking paths when asked "where / link
      // me" — e.g. inventing /carriers instead of the real /gsl-careers/.
      return rows.map((r) => {
        const meta = r.meta as { url?: unknown } | null;
        const url =
          meta && typeof meta.url === "string" && meta.url.trim()
            ? meta.url.trim()
            : null;
        return url ? `(source: ${url})\n${r.content}` : r.content;
      });
    } catch (err) {
      this.logger.error(
        `vector search failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
      return [];
    }
  }
}
