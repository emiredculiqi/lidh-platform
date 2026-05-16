# Architecture Decision Records (ADR)

A running log of significant technical decisions: **what** we chose, the
**technical term**, a **plain-language explanation**, and **why**. Append new
records over time; never rewrite old ones (if a decision changes, add a new
record that supersedes it).

---

## The restaurant analogy (the mental model behind ADR-001)

We keep coming back to this picture, so it's worth pinning:

| Restaurant role | In the codebase | Job |
|---|---|---|
| **The chef** | `packages/core` (the AI "brain") | Knows how to cook (run the agent). Doesn't know who the customer is or how food is delivered. |
| **The waiter + kitchen** | `services/api` (the "shell") | Takes the order, fetches ingredients, plates the food, serves it, writes down what was ordered. |
| **The customer** | A website visitor chatting with the agent | — |
| **The pantry / cookbook** | The database + the business's knowledge base | — |
| **The kitchen porter** | The part of the shell that does database lookups | Fetches the right recipe pages from the storeroom so the chef never touches it. |

---

## ADR-001 — Agent runtime design (M2 Phase 2.1)

**Status:** Accepted · 2026-05-16
**Context:** Building the multi-tenant AI agent runtime by generalizing the
existing single-tenant marketing chatbot.

Eight decisions. Each row: the technical term ↔ the plain explanation ↔ what we
chose ↔ why it matters.

### 1. How the brain returns its output

- **Technical term:** *async generator* (`async function* runAgent(): AsyncIterable<AgentEvent>`).
- **Plain:** The chef yells "plate ready!" repeatedly and the waiter runs each
  plate out the moment it's done — instead of cooking the whole meal in silence
  and dumping it at the end.
- **Chosen:** Async generator that `yield`s events (`text`, `effect`, `done`,
  `error`).
- **Why:** The visitor sees the reply stream in word-by-word (like ChatGPT
  typing) instead of waiting for a wall of text. The *same* generator can also
  feed a non-streaming channel later (WhatsApp just takes the final text).

### 2. Where tool side-effects happen

- **Technical term:** *dependency injection of an `executeTool` port*
  (ports & adapters / hexagonal architecture).
- **Plain:** When the chef decides "save this customer's number for the
  manager," the chef hands a **ticket** to a runner. The runner deals with the
  database/email. The chef never learns what a database is.
- **Chosen:** `packages/core` defines the tool *contract*; `services/api`
  injects the implementation that writes `Lead`/`Event` rows.
- **Why:** Keeps the brain reusable across channels. The web channel and the
  future WhatsApp channel share the same chef but can have different runners.

### 3. Who fetches knowledge for a question (RAG retrieval)

- **Technical term:** *retrieval happens in the API shell, not in core* (RAG =
  Retrieval-Augmented Generation).
- **Plain:** The business's knowledge is a huge cookbook. When the customer
  asks "do you deliver?", the kitchen porter (shell) finds the relevant pages
  and hands them to the chef. The chef never rummages in the storeroom.
- **Chosen:** The shell embeds the query, runs the vector search, passes the
  top matching text chunks into the chef's context.
- **Why:** The brain stays database-free and easy to test. Only the shell
  touches Postgres/pgvector.

### 4. What shape the brain's inputs take

- **Technical term:** *core defines its own domain types* (decoupling from the
  persistence layer).
- **Plain:** Ingredients arrive repacked into the kitchen's own clean,
  labelled containers — not the supermarket's original packaging.
- **Chosen:** `packages/core` declares its own plain input types; the shell
  maps database rows into them.
- **Why:** If the database schema changes later, the brain doesn't notice or
  break. One-way dependency: shell → core, never the reverse.

### 5. When conversations get saved

- **Technical term:** *incremental persistence* (write-ahead, not write-behind).
- **Plain:** The waiter writes the order ticket when the customer orders, and
  again when the food is served — not one big scribble at the very end.
- **Chosen:** Persist the user message before calling the brain; persist the
  assistant message after it finishes.
- **Why:** Survives a mid-stream crash with a partial record, and lets a future
  "live inbox" screen show in-flight conversations.

### 6. The streaming wire format

- **Technical term:** *Server-Sent Events (SSE)* with a stable event vocabulary
  (`text` / `effect` / `done` / `error`).
- **Plain:** The kitchen and waiter already use an agreed set of shouts. The
  existing website chat widget already understands exactly these words. We keep
  the same vocabulary so nothing that already works breaks.
