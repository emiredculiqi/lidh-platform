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

---

## ADR-018 — Reposition: a multi-channel conversation platform, AI second

**Status:** Accepted · 2026-08-06. Supersedes the implicit positioning behind
ADR-001 and ADR-009/010 (an "AI assistant" product with channels attached).

- **Context:** The product was conceived AI-first — an agent that answers for a
  business, with WhatsApp/web as delivery. Selling that in Albania means
  teaching the market to trust AI *before* they can evaluate the product. That
  is a cost we cannot carry as an unknown vendor. Meanwhile the thing local
  businesses already feel as daily pain is scattered conversations: DMs on
  Instagram, WhatsApp, Messenger and website chat, each in a different app, with
  no shared history and nothing written down.
- **Technical term:** *category repositioning — the same system sold as a
  unified customer-conversation platform (shared team inbox) rather than as a
  conversational-AI product.*
- **Plain:** We sell the inbox, not the robot. The assistant becomes a feature
  that makes the salesperson faster, not the reason to buy.

### Decision 1 — The promise is "every customer conversation in one place"

Scope is **inbox + comments**: DMs across WhatsApp, Instagram, Messenger and the
web widget, plus replying to post/ad comments and comment→DM capture.

**Publishing/scheduling and ads management are explicitly out of scope.** They
are a separate product with their own integrations and calendar UI; promising
them alongside the inbox is how this drowns. When a prospect asks "where do I
schedule posts?", the answer is "we don't — we handle the replies".

### Decision 2 — AI autonomy is a ladder the owner climbs, not a quota

| Level | Behaviour |
|---|---|
| 0 — Off | Humans only. The default, and a complete product on its own. |
| 1 — Suggest | Assistant drafts; the salesperson edits and sends. Nothing goes out unread. |
| 2 — Narrow auto | Auto-answers only safe intents (hours, address, "we'll get back to you"). |
| 3 — Broad auto | Auto-replies generally; human takeover always one click away. |

The system **proposes** promotion from the account's own data — primarily
**edit rate**, the share of drafts sent unchanged — and the **owner decides**.

- **Why not a message quota:** a count measures volume, not readiness. 100 sent
  messages says nothing; 140 replies sent 92% unedited says a great deal. A
  hard cap also creates a cliff — either the assistant stops working, or it
  auto-enables and we have taken away the control we promised.
- **Why the owner flips the switch, not us:** "Lidh.al reviews your account
  before unlocking" makes us the bottleneck on our customer's product and caps
  our own growth with manual work.
- **Wedge:** after-hours. Nobody objects to the assistant answering at 02:00
  when the alternative is silence until morning.

### Decision 3 — Plans gate channels and seats, not WhatsApp

Reverses the "WhatsApp is the Premium hook" decision. Gating the channel
Albanians actually use behind the upper tier directly contradicts a pricing page
that promises to unify their channels. Growth now comes from connecting more
channels and adding more salespeople — both of which track the value delivered.

### Consequences

- **Marketing language drops AI as the headline.** This is about the *buyer*.
  End-user AI disclosure in the chat surfaces stays and is non-negotiable — it
  is a Meta requirement and simple honesty. Two different audiences.
- **Compliance improves.** Meta bars AI providers only "when such technologies
  are the primary (rather than incidental or ancillary) functionality"; an inbox
  where AI assists a human is unambiguously on the safe side.
- **Cross-tenant persona learning stays dead** (see the WhatsApp terms notes in
  `meta-app-review.md`), but the ladder gives us a better and lawful substitute:
  learning from *this* owner's approved replies, for *this* owner only, which is
  exactly the exclusive-use fine-tuning carve-out.
- **Honest scope:** Instagram and Messenger are currently "soon" placeholders in
  the dashboard; comments are not built at all. The repositioning is a decision
  about direction, not a claim about shipped capability.

## ADR-019 — Retire the real-estate vertical

