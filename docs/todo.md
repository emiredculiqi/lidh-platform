# To-do

Known gaps and deferred work. Each item says what's wrong, why it matters, and
what the fix looks like — so it can be picked up cold.

For accepted architectural decisions see [decisions.md](./decisions.md); for
what the platform is, [platform.md](./platform.md).

---

## Security

### 1. `/v1/chat/web` has no rate limiting, and the origin check is bypassable

**Status:** open · **Severity:** high (costs real money) · found 2026-09-10

`POST /v1/chat/web` is `@Public()` — no Clerk token, by necessity, since the
widget serves anonymous visitors. Two problems compound:

- **No rate limiting exists anywhere in the API.** Neither `@fastify/rate-limit`
  nor any equivalent is installed. Every accepted request runs a real Anthropic
  call that we pay for, so an abusive script maps directly onto our bill.

- **The per-tenant origin allow-list does not stop a non-browser client.** In
  `ChatService.runWeb` the gate reads:

  ```ts
  if (allowedOrigins.length > 0 && origin && !isOriginAllowed(origin, allowedOrigins))
  ```

  `Origin` is a browser-set header. A script (curl, a bot) simply omits it, so
  `origin` is undefined and **the whole check is skipped**. The allow-list
  protects against an honest site embedding someone else's widget; it does not
  protect against deliberate abuse.

  Related: an **empty** `allowedOrigins` also skips the check — empty means "open
  to every website", not "closed". Businesses that never configure it are
  unprotected by default. Worth revisiting as a product decision.

**Fix direction:** rate limiting is the real control; treat the origin check as
hygiene, not defence. Key the limit per tenant slug **and** per IP, since one
abusive visitor must not silence a whole business's widget. See item 2 for where
to enforce it.

### 2. Block abusive requests before they reach the handler

**Status:** open · **Depends on:** item 1 · found 2026-09-10

Today every gate runs *inside* `ChatService.runWeb` — the request is fully
routed, parsed and DB-resolved before it can be rejected. Four places could stop
it earlier, cheapest first:

1. Cloudflare (edge) — never reaches Fly
2. Fastify middleware — before Nest routing
3. A NestJS guard — before the handler
4. Inside the handler — where we are now

**Chosen: layer 2, `@fastify/rate-limit`,** registered in `main.ts` and scoped to
the chat and webhook routes.

**Why not layer 1 (Cloudflare), which is cheaper:** it only applies if
`api.lidh.al` is actually proxied through Cloudflare (orange-cloud DNS) rather
than pointing straight at Fly — verify before relying on it. Cloudflare is the
better long-term answer for volumetric abuse and should be added on top; the
Fastify plugin is the part that works regardless of DNS and is the baseline.

**Why not layer 3 (a guard):** a guard would need to load the tenant to know the
per-tenant limit, and `runWeb` loads it again moments later — two queries for one
fact. A cheap IP/slug-keyed limit at layer 2 needs no DB read at all.

**Care needed:** provider webhooks (`/v1/webhooks/whatsapp`, `/v1/webhooks/meta`)
arrive in legitimate bursts — coexistence history backfill sends 3 phases × N
chunks. Exempt them or give them a much higher ceiling, or the first history sync
after a connect will be throttled and messages lost.

---

## Cost & observability

### 3. Token counts are merged on write, so caching is unmeasurable

**Status:** open · **Severity:** medium · found 2026-09-10

`runAgent` reports three separate figures — `tokensIn` (full price),
`cacheReadTokens` (~0.1x), `cacheWriteTokens` (~1.25x). **Both** runtimes then
add all three into one variable before persisting:

- `chat.service.ts` — `tokensIn += ev.tokensIn + ev.cacheReadTokens + ev.cacheWriteTokens`
- `whatsapp.service.ts` — the same line

`Message` stores only `tokensIn` / `tokensOut`, so a row reading `1500` could be
1,500 tokens at full price or 1,400 cached ones plus 100 fresh — roughly a 10x
cost difference the DB cannot distinguish.

This matters because prompt caching **fails silently**: if the cached prefix is
below the model's minimum cacheable size (512–4096 tokens, model-dependent), no
cache is created and no error is raised. A tenant with a short persona may never
cache at all and we would not know.

**Fix:** persist `cacheReadTokens` / `cacheWriteTokens` as their own columns (or
at minimum log them). A non-zero cache-read count is the only proof caching works.

### 4. Knowledge block sits before history, which blocks caching the history

**Status:** open · **Severity:** medium (grows with conversation length) · found 2026-09-10

Anthropic caching is a **prefix match** — a breakpoint covers everything from the
start of the request up to it, and any byte change invalidates everything after
it. Render order is `tools` -> `system` -> `messages`, so today:

