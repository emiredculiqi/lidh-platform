# syntax=docker/dockerfile:1.7
# Multi-stage build for @lidh/api. Build context: monorepo root.
#
# Stage 1 (pruner)    -> turbo prune @lidh/api --docker
# Stage 2 (installer) -> pnpm install against the pruned manifests (cached layer)
# Stage 3 (builder)   -> compile @lidh/db + @lidh/api
# Stage 4 (runtime)   -> minimal Node runtime with only prod deps + dist
#
# Resulting image: ~200MB (vs ~700MB if we copied the whole monorepo).

# ─────────────────────────────────────────────────────────────────────────────
# Base image: pinned Node + corepack-managed pnpm
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    NODE_ENV=production
RUN corepack enable

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: prune the monorepo to only what @lidh/api needs
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS pruner
WORKDIR /repo
COPY . .
# turbo is in root devDependencies; use dlx to avoid an explicit install here.
RUN pnpm dlx turbo@^2.3 prune @lidh/api --docker

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: install dependencies against the pruned manifests
# This layer only re-runs when package.json or pnpm-lock.yaml changes.
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS installer
WORKDIR /repo
# Skip @lidh/db's postinstall (prisma generate + tsc) here — we rebuild it
# in the next stage with sources present anyway.
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

COPY --from=pruner /repo/out/json/ ./
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml

# BuildKit cache mount keeps pnpm's content-addressed store across builds.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: copy full pruned source and build
# ─────────────────────────────────────────────────────────────────────────────
FROM installer AS builder
WORKDIR /repo
COPY --from=pruner /repo/out/full/ ./
# Now run the postinstalls we deferred (generates prisma client + builds @lidh/db).
RUN pnpm rebuild
# Build @lidh/db dist + then the NestJS app dist.
RUN pnpm --filter @lidh/db build
RUN pnpm --filter @lidh/api build

# Strip dev dependencies for a smaller runtime image.
RUN pnpm --filter @lidh/api... --prod deploy /deploy

# ─────────────────────────────────────────────────────────────────────────────
# Stage 4: runtime
#
# Debian slim (NOT alpine): Playwright/Chromium needs glibc + system libs that
# alpine doesn't provide well. `playwright install --with-deps chromium` pulls
# the matched Chromium + its apt deps. This is the documented approach and is
# version-pinned via the `playwright` dep in package.json.
#
# NOTE (ADR-005): not buildable/verifiable locally (no Docker on the dev
# machine). Validated when Fly's remote builder builds it at deploy. Bump the
# Fly machine memory (fly.toml 512MB → ~1GB) for Chromium before deploying.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN groupadd -g 1001 app && useradd -u 1001 -g app -m app

COPY --from=builder --chown=app:app /deploy ./

# Install the Chromium build matched to the bundled playwright version, plus
# its OS dependencies, into a shared path readable by the non-root user.
RUN npx --yes playwright install --with-deps chromium \
    && chown -R app:app /ms-playwright

USER app
EXPOSE 4000
CMD ["node", "dist/main.js"]