**Status:** Accepted · 2026-09-18. Removes the work referred to throughout the
code as "ADR-016" — an entry that was never actually written (the log jumped
013 → 017; `platform.md` had been warning readers to trust the code instead).

- **Context:** The vertical was built 2026-06-10, before the ADR-018 pivot, as
  the purest expression of the AI-first product: a structured `Property` table,
  a `search_properties` agent tool with a four-step search-widening strategy, a
  `real_estate` persona in five languages, Houzez/geocode ingest scripts, and a
  live demo tenant (Bela Real Estate). It answered "can the assistant sell
  apartments?" — a question the business no longer asks. The priority is a
  business managing its WhatsApp and website conversations in one inbox, with
  Instagram and Messenger next; the assistant is an option the owner switches on.
  Meanwhile `services/api/scripts/` had grown into ~950 lines of vertical-specific
  ingestion holding raw Prisma clients against production, with no rule saying
  what belonged there.
- **Technical term:** *feature retirement with schema rollback — removing a
  vertical end-to-end (tool, persona, service, table, tooling, data) rather than
  leaving it dormant.*
- **Plain:** We delete the apartment-search feature entirely instead of leaving
  it switched off. Dormant code still has to be understood, typed, and migrated
  around; a feature nobody will sell is not worth that tax.

### Decision 1 — Remove it end-to-end, including the data

Code (`PropertySearchService`, the tool branch and opt-in wiring in
`chat.service.ts`, the tool definition and `ToolName` member in `@lidh/core`, the
persona preset), schema (`Property`, `PropertyListingType`, `Tenant.properties`,
via migration `20260918120000_drop_property_vertical`), the five ingest/seed
scripts, and the production data — listing rows are dropped with the table; the
Bela tenant and the DB-backed `real_estate` `PersonaPreset` row are deleted at
deploy time.

- **Why not just disable it:** `ToolName` is a union every runtime switches on;
  a dead member still has to be handled everywhere. The persona would remain
  selectable in the admin console with a prompt ordering the model to call a
  tool that no longer exists. Dormant is not free.
- **Why drop the data:** it was scraped for one demo and explicitly not wanted.
  An export nobody will read is a liability (personal data, retention) not an
  asset.

### Decision 2 — Keep the knowledge pipeline; it is not vertical-specific

`KnowledgeSource` / `KnowledgeChunk` are written by the dashboard's crawl,
paste-text and upload features and are the opt-in assistant's memory. The CS-Cart
scripts only added rows to them. They stay. Any future vertical need is served by
that pipeline, not by a bespoke table.

### Decision 3 — `scripts/` becomes `ops/`, with a written rule

Four files were never about AI — `freeze-check` (the only dry run for trial
enforcement, in a system with no staging), two WhatsApp diagnostics, and the test
seed needed until Meta App Review passes. They move to `services/api/ops/` under a
README stating the rule: **read-only diagnostics and dev seeds only; anything
that changes customer data goes through a service behind the API**, where tenant
isolation and the audit trail apply.

### Consequences

- **The Bela demo at `app.lidh.al/b/bela-real-estate` is gone.** Nothing else
  demonstrates a vertical; the product is demonstrated by the inbox.
- `ToolName` is two tools (`capture_lead`, `request_human_handoff`). Every tool
  is default-on; the opt-in mechanism (`OPT_IN_TOOLS`) was removed with its only
  member and should be reintroduced only with a second concrete tool.
- Schema is 17 models. The drop migration is irreversible and runs on the next
  `fly deploy` — the release command applies pending migrations before traffic
  flips.
- **Deploy-time checklist:** after the deploy, `DELETE /v1/tenants/:id` for the
  Bela tenant (cascades conversations, contacts, leads, personas) and delete the
  `real_estate` row from `PersonaPreset` — code removal does not touch DB-backed
  presets (ADR-010).
- `docs/diagrams.md` remains an M1 snapshot and never showed the vertical; it is
  stale for other reasons and is tracked separately.

## ADR-020 — Human answers by default; the assistant is a per-business setting with a schedule