```
[ tools ]  [ system 1: persona+facts ]  [ system 2: knowledge ]  [ messages: history ]
   stable        stable, CACHED            varies every message        grows
```

`buildSystemPrompt` puts retrieved knowledge in system block 2 — **between** the
cached persona and the message history. Because RAG returns different passages
for every question, everything after it differs on every request, so a cache
breakpoint on the history would essentially never hit.

History is re-sent at full price on every turn and grows to `MAX_HISTORY` (40),
so on long conversations it becomes the dominant input cost.

**Fix:** move the volatile knowledge to the END, after the history (e.g. appended
to the final user message) so the order becomes tools -> persona -> history ->
knowledge. Then a second breakpoint after the history can actually hit. This is a
change to prompt assembly in `packages/core/src/prompt.ts` + both runtimes, not a
one-line addition — and it changes what the model sees, so re-check answer
quality after.

### 5. WhatsApp retrieval is weaker than web retrieval

**Status:** FIXED 2026-09-11 · **Severity:** low-medium (answer quality) · found 2026-09-11

The web path builds its RAG query from the **last two user turns plus** the new
message, so a short follow-up ("for my face, anti-wrinkle") still retrieves
against what was asked earlier ("a cream"):

```ts
// chat.service.ts
const retrievalQuery = `${recentUserText} ${dto.message}`.trim().slice(0, 1000);
```

`whatsapp.service.ts` embeds the bare inbound instead:

```ts
const knowledgeChunks = await this.retrieval.retrieve(tenant.id, msg.text);
```

So the same customer asking the same follow-up gets worse knowledge on WhatsApp
than on the website. This is exactly the drift ADR-004 warns about when the two
orchestrations are kept separate — an improvement landed on one path only.

**Fixed:** `buildRetrievalQuery(history, message)` now lives in
`chat/retrieval.service.ts` and both runtimes call it. The helper drops a
trailing duplicate because the two paths disagree on whether `history` already
contains the new message — web reads history BEFORE persisting the inbound,
WhatsApp AFTER — so a naive shared helper would have embedded the WhatsApp
message twice. Covered by `chat/retrieval-query.spec.ts`.

---

## Quality

### 6. No way to measure whether a prompt change made answers better

**Status:** open · **Severity:** medium (blocks other work) · found 2026-09-11

Nothing in this repo evaluates answer quality. The Vitest suite covers parsing,
consent keywords, entitlements and retrieval-query construction — all pure
functions. Whether the agent actually answers a customer *well* is judged by
reading a few replies and forming an impression.

That makes any change to what the model sees unfalsifiable. Concrete changes
currently blocked on it:

- **Carrying retrieved knowledge forward between turns** (raised 2026-09-11).
  Today each turn retrieves fresh passages, so a listing discussed in turn 1 can
  vanish by turn 3. Accumulating old + new chunks would preserve it, and as a
  side-effect would make the knowledge block **append-only** — a growing prefix,
  which is the shape prompt caching rewards (see item 4). Against it: grounding
  quality depends on precision not volume, so more passages give the model more
  chances to seize the wrong one; stale chunks can contradict fresh ones (the
  same apartment at two prices from two crawls); and growth is unbounded. The
  last-two-turns query already addresses the same continuity problem more
  cheaply, and facts the agent actually used survive inside its own replies,
  which are in the history. **Verdict: plausible but unproven — do not ship it
  on intuition.**
- Moving the knowledge block after the history (item 4) — changes what the model
  sees, not just where bytes sit.
- Any persona or RESPONSE_STYLE edit.

**Fix direction:** a small golden set — 20-30 real customer questions per
vertical with a note on what a good answer contains — run against the live agent
and scored, even manually at first. Enough to catch a regression, not a research
benchmark.

---

## Privacy & compliance

> These four are one body of work. **Order matters:** the written documents
> (7, 10) promise behaviour the code must actually be capable of (8, 9). Publishing
> a policy the system cannot honour is how the current privacy page became false —
> do not repeat it in the DPA.
>
> Items 7 and 10 live in the **`lidh-website`** repo (ADR-012), not here.

### 7. Privacy policy contradicts the code

**Status:** open · **Severity:** HIGH — false statement to end users · **Repo:** `lidh-website`

`lidh.al/privacy` states:

> "Lidh.al does not store the full content of WhatsApp conversations in our own databases"

This is **false**. `whatsapp.service.ts` persists every inbound body, every agent
reply and every owner echo as plaintext in `Message.contentText` (`String? @db.Text`).
The same is true of web chat.

This is legal exposure independent of Meta, and App Review reviewers open that URL.

