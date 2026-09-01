# Lidh.al Platform — what it is

The product, the shape of the system, and the reasoning behind both. Start here.
For *decisions* and their trade-offs see [decisions.md](./decisions.md); for the
WhatsApp channel specifically see [whatsapp.md](./whatsapp.md).

---

## The product

**Every customer conversation in one place.** A shared team inbox for Albanian
businesses whose customers message them on Instagram, WhatsApp, Messenger and
their website — four apps today, one inbox with Lidh.al.

We sell the inbox, not the robot. An AI assistant is a feature inside it that
makes the salesperson faster; it is not the reason to buy (ADR-018).

**In scope:** direct messages across channels, replies to post/ad comments,
comment→DM capture, contacts and leads, human takeover, per-business knowledge.

**Explicitly out of scope:** scheduling/publishing posts, ads management,
analytics suites. Those are a different product.

### Who it is for

Albanian SMBs where one or two people answer everything themselves — retail,
beauty, restaurants, real estate, clinics. The pain is not "I want AI"; it is
"a customer asked a price on Instagram at 21:00 and nobody saw it until Tuesday".

There is a **real-estate vertical** already built — a `Property` model, a
property-search tool and a dedicated persona — but no ADR was ever written for
it (the decision log jumps 013 → 017). Treat the code as the source of truth
there, not the docs.

### How the assistant earns trust

Autonomy is a ladder the **owner** climbs, never a switch we flip for them:

| Level | Behaviour |
|---|---|
| 0 — Off | Humans only. The default, and a complete product on its own. |
| 1 — Suggest | Assistant drafts; the salesperson edits and sends. |
| 2 — Narrow auto | Auto-answers safe intents only (hours, address, "we'll come back to you"). |
| 3 — Broad auto | Auto-replies generally; takeover always one click away. |

The system proposes promotion from that account's own **edit rate** — the share
of drafts sent unchanged — and the owner decides. No quotas, no cliffs, and no
manual review by us. See ADR-018 for why a message count is the wrong metric.

---

## System shape

A pnpm + turbo monorepo. Four workspaces, two deploy targets.

```
apps/dashboard    Next.js 15 App Router · Clerk auth · app.lidh.al      → Vercel
services/api      NestJS + Fastify · REST under /v1 · api.lidh.al       → Fly.io (lidh-api, fra)
packages/core     the agent runtime (runAgent, personas, prompt cache)  — shared lib
packages/db       Prisma schema + generated client · Postgres           → Neon
```

The marketing site (`lidh.al`) is a **separate repository** — see ADR-012. It is
not built or deployed from here.

### Request paths

- **Web widget** → `POST /v1/chat/web` (SSE stream) → `runAgent`
- **WhatsApp** → `POST /v1/webhooks/whatsapp` (HMAC-verified) → same `runAgent`,
  non-streaming, reply delivered via the Cloud API transport
- **Dashboard** → Clerk-authenticated BFF proxy → the API
- **Public funnel** → `app.lidh.al/b/<slug>`, unauthenticated, one per tenant

Both channels share one brain: `runAgent` in `packages/core`. The channel only
changes the envelope (streaming vs not, and how the reply is delivered).

### Multi-tenancy

Every domain row carries a denormalized `tenantId`. Access is enforced in code
via `assertCanAccessTenant` / `assertTenantRole`, reading an AsyncLocalStorage
request context seeded by a global Clerk `AuthGuard`. Postgres RLS is *not* in
place — application-layer enforcement is the only gate today.

### Core model

`Tenant → Channel → Conversation → Message`, with `Contact` unified across
channels by `(tenantId, phone)` / `(tenantId, email)` so the same person messaging
on web and WhatsApp collapses into one record. `Agent` + `AgentPersona` hold the
per-tenant assistant configuration; `KnowledgeSource` + chunks back retrieval.

### Entitlements

Plans gate **channels and seats** (ADR-018) — not WhatsApp specifically.
Entitlements are *derived* on every read by a pure resolver, never materialized
(ADR-017), and an expired trial **freezes** the account read-only rather than
locking the owner out.

---

## Channels

| Channel | State |
|---|---|
| Web widget | live — embeddable `widget.js`, any origin, per-tenant allowlist |
| WhatsApp | live — direct Meta Cloud API as a **Tech Provider**, using Coexistence |
| Instagram DM | not built (dashboard shows "soon") |
| Messenger | not built (dashboard shows "soon") |
| Comments / comment→DM | not built — in scope per ADR-018 |

WhatsApp is the deep one: we are a Meta **Tech Provider**, businesses onboard via
Embedded Signup, and **Coexistence** means the owner keeps using the WhatsApp
Business App on their phone while we answer on the same number. Go-live is gated
on Meta App Review — see [meta-app-review.md](./meta-app-review.md).

---

## Constraints worth knowing before you change things

- **Real-time is single-instance.** Live inbox updates and human takeover use an
  in-process `EventEmitter`, and the API runs as one Fly machine. Adding a second
  instance silently breaks both until there is Redis pub/sub behind it.
- **WhatsApp data may not train shared models.** Meta's terms allow fine-tuning
  only for *exclusive use*. Learning across businesses from WhatsApp
  conversations is out; learning from one owner's own approved replies is fine.
  Web-widget conversations are unaffected.
- **Prompt caching is a cost requirement, not an optimisation** (ADR-001 #7) —
  the system-prompt prefix must stay stable and tools must render deterministically.
- **Message content is stored in plaintext** with no retention policy or purge
  job yet. The privacy policy now says so honestly; the retention work does not
  exist.
- **No staging environment.** One Fly app, one Vercel project, work happens on
  `main`. Anything that writes data deserves a dry run and a way back.
