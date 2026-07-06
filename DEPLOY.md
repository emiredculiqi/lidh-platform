# Lidh.al Platform — Deployment Guide

End-to-end deploy of this monorepo to production. Designed to be followed top
to bottom on a first deploy. Keep this open as a reference; copy-paste the
commands as you go.

## What goes where

| Piece | Hosted on | URL | From this repo |
|---|---|---|---|
| `services/api` (NestJS + Fastify, Docker) | **Fly.io** (Frankfurt) | `api.lidh.al` | — |
| `apps/dashboard` (Next.js + Clerk) | **Vercel** | `app.lidh.al` | — |
| Demo links (`/demo/[token]`) | **Vercel** (same project as dashboard) | `demo.lidh.al` | — |
| Postgres + pgvector | **Neon** (already provisioned) | internal | — |
| DNS + edge | **Cloudflare** | — | — |
| Marketing site (`lidh.al`) | **Vercel** (separate repo `lidh-website`) | `lidh.al` | not this monorepo (ADR-012) |

---

## Phase 0 — Prerequisites

Gather these before starting. Skip ahead if you already have them.

### Accounts

- [ ] **Fly.io account** — sign up at https://fly.io/app/sign-up. **Credit card required** even on the free tier (no charge unless you exceed the free allowance).
- [ ] **Vercel account** — you have this. Confirm you're on the org/account that will host the production project.
- [ ] **Cloudflare account** that manages `lidh.al` — you have this (it's how the marketing site is currently live).
- [ ] **Neon project** — already done; you've been using it for development.

### Local CLI

```bash
# Fly CLI
brew install flyctl
flyctl version    # should print a version

# Sign in once; opens a browser
fly auth login
```

Vercel CLI is optional — you can do everything through the Vercel web UI.

### Credentials to have on hand

You'll paste these as Fly secrets / Vercel env vars during the phases below. Copy them to a scratch note now so you're not hunting later.

| Value | Where to find it |
|---|---|
| `DATABASE_URL` | Neon dashboard → your project → Connection details → **direct** (not pooled) connection string with `sslmode=require` |
| `ANTHROPIC_API_KEY` | Your existing Anthropic key (the one in `services/api/.env`) |
| `OPENAI_API_KEY` | Your existing OpenAI key (for RAG embeddings) |
| `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard → API Keys. **For first deploy:** use your existing `sk_test_…` / `pk_test_…` keys. Clerk will show a "development mode" banner but everything works. Swap to production keys later (Phase 4). |
| `PLATFORM_ADMIN_EMAILS` | Your email (and any teammates' emails who should be platform admins) |
| `CREDENTIAL_ENC_KEY` | 32-byte base64 key for encrypting per-tenant WhatsApp tokens. Generate with `openssl rand -base64 32`. Required before any tenant connects WhatsApp. |
| `META_APP_ID` / `META_APP_SECRET` / `META_CONFIG_ID` | Optional — set when you go live as a Meta Tech Provider (Phase 5). Empty = WhatsApp uses the Stub transport. |
| `META_WEBHOOK_VERIFY_TOKEN` | Optional — the verify token you enter in the Meta App webhook settings (any random string). |

> **Cost expectation:** ~$5/month for the Fly machine (1 GB always-on). Vercel Hobby is free; Pro ($20/mo) is required once you're commercial.

---

## Phase 1 — Deploy the API to Fly.io

The API is the deepest piece (Postgres, Anthropic, Playwright). Get it green first; everything else just talks to it.

### 1.1 — Create the Fly app

From the repo root:

```bash
cd services/api
fly launch --no-deploy --copy-config
```

What happens:
- Fly reads your existing `fly.toml` (so it pre-fills name, region, etc.).
- It asks "Would you like to copy its configuration to the new app?" — **yes**.
- It may prompt to create a Postgres / Redis cluster — **no** to both (we use Neon).
- App name will be `lidh-api` (already in `fly.toml`). If taken, Fly suggests `lidh-api-<random>` — write down whatever it ends up as.

### 1.2 — Set secrets

Replace each `<value>` below with your real value:

```bash
fly secrets set \
  DATABASE_URL='<neon-direct-connection-string>' \
  ANTHROPIC_API_KEY='<your-anthropic-key>' \
  ANTHROPIC_MODEL='claude-haiku-4-5' \
  OPENAI_API_KEY='<your-openai-key>' \
  CLERK_SECRET_KEY='<your-clerk-secret-key>' \
  PLATFORM_ADMIN_EMAILS='you@example.com' \
  DEMO_BASE_URL='https://demo.lidh.al/demo' \
  ENABLE_SWAGGER='true'
```

Notes:
- `CORS_ORIGINS` is set in `fly.toml` already (`https://app.lidh.al,https://widget.lidh.al,https://demo.lidh.al`).
- Meta secrets (`META_APP_ID`, `META_APP_SECRET`, `META_CONFIG_ID`, `META_WEBHOOK_VERIFY_TOKEN`) only matter when you go live as a WhatsApp Tech Provider — leave unset for now (the factory falls back to the Stub transport, which is fine). Do set `CREDENTIAL_ENC_KEY` before any tenant connects WhatsApp.
- `ENABLE_SWAGGER='true'` exposes `/docs` in prod so you can probe endpoints. Unset later if you want to hide it.

### 1.3 — Deploy

```bash
fly deploy
```

This builds the Docker image on Fly's remote builder (~3–5 min the first time — installing Chromium is the slow part). When it succeeds you'll see something like:

```
✓ deploy complete
visit https://lidh-api.fly.dev/v1/health
```

### 1.4 — Verify

```bash
curl https://lidh-api.fly.dev/v1/health
# → {"status":"ok","db":"ok","dbLatencyMs":50,...}

# Auth-gated endpoint with no token should be 401:
curl -o /dev/null -w '%{http_code}\n' https://lidh-api.fly.dev/v1/me
# → 401

# Public route works:
curl -o /dev/null -w '%{http_code}\n' 'https://lidh-api.fly.dev/v1/demo/anything'
# → 404 (route runs, token unknown — confirms the route is wired)
```

**Phase 1 done** when all three return the expected codes.

### Troubleshooting

| Symptom | Fix |
|---|---|
| `Can't reach database server` | Neon may be suspended — first query wakes it. Re-deploy or `fly machine restart <id>` to retry. |
| OOM (process killed during boot) | Bump memory in `fly.toml` (`memory_mb = 2048`) and `fly deploy` again. |
| `Mapped {/v1/health, GET}` never appears in logs | Logs: `fly logs`. Likely a missing secret — re-check the `fly secrets set` line. |
| Build hangs on `playwright install` | Network blip; retry `fly deploy`. |

---

## Phase 2 — Deploy the Dashboard to Vercel

### 2.1 — Create the project

In Vercel:

1. **New Project** → import the `lidh-platform` GitHub repo (authorize Vercel to read it if you haven't already).
2. **Configure project**:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `apps/dashboard` ← important, monorepo
   - **Build Command**: leave default (Vercel runs `next build` after `pnpm install` at the repo root)
   - **Install Command**: leave default (`pnpm install` — Vercel detects pnpm from `pnpm-lock.yaml`)
   - **Output Directory**: leave default

### 2.2 — Environment variables

Add these in the Vercel project's **Settings → Environment Variables** (Production + Preview + Development scopes):

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>
CLERK_SECRET_KEY=<your-clerk-secret-key>
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/tenants
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/tenants
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_API_URL=https://lidh-api.fly.dev
NEXT_PUBLIC_APP_URL=https://app.lidh.al
```

Notes:
- **Use the SAME `CLERK_SECRET_KEY` you set on Fly** — both sides must be the same Clerk app.
- `NEXT_PUBLIC_API_URL` is the Fly URL for now; we'll swap it to `https://api.lidh.al` after DNS in Phase 3.
- `NEXT_PUBLIC_APP_URL` is the dashboard's own URL. Vercel will assign a default `<project>.vercel.app` initially; once you point `app.lidh.al`, change this value.

### 2.3 — Deploy

Click **Deploy**. ~2 min later you'll have `https://<your-project>.vercel.app`.

### 2.4 — Verify

- Visit `https://<your-project>.vercel.app` → bounces to `/sign-in` (correct — middleware protects all `(app)/*` routes).
- Sign in with your platform-admin email → lands on `/tenants` (the admin all-tenants list).
- The list should load (proves dashboard → Fly API → Neon end to end).

**Phase 2 done** when you can sign in and see the tenants list in production.

---

## Phase 3 — Cloudflare DNS

Right now your prod URLs are `lidh-api.fly.dev` and `<project>.vercel.app`. Time to flip the real subdomains.

### 3.1 — Point `api.lidh.al` at Fly

In Cloudflare → your `lidh.al` zone → **DNS**:

1. **Add record**:
   - Type: `CNAME`
   - Name: `api`
   - Target: `lidh-api.fly.dev`
   - Proxy status: **DNS only (gray cloud)** — Fly handles its own TLS; the orange-cloud proxy will conflict.
   - TTL: Auto.

2. Tell Fly about the custom domain:
   ```bash
   fly certs add api.lidh.al --config services/api/fly.toml
   ```
   Wait ~30 seconds, then:
   ```bash
   fly certs show api.lidh.al --config services/api/fly.toml
   ```
   Status should become `Ready` (DNS verified + cert issued). Test:
   ```bash
   curl https://api.lidh.al/v1/health
   ```

3. **Update Vercel env**: in the dashboard project, change `NEXT_PUBLIC_API_URL` from `https://lidh-api.fly.dev` to `https://api.lidh.al`. Redeploy the project (Vercel → Deployments → top deployment → ⋯ → Redeploy).

### 3.2 — Point `app.lidh.al` at Vercel

In Vercel → dashboard project → **Settings → Domains** → **Add**:

1. Enter `app.lidh.al` → Vercel shows a CNAME target like `cname.vercel-dns.com`.

2. In Cloudflare → DNS → **Add record**:
   - Type: `CNAME`
   - Name: `app`
   - Target: `cname.vercel-dns.com`
   - Proxy status: **DNS only (gray cloud)** — Vercel issues its own TLS cert; orange cloud breaks it during issuance. (You can flip it to orange later after the cert is issued, but starting gray is safer.)
   - TTL: Auto.

3. Back in Vercel, wait until the domain status flips to **Valid Configuration** (~1–2 min).

4. **Update Vercel env**: change `NEXT_PUBLIC_APP_URL` from the `.vercel.app` URL to `https://app.lidh.al`. Redeploy.

### 3.3 — (Optional) Point `demo.lidh.al` at the same Vercel project

Same as `app.lidh.al`:
- Vercel Domains → Add → `demo.lidh.al`
- Cloudflare → CNAME `demo` → `cname.vercel-dns.com`, DNS only.
- The dashboard's `/demo/[token]` route handles it (`app.lidh.al/demo/<token>` and `demo.lidh.al/<token>` will both work).

### 3.4 — Marketing site (`lidh.al`) untouched

Per ADR-012, `lidh.al` stays on the existing Vercel project from the `lidh-website` repo. **Don't change the apex DNS record.**

**Phase 3 done** when:
```bash
curl https://api.lidh.al/v1/health   # 200 with db:"ok"
```
and `https://app.lidh.al/sign-in` loads in the browser.

---

## Phase 4 — Clerk production (when you're ready for real users)

You can defer this. With `sk_test_` keys the dashboard works but shows "development mode" — fine while you test, **not** fine for real customers (rate limits, no SLA, "dev" branding).

When you're ready:

1. In Clerk dashboard, **create a new application** in *Production* mode (separate from your dev app). Name it `Lidh.al` or similar.
2. In the new app:
   - **Domains**: add `app.lidh.al` (and `lidh.al` if you ever do auth there).
   - **Authentication → Email, Phone, Username**: enable email + password (matches what's hosted at `/sign-up`).
3. Copy the new production `pk_live_…` and `sk_live_…` keys.
4. **Vercel**: replace `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` with the production values. Redeploy.
5. **Fly**: `fly secrets set CLERK_SECRET_KEY='<sk_live_...>' --config services/api/fly.toml`
6. Re-test the sign-up flow end-to-end — your existing test-mode users won't carry over.

---

## Phase 5 — (Optional) Go live as a Meta WhatsApp Tech Provider (Coexistence)

Only do this after the rest is live. We connect businesses' WhatsApp numbers
directly via Meta's Cloud API (no BSP). See `docs/whatsapp.md` for the full
architecture; this is the deploy checklist.

**One-time Meta setup (the long pole — start early):**
1. Complete **Business Verification** for the Lidh.al Meta Business.
2. Create a **Meta App** (type: Business) → add the **WhatsApp** product → note the **App ID** + **App Secret**.
3. Create a **Facebook Login for Business** config for Embedded Signup (coexistence) → note the **`config_id`**.
4. Submit **App Review** for Advanced Access to `whatsapp_business_messaging` + `whatsapp_business_management`.
5. In the App's **WhatsApp → Configuration → Webhook**, set the callback URL to
   `https://api.lidh.al/v1/webhooks/whatsapp` and the verify token to your
   `META_WEBHOOK_VERIFY_TOKEN`; subscribe the fields `messages`, `message_echoes`, `account_update`.

**Fly secrets:**
```bash
fly secrets set \
  CREDENTIAL_ENC_KEY="$(openssl rand -base64 32)" \
  META_APP_ID='<app-id>' \
  META_APP_SECRET='<app-secret>' \
  META_CONFIG_ID='<embedded-signup-config-id>' \
  META_WEBHOOK_VERIFY_TOKEN='<random-string>' \
  META_GRAPH_VERSION='v22.0' \
  --config services/api/fly.toml
```

**Vercel (dashboard) env** (Embedded Signup runs in the browser):
`NEXT_PUBLIC_META_APP_ID`, `NEXT_PUBLIC_META_CONFIG_ID`, `NEXT_PUBLIC_META_GRAPH_VERSION`.

**Per-business connect (self-serve):** the business owner opens their dashboard →
**Developer** → **Connect WhatsApp**, completes the Meta popup and scans the QR
from their WhatsApp Business App. The backend exchanges the code for a token,
subscribes our app to their WABA, and flips the channel to `connected`. From
then on their WhatsApp customers are answered by the same agent as web chat.
Billing note: each business adds their own payment method and pays Meta directly
for message costs (Tech Provider model).

---

## Quick reference — useful commands

```bash
# Fly logs / status / SSH
fly logs --config services/api/fly.toml
fly status --config services/api/fly.toml
fly ssh console --config services/api/fly.toml

# Re-deploy after a code change
git push                       # if Vercel is wired to auto-deploy on push
fly deploy --config services/api/fly.toml

# Roll back a Fly deploy
fly releases --config services/api/fly.toml
fly deploy --image registry.fly.io/lidh-api:deployment-<id> --config services/api/fly.toml

# Update a single Fly secret without redeploying everything else
fly secrets set KEY=newvalue --config services/api/fly.toml
```