- **Chosen:** Manual SSE responses preserving the existing event names (not
  NestJS's opinionated `@Sse()` envelope).
- **Why:** Backwards-compatible with the current widget; the M3 embeddable
  widget reuses the identical contract. SSE = a one-way live stream from server
  to browser; it's what makes the typing effect work.

### 7. Prompt caching strategy (the money one)

- **Technical term:** *split prompt caching* — Anthropic `cache_control:
  ephemeral` on the stable prefix only.
- **Plain:** Before every dish the chef re-reads the restaurant's standard
  rules + this customer's profile (persona + business facts). That text is
  identical for every message in a conversation, so we "prep it once and pin it
  to the board" instead of re-reading (and re-paying) every message. The
  specific recipe pages for one question change each time, so those aren't
  pinned.
- **Chosen:** Cache the persona + business-facts block (`ephemeral`); do not
  cache the per-message retrieved knowledge.
- **Why:** Re-billing the full stable prefix on every message is what blows up
  the AI cost. This is the difference between the Business plan being
  profitable or not (see the pricing notes).

### 8. The existing marketing chatbot

- **Technical term:** *defer the refactor* (avoid premature consolidation).
- **Plain:** You already have a working food truck (the marketing chatbot).
  We're building a full restaurant (the platform). We leave the truck running
  and build the restaurant's kitchen fresh, instead of ripping the truck's
  engine out right now to share it.
- **Chosen:** Do not modify `apps/marketing`'s chatbot during M2. Revisit
  "make marketing tenant zero" after M2 ships.
- **Why:** Don't break a working thing chasing elegance. Lower risk; the
  consolidation is optional and reversible later.

### Embedding provider (the "meaning-numbers" service)

- **Technical term:** *embedding model* — turns text into a `vector(1536)` that
  captures meaning, so "do you deliver?" matches a page titled "shipping hours"
  even with no shared words. Powers semantic search / RAG.
- **Plain:** Your cookbook is so big you need a separate "find pages by
  meaning" index service. Anthropic doesn't sell one, so we add one more login.
- **Chosen:** **OpenAI** `text-embedding-3-small` (1536-dim). Requires an
  OpenAI account/key — the only new external dependency M2 introduces.
- **Why:** Cheapest and simplest of the viable options; the schema's
  `vector(1536)` already fits it.

---

## ADR-002 — Knowledge ingestion runs in-process (M2 Phase 2.2)

**Status:** Accepted · 2026-05-16
**Context:** Tenants need knowledge by giving a URL (crawl → chunk → embed →
store), not hand-seeding. Crawling several pages + embedding takes seconds to
tens of seconds — too long to block an HTTP request.

- **Technical term:** *in-process fire-and-forget background work with
  status-tracked state* (vs. a durable external job queue).
- **Plain:** When you ask the kitchen to restock the pantry from a supplier
  (crawl a website), the request desk doesn't make you stand there waiting —
  it says "got it, restocking" (HTTP 202) and a kitchen hand does it in the
  background. You check a status board (`GET /v1/knowledge/sources/:id`) to
  see when it's done.
- **Chosen:** `POST /v1/knowledge/sources` creates the source (`pending`),
  returns 202, then `KnowledgeService.ingest()` runs **un-awaited** inside the
  Node process, moving status `processing → ready | failed` (+ `error` text).
  A `POST /:id/reingest` gives manual recovery.
- **Why:** The API is a long-lived Fly process (not serverless), so in-process
  async is fine for M2's scale (small business sites, tens of chunks). It adds
  **zero new infrastructure**. The known limitation — a process restart can
  strand a source in `processing` — is acceptable for M2 and covered by the
  reingest endpoint.
- **Superseded by (planned):** M3 moves ingestion to a durable queue
  (**Inngest**) for retries, observability, and horizontal scale. The
  `KnowledgeService.ingest()` body stays the same; only the trigger changes.
  Deferring keeps M2 free of another external account/dependency.

### Crawler reuse

- **Chosen:** Lift the battle-tested crawler from
  `apps/marketing/lib/demo/crawler.ts` into `services/api/src/knowledge/`
  (dropping the Next.js `import "server-only"`). Marketing's copy is left
  untouched (ADR-001 #8).
- **Why:** It already handles URL normalization, bot-protection detection,
  sitemap parsing, link prioritization, and readable extraction. Rewriting
  would be wasteful and risky. Consolidating the two copies is a later
  refactor, same as the chatbot.

---
