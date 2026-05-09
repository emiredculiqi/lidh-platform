-- Integrity constraints + vector index that Prisma's schema syntax can't express.
-- Hand-written migration. RLS deferred to M2 by decision (see CLAUDE.md / project memory).

-- ─────────────────────────────────────────────────────────────────────────────
-- Demo lifecycle integrity
-- ─────────────────────────────────────────────────────────────────────────────
-- Enforces the invariant from the Tenant model docs:
--   isDemo = false  =>  demoToken IS NULL AND demoExpiresAt IS NULL
--   isDemo = true   =>  demoToken IS NOT NULL AND demoExpiresAt IS NOT NULL
-- Prevents app code bugs from creating "half-demo" tenants.

ALTER TABLE "Tenant" ADD CONSTRAINT "tenant_demo_consistency_check" CHECK (
  ("isDemo" = false AND "demoToken" IS NULL AND "demoExpiresAt" IS NULL)
  OR
  ("isDemo" = true  AND "demoToken" IS NOT NULL AND "demoExpiresAt" IS NOT NULL)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- HNSW vector index for similarity search on KnowledgeChunk.embedding
-- ─────────────────────────────────────────────────────────────────────────────
-- Hierarchical Navigable Small World — sub-millisecond cosine similarity even
-- at millions of rows. Used implicitly when queries do:
--     ORDER BY embedding <=> $1::vector LIMIT k
-- The index supports incremental insert/update; no need to wait for data.
-- Cosine distance chosen because Voyage AI / OpenAI embeddings are normalized.

CREATE INDEX "KnowledgeChunk_embedding_hnsw_idx"
  ON "KnowledgeChunk"
  USING hnsw (embedding vector_cosine_ops);
