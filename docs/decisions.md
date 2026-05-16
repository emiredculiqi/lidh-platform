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

## ADR-003 — Admin endpoints unauthenticated in M2 (M2 Phase 2.3)

**Status:** Accepted (temporary) · 2026-05-16
**Context:** `POST /v1/tenants`, `/graduate`, knowledge management, etc. are
admin actions, but Clerk JWT auth + the TenantContext resolution are a later
M2 step. Building them auth-gated now would block progress on auth that isn't
wired yet.

- **Technical term:** *deliberate temporary trust boundary gap*, tracked.
- **Plain:** The staff door has no lock yet because the lock (Clerk auth) is
  being fitted later. We're building the rooms behind the door first; the door
  gets its lock before anyone moves in.
- **Chosen:** Ship admin endpoints unauthenticated through M2 build phases,
  consistent with chat/knowledge. Each admin controller carries a comment
  saying so. The public demo-resolution endpoint (`GET /v1/demo/:token`) is
  *intentionally* public and stays so.
- **Why:** Unblocks 2.3/2.4 without a half-built auth dependency. Low real
  risk in dev (nothing deployed publicly yet).
- **MUST be closed before:** any public deployment. The dedicated M2 auth step
  adds the Clerk guard + `@RequireRole`/`isPlatformAdmin` checks to every
  admin route; the public demo + web-chat endpoints stay open by design.

---

## ADR-004 — WhatsApp as a provider-agnostic channel adapter (M4.1)

**Status:** Accepted · 2026-05-16
**Context:** User pivoted to M4 (WhatsApp), skipping M2.4 (dashboard) + M3.
Provider is WhatChimp (memory: project_whatsapp_provider) but it must first
be validated as a pass-through — can't be done autonomously.

- **Technical term:** *channel adapter behind a transport port* (ports &
  adapters again; the `WhatsAppTransport` interface + `WHATSAPP_TRANSPORT`
  DI token).
- **Plain:** Same chef (`@lidh/core` `runAgent`), different waiter. The
  WhatsApp waiter takes the whole plated meal (non-streaming) and hands it to
  a delivery service (the transport). Which delivery company (WhatChimp / Meta
  / stub) is one swappable line in the module.
- **Chosen:** Build everything provider-agnostic now — webhook (fast-ack +
  async process, ADR-002 pattern), tenant resolution by `businessNumber` →
  whatsapp Channel, contact unification by `(tenantId, phone)`, reuse
  `runAgent` collected non-streaming, reply via `WhatsAppTransport`.
  `StubWhatsAppTransport` (logs) is the default binding so the full pipeline
  is verifiable with zero credentials.
- **Why:** Keeps momentum without blocking on a third-party validation/secret.
  Reuses the exact agent runtime — proves the channel-adapter design. The
  channel/contact/conversation schema needed no changes.
- **USER GATE (M4.4, blocks completion):** validate WhatChimp exposes
  programmatic inbound-webhook + outbound-send (pass-through, our agent stays
  the brain). If yes → implement `WhatChimpTransport` + a payload adapter
  (raw WhatChimp webhook → normalized InboundWhatsAppMessage) + signature
  verification; bind it in WhatsappModule (one line). If WhatChimp must BE the
  bot → fall back to Meta Cloud API. Needs WhatChimp API docs + a test
  credential from the user.
- **Deferred:** shared AgentOrchestrator (ChatService/WhatsappService share
  persona/RAG/persist/executeTool logic — duplicated now to not disturb the
  verified web path); 24h-window enforcement only matters for proactive/
  template sends (out of scope; M3); signature-verify guard is provider-
  specific (lands with the real provider in M4.4).

---

## ADR-005 — Knowledge depth: automate scraping, fail loudly (M2.5)

**Status:** Accepted · 2026-05-17
**Context:** Demo quality = knowledge quality. Plain fetch fails on
JS-rendered sites and bot-protected sites; many SMBs have no/thin sites.
User wants max automation, a clear UI signal when a site truly can't be
processed, and Playwright for the headless cases.

- **Technical term:** *tiered FetchProvider (ports & adapters) with automatic
  escalation*, + explicit failure-reason surfacing, + S3-compatible blob
  storage abstraction.
- **Plain:** Try the cheap way; if the door's locked, send the robot with a
  real browser; if it's *still* locked, put a clear sign on it ("can't read
  this — upload the docs instead") rather than failing silently.
- **Chosen:**
  - **FetchProvider port**, escalation: Tier1 plain `fetch` → Tier2
    **Playwright** (real Chromium) auto-triggered on WAF-detect / JS-shell /
    thin content → Tier3 paid unblocker (port only, **unwired** — user
    deferred; will do manual work instead).
  - **Failure-UX:** propagate `CrawlError.code`
    (bot_protected|unreachable|empty|too_large|invalid_url) into
    `KnowledgeSource.error`; dashboard maps each to a human message + a
    "upload a document / paste content" call-to-action. No silent failures.
  - **Deeper crawl:** read `robots.txt` `Sitemap:` directive + CMS fallbacks
    (/wp-sitemap.xml etc.) + depth-2 internal-link follow; page cap per plan.
  - **Document upload:** store the **original** (enables re-ingest with a
    better chunker without re-upload). Storage behind an **S3-compatible
    port** (`@aws-sdk/client-s3`) — backend = env (MinIO | Cloudflare R2 |
    S3), swappable, no lock-in. Dev default: local MinIO container (zero
    signup). Prod backend decided at deploy (R2 recommended: free tier
    covers tiny business docs, zero egress, zero ops; MinIO equally valid).
  - **Paste-text source** (`kind=faq`): direct chunk→embed, no fetch — the
    always-works manual lever.
- **Why:** Playwright rescues the *common* failure (JS-rendered SMB sites),
  not hardcore WAFs — honest scope; the failure-UX + upload/paste closes the
  loop for the unfixable residue. S3 abstraction honors the user's MinIO
  preference without coupling.
- **Honest limits / flagged:** Playwright ≠ universal WAF bypass. It adds
  ~300MB Chromium to services/api Docker + needs more RAM → Fly machine
  memory bump at deploy (current fly.toml 512MB). Heavy headless crawl
  reinforces the deferred move to a durable queue (ADR-002 / Inngest, M3);
  in-process stays for M2 with tight concurrency/timeouts.
- **Order:** failure-UX + deeper crawl first (no new deps) → FetchProvider +
  Playwright (touches Docker) → S3 + upload + paste (needs storage; local
  MinIO dev).

---
