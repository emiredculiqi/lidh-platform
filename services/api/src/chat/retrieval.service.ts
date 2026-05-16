import { Injectable, Logger } from "@nestjs/common";
import OpenAI from "openai";
import { PrismaService } from "../common/prisma/prisma.service";

const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536-dim → matches schema
const TOP_K = 5;

/**
 * RAG retrieval (ADR-001 #3 — happens in the shell, not core).
 *
 * 1. Embed the user's query with OpenAI.
 * 2. Vector-search the tenant's KnowledgeChunks via pgvector (cosine).
 * 3. Return the top-k passages as plain strings for core's prompt.
 *
 * Graceful degradation: if OPENAI_API_KEY is unset, returns [] so the agent
 * still answers from persona + business facts. This is intentional so the
 * endpoint works before the key is added.
 */
@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);
  private readonly openai: OpenAI | null;

  constructor(private readonly prisma: PrismaService) {
    const apiKey = process.env.OPENAI_API_KEY;
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
    if (!this.openai) {
      this.logger.warn(
        "OPENAI_API_KEY not set — knowledge retrieval disabled (agent will " +
          "answer from persona + business facts only).",
      );
    }
  }

  async retrieve(tenantId: string, query: string): Promise<string[]> {
    if (!this.openai) return [];

    let embedding: number[];
    try {
      const res = await this.openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: query,
      });
      embedding = res.data[0].embedding;
    } catch (err) {
      this.logger.error(
        `embedding failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
      return [];
    }

    // pgvector literal: '[0.1,0.2,...]'. Cast to ::vector in SQL. Scoped by
    // tenantId (RLS lands in a later step; explicit filter until then).
    const vectorLiteral = `[${embedding.join(",")}]`;

    try {
      const rows = await this.prisma.client.$queryRawUnsafe<
        { content: string }[]
      >(
        `SELECT content
           FROM "KnowledgeChunk"
          WHERE "tenantId" = $1
          ORDER BY embedding <=> $2::vector
          LIMIT ${TOP_K}`,
        tenantId,
        vectorLiteral,
      );
      return rows.map((r) => r.content);
    } catch (err) {
      this.logger.error(
        `vector search failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
      return [];
    }
  }
}