**Status:** Accepted · 2026-09-19. Lands ADR-018 Decision 2 in the code: until
now `Conversation.aiPaused @default(false)` meant the assistant answered every new
conversation unless someone stopped it — the opposite of "Level 0 Off is the
default".

- **Context:** Owners in the Albanian market buy a shared inbox and are wary of
  a bot answering in their name. The product now sells human control first and
  the assistant as something the owner switches on — always, or only when nobody
  is there (evenings, weekends). The old per-conversation boolean could not
  distinguish "inherited from the business" from "a person deliberately took
  over", so a schedule had nothing to reason about.
- **Technical term:** *a three-layer responder resolution — per-thread override,
  then business mode, then a weekly window in the business's timezone — resolved
  by a pure function on every inbound message, in both runtimes.*
- **Plain:** Each business chooses who answers: the team (default), the
  assistant, or the assistant only during set hours. Inside any single
  conversation a person can still take over or hand the thread to the
  assistant, and that choice sticks until they undo it.

### Decision 1 — One pure resolver, mirrored on `entitlements.ts`

`tenants/responder.ts`: `readResponderSettings(Tenant.settings)` →
`resolveResponder(settings, now)` → `effectiveResponder(settings, override,
now)`. No DB, injectable clock, Vitest-covered (timezones, overnight windows,
weekends, override precedence). Both `chat.service` and `whatsapp.service` call
it where they used to read `aiPaused`; the dashboard reads the same result.

- **Why derived, not stored:** the same reason as ADR-017 — a stored "AI is on"
  flag flipped by a scheduler is stale between runs and silent when the
  scheduler fails. Evaluating at message time can never be either.

### Decision 2 — The manual override wins over the schedule

`Conversation.aiOverride` (`human` | `ai` | null) replaces `aiPaused`. Null
inherits the business setting. A takeover sets `human` and stays until an
operator clears it — the schedule only governs threads nobody touched.

- **Why:** an operator mid-conversation must never have the assistant resume
  under them because the clock hit 18:00. Predictability for the person at the
  keyboard beats strictness of the schedule.

### Decision 3 — Existing businesses keep the assistant on

The migration backfills `responder.mode = "ai"` for every tenant that exists on
deploy, so nothing changes for current customers. Only businesses created
afterwards start on human. Existing `aiPaused = true` rows become explicit
`human` overrides, so no takeover is lost.

### Decision 4 — The suggested schedule is the after-hours wedge

When a business first switches to `schedule`, the form is pre-filled with
weekdays 18:00→09:00 and the whole weekend, in `Europe/Tirane`. That is the
ADR-018 wedge in concrete form: humans during the working day, the assistant
when the alternative is silence until morning.

### Consequences

- New Settings page (`/tenants/:slug/settings`) and sidebar entry; the setting
  is owner/admin-editable via `PUT /v1/tenants/:slug/responder`.
- `POST /v1/conversations/:id/ai` now takes `{ mode: human | ai | inherit }`
  and returns the override plus the resolved responder.
- The thread footer shows who is answering and offers "take over", "let the
  assistant answer", and — when an override exists — "back to business
  default". The inbox no longer filters by AI/Human (ADR-018); it filters by
  channel and by who is waiting.
- Writes are validated strictly (real IANA zone, well-formed windows) precisely
  because the runtime reader is lenient by design — it drops bad windows rather
  than throw on a customer message, so bad data must be refused at the door.
- The ladder's Level 1 ("Suggest": drafts a human sends) is still not built;
  this ADR covers Levels 0 and 3 plus a timer. Suggest remains the next rung.

## ADR-021 — Web intake gate: name and email before the business sees a conversation

**Status:** Accepted · 2026-09-19.

- **Context:** With the inbox as the product, an anonymous web thread is worth
  little to a business — they cannot follow up, and it pollutes the contact
  list ("Anonymous visitor" ×40). WhatsApp has no such problem: the phone
  number is the identity. The owner's request was that a web visitor must give
  a name and email before they can ask anything, and that until then the
  conversation never reaches the business at all.
