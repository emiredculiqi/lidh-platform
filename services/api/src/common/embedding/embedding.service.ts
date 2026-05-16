import { Injectable, Logger } from "@nestjs/common";
import OpenAI from "openai";

export const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536-dim
export const EMBEDDING_DIMS = 1536;

/**
 * Single source of truth for OpenAI embeddings. Used by:
 *  - RetrievalService  → embed the visitor's question (1 input)
 *  - KnowledgeService  → embed crawled chunks (batched)
 *
 * Returns null when OPENAI_API_KEY is unset so callers can degrade
 * gracefully (chat still answers from persona + facts; ingestion stores
 * chunks with NULL embeddings).
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly client: OpenAI | null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn(
        "OPENAI_API_KEY not set — embeddings disabled (RAG inactive).",
      );
    }
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  /** Embed one string. null on no-key or failure. */
  async embedOne(text: string): Promise<number[] | null> {
    const out = await this.embedMany([text]);
    return out ? out[0] : null;
  }

  /**
   * Embed many strings in one API call. OpenAI accepts an array input;
   * we cap batch size to stay well under request limits.
   */
  async embedMany(texts: string[]): Promise<number[][] | null> {
    if (!this.client || texts.length === 0) return null;
    const BATCH = 96;
    const result: number[][] = [];
    try {
      for (let i = 0; i < texts.length; i += BATCH) {
        const slice = texts.slice(i, i + BATCH);
        const res = await this.client.embeddings.create({
          model: EMBEDDING_MODEL,
          input: slice,
        });
        // OpenAI guarantees order matches input order.
        for (const d of res.data) result.push(d.embedding);
      }
      return result;
    } catch (err) {
      this.logger.error(
        `embedding failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
      return null;
    }
  }
}
