# Lidh.al Platform

**Every customer conversation in one place** — a shared team inbox for Albanian
businesses whose customers message them on WhatsApp, Instagram, Messenger and
their website.

An AI assistant drafts replies and, once the owner trusts it, answers on its own.
But the product is the inbox: autonomy is a ladder the business owner climbs,
never a default we impose (see ADR-018).

> The marketing site at [lidh.al](https://lidh.al) is a **separate repository**
> (ADR-012). This repo is the platform: `app.lidh.al` + `api.lidh.al`.

## Stack

| | |
|---|---|
| **apps/dashboard** | Next.js 15 (App Router), Clerk auth, Tailwind → Vercel (`app.lidh.al`) |
| **services/api** | NestJS + Fastify, REST under `/v1` → Fly.io (`lidh-api`, fra) |
| **packages/core** | Agent runtime — `runAgent`, personas, prompt caching (Anthropic) |
| **packages/db** | Prisma schema + client → Neon Postgres |

pnpm workspaces + turbo. Node ≥ 20.11.

## Quick start

```bash
pnpm install
cd packages/db && npx prisma generate && npx prisma migrate deploy
pnpm dev
```

> There is **no committed `.env.example`** anywhere in the repo (SETUP.md has
> claimed otherwise for a while). The required variables are listed in
> [SETUP.md](SETUP.md) and [docs/whatsapp.md](docs/whatsapp.md) — create
> `services/api/.env` by hand from those.

Dashboard on `:3000`, API on `:4000` (docs at `/docs` in development).

Full bootstrap including third-party accounts: [SETUP.md](SETUP.md).

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | All workspaces in watch mode |
| `pnpm build` / `pnpm lint` / `pnpm typecheck` | Across the monorepo |
| `pnpm --filter @lidh/api test` | Vitest suite for the API |
| `npx prisma generate` (in `packages/db`) | Regenerate the client — required after any schema change |

## Channels

| Channel | State |
|---|---|
| Web widget | live — embeddable `widget.js`, per-tenant origin allowlist |
| WhatsApp | live — direct Meta Cloud API as a Tech Provider, using Coexistence |
| Instagram DM / Messenger | not built |
| Post & ad comments | not built — in scope |

WhatsApp go-live is gated on Meta App Review:
[docs/meta-app-review.md](docs/meta-app-review.md).

## Documentation

| Doc | Contents |
|---|---|
| [docs/platform.md](docs/platform.md) | What the product is, system shape, constraints — **start here** |
| [docs/decisions.md](docs/decisions.md) | 15 ADRs (numbered to 018 — 014/015/016 were never written) — what was decided and why |
| [docs/whatsapp.md](docs/whatsapp.md) | WhatsApp/Meta architecture, coexistence specifics, env vars |
| [docs/meta-app-review.md](docs/meta-app-review.md) | Meta requirements, our status, remaining gaps |
| [docs/diagrams.md](docs/diagrams.md) | Mermaid architecture diagrams |
| [SETUP.md](SETUP.md) / [DEPLOY.md](DEPLOY.md) | Bootstrap and deployment |
| [CLAUDE.md](CLAUDE.md) | Working rules for Claude Code |

## Deployment

`services/api` → Fly.io (Docker, single machine in `fra`).
`apps/dashboard` → Vercel. Database → Neon. DNS → Cloudflare.

Note there is **no staging environment** — one Fly app, one Vercel project, and
work happens on `main`. See [DEPLOY.md](DEPLOY.md).

## License

Proprietary — all rights reserved by Lidh.al.
