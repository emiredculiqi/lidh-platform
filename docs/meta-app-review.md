# Meta App Review — Tech Provider (Coexistence) readiness

Working checklist for taking the Lidh.al Meta app from Dev Mode to Live as a
**Tech Provider** offering **Coexistence**. Companion to [whatsapp.md](./whatsapp.md),
which describes the architecture; this file describes the Meta-side gate.

**Status as of 2026-08-06:** Business Verification done, app still in **Dev Mode**,
App Review **never submitted**. Embedded Signup has never executed once.

> ### ⚠️ Uncommitted work in the tree (2026-08-06)
>
> Nothing below has been committed or deployed. The working tree holds **two
> unrelated features** — commit them separately:
>
> 1. **This work** (Meta readiness): consent/opt-out + migration, Meta callbacks
>    + `signed_request` verification + `/data-deletion` page, coexistence history
>    sync, AI disclosure, Swagger + origin-check fixes, and the docs.
> 2. **Pre-existing freeze/read-only work**: `ReadOnlyGuard`, `ReadOnlyBanner`,
>    `freeze-check.ts`, and the `auth.module.ts` / `tenants.service.ts` edits.
>    This gates **every write endpoint** — do not ship it by accident.
>
> Verified at time of writing: 84 tests pass, typecheck clean, all builds green.
> The two new callback endpoints return **404 in production** until deployed, so
> do not configure their URLs in the Meta dashboard yet.
>
> Also pending: `pnpm --filter @lidh/db db:migrate:deploy` for `optedOutAt` and
> the two new `EventKind` values.

---

## 0. The sequence

Strictly ordered — each step gates the next:

1. ✅ Business-type Meta app + linked Business Portfolio
2. ✅ **Business Verification** (must complete *before* App Review)
3. ❌ **App Review** — Advanced Access for two permissions
4. ❌ **Live mode**
5. ❌ Onboard third-party customers via Embedded Signup

Beyond that: **Access Verification** raises the onboarding cap from 10 to 200 new
customers per rolling 7 days. Above 200/week requires Meta Business Partner status.

---

## 1. Requirements vs our state

| # | Requirement | State |
|---|---|---|
| 1 | Tech Provider tier — self-declared; no Business Partner membership, **no credit line**; each client attaches their own payment method and pays Meta directly | ✅ matches our billing model |
| 2 | Business-type Meta app + Business Portfolio linked | ✅ |
| 3 | Business Verification before App Review | ✅ done |
| 4 | Advanced Access for **exactly two** permissions: `whatsapp_business_messaging`, `whatsapp_business_management`. Bare `business_management` is a *Solution Partner* credit-line requirement — **not ours** | ❌ not submitted |
| 5 | ≥1 successful API call **per permission**, within 30 days before submitting | ⚠️ messaging satisfied by the test-number reply; **management likely never called** |
| 6 | Two screen recordings: (a) message sent from app → received in WhatsApp client; (b) a template being created. **API Setup cURL script and WhatsApp Manager recordings are accepted alternatives** | ❌ not made |
| 7 | 1024×1024 compliant app icon | ⚠️ repo has `logo.png` 2000×2000 only |
| 8 | Reviewers use **Meta's own test accounts**; do **not** supply personal Meta credentials | ✅ nothing to prepare beyond app reachability |
| 9 | App in Live mode | ❌ Dev Mode |
| 10 | ES on Facebook Login for Business + JS SDK. **ES v2 dies 15 Oct 2026 — must be v4** | ✅ code sends `version: "v4"` — ⚠️ `config_id` presence unconfirmed |
| 11 | Coexistence prereqs: Tech Provider status, WA Business app **2.24.17+**, a webhook that accepts *and digests* webhooks, ES **with session logging** | ✅ webhook live + HMAC-enforced — ⚠️ session logging unverified |
| 12 | Coexistence: ≤4 companion clients; **all existing companions are auto-unlinked at onboarding** and must be re-linked. Windows and WearOS unsupported | ❌ Connect UI never warns |
| 13 | History sync: 180 days of messages + all contacts; **must be synced within 24h of onboarding** or offboard and redo. It is a **pull** — `POST /{phone-number-id}/smb_app_data` with `sync_type` `history` / `smb_app_state_sync`; nothing arrives unasked. Delivered in 3 phases × N chunks, `progress: 100` = done. Media asset IDs only within 14 days. Owner taps Confirm | ✅ **built** — requested at connect, parsed, imported idempotently. ⚠️ needs the `history` + `smb_app_state_sync` webhook fields subscribed |
| 14 | Coexistence restrictions: no groups, voice/video, business tools, messaging tools, business profile, channels; disappearing + view-once + live-location off; broadcast lists read-only; **fixed non-upgradable 20 mps** | ⚠️ our docs said 5 msg/s — corrected |
| 15 | Billing 2026: **per-message** (conversation-based deprecated 1 Jul 2025), charged on template delivery. **1 Oct 2026: free service messages inside the 24h window become billable** | ⚠️ pricing model still assumes conversation-based |

