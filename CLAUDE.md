# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this repo is

**Lidh.al Platform** — a multi-tenant customer-conversation platform for Albanian
businesses. One shared team inbox for the messages a business gets on WhatsApp,
Instagram, Messenger and its website.

We sell the **inbox**, not the AI. An assistant drafts and (once the owner trusts
it) answers, but autonomy is a ladder the owner climbs, not the headline feature —
see **ADR-018** in [docs/decisions.md](docs/decisions.md). Keep that framing in
user-facing copy: lead with conversations and control, not with AI.

> This is **not** the marketing site. `lidh.al` lives in a separate repo
> (`lidh-website`, see ADR-012) and is neither built nor deployed from here.
> If you are looking for `content/site.ts` or `lib/mailer.ts`, you are in the
> wrong repository.

Full overview: [docs/platform.md](docs/platform.md).

## Layout

```
apps/dashboard    Next.js 15 App Router · Clerk · app.lidh.al   → Vercel
services/api      NestJS + Fastify · REST /v1 · api.lidh.al     → Fly.io (lidh-api)
packages/core     agent runtime — runAgent, personas, prompts
packages/db       Prisma schema + client                        → Neon Postgres
```

## Commands

```bash
pnpm install
pnpm dev                                   # turbo: all workspaces
pnpm build && pnpm lint && pnpm typecheck   # turbo, all workspaces

pnpm --filter @lidh/api test               # Vitest (services/api)
cd packages/db && npx prisma generate       # after ANY schema.prisma change
```

Migrations are **hand-authored** — create `packages/db/prisma/migrations/<UTC-timestamp>_<name>/migration.sql`
following the existing files. Do not rely on `prisma migrate dev` to name them.

## Architecture rules

- **One brain, many envelopes.** Web chat and WhatsApp both call `runAgent` from
  `@lidh/core`. The channel changes only streaming vs not, and delivery. Do not
  fork agent logic per channel.
- **Tenant isolation is enforced in application code**, via `assertCanAccessTenant`
  / `assertTenantRole` reading an AsyncLocalStorage context seeded by the global
  Clerk `AuthGuard`. There is **no Postgres RLS** — every new query must be scoped
  by `tenantId` deliberately.
- **Entitlements are derived, never materialized** (ADR-017). An expired trial
  *freezes* to read-only; it never locks the owner out.
- **Real-time is single-instance.** Live updates and human takeover use an
  in-process `EventEmitter` and the API runs as one Fly machine. Scaling to 2+
  needs Redis pub/sub first — this breaks silently, not loudly.
- **Prompt caching is a cost requirement** (ADR-001 #7): keep the system-prompt
  prefix stable and the tool list deterministic. No per-request tools.

## Conventions

- New user-facing strings are **bilingual (AL + EN)** — `useT({al, en})` in client
  components, `<T al="…" en="…" />` in server components. Never hardcode one language.
- Secrets never touch the DB unencrypted: `CryptoService` (AES-256-GCM) wraps
  provider tokens into `Channel.credentialsEnc`.
- Provider webhooks are `@Public()` and authenticated by signature, not by Clerk —
  WhatsApp via `X-Hub-Signature-256` over the **raw body**, Meta app callbacks via
  `signed_request`. Preserve `rawBody: true` in `main.ts` or HMAC verification breaks.
- Prefer extending an existing service over adding a parallel one; the agent
  orchestration in `whatsapp.service.ts` and `chat.service.ts` is knowingly
  duplicated (ADR-004) — do not deepen the split.

## WhatsApp / Meta

We are a direct Meta **Tech Provider** using **Coexistence** (the owner keeps the
WhatsApp Business App on their phone; we answer on the same number).

- Architecture and env vars: [docs/whatsapp.md](docs/whatsapp.md)
- App Review status, requirements and gaps: [docs/meta-app-review.md](docs/meta-app-review.md)

Two rules that are easy to break:

- **Never register a coexistence number** (`/register`) — it must stay on the
  Business App.
- **WhatsApp data may not train shared models.** Meta permits fine-tuning only for
  *exclusive use*. Learning across businesses from WhatsApp conversations is
  prohibited; learning from one owner's own approved replies is fine. Web-widget
  conversations are unaffected.

## Operational reality

- **No staging.** One Fly app, one Vercel project, work happens on `main`.
  Anything that writes data deserves a dry run and a way back.
- `NEXT_PUBLIC_*` values are inlined at **build time** — setting them in Vercel
  does nothing until the dashboard is redeployed.
- The WhatsApp transport is real only when `META_APP_ID` is set; otherwise a stub
  logs instead of sending.

## Working style

Explain the reasoning before making a change, and stop at genuine decision points
rather than assuming. Verify claims against the code or a live probe instead of
asserting from memory — several documents in this repo have been stale, and this
file was itself wrong for months.