- **Technical term:** *a scripted intake state machine ahead of the agent,
  with visibility gating on the conversation row.*
- **Plain:** The chat bot asks two questions — name, then email — before it
  will do anything else. Until both are answered, the business does not see
  the conversation. Once answered, the visitor becomes a contact, the business
  is notified, and the team or the assistant takes it from there.

### Decision 1 — Scripted, not model-driven

Two bot lines (`chat/intake.ts`), email validated by pattern, free text parsed
for both details so "Ana, ana@x.al" completes intake in one message. Zero
tokens, deterministic, and it cannot be argued out of.

- **Why not the model:** a model-driven intake can be talked around ("answer
  this first"), costs a call per message, and needs the model to run for
  businesses that have switched the assistant off. The gate must hold for all
  of them.

### Decision 2 — Always on, independent of the responder setting

Human is the default responder (ADR-020). If the intake only ran when the
assistant was on, a business set to "team answers" would never receive a web
conversation. So the intake runs for every web visitor; on completion the bot
either says the team will reply shortly, or the assistant answers.

### Decision 3 — Invisible until complete

`Conversation.intakePending` is true from creation until completion. While
true the row is excluded from the inbox, unread counts, "awaiting reply",
response time, usage and the notifications feed, and no live events are
published. On completion: `conversation_started` and `contact_registered`
feed entries (the bell), a `conversation.started` live event, and the contact
is upserted by email — a returning visitor in a new browser is merged onto
their existing contact, which closes the long-standing web dedup gap.

### Decision 4 — Abandoned intakes are purged after 7 days

An hourly in-process timer (`IntakePurgeService`) deletes gated conversations
older than a week and their placeholder contacts. Nothing of value is lost
(no identity, never visible). This is the first scheduled job in the codebase;
it is in-process because the API runs as one machine by design. It is
idempotent, so a second machine would merely repeat it — but the retention
work (todo #8) should move it to a real scheduler.

### Decision 5 — The dashboard test chat gets its own authenticated route

`POST /v1/chat/preview` is Clerk-guarded and creates `kind: preview`
conversations that skip intake and are excluded everywhere. Before this, the
test chat used the public route and its sessions counted as real customers in
the inbox and usage — a latent bug fixed as a side effect. The exemption
cannot be spoofed: a visitor has no token.

### Consequences

- The widget and the funnel page needed **no change** — the gate is entirely
  server-side and its prompts arrive as ordinary `text` events.
- Existing anonymous web conversations are grandfathered as visible.
- In assistant mode, the first real question is answered after intake from the
  full history, which now contains the intake exchange; this is a behaviour
  to watch until an eval exists (todo #6).
- Some visitors will leave at the name prompt. That is the accepted trade for
  an inbox where every web contact is reachable.

**Amended 2026-10-05.** The second detail is *an email or a phone number*,
not email only — many Albanian customers would rather leave a number, and a
number typed here is normalised to E.164 and merges into the contact the
WhatsApp path already keeps for it. The first message of a conversation is
never read as a name (the bot has not asked yet), and the parser accepts the
lead-ins people actually type ("un ja redi"). The copy explains the reason —
so the business knows who it is talking to and can reply — before it asks.

## ADR-022 — Persona presets: usage check, warn on deactivate, refuse delete while in use

**Status:** Accepted · 2026-09-19.

- **Context:** The admin console could only deactivate a preset; the API's
  `DELETE` was itself a soft-delete. After the real-estate retirement
  (ADR-019) the `real_estate` preset could only be hidden, not removed. And
  neither action told the admin whether any business was using the preset —
  presets are copied into a tenant's personas at creation with no
  back-reference (ADR-010), so "in use" was unknowable.
- **Plain:** Before hiding or deleting a preset, the admin sees which
  businesses use it. Hiding is always allowed (existing businesses keep their
  copies). Deleting is refused while any business uses it.

### Decision 1 — Record the source preset from now on, infer it for the past

`AgentPersona.presetId` (informational, not a foreign key — the copy must
outlive the preset) is written at tenant creation. For tenants created before
the column existed, usage is inferred by **content match**: a persona whose
text equals the preset's text for that locale with `{business}` expanded to
the tenant's name. The match misses copies the owner has since edited, and the
admin UI says so.

### Decision 2 — Deactivate warns; delete is blocked

`GET /v1/persona-presets/:id/usage` returns the businesses and how each was
matched. Deactivating (`PUT { active: false }`) shows the list and proceeds —
it only affects future signups. `DELETE` is now a hard delete and returns
`409 preset_in_use` with the list while any business uses the preset. The
refusal protects the *source* text, not the tenants: their personas are copies
and survive regardless.

### Consequences

- The `real_estate` preset can now be deleted once no business matches it.
- Usage is computed on demand across all non-archived tenants; fine at the
  current scale, and it only runs on an admin click.

## ADR-023 — Retire the Lead module; interest becomes a stage and a note on the contact

**Status:** Accepted · 2026-09-19.

- **Context:** A `Lead` row was created whenever the assistant's `capture_lead`
  tool fired: the captured fields, a note, and its own status ladder
  (`new → contacted → won → lost`). After the customer stage landed on
  `Contact` (`new → lead → client → not a fit`, set by a person), the product
  carried **two "lead" concepts with two status machines**, one set by the
  assistant and one by the team, and owners could not tell a lead from a
  contact from a conversation. The one thing of lasting value in a Lead row
  was its `notes` — the assistant's one-line summary of what the person wanted.
- **Technical term:** *collapsing an AI-produced entity into attributes of the
  human-owned entity (stage + notes on Contact), with a data-carrying migration.*
- **Plain:** A lead is a contact the team has marked as one. The assistant may
  suggest it — by moving a brand-new contact to *Lead* and writing down what
  they asked for — but there is no separate list to keep in sync.

### Decision 1 — `capture_lead` now enriches the contact

On intent: fill in name/email/phone (as before), move `Contact.stage` from
`new` to `lead` — never downgrading a `client` or a `not_a_fit` — append an
**intent note**, and notify by bell and email exactly as before. The tool
keeps its name; renaming it would change what the model has learned to call.

### Decision 2 — Notes are a history, and the team can write them too

`ContactNote { kind: intent | manual, body, conversationId?, authorUserId? }`.
Intent notes come from the assistant (both runtimes); manual notes come from a
box on the contact page (`POST /v1/contacts/:id/notes`). One timeline, newest
first. "Latest only" was considered and rejected: the marginal cost of a table
over a column is small, and *"called back, prefers mornings"* had no home.

### Decision 3 — Migrate, then drop

One release-time migration creates `ContactNote`, copies every `Lead` onto its
contact as an intent note (the note body, else the captured fields, else
"Interest detected"), moves those contacts `new → lead`, then drops `Lead` and
`LeadStatus`. Leads whose contact had already been deleted carry no identity
and go with the table.

### Consequences

- The Leads page, sidebar item, API module and types are gone. "Show me my
  leads" is the Contacts page filtered by stage = Lead.
- The dashboard's "New contacts" tile and the usage page count contacts with an
  identity first seen this month, not lead rows.
- The bell keeps the `lead_captured` event kind (renaming an enum value is
  churn) but labels it **"Interest detected" / "Interes i zbuluar"**; the email
  now links to the contact, not to a dead page.
- ADR-004's knowing duplication shows again: `recordIntent` exists in both
  `chat.service` and `whatsapp.service`, kept in step by hand.

## ADR-024 — The conversation workspace: search, favorites, team awareness, tasks, drafts

**Status:** Accepted · 2026-09-19. Implemented step by step; each decision
below notes where it stands.

- **Context:** With the inbox as the product (ADR-018), the thread view is
  where a team spends its day. Five gaps showed up as soon as two people used
  it: filters lived in React state and could not search message text; there
  was no way to keep a few threads on top; two employees could answer the same
  customer without knowing about each other; "what we agreed with this
  customer" had no home; and the assistant, even when trusted, could only
  answer *instead of* a person, never *for* one to review.
- **Plain:** the inbox becomes a shared workspace. The server does the
  filtering, a person can star what matters to them, everyone can see who is
  on a thread, agreements become a checklist on the contact, and the assistant
  can draft a reply that a person sends or throws away.

### Decision 1 — Filters live in the URL and the server does the work (shipped)

`GET /v1/conversations` takes `q`, `channel`, `stage`, `only=unanswered`.
`q` matches the contact's name, phone and email **and any message body** in
the thread (case-insensitive substring; a correlated `EXISTS`, adequate at our
scale — a trigram index is the upgrade if it ever shows in a query plan).
"Unanswered" is computed server-side with the same SQL as the dashboard's
*Awaiting reply* tile, and its tenant-wide count is returned alongside the
list so the tab badge and the KPI can never disagree. The inbox reads
`?only=&channel=&stage=&q=` from the URL, exactly like Contacts, so a view
survives a reload and thread links keep the filters.

Layout, after a first round of hand testing: the search box is always
visible; the one work filter (*All* / *Unanswered · n*) is a pair of tabs;
channel and customer stage sit behind a single *Filters* button with a count
badge. Waiting threads are also marked in the list itself (amber dot on the
avatar, "Waiting · 12 min" pill), because a filter answers "which ones" but
a row has to answer "is this one".

A Next.js layout cannot read the query string, so the layout still renders the
**unfiltered** first page for instant paint, and the client fetches the
filtered list itself, re-fetching on a `tick` the live provider bumps on every
event. Client-side filtering over the newest 100 rows was rejected: it could
not search text and silently missed anything older than the page.

### Decision 2 — Favorites are personal (shipped)

A star is a focus tool for one person, like Gmail's; a shared "important
customer" is what the contact stage is for. `ConversationStar { userId,
conversationId }`; starred threads float to the top of every list, newest
first within the group, shown as a **collapsible section** at the top of the
inbox rather than as a filter tab — the focus set stays in view while the
rest of the list is what it always was. The star sits at the top right of a
row, next to the time.

### Decision 3 — Team awareness is a soft warning, never a lock (shipped)

Three signals, cheapest first: **who replied last** (already in the data —
human replies record their author, takeover sets `assignedToUserId`, nothing
read either until now); **who is viewing** (a 20 s heartbeat from the open
thread, kept in memory in `LiveService`, broadcast to the tenant's other
dashboards); **who is typing** (the same heartbeat with a flag, expiring in
5 s). The other employee sees "Ana is replying to this customer" above the
composer and a chip on the list row. The composer stays enabled: a hard lock
fails the moment someone leaves a tab open. Presence is in-process and
single-instance, consistent with the rest of the live bus (CLAUDE.md), and
moves to Redis with it.

### Decision 4 — Tasks belong to the contact (shipped)

The right panel of a thread is the *contact* panel, and a customer has many
threads, so the checklist follows the customer like notes do (ADR-023).
`ContactTask { text, done, doneAt, createdById, conversationId? }`, shown in
the thread's right panel and on the contact page.

### Decision 5 — The assistant drafts; a person sends (shipped)

`POST /v1/conversations/:id/suggest` runs the same brain (persona, facts,
knowledge retrieval over the thread) with **tools off and nothing persisted**:
no message row, no events, no contact changes; only usage is counted. The draft
lands in the composer for editing. A sent reply records whether the draft was
used as-is or edited — free now, and the raw material for learning from an
owner's approved replies later. This is the first rung of the ADR-018 trust
ladder made concrete. One-shot rather than streamed: text arriving inside a
box you are editing is worse than a two-second wait.

### Consequences

- The topbar's decorative search box is gone; search happens where the list is.
- Everything here is per tenant and, for stars and presence, per user — every
  new query is scoped by `tenantId` by hand (no RLS).
