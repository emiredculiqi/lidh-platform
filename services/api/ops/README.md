# ops/ — operator tooling

Read-only diagnostics and dev seeds, run by hand with `tsx`. **Not** part of the
built API, not on any schedule, and not a home for business logic.

## The rule

A file belongs here only if it is one of:

- **A read-only diagnostic** — prints state, writes nothing. It may reuse a
  runtime function so the answer cannot drift from production behaviour
  (`freeze-check` calls the same `loadTenantEntitlements` the API does).
- **A dev/test seed** — sets up something the product cannot yet do through its
  own UI (`seed-wa-test-channel` exists only until Meta App Review passes).

Anything that *changes* customer data belongs in a service behind the API, where
tenant isolation (`assertCanAccessTenant`) and the audit trail apply. A script
holding a raw Prisma client has no guardrails and runs against production — the
`scripts/` folder this replaced accumulated ~950 lines of vertical-specific
ingestion that way, and was removed with the real-estate vertical (ADR-019).

## Files

| File | Kind | Purpose |
|---|---|---|
| `freeze-check.ts` | diagnostic | Lists every tenant and whether trial enforcement freezes it now or soon — the dry run for the one switch that silences a customer. No staging exists; run this before touching plans or trials. |
| `check-wa-channel.ts` | diagnostic | Dumps the stored WhatsApp channel rows (config, status) for debugging a connect. |
| `check-wa-messages.ts` | diagnostic | Lists recent WhatsApp conversations/messages to confirm inbound is landing. |
| `seed-wa-test-channel.ts` | seed | Attaches a Meta **test** number to a tenant, bypassing Embedded Signup. Needs the deployed API's `DATABASE_URL` and `CREDENTIAL_ENC_KEY`. Delete once the Meta app is Live. |

## Running

```bash
# from the repo root; every script needs DATABASE_URL
pnpm --filter @lidh/api exec tsx ops/freeze-check.ts
```
