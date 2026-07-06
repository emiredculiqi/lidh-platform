# WhatsApp — direct Meta Tech Provider (Coexistence)

Lidh.al connects businesses' WhatsApp numbers **directly via Meta's Cloud API**
(we are a Meta Tech Provider — no BSP middleman) using **Coexistence**: the
business keeps using the WhatsApp Business App on their phone *and* our platform
answers on the same number via the API. Inbound messages are handled by the same
`@lidh/core` agent that powers web chat.

> This supersedes the earlier WhatChimp plan (ADR-004). The WhatChimp transport
> and webhook route have been removed.

## Message flow

```
Meta Cloud API ──webhook──▶ WhatsappController (verify X-Hub-Signature-256, parse)
                                   │
                                   ▼
                        WhatsappService.handleInbound() ── same brain as web ──▶ runAgent() @lidh/core
                                   │                                                     │
                    (resolve tenant/contact/convo, dedupe,                    (reply text collected)
                     honor aiPaused takeover, persist, RAG)                             │
                                   ▼                                                     ▼
                        WhatsAppTransport.sendText() ──▶ MetaCloudTransport ──▶ Graph POST /{phoneNumberId}/messages
```

## Key files (`services/api/src`)

- `common/crypto/crypto.service.ts` — AES-256-GCM for the per-tenant token in `Channel.credentialsEnc`.
- `channels/whatsapp/transport.ts` — the `WhatsAppTransport` port (`sendText`) + DI token.
- `channels/whatsapp/meta-cloud-transport.ts` — Graph API sender; `MetaSendError` (`.isTokenExpired` 190, `.isOutsideWindow` 131047).
- `channels/whatsapp/stub-transport.ts` — dev transport (logs; bound when `META_APP_ID` unset).
- `channels/whatsapp/meta-webhook.parser.ts` — pure parser: messages / echoes / statuses / account events.
- `channels/whatsapp/whatsapp.controller.ts` — `GET/POST /v1/webhooks/whatsapp` (HMAC-verified).
- `channels/whatsapp/whatsapp.service.ts` — `handleInbound`, `handleEcho`, `handleAccountEvent`, takeover capture.
- `channels/whatsapp/whatsapp-outbound.service.ts` — delivers dashboard operator replies to WhatsApp.
- `channels/channels.service.ts` + `meta-onboarding.service.ts` — Embedded Signup connect/disconnect + Graph handshake.

Dashboard: `components/ConnectWhatsApp.tsx` (self-serve connect on the business
**Developer** page) + `getChannels`/`connectWhatsApp`/`disconnectWhatsApp` in `lib/api-core.ts`.

## Onboarding (Embedded Signup, coexistence)

1. Owner clicks **Connect WhatsApp** (business panel → Developer). The FB JS SDK
   opens the popup; they authenticate with Meta and scan a QR from their
   WhatsApp Business App.
2. Frontend collects the auth `code` (login callback) + `waba_id` +
   `phone_number_id` (a `message` event) and POSTs them.
3. Backend: plan-gate (`Plan.features.hasWhatsApp`) → exchange `code` for a
   WABA-scoped token (`GET /oauth/access_token`) → subscribe our app
   (`POST /{waba-id}/subscribed_apps`) → **skip `/register`** (coexistence keeps
   the number on the Business App) → fetch the display number → encrypt + store
   the token → flip `Channel.status` to `connected`.

## Coexistence specifics

- **Echoes**: messages the owner sends from their own phone are echoed to our
  webhook (`message_echoes`) — persisted as human messages for inbox sync; the
  agent does NOT reply to them (would loop).
- **24h window**: the agent is reactive (customer messages first → always
  in-window). A human operator replying later may be outside it → Graph error
  `131047` → the dashboard shows a "delivery_failed" notice (template re-engagement is a future add).
- **Account events**: `account_offboarded` / `account_reconnected` flip
  `Channel.status` automatically.
- Do NOT register the number for coexistence; throughput cap is ~5 msg/s.

## Environment variables

**API (`services/api`)** — set as Fly secrets in prod:

| Var | Purpose |
|---|---|
| `CREDENTIAL_ENC_KEY` | 32-byte base64 (`openssl rand -base64 32`) — encrypts stored tokens. Required before any connect. |
| `META_APP_ID` / `META_APP_SECRET` | Meta App creds. `META_APP_ID` set = MetaCloudTransport active (else Stub). App secret verifies webhook HMAC. |
| `META_CONFIG_ID` | Facebook Login for Business config id (Embedded Signup). |
| `META_WEBHOOK_VERIFY_TOKEN` | Webhook subscription verify token. |
| `META_GRAPH_VERSION` | Graph version (default `v22.0`). |

**Dashboard (`apps/dashboard`)** — public, build-time:
`NEXT_PUBLIC_META_APP_ID`, `NEXT_PUBLIC_META_CONFIG_ID`, `NEXT_PUBLIC_META_GRAPH_VERSION`.

Webhook callback URL to configure in the Meta App: `https://api.lidh.al/v1/webhooks/whatsapp`.

## Billing

Tech Provider model: each onboarded business adds its own payment method and
pays Meta directly for message costs. Lidh.al bills only for its software plans.
