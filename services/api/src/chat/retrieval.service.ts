import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { EmbeddingService } from "../common/embedding/embedding.service";

const TOP_K = 5;

/** Prior customer turns folded into the retrieval query alongside the new one. */
const QUERY_CONTEXT_TURNS = 2;
/** Upper bound on the embedded query — one embedding call, keep it cheap. */
const MAX_QUERY_CHARS = 1000;

/**
 * Build the text used to SEARCH the knowledge base. This is not what the model
 * receives — the model gets the real history; this only steers retrieval.
 *
 * A short follow-up ("for my face, anti-wrinkle") embeds poorly on its own and
 * matches the wrong passages, so the customer's last couple of turns are
 * prefixed to keep the subject ("a cream") in the query. Assistant turns are
 * excluded deliberately: the agent's own phrasing would pull the search toward
 * what it already said rather than what was asked.
 *
 * Shared by both runtimes, which disagree on whether `history` already contains
 * `message` — the web path reads history BEFORE persisting the inbound, the
 * WhatsApp path AFTER. A trailing duplicate is dropped so the new message is
 * never weighted twice.
 */
export function buildRetrievalQuery(
  history: Array<{ role: string; content: string }>,
  message: string,
): string {
  const userTurns = history
    .filter((m) => m.role === "user")
    .map((m) => m.content);
  if (userTurns[userTurns.length - 1] === message) userTurns.pop();

  const recent = userTurns.slice(-QUERY_CONTEXT_TURNS).join(" ");
  return `${recent} ${message}`.trim().slice(0, MAX_QUERY_CHARS);
}

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
