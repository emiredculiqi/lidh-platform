# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Marketing site for **Lidh.al** — customer support and lead management for Albanian businesses. Live at https://lidh.al. Single-page Next.js App Router site with two API routes: `/api/contact` (Resend) and `/api/chat` (streaming Claude chatbot with tool-driven lead capture and human handoff).

## Commands

```bash
npm run dev          # local dev server (http://localhost:3000)
npm run build        # production build
npm run start        # serve the production build
npm run lint         # ESLint (eslint-config-next)
npm run test:smtp    # send a test email through Resend to CONTACT_TO_EMAIL
```

There is no test framework — `test:smtp` is a one-off script ([scripts/test-smtp.ts](scripts/test-smtp.ts)) for verifying the Resend pipeline, not a unit-test runner.

## Required env vars

Set in `.env.local` (and on Vercel):

- `RESEND_API_KEY` — Resend API key
- `RESEND_FROM` — sender, e.g. `"Lidh.al <noreply@lidh.al>"` (domain must be verified in Resend)
- `CONTACT_TO_EMAIL` — inbox that receives lead notifications and chatbot handoffs
- `ANTHROPIC_API_KEY` — Claude API key for the chatbot. Without it, `/api/chat` returns 503.
- `ANTHROPIC_MODEL` — optional override. Defaults to `claude-haiku-4-5` (the right model for FAQ + lead capture; fast and cheap). Use `claude-sonnet-4-6` / `claude-opus-4-7` for higher quality.

[lib/mailer.ts](lib/mailer.ts) throws on first send if Resend vars are missing. [app/api/chat/route.ts](app/api/chat/route.ts) returns 503 if `ANTHROPIC_API_KEY` is missing.

## Architecture

**One page, composed from sections.** [app/page.tsx](app/page.tsx) renders `Header`, then stacks the section components from [components/sections/](components/sections/) (`Hero`, `Benefits`, `UseCases`, `About`, `Contact`), then `Footer`. There is no routing beyond this page and the contact API.

**Content is data, not JSX.** All marketing copy lives in [content/site.ts](content/site.ts) (typed as `SiteContent`) and [content/use-cases.ts](content/use-cases.ts). Each entry is a `{ al, en }` bundle. Components never hardcode strings — they call `useT(siteContent)` from [lib/i18n.tsx](lib/i18n.tsx) and read `t.someKey`. To add copy: extend the `SiteContent` type, add the key under both `al` and `en`, then reference `t.yourKey` in the component.

**i18n is client-side only.** [lib/i18n.tsx](lib/i18n.tsx) is a `"use client"` `LocaleProvider` mounted in [app/layout.tsx](app/layout.tsx). Locale (`al` default, `en`) is persisted to `localStorage` under `lidh.locale` and also written to `document.documentElement.lang` (`sq`/`en`). Any component using `useT`/`useLocale` must be a client component or a child of one.

**Contact flow.**
- Client: [components/sections/Contact.tsx](components/sections/Contact.tsx) POSTs JSON to `/api/contact`.
- Server: [app/api/contact/route.ts](app/api/contact/route.ts) Zod-validates (`runtime = "nodejs"`), then calls `sendContactEmail` from [lib/mailer.ts](lib/mailer.ts).
- Mailer sets `replyTo` to the submitter so replies from the inbox go straight to the customer; renders both text and HTML versions; HTML fields are escaped via the local `escapeHtml`.
- Responses: `200 {ok:true}`, `400 invalid_json`, `422 invalid_input` (with Zod `flatten()`), `502 email_failed`. Keep these contracts when editing.
- Note: route schema currently requires `phone` (min 1) even though `ContactPayload` types it optional — if you change one, change both.

**Styling.** Tailwind with brand tokens in [tailwind.config.ts](tailwind.config.ts) (`brand.deep/blue/sky/mint/ink/fog`, `accent.orange*`, `bg-brand-gradient`, `shadow-glow`, `animate-float|shimmer|gradient-shift`). Fonts loaded via `next/font/google` in [app/layout.tsx](app/layout.tsx) and exposed as `--font-inter` / `--font-jakarta`. Prefer existing tokens over arbitrary hex/animation values.

**Path alias.** `@/*` → repo root (see [tsconfig.json](tsconfig.json)).

**Chatbot.**
- Floating widget [components/Chat/ChatWidget.tsx](components/Chat/ChatWidget.tsx) is mounted once in [app/layout.tsx](app/layout.tsx) so it's available on every page. Persists conversation in `localStorage` under `lidh.chat`. Reads locale via `useLocale()`.
- Server: [app/api/chat/route.ts](app/api/chat/route.ts) (`runtime = "nodejs"`, `maxDuration = 60`) Zod-validates `{messages, locale}`, then runs an agentic loop using `client.messages.stream()` from `@anthropic-ai/sdk`. Streams **SSE** to the client (`event: text|effect|done|error`).
- System prompt: [lib/chat/prompt.ts](lib/chat/prompt.ts) — separate AL/EN personas + shared business facts, wrapped in a single `text` block with `cache_control: { type: "ephemeral" }` so the prefix caches across turns. Tools render before system, so the tool list must stay deterministic — don't add per-request tools.
- Tools: `capture_lead` and `request_human_handoff`. Both are server-executed in `runTool()` and call `emailLead`/`emailHandoff` from [lib/chat/handoff.ts](lib/chat/handoff.ts), which reuses `sendContactEmail` from [lib/mailer.ts](lib/mailer.ts). Tool execution emits an `effect` SSE event (`lead_captured` / `human_handoff`) the widget renders as a confirmation banner.
- WhatsApp handoff number `+355 69 520 1250` is hardcoded as `WHATSAPP_NUMBER` in [lib/chat/handoff.ts](lib/chat/handoff.ts) and `WHATSAPP_HREF` in [components/Chat/ChatWidget.tsx](components/Chat/ChatWidget.tsx) — keep them in sync if it changes.
- Limits: `MAX_HISTORY=40`, `MAX_MESSAGE_CHARS=4000`, `MAX_AGENTIC_TURNS=4`, `CHAT_MAX_TOKENS=1024` (in [lib/chat/prompt.ts](lib/chat/prompt.ts)).

## Conventions worth keeping

- `lib/mailer.ts` is `import "server-only"` — never import it from a client component.
- New translatable strings go in `content/*.ts`, not inline in JSX.
- Section components live in [components/sections/](components/sections/); shared primitives in [components/ui/](components/ui/) (e.g. `Container`); scroll-reveal wrapper is [components/animations/Reveal.tsx](components/animations/Reveal.tsx).
- Brand colors are referenced as Tailwind classes (`text-brand-deep`, `bg-brand-gradient`), not raw hex.
