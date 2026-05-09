# lidh.al

Marketing site for **Lidh.al** — customer support and lead management for Albanian businesses.

Live at [https://lidh.al](https://lidh.al).

## Stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Resend** for transactional email (contact form delivery)
- **Zod** for request validation

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Set these in `.env.local` for development and in your hosting provider's project settings for production.

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | API key from [resend.com/api-keys](https://resend.com/api-keys) |
| `RESEND_FROM` | Sender shown in `From:` header, e.g. `"Lidh.al <noreply@lidh.al>"`. Domain must be verified in Resend. |
| `CONTACT_TO_EMAIL` | Inbox that receives new lead notifications (e.g. `info@lidh.al`) |
| `ANTHROPIC_API_KEY` | API key from [console.anthropic.com](https://console.anthropic.com). Required for the chatbot widget. |
| `ANTHROPIC_MODEL` | Optional. Defaults to `claude-haiku-4-5` (fast + cheap, right model for FAQ/lead-capture). Set to `claude-sonnet-4-6` or `claude-opus-4-7` for higher quality. |

## Project layout

```
app/
  api/contact/route.ts    # POST /api/contact — validates + sends email via Resend
  layout.tsx              # Root layout, fonts, locale provider
  page.tsx                # Composes the homepage from /components/sections
  globals.css
components/
  sections/               # Hero, Benefits, UseCases, About, Contact
  ui/                     # Container and other primitives
  animations/Reveal.tsx   # Reusable scroll-reveal wrapper
  Header.tsx
  Footer.tsx
  LanguageToggle.tsx      # AL / EN switcher
content/
  site.ts                 # All marketing copy in one typed object (al + en)
  use-cases.ts            # Industry cards (icon, title, body in both languages)
lib/
  i18n.tsx                # LocaleProvider, useLocale, useT hooks
  mailer.ts               # Resend client + sendContactEmail
public/
  logo.png                # Brand mark
scripts/
  test-smtp.ts            # Standalone Resend send test (npm run test:smtp)
tailwind.config.ts        # Brand colors, fonts, animations
```

## Editing common things

| Goal | File |
|---|---|
| Change marketing copy (AL or EN) | `content/site.ts` |
| Add or edit an industry card | `content/use-cases.ts` |
| Adjust brand colors / fonts | `tailwind.config.ts` |
| Tweak hero animation | `components/sections/Hero.tsx` |
| Change contact form fields or validation | `components/sections/Contact.tsx` and `app/api/contact/route.ts` |
| Customize email body sent on form submit | `lib/mailer.ts` |

## Internationalization

The site supports Albanian (`al`, default) and English (`en`). Every translatable string lives in `content/site.ts` under `{ al: …, en: … }`. Components consume strings via `useT(siteContent)`. The active locale is persisted to `localStorage` under `lidh.locale`.

To add a new translatable section:

1. Add the keys under both `al` and `en` in `content/site.ts`.
2. In your component, call `const t = useT(siteContent)` and reference `t.yourNewKey`.

## Contact form

The form (`/components/sections/Contact.tsx`) POSTs JSON to `/api/contact`. The API route:

1. Validates with Zod (`name`, `email`, `message` required; min/max lengths enforced both client- and server-side).
2. Calls `sendContactEmail()` (`lib/mailer.ts`) which sends through Resend.
3. Sets `Reply-To` to the submitter's email so replies from the inbox go straight to the customer.
4. Returns `200 ok` on success, `422 invalid_input` on validation failure, `502 email_failed` on Resend errors.

To verify the email pipeline without going through the form:

```bash
npm run test:smtp
```

This script sends a test message to `CONTACT_TO_EMAIL` and prints the Resend message id.

## DNS / mail setup (lidh.al)

DNS is hosted at **Cloudflare**. The records that matter for mail:

| Record | Purpose |
|---|---|
| `MX` `@` → `mx.zoho.eu` (10), `mx2.zoho.eu` (20), `mx3.zoho.eu` (50) | Receive mail at `*@lidh.al` (Zoho) |
| `MX` `send` → `feedback-smtp.eu-west-1.amazonses.com` (10) | Resend bounce notifications |
| `TXT` `send` → `v=spf1 include:amazonses.com ~all` | SPF for Resend |
| `TXT` `resend._domainkey` → `p=…` | Resend DKIM |
| `TXT` `_dmarc` → `v=DMARC1; p=none;` | DMARC policy |
| `TXT` `@` → `zoho-verification=…` | Zoho domain ownership |

## Deploying

Vercel is the simplest target — it auto-detects Next.js. After the first push to GitHub:

1. Import the repo at [vercel.com/new](https://vercel.com/new).
2. Add the three environment variables above.
3. Deploy.
4. In **Settings → Domains** add `lidh.al` and `www.lidh.al`.
5. In Cloudflare DNS, point `@` (A) to the Vercel IP and `www` (CNAME) to `cname.vercel-dns.com` — keep the proxy **off (grey cloud)** until SSL is issued.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Run the production build locally |
| `npm run lint` | Lint with ESLint |
| `npm run test:smtp` | Send a test email via Resend to confirm the pipeline |

## License

Proprietary — all rights reserved by Lidh.al.
