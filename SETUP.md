# Lidh.al Platform — Setup

Everything needed to bootstrap this monorepo from a fresh machine, and which
third-party accounts each part depends on. Keep this current as the stack grows.

> Status: **M1 (foundation) complete.** Workspaces: `apps/dashboard`,
> `services/api`, `packages/core`, `packages/db`. The marketing site
> (`lidh.al`) lives in its own repo — see ADR-012.

---

## 1. Local prerequisites

| Tool | Why | Install |
|---|---|---|
| Node ≥ 20.11 (22 recommended) | Runtime for every workspace | `brew install node` |
| corepack | Pins pnpm per-repo (`packageManager` field) | `brew install corepack` then `corepack enable` |
| pnpm 9.12.3 | Package manager (auto-fetched by corepack) | nothing — corepack handles it |
| flyctl | Deploy `services/api` to Fly.io | `brew install flyctl` (only when deploying) |

You do **not** need Docker locally — Fly builds images on remote builders.

```bash
node --version      # ≥ v20.11
corepack --version  # any
git clone https://github.com/emiredculiqi/lidh-platform.git
cd lidh-platform
pnpm install        # corepack fetches pnpm 9.12.3 on first run
```

`pnpm install` triggers `@lidh/db`'s postinstall (`prisma generate && tsc`),
so the typed client is built automatically.

---

## 2. Third-party accounts

| Service | Used by | M1? | What you need |
|---|---|---|---|
| **Neon** (Postgres + pgvector) | `packages/db`, `services/api` | ✅ | Project + connection string |
| **Clerk** (auth) | `apps/dashboard` | ✅ | App + publishable & secret keys |
| **Anthropic** (Claude) | `services/api` (the agent) | ✅ | API key |
| **OpenAI** (embeddings) | `services/api` (RAG retrieval) | ✅ | API key |
| **Fly.io** (API hosting) | `services/api` | deploy-time | Account + `fly auth login` |
| **Vercel** (web hosting) | `apps/dashboard` | deploy-time | Account + project (root = `apps/dashboard`) |
| **Cloudflare R2** (file storage) | knowledge file uploads | M2 | Bucket + S3 creds |
| **Inngest** (job queue) | ingestion / usage rollups | M2 | Account + signing key |
| **360dialog or Meta** (WhatsApp) | channel ingest | M3 | BSP account or Meta app + WABA |
| **Meta Graph API** (Instagram) | channel ingest | M4 | Meta app + IG professional account |

---

## 3. Environment files

All `.env*` files are gitignored. Each workspace has a committed `.env.example`
template — copy it and fill in real values.

### `packages/db/.env`
```
DATABASE_URL="postgresql://USER:PASS@HOST.eu-central-1.aws.neon.tech/neondb?sslmode=require"
```
Use the **direct** (non-pooled) Neon string for migrations.

### `services/api/.env`
```
DATABASE_URL="<same Neon string as packages/db/.env>"
PORT=4000
NODE_ENV=development
CORS_ORIGINS=*
ANTHROPIC_API_KEY=""          # M2 — placeholder fine in M1
ANTHROPIC_MODEL=claude-haiku-4-5
```

### `apps/dashboard/.env` (or `.env.local`)
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_URL=http://localhost:4000
DATABASE_URL=                 # optional — only for direct DB reads / webhook
CLERK_WEBHOOK_SECRET=         # M2 — Clerk dashboard → Webhooks → signing secret
```

---

## 4. Database

The schema lives in `packages/db/prisma/schema.prisma`. Two migrations are
already applied to Neon.

```bash
# apply all pending migrations (idempotent — safe to re-run)
pnpm --filter @lidh/db exec prisma migrate deploy

# create a new migration after editing schema.prisma
pnpm --filter @lidh/db db:migrate -- --name <change_name>

# open the data browser
pnpm --filter @lidh/db db:studio
```

RLS is intentionally **deferred to M2** (added once the NestJS TenantContext
interceptor resolves real auth). The demo CHECK constraint + HNSW vector index
are applied via the `integrity_constraints` migration.

---

## 5. Running locally

| Command | Result |
|---|---|
| `pnpm dev` | Turbo runs every workspace's `dev` in parallel |
| `pnpm --filter @lidh/dashboard dev` | Dashboard → http://localhost:3001 |
| `pnpm --filter @lidh/api dev` | API → http://localhost:4000/v1 |
| `pnpm -r typecheck` | Typecheck all workspaces |
| `pnpm --filter @lidh/api exec curl ...` | — |

Quick API smoke test:
```bash
curl http://localhost:4000/v1/health
# → {"status":"ok","db":"ok","dbLatencyMs":~40}
```

---

## 6. Deploying

### `services/api` → Fly.io
```bash
brew install flyctl
fly auth login
cd services/api
fly launch --no-deploy --copy-config        # creates the app
fly secrets set \
  DATABASE_URL="<neon>" \
  ANTHROPIC_API_KEY="<key>" \
  CORS_ORIGINS="https://app.lidh.al,https://widget.lidh.al,https://demo.lidh.al"
fly deploy
curl https://lidh-api.fly.dev/v1/health
```

### `apps/dashboard` → Vercel
One Vercel project, root directory = `apps/dashboard`. Build command
auto-detected; mirror the `.env` keys in Vercel project settings.

The marketing site (`lidh.al`) is a *separate* Vercel project deployed
from its own repo — never the apex domain from this monorepo (ADR-012).

---

## 7. Where things live

```
lidh-platform/
├── apps/
│   └── dashboard/     @lidh/dashboard  — app.lidh.al (Next.js + Clerk)
├── services/
│   └── api/           @lidh/api        — api.lidh.al (NestJS + Fastify, Fly)
├── packages/
│   ├── core/          @lidh/core       — framework-agnostic agent runtime
│   └── db/            @lidh/db         — Prisma schema + migrations + client
├── docs/
│   ├── decisions.md   — ADR ledger (ADR-001..012)
│   └── diagrams.md    — architecture, ERD, flows (Mermaid)
└── SETUP.md           — this file
```

The marketing site (`lidh.al`) lives in a separate repo and is deployed
as its own Vercel project; this monorepo does not include or build it.

See `docs/diagrams.md` for architecture + data-model diagrams.