### Not covered by research — verify in the dashboard, do not assume

App-settings detail (privacy/ToS/data-deletion callback fields), the Data
Protection Assessment, review timelines and rejection reasons, quality ratings,
annual re-verification. Two questions were deliberately left unanswered rather
than guessed: whether a separate "Tech Provider" application step exists, and
whether Coexistence carries any extra App Review item.

---

## 2. Contractual compliance (WhatsApp Business terms)

New terms take effect **23 September 2026** ([preview index](https://www.facebook.com/legal/wa-for-business-terms-preview)),
restructuring six documents and renaming `Business Solution Data` →
`WhatsApp Business Platform Data`. The two that bind us are the
[Meta Terms for WhatsApp Business Platform](https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform-preview)
and the [Cloud API Terms](https://www.facebook.com/legal/WhatsApp-Business-Platform-Cloud-API-preview).

**Terminology trap.** These documents define **"Solution Provider"** functionally —
*"a third party authorized to use these APIs on such business' behalf."* That is
**us**, even though our dashboard tier is "Tech Provider". These clauses are not
BSP-only.

### The AI rules are already in force

Not a September change. Effective **15 Oct 2025** for new API users, rolled out to
all existing users by **15 Jan 2026**; current live terms are dated **6 Mar 2026**.

**Answering our customers with AI is permitted.** The prohibition on AI providers
applies only *"when such technologies are the primary (rather than incidental or
ancillary) functionality."* That separates selling a general-purpose assistant
through WhatsApp (banned) from a business using AI to serve its own customers
(allowed). The terms explicitly permit *"retain[ing] an AI Provider as your Third
Party Service Provider"* — our Anthropic architecture is the contemplated shape,
and our privacy policy already names Anthropic as a processor.

Two live constraints:

1. **No cross-tenant learning from WhatsApp data.**
   > "you may not directly or indirectly allow Business Solution Data… to be used to
   > create, develop, train, or improve any machine learning or artificial
   > intelligence systems" — except to *"fine-tune an AI Model that is for your
   > exclusive use, so long as this does not result in Business Solution Data being
   > used to create, develop, train, or improve any other AI Models."*

   The shared per-industry persona roadmap conflicts with this **when the source is
   WhatsApp conversations**. Anonymisation does not clearly rescue it — the clause
   restricts *improving systems*, not just handling raw content. **Web-widget
   conversations are unaffected.** Rule: mine web freely; keep WhatsApp-derived
   learning inside the originating tenant.

2. **Positioning.** Market as customer support and lead management, not as a
   general-purpose assistant. The EEA/Brazil carve-out permitting general-purpose AI
   does **not** cover Albania.

### Other operative obligations

- **Consent flows to us:** *"obtain (or if you are a Solution Provider, **ensure your
  Clients obtain**) all necessary rights and… legally sufficient consent."* We have
  no consent capture — this is contractual, not cosmetic.
- **No profiling:** may not use platform data *"to track, build, or augment profiles
  on individual WhatsApp Users."*
- **No third-party sharing** of platform data except to a Solution Provider.
- **Meta is not an archive:** *"Meta does not provide an archiving service, storage
  service, or any backup functionality; you are solely responsible for creating
  backups."* → a platform with an inbox necessarily stores messages; the privacy
  policy must say so.
- **Deletion:** Meta deletes Company Personal Data within **90 days** of service cessation.
- **Audit:** usage reports due within **30 days** of Meta's request.
- **Rate Card** may change at any time, effective the first of the following month.

---

## 3. Gaps

### P0 — before submitting

- [ ] **Privacy policy contradicts the code.** `lidh.al/privacy` claims *"Lidh.al does
      not store the full content of WhatsApp conversations in our own databases"* and
      promises opt-out by replying STOP. Both false: `whatsapp.service.ts:153,279,491`
      store every inbound body, reply and echo in plaintext (`contentText String? @db.Text`),
      and no STOP handling exists. Legal exposure independent of Meta; reviewers open
      that URL. Fix the text (storage is unavoidable — Meta does not archive) and build
      the opt-out.
- [ ] **STOP / UNSUBSCRIBE / ÇREGJISTROHU** handling before the agent runs
- [ ] **`Contact.optedOutAt`** + migration
- [ ] **Consent capture** — required by the terms, absent entirely
- [ ] **Disable public Swagger** — `api.lidh.al/docs-json` returns 200 today, serving a
      stale description claiming *"endpoints are open"*
- [ ] **AI/bot disclosure** on the widget and funnel chat surfaces
- [ ] **Data-deletion + deauthorize callbacks** — `lidh.al/data-deletion` is 404.
      Standard for Facebook Login apps; not confirmed as a hard Meta requirement, but cheap

### P1 — coexistence correctness

- [x] **History sync** — requested at connect (`smb_app_data`), parsed from the
      `history` / `smb_app_state_sync` webhooks, imported idempotently via the unique
      `providerMessageId`. Progress tracked on `Channel.config.historySync`
- [ ] **Media in history** — asset IDs arrive in later webhooks (14-day window only)
      and are not downloaded; historical media currently imports as `[image message]`
- [ ] **Retry UI** — if the `smb_app_data` request fails the failure is recorded on
      the channel but there is no dashboard button to retry inside the 24h window
- [ ] **Companion-device warning** in the Connect UI — onboarding unlinks their devices
- [ ] **postMessage origin bug** — `host.endsWith("facebook.com")` also matches
      `evilfacebook.com` (`ConnectWhatsApp.tsx:119`)
- [ ] **ES session logging** — `sessionInfoVersion: "3"` is set but the payload is held
      in a ref and discarded
- [x] **Throughput doc corrected** — 20 mps fixed, not 5 msg/s

### P2 — operational robustness

- [ ] **Token lifecycle** — `tokenExpiresAt` written, never read; `MetaSendError.isTokenExpired`
      (code 190) has no caller; a channel is never marked errored
- [ ] **`appsecret_proof`** on all Graph calls — everything breaks if "Require
      appsecret_proof" is ever enabled
- [ ] **`min_machines_running = 1`** — scale-to-zero cold starts vs Meta's webhook retries
- [ ] **Retention policy + per-contact erasure** — no TTL, no purge job, no scheduler at all
- [ ] **Tests** for the webhook parser and signature verification — currently zero
- [ ] **Boot-time env validation** — `ConfigModule` has no `validationSchema`
- [ ] **ADR** for the WhatChimp → Meta Tech Provider pivot (never written)

---

## 4. Submission runbook

1. Confirm Facebook Login for Business + an ES configuration exist
   (**WhatsApp → Embedded Signup Builder** generates both). The configuration's ID is
   `META_CONFIG_ID`; without it the Connect button silently does nothing.
2. Confirm the configuration requests exactly `whatsapp_business_messaging` +
   `whatsapp_business_management` — our code passes no `scope`, so the permission set
   lives entirely Meta-side.
3. Upload the 1024×1024 icon; set privacy policy + ToS URLs.
4. Make one `whatsapp_business_management` call (e.g. list templates on a WABA)
   **within 30 days** of submitting.
5. Record the two screencasts. We have no template feature — use the **WhatsApp Manager**
   alternative for the template recording.
6. Submit, self-identifying as *"a Solution Partner or Tech Provider"* in the use-case text.
7. Switch to Live mode; then pursue Access Verification for the 200/week cap.

---

## 5. Verify directly

- ✅ **Fly secrets confirmed set** (2026-08-06): `META_APP_ID`, `META_APP_SECRET`,
  `META_WEBHOOK_VERIFY_TOKEN`, `CREDENTIAL_ENC_KEY`. So the **real
  `MetaCloudTransport` is bound in production**, not the stub, and webhook HMAC
  verification is enforced (an unsigned POST returns `{"status":"ignored"}`,
  reachable only when the secret is present).
- ⚠️ `META_CONFIG_ID` is also set on Fly but **nothing server-side reads it** — it
  is inert there. The value that matters is `NEXT_PUBLIC_META_CONFIG_ID` in the
  **Vercel** dashboard project.
- ❓ **Still unverified:** `NEXT_PUBLIC_META_APP_ID` / `NEXT_PUBLIC_META_CONFIG_ID`
  in Vercel. Both are inlined at build time, so they need a dashboard **redeploy**
  after being set. Without the config id, `connect()` returns early and the
  Connect button silently does nothing — which would make Embedded Signup
  untestable no matter what the Meta app says.
- Meta App → WhatsApp → Configuration → Webhook: `https://api.lidh.al/v1/webhooks/whatsapp`,
  fields `messages`, `message_echoes`, `account_update`. The parser silently drops anything else.
- Whether "Require appsecret_proof for API calls" is enabled — if so, every Graph call
  in this repo fails today.
- Whether `seed-wa-test-channel.ts` was ever run against production Neon — it attaches a
  Meta **test** WABA to a real tenant with `coexistence: false` and bypasses the plan gate.

---

## Sources

- [Tech Provider get-started](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers)
- [Solution providers overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/overview)
- [Embedded Signup overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview)
- [Onboarding Business App users (Coexistence)](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users/)
- [App Review sample submission](https://developers.facebook.com/docs/whatsapp/solution-providers/app-review/sample-submission)
- [Pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
- [Business Solution Terms (live)](https://www.whatsapp.com/legal/business-solution-terms) ·
  [Terms preview index](https://www.facebook.com/legal/wa-for-business-terms-preview)
