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

## ADR-006 — Close the auth gap: Clerk-verified API + BFF proxy (#2)

**Status:** Accepted · 2026-05-17 — supersedes ADR-003's temporary gap.
**Context:** API endpoints were open (ADR-003). Dashboard has Clerk login but
calls the API with no auth. The `User` table is empty (M1 Clerk webhook is a
503 stub). Need real auth without blocking on the webhook + ngrok.

- **Technical term:** *global auth guard verifying Clerk JWTs + JIT user
  provisioning + a Next BFF (backend-for-frontend) proxy*.
- **Plain:** The staff door gets its lock. Dashboard requests carry a Clerk
  pass; the API checks it. First time it sees a valid person with no file, it
  creates their file from Clerk (no webhook needed). A small reception desk
  in the dashboard stamps the pass onto every request so we don't wire auth
  into a dozen call sites.
- **Chosen:**
  - **API:** `@clerk/backend` `verifyToken(CLERK_SECRET_KEY)`. A global
    `APP_GUARD`; routes opt OUT with `@Public()`. Public = health,
    `POST /v1/chat/web` (anonymous visitors/widget), `GET /v1/demo/:token`,
    WhatsApp webhook (+verify). Everything else requires a valid Clerk user.
  - **JIT provisioning:** on a verified request, if no `User` for `sub`
    (clerkId), fetch the profile via Clerk backend `users.getUser` and
    upsert. The webhook stays a deferred optimization (freshness/deletes).
  - **Platform admin:** env `PLATFORM_ADMIN_EMAILS` (comma list). User's
    email in it → `isPlatformAdmin=true` (also honors Clerk
    publicMetadata.role==="platform_admin" if present). M2.4 reality =
    every non-public endpoint is founder/admin, so the guard requires
    `isPlatformAdmin` for non-public routes. Relaxed to Membership/role
    checks when the team flow lands (documented, not now).
  - **Guard ↔ context:** guard verifies + JIT, attaches `req.auth`; the
    existing TenantContextInterceptor (owns the ALS scope) seeds
    TenantContext from `req.auth` (replacing the dev x-tenant/x-user
    headers).
  - **Dashboard BFF proxy:** `app/api/proxy/[...path]` route handler does
    Clerk `auth().getToken()` server-side and forwards to the API with the
    Bearer header. `api.*` (tenants/knowledge/agents/conversations/leads)
    point at the proxy (one token code path, no client/server split, no
    CORS). Public chat SSE (TestChat/FunnelChat) still hits the API directly
    (it's @Public + streaming).
- **Why:** JIT removes the webhook+ngrok prerequisite. The BFF proxy solves
  the "client components can't read a server-only Clerk token" problem and
  CORS in one move — standard Next pattern. Email-allowlist admin needs zero
  Clerk metadata plumbing for the founder.
- **Honest scope:** non-admin authenticated users get 403 on admin endpoints
  until the Membership/team flow exists — intentional for M2.4. Webhook
  user-sync still deferred (JIT covers create; deletes/edits later).

---

## ADR-007 — Server components call the API directly; proxy is client-only (fix of ADR-006)

**Status:** Accepted · 2026-05-17 — corrects ADR-006's "one token code path,
no client/server split" claim, which was wrong.
**Context:** With auth turned on, every server-rendered dashboard page
(`/tenants`, `/inbox`, `/leads`, `/agent`) returned a 404. ADR-006 had all
`api.*` calls go through the BFF proxy `/api/proxy` regardless of where they
ran. But the pages are **server components**: they call `api.listTenants()`
*during server render*, so `lib/api.ts` did `fetch("http://localhost:3001/api/proxy/…")`
— the Next server fetching its own route. A server-to-server fetch carries
**no browser cookies**, so the Clerk session never reached the proxy; and
`middleware.ts` protects `/api/proxy(.*)`, so Clerk's `auth.protect()` 404'd
the cookie-less call before the handler ran. The proxy could therefore *never*
serve a server component. It only ever worked for client components (browser
fetch → cookies ride along automatically).

- **Technical term:** *transport split by execution context — direct
  server-side call with `auth()` token vs. browser→BFF proxy*.
- **Plain:** The reception desk (proxy) only works for visitors who walk in
  the front door carrying their pass (the browser, cookies attached). Staff
  already *inside* the building (server components) don't go back out to the
  street and queue at reception — they have their badge on them (`auth()`)
  and walk straight to the back office (the API). ADR-006 sent everyone out
  to reception, including people already inside — and the cookie-less round
  trip got turned away at the door (middleware) every time.
- **False start (recorded as a lesson):** first attempt kept one `lib/api.ts`
  and branched on `typeof window`, doing `await import("@clerk/nextjs/server")`
  only on the server. **This does not work.** A `typeof window` check is a
  *runtime* guard; the bundler still *statically traces* dynamic `import()`
  into the module graph of any client component that imports the file. Result:
  `'server-only' cannot be imported from a Client Component` → every page
  bundling a client component (e.g. `NewTenantForm`) 500'd. The client/server
  boundary is a **build/file** boundary, not a runtime branch.
- **Chosen:** a hard three-file split:
  - **`lib/api-core.ts`** — client-safe: types, `apiBase`, `unwrap()`, the
    `makeApi(transport)` factory, and `proxyTransport` (browser → `/api/proxy`).
    Zero server-only imports, so it can enter any client bundle.
  - **`lib/api.ts`** — `export * from "./api-core"` + `api = makeApi(proxyTransport)`.
    What **client** components import (forms) and anything needing only
    `apiBase`/types (TestChat/FunnelChat, public funnel page). Client-safe.
  - **`lib/api-server.ts`** — `import "server-only"` (build *fails loudly* if a
    client ever imports it) + static `import { auth } from "@clerk/nextjs/server"`
    + a direct-call+Bearer transport; `api = makeApi(serverTransport)`. The 6
    **server** pages import this. Same `api` shape, injected transport.
  - The proxy route and `middleware` protection of it stay exactly as ADR-006
    defined. Public demo page unaffected (imports only `apiBase`, hits the
    `@Public` `/v1/demo/:token` endpoint directly — no token path).
- **Why:** A server component already holds the request/session context;
  HTTP-hopping through its own middleware-gated route to re-acquire a token it
  can read directly is both broken (cookies/middleware) and pointless. Direct
  call is the idiomatic Next App Router + Clerk pattern. The proxy remains
  necessary and correct for client components (they genuinely can't read a
  server-only token, and same-origin avoids CORS).
- **Honest scope:** ADR-006's prose ("no client/server split") is the part
  superseded — its API guard, JIT, admin allowlist, and the proxy-for-clients
  design all stand. Also fixed alongside this: the API now binds dual-stack
  (`::`, see main.ts) so Node's IPv6-first `localhost` resolution reaches it;
  and the data-fetch error surfaces the real HTTP status/body instead of a
  blanket "could not reach the API".

---

## ADR-008 — Tenant lifecycle: reversible archive + irreversible delete

**Status:** Accepted · 2026-05-17.
**Context:** Operators need to stop a customer's service when they cancel a
subscription, and to fully remove a customer on request. Two distinct needs:
"pause, I might bring them back" vs. "erase everything". Conflating them (only
delete) loses data on every churn; only archiving never reclaims storage or
satisfies a deletion request.

- **Technical term:** *soft state machine (`TenantStatus`) for service
  suspension, separate from a hard cascade delete*.
- **Plain:** Two different switches, not one. **Archive** is the lights-off
  switch: the shop is closed, the door is locked to customers, but everything
  inside is exactly as they left it and you can reopen tomorrow. **Delete** is
  the demolition: the building and all its contents are gone, and there is no
  rebuild. We deliberately built them as separate switches because "closed for
  now" and "gone forever" are not the same decision and must never be one
  click apart by accident.
- **Chosen:**
  - **Schema:** `enum TenantStatus { active archived }` + `status`
    (default `active`, backfills existing rows) + `archivedAt DateTime?` on
    Tenant. Matches the codebase's enum-driven lifecycle style
    (ChannelStatus, KnowledgeSourceStatus, …).
  - **Archive = stop *serving*, not stop *existing*.** Enforced only on the
    customer-facing paths: `chat.runWeb` (web widget + demo) and
    `whatsapp.handleInbound` both bail when `status==='archived'`;
    `resolveDemo` throws 410. Admin/dashboard **read** endpoints stay open so
    the operator can still review and export an archived tenant's data before
    deciding to delete. Reversible via `reactivate`. Both idempotent.
  - **Delete = one row delete.** Every Tenant child
    (agent, personas, channels, knowledge sources+chunks, contacts,
    conversations, messages, leads, events, usage, memberships) already has
    `onDelete: Cascade`, so `prisma.tenant.delete()` purges the lot
    atomically. S3 originals (`tenants/<id>/…`) are *not* reachable by the DB
    cascade → `StorageService.deleteByPrefix` purges them first, best-effort
    (never throws: an orphaned object is recoverable, a half-deleted tenant
    is not).
  - **API:** `POST /v1/tenants/:id/archive`, `…/reactivate`,
    `DELETE /v1/tenants/:id` (platform-admin, like the rest). UI requires
    typing the slug to arm delete.
- **Why:** Churn is normal; most "cancellations" are reversible, so the
  default off-switch must preserve data and be one call to undo. Relying on
  DB-level cascade (not application-level fan-out delete) makes "delete
  everything" correct-by-construction — it can't drift as new child tables
  are added, as long as they keep `onDelete: Cascade`. Gating only the
  serving path (not reads) is what "interrupt their service" actually means
  and keeps post-cancellation export possible.
- **Honest scope:** No audit-log table — lifecycle transitions are logged
  (Logger) but not persisted, and a `tenant_deleted` row would cascade away
  anyway; a non-cascading audit log is deferred to M3 (billing). No
  archive→delete ordering is enforced (independent actions, per the request).
  Billing-driven states (`past_due`, `suspended`) are intentionally NOT added
  now; the enum is extensible when Stripe lands (M3).

---

## ADR-009 — Standard persona library: code-shipped, hand-authored, 5-locale

**Status:** Accepted · 2026-05-18. **Storage decision revised by ADR-010**
(presets moved code → DB, editable). The preset *model* (pick a standard →
expand into 5 locales with `{business}`) stands; only "code-shipped" changed.
**Context:** Every tenant needs a system-prompt persona. Hand-writing one per
customer per language doesn't scale and yields inconsistent quality. The
operator wants to *pick a standard* and have it just work in Albanian
(primary) plus EN/IT/FR/DE.

- **Technical term:** *a versioned, parameterised persona template set,
  expanded per-locale at tenant creation*.
- **Plain:** A set of well-written "starter scripts" for the assistant — like
  pre-set staff training manuals for a restaurant, a shop, an appointments
  business, a help desk — each already translated into the five languages we
  serve. You pick one off the shelf; the system stamps the business's name
  into it and files one copy per language. You can still hand-write a bespoke
  one when a customer is unusual.
- **Chosen:**
  - **Location:** `packages/core/src/personaPresets.ts` — code, not a DB
    table. Matches the repo's "content is data" pattern, versioned with the
    runtime, zero migration. (DB-editable presets deferred until there's a
    real need to edit without deploy.)
  - **Locales:** `al en it fr de`, `al` first = primary/master **and** the
    platform fallback locale. Confirmed with the operator (German included
    despite not being in the first ask — it's on the roadmap).
  - **Authoring:** every preset/locale is **hand-written & vetted**, not
    machine-translated — these get stamped onto real customers, tone matters,
    and the preset count is small and finite. Personas cover role / scope /
    boundaries / escalation only; formatting & brevity stay centralised in
    `RESPONSE_STYLE` (prompt.ts) so a persona never repeats them.
  - **Parameterisation:** literal `{business}` token, replaced with the
    tenant name in `expandPreset()` at create time.
  - **API:** `CreateTenantDto.presetId?` (mutually sufficient with
    `personas`; service throws 400 if neither, or unknown id);
    `GET /v1/persona-presets` backs the dashboard picker, which defaults to
    the first preset and keeps a "Custom" escape hatch.
  - Starter set (extensible — it's just data): restaurant, retail, services,
    support.
- **Why:** Code-shipped keeps presets consistent, reviewable and
  deploy-versioned for a curated set the founder owns. Expanding to one
  `AgentPersona` row per locale (not a runtime lookup) reuses the existing
  per-locale persona selection unchanged — presets are purely a creation-time
  convenience, invisible to the runtime.
- **Honest scope:** No preset for an *existing* tenant yet (apply-on-create
  only); re-applying / editing presets via the Agent page is a later add. No
  per-tenant preset override tracking (once expanded, rows are normal
  personas and edited like any other).

---

## ADR-010 — Persona presets become DB-backed & operator-editable

**Status:** Accepted · 2026-05-19 — revises ADR-009's *storage* only (the
preset model, 5-locale expansion, `{business}`, create-time application all
stand). Supersedes the briefly-explored composable-characteristics redesign,
which was dropped as premature (YAGNI — no usage data justified it).

- **Context:** ADR-009 shipped presets in `@lidh/core`. Operating the product
  surfaced the gap: changing a standard's wording needed a code edit +
  redeploy. The operator wants to edit existing presets *and add new ones*
  from the dashboard, no deploy. (Per-tenant personas were already
  dashboard-editable on the Agent page — only the shared *templates* weren't.)
- **Technical term:** *seed-from-code, serve-from-DB* — code holds defaults,
  the database holds the live, editable copy.
- **Plain:** The recipe cards used to be printed in the cookbook (reprint =
  redeploy). Now they live on a board in the kitchen: the cookbook still
  provides the starter set, but the chef rewrites a card or pins up a new one
  anytime, instantly. Dishes already served are unaffected — a tenant gets a
  *copy* of the card when created.
- **Chosen:**
  - New global table `PersonaPreset { id, label, description, personas(JSON
    al/en/it/fr/de), active }`.
  - `PersonaPresetsService.onModuleInit` seeds from `@lidh/core`
    `PERSONA_PRESETS` **create-if-missing** (`upsert` with empty `update`):
    new code presets appear; operator edits are never clobbered on deploy.
  - CRUD: `GET /v1/persona-presets` (`?all` includes inactive),
    `POST`/`PUT :id`/`DELETE :id` (soft, `active=false`). Platform-admin.
  - `TenantsService.createTenant` resolves the preset from the **DB**
    (`expandPersonas()` from core does the `{business}` fill); unknown or
    inactive → 400. The code path `expandPreset` is retired in favour of
    `expandPersonas(personasMap, name)`.
  - Dashboard: a top-nav **"Persona presets"** admin screen (edit/add/
    deactivate); the New-tenant picker consumes the same endpoint unchanged.
- **Why:** Seed-from-code keeps a sane default set versioned in git and makes
  fresh environments work with zero setup, while serve-from-DB removes the
  deploy coupling for the operator. Presets are *copied* into a tenant at
  create time (no FK), so editing/removing a preset is safe — existing
  tenants are immutable to it by construction.
- **Honest scope:** Soft-delete only (no hard delete UI — unneeded, presets
  aren't referenced post-create). No preset versioning/audit. Composable
  per-characteristic personas remain a possible future evolution of the
  `personas` JSON if real usage ever demands it — deliberately not built now.

---

## ADR-011 — Per-tenant model choice (Haiku ⇄ Sonnet)

**Status:** Accepted · 2026-05-19.
**Context:** `Agent.modelOverride` existed and was already read by the chat &
WhatsApp runtimes (`ctx.model ?? DEFAULT_MODEL`), but nothing could *set* it
— a dormant column. Some tenants have harder conversations that justify a
stronger (costlier) model; most don't.

- **Technical term:** *per-tenant model selection via the existing
  `Agent.modelOverride`, with a closed allow-list*.
- **Plain:** A dial per customer: leave it on the cheap, fast default, or
  turn it up to the smarter, pricier model for the ones who need it — without
  touching anyone else or the platform default.
- **Chosen:** `SELECTABLE_MODELS` (core) = `claude-haiku-4-5` (default) and
  `claude-sonnet-4-6`, shared by API validation (`@IsIn`) and the dashboard
  picker. `PUT /v1/agents/model { tenantSlug, model }` sets/clears the
  override (null/omitted ⇒ default); `GET /v1/agents` now returns it; an
  Agent-page selector flips it. No schema change (column already existed); no
  runtime change (already wired).
- **Why:** Closed allow-list, not a free string — prevents typos/unknown
  models reaching the API and keeps cost predictable. Default stays Haiku
  (the pricing model assumes the cheap path); Sonnet is opt-in per tenant.
  Takes effect next message since both runtimes read the column per request.
- **Honest scope:** Opus deliberately excluded (cost). No automatic
  escalation/heuristics (a possible later lever); selection is manual per
  tenant. Not yet surfaced in usage/billing rollups — model-mix cost
  reporting is an M3 (billing) concern.

---

## ADR-012 — Marketing site is a separate repo; this monorepo is platform-only

**Status:** Accepted · 2026-05-25. Reverses the implicit choice from ADR-001
#8 ("marketing's copy stays untouched; consolidation is a later refactor") —
that consolidation is **not happening**; we're going the other way.

- **Context:** When the platform monorepo was bootstrapped, the existing
  lidh.al marketing site was copied in as `apps/marketing` (commit 998cc1c,
  2026-05-09). It hasn't been touched here since — meanwhile the canonical
  marketing repo continued evolving. After 16 days the in-monorepo copy was
  meaningfully behind the live site. Either we sync forever, or we accept
  they're two different things and split them.
- **Technical term:** *deployment-boundary separation; the marketing site
  and the SaaS platform are independent codebases with independent CI/CD*.
- **Plain:** They're two different products. The marketing site is a brochure
  that changes occasionally; the platform is the app under active build.
  Keeping them in one drawer (one repo, one CI, one deploy graph) means every
  platform change reads the brochure and vice versa. Putting them in two
  drawers costs nothing because nothing real connects them.
- **Chosen:** Delete `apps/marketing/` from the platform monorepo. The
  marketing site continues in its own repo and its own Vercel project,
  owning the apex `lidh.al`. This monorepo deploys only `apps/dashboard`
  (`app.lidh.al`) + `services/api` (`api.lidh.al`) + `apps/dashboard/app/demo`
  (`demo.lidh.al`, same Vercel project as dashboard). The two systems
  communicate only through the platform's public API — if the marketing site
  ever needs the agent (e.g. a chat widget), it's a thin embed pointing at
  `api.lidh.al`, plus a CORS entry.
- **Why:**
  - **Different deploy targets.** Marketing → Vercel static-ish. Platform →
    Vercel + Fly + Docker + Postgres + Anthropic + Playwright. Different
    builds, different surface, different concerns at the CI layer.
  - **Different cadence.** Marketing changes occasionally; platform changes
    daily. Coupling pollutes both git histories.
  - **Different blast radius.** A bad platform deploy should never block a
    marketing-copy fix, and vice versa.
  - **No real shared code.** What they'd ever share is a small chat-widget
    JS snippet — not enough to justify a shared package.
  - **YAGNI on the cross-cutting refactor.** The "atomic refactor across
    both" scenario hasn't happened in this codebase and isn't likely soon.
  - **Industry norm** for SaaS at this stage: `www.x.com` and `app.x.com`
    are different projects (Stripe, Linear, Vercel itself).
- **Honest scope:** If a real shared design system or interactive product
  demos that embed dashboard code ever emerge, reconsider. Reverse migration
  is easier than forward — bringing the marketing repo *into* the monorepo
  later is a one-time copy plus a Vercel root-directory change. The cleanup:
  `apps/marketing/` removed; SETUP.md and diagrams pruned; comments that
  referenced the path reworded to credit the marketing site by name.

---

## ADR-013 — Business membership auth + self-serve onboarding

**Status:** Accepted · 2026-05-26. Closes the "Membership/team flow" that
ADR-006 explicitly left as honest scope ("non-admin authenticated users get
403 on admin endpoints until the Membership/team flow exists — intentional
for M2.4").

- **Context:** Until now the platform was single-operator: the only people
  who could log into the dashboard were *you* (platform admin, via
  `PLATFORM_ADMIN_EMAILS`). Business owners couldn't sign up, log in, or
  see their own data — every protected route returned 403. We need real
  multi-user signup so businesses can self-serve.
- **Technical term:** *Clerk-hosted signup + membership-based authorization
  + per-tenant access enforcement in service layer*.
- **Plain:** Before, there was one front door and only the owner had a key.
  Now anyone can sign up at the front door (Clerk handles passwords/
  reset/MFA), and after they walk in we hand them a key to their *own
  building* (their tenant). Each room in the building checks "is this your
  key?" before letting them in. The owner's master key still opens
  everything.
- **Chosen:**
  - **Signup UI** = Clerk-hosted `app.lidh.al/sign-up` (already configured).
    The marketing site (`lidh.al`, separate repo per ADR-012) gets a CTA
    that links here — no custom registration form, no password handling.
  - **AuthGuard** (`common/auth/auth.guard.ts`) relaxed: verifies the Clerk
    token, JIT-provisions the `User`, **loads the user's `Membership`
    rows**, and attaches `{userId, email, isPlatformAdmin, memberships:
    [{tenantId, role}]}` to `req.auth`. Any authenticated user passes;
    no more universal `not_a_platform_admin` 403.
  - **`@PlatformAdminOnly()` decorator** (`common/auth/platform-admin.decorator.ts`)
    + check inside AuthGuard for admin-only endpoints: tenants list/create/
    archive/reactivate/delete/graduate, persona-preset CRUD.
  - **`assertCanAccessTenant(ctx, tenantId)` helper** (`common/auth/access.ts`)
    reads the `TenantContext` (AsyncLocalStorage seeded from `req.auth` by
    the existing interceptor) and throws 403 unless the user is platform
    admin OR a member of that tenant. Called in tenant-resolving services:
    `TenantsService.getTenant`, `AgentsService.*`, `KnowledgeService.*`,
    `ConversationsService.*`, `LeadsService.*`.
  - **`POST /v1/onboarding/business`** + **`GET /v1/me`** (new
    `OnboardingModule`). `/me` returns `{user, memberships}` and drives the
    dashboard's first-paint routing. `/onboarding/business` creates Tenant +
    Agent + Persona(s) + web Channel + **Membership(role=owner)** for the
    caller in a single transaction (extends `TenantsService.createTenant`
    with an optional `ownerUserId` param so platform-admin tenant creation
    still works without a membership).
  - **Dashboard routing**: `(app)/layout.tsx` reads `/me` to render the nav
    (admin sees Tenants + Persona presets; business user sees only "My
    business" → their own tenant). `/tenants` list redirects non-admins to
    their own tenant (or `/onboarding` if they have none). `/persona-presets`
    redirects non-admins away. `/onboarding` redirects users who already
    have a tenant.
  - **WhatChimp account provisioning** = `WhatChimpTransport.provisionAccount()`
    method (wraps WhatChimp's `user/get/direct-login-url/only-new-users`).
    NOT triggered on signup — fired later when a tenant subscribes to the
    WhatsApp-included plan (billing comes in M3). Building block, ready to
    call.
- **Why:**
  - Clerk-hosted signup is the SaaS norm (Stripe/Vercel/Linear all do it):
    avoids re-implementing password hashing/reset/MFA, gains free OAuth
    later, less code surface for security bugs.
  - The membership check lives in the service layer (not the guard) because
    routes vary in how they identify the tenant (slug in URL, slug in query,
    id in body) — sprinkling 2 lines after each `tenant.findUnique` is
    cleaner than a generic guard that has to parse all those shapes. The
    `AsyncLocalStorage` `TenantContext` was already in place from ADR-006
    waiting for exactly this.
  - v1 = one tenant per business user (`/onboarding/business` rejects if
    `Membership` already exists). Multi-tenant memberships per user (team
    invites, agencies managing many clients) is a real later feature; the
    schema's `@@unique([userId, tenantId])` already supports many-to-many,
    but the UI/UX of "switching tenants" isn't built.
- **Honest scope:** No team invites yet (one user = one tenant for now,
  no add-teammate flow). No role-gated mutations within a tenant — any
  member can do anything on their own tenant; `admin`/`agent` roles are
  carried but not yet enforced in business logic. Archive/delete of a
  tenant stays platform-admin-only (a business owner can't delete their
  own tenant via the API yet — they'd ask you). All M3 (billing) work is
  unchanged; WhatChimp provisioning is wired but unbound.

---

## ADR-017 — Trial enforcement & the entitlements resolver (freeze, don't lock out)

The free tier is a **reverse trial**: every tenant is born with a 30-day trial
(`Tenant.trialEndsAt`, `TRIAL_DAYS=30`) that grants **full Premium**, WhatsApp
included. When it lapses the tenant must **choose a plan** — **Basic** (€29,
web widget only, *no* WhatsApp) or **Premium** (€69, keeps WhatsApp). WhatsApp
is deliberately the Premium hook; putting it on Basic would gut Premium. In
Albania WhatsApp *is* the product, so giving the whole Premium experience free
and then gating it is the strongest conversion lever — and it exposes Lidh to
no message cost (direct Meta Tech Provider; **service** conversations are free,
see [[ADR-004]] / `docs/whatsapp.md`).

**The problem this fixes:** "free for a month" was silently "free forever." The
runtime gated only on `status === "archived"`; an expired-but-not-archived trial
kept getting served on the web widget and WhatsApp. And the one helper that knew
about trials, `isTenantActive()`, was wired into `getFunnel`/`toTenantResponse`
only — never the chat or WhatsApp runtimes.

### Decision 1 — Derive entitlements; never materialize them

Enforcement is a **pure, synchronous** computation from `status` + `trialEndsAt`
+ `planId` + the clock. There is NO "expired" status column and NO cron that
flips tenants off. The instant grace passes, the next request sees the freeze.

- Correct by construction — no "expired but the nightly job hasn't run" window.
- Enforcement never depends on the scheduler. The cron exists only to *remind*
  (Phase 5); it can fail without ever letting a lapsed trial serve for free.

### Decision 2 — One resolver returns the full picture, not a boolean

`resolveEntitlements(input, opts)` in `services/api/src/tenants/entitlements.ts`
returns `{ state, chatEnabled, whatsappEnabled, dashboard, graceEndsAt }`.
Each enforcement point reads the column it cares about. Precedence
archived → subscribed → trial. States and capabilities:

| state | condition | web/funnel | whatsapp | dashboard |
|---|---|---|---|---|
| `trialing` | `trialEndsAt > now` | on | on | full |
| `grace` | lapsed, `< trialEndsAt + 3d`, no plan | on | on | full (warned) |
| `expired` | `≥ trialEndsAt + 3d`, no plan | **off** | **off** | **read_only** |
| `subscribed` | `planId` set | on | plan flag (Basic off / Premium on) | full |
| `archived` | `status="archived"` | off | off | none |

### Decision 3 — Freeze, don't lock out

An `expired` tenant keeps **read-only** dashboard access — they still see the
leads, contacts, conversations and usage they collected; every *mutation* is
rejected (`subscription_required`). Only `archived` (the admin kill switch,
[[ADR-008]]) is a hard lock-out. WhatsApp inbound is still **persisted** before
the reply gate, so a frozen tenant's incoming messages remain reviewable.

### Decision 4 — Soft grace = 3 days

After `trialEndsAt` the tenant stays fully live for `GRACE_DAYS = 3` (Premium,
full dashboard) while reminders escalate, so a live customer chat never dies
mid-sentence. Then it freezes. Tunable via the resolver's `graceDays` option.

### Decision 5 — Manual activation stays; no payment gate in code

The resolver reads `planId`/`trialEndsAt`/`status`, never a payment record.
Admins reactivate anyone — paid or not — via the existing `grantPlan` /
`extendTrial` / `planOverrides`. Reactivation is instant (derived) and
non-destructive (the WhatsApp channel is suspended, not deleted). A `planId` is
a **permanent** grant until an admin revokes it — real billing cycles /
`planExpiresAt` are M3.

- **Why derived over a job:** a materialized status conflates "admin archived"
  with "trial auto-lapsed", goes stale between runs, and couples access control
  to a background worker. A pure function is trivially testable — the first
  test suite in the monorepo (Vitest, `entitlements.spec.ts`, 17 cases) proves
  every row + the grace boundaries.
- **Why read-only, not lock-out:** an expired trial is someone we want to win
  back, not evict. Letting them review what the trial captured *is* the sales
  pitch; locking them out destroys it.

- **Honest scope:** ADR covers the model + the pure resolver (Phase 1, built).
  Still to wire (Phases 2–6): the runtime gates in `chat.service.ts` +
  `whatsapp.service.ts` (in/out) + `getFunnel`; the dashboard read-only
  write-guard + DTO fields; the admin override buttons; and the
  `@nestjs/schedule` reminder job (T-7/T-3/T-1/T-0) with a "reminder-sent"
  marker. Owner-phone capture (for later WhatsApp reminders), hard conversation
  caps, self-serve checkout and BSP/consolidated billing are explicitly M3+.