**The fix is the text, not the code.** Storing is legitimate and unavoidable — the
WhatsApp terms state plainly that *"Meta does not provide an archiving service,
storage service, or any backup functionality; you are solely responsible for
creating backups."* A shared inbox cannot exist without storage. The policy simply
has to say so.

The rewritten policy must state, accurately:

- that conversation content **is** stored, and why (the inbox is the product)
- how long it is kept — blocked on item 8; do not invent a number
- who it is shared with — the sub-processor list in item 10
- that an AI assistant may generate replies, and that Anthropic processes message
  content to do so (already named in the current policy — keep it)
- how a customer requests erasure — blocked on item 9
- that replying STOP stops automated replies (now true — commit `0ef5bde`)

### 8. No data retention policy, and no way to enforce one

**Status:** open · **Severity:** HIGH · **Blocks:** 7, 10

There is **no TTL, no purge job, and no scheduler of any kind** in this codebase.
Every message, contact and event is kept in plaintext indefinitely, because the
deletion code was never written — not because a retention period was chosen.

"We keep everything forever" is the weakest defensible position under any modern
privacy regime, and item 7 cannot state a retention period until one exists.

**Fix direction:** pick a period per data class (conversation content, contacts,
events, usage rollups) — content is the one that matters. Then build the purge.
Note there is no scheduler at all today, so this needs a runner (a Fly scheduled
machine, or a cron-triggered endpoint) as well as the delete logic. Archived and
deleted tenants need a defined disposal path too (ADR-008 covers the tenant
lifecycle but not the data's).

### 9. No per-contact erasure

**Status:** open · **Severity:** HIGH · **Blocks:** 7, 10

If a **customer** — someone who messaged a business on WhatsApp or the widget —
asks to have their data erased, there is no mechanism. No endpoint, no admin
action, no script.

**The `/data-deletion` callback does not cover this.** It handles a Meta callback
for the **business owner's Meta login**: it revokes their channels and destroys the
stored token, and it deliberately does *not* delete conversations, because those
belong to the business rather than to the Meta login. That decision is correct —
but it means the customer-facing erasure path does not exist at all. The similar
names hide the gap.

**Fix direction:** erase by `Contact` within a tenant — the contact row, its
conversations, their messages, and related events. Decide explicitly whether it is
a hard delete or an anonymisation (keeping usage counts intact matters for
billing). Needs an operator-facing trigger and an audit record of the erasure
itself.

### 10. No Data Processing Agreement with businesses

**Status:** open · **DO THIS LAST** · **Severity:** HIGH · **Repo:** `lidh-website`
(+ signup flow) · **Blocked by:** 8, 9

> Deliberately the final item in this list. The DPA describes what the system
> does; it cannot be written truthfully until retention (8) and erasure (9)
> exist and the privacy policy (7) is corrected.

Legally the **business is the data controller** (it owns the customer
relationship and decides why the data is used); **Lidh.al is the processor**,
storing and processing on its behalf. That arrangement normally requires a written
Data Processing Agreement. None exists.

The WhatsApp terms lean on this too: *"obtain (or if you are a Solution Provider,
**ensure your Clients obtain**) all necessary rights and legally sufficient
consent."* The DPA is the instrument that discharges "ensure your Clients obtain".

**A DPA must state:** what categories of data are processed, for what purpose,
that we act only on the controller's documented instructions, security measures,
retention and deletion on termination (items 8, 9), breach-notification timing,
audit rights, and the **sub-processor list**.

**Sub-processors, as derived from this codebase** — verify before publishing:

| Sub-processor | Role | Sees message content? |
|---|---|---|
| Anthropic | LLM generating replies | **yes** |
| OpenAI | embeddings for RAG | knowledge chunks + query text |
| Neon | Postgres — the system of record | **yes, at rest** |
| Fly.io | API hosting (Frankfurt) | **yes, in transit/memory** |
| Vercel | dashboard hosting | yes, rendered to operators |
| Clerk | authentication | no — operator identities only |
| Resend | transactional email | lead/handoff notification contents |
| Meta / WhatsApp | the channel itself | **yes** |
| Cloudflare | DNS / edge | in transit |
| S3-compatible storage | uploaded source documents | only if configured |

**Do not draft this from scratch.** Start from a standard SaaS processor-side DPA
template, adapt it, and have a lawyer review it once. For SMB self-serve it is
normally published as an annex to the Terms of Service and accepted at signup —
not separately negotiated per customer.

Albanian data-protection law is aligned with EU standards, and GDPR applies
directly to any customer serving EU residents. Confirm the specifics with a
lawyer before onboarding paying customers.
