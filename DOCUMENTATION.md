# RioPoly — Complete System Documentation

> **Purpose:** end‑to‑end reference for how RioPoly works, how each feature is
> meant to be used, and everything an engineer (or AI agent) needs to resume
> work with zero prior context. Last updated: **July 2026**.

---

## Table of contents

1. [What RioPoly is](#1-what-riopoly-is)
2. [Live status & quick facts](#2-live-status--quick-facts)
3. [Resume checklist (read this first if resuming)](#3-resume-checklist)
4. [Product guide — how users use every feature](#4-product-guide)
5. [Architecture & repo layout](#5-architecture--repo-layout)
6. [Routing & the unified app](#6-routing--the-unified-app)
7. [Data model (Prisma / Postgres)](#7-data-model)
8. [Authentication](#8-authentication)
9. [Billing & payments engine](#9-billing--payments-engine)
10. [GST & invoicing](#10-gst--invoicing)
11. [Environment variables](#11-environment-variables)
12. [External services & setup](#12-external-services--setup)
13. [Operational runbook](#13-operational-runbook)
14. [Testing](#14-testing)
15. [Key decisions & gotchas](#15-key-decisions--gotchas)
16. [Go‑live checklist & known TODOs](#16-go-live-checklist--known-todos)
17. [Company / legal facts](#17-company--legal-facts)

---

## 1. What RioPoly is

RioPoly is a **B2B SaaS 3D paint‑visualization & proposal platform** for interior
professionals (designers, paint contractors, design agencies, sales teams).
Users open a furnished 3D house in the browser, repaint any surface in real time,
and export a **branded PDF proposal** with cost estimates.

- **Tagline:** *Visualize. Propose. Close.*
- **Operator:** GTANALYZE SOLUTIONS PRIVATE LIMITED (see §17).
- **One product in a family** (Atlas, RioPoly, …) each under its own subdomain of
  `gotoanalyze.com`.

The whole thing — marketing site, 3D studio, and the billing/auth backend — is a
**single unified Next.js app** deployed to **`https://riopoly.gotoanalyze.com`**.

---

## 2. Live status & quick facts

| Item | Value |
|---|---|
| Production URL | `https://riopoly.gotoanalyze.com` |
| Vercel project | `riopoly-billing` (personal account `balajiece15`) |
| Framework | Next.js 14 (App Router) + React 18 + TypeScript |
| DB | Supabase Postgres (via Prisma), **free tier** + daily keep‑alive |
| Payments | Razorpay (**currently TEST keys**), shared MID with sibling projects |
| Auth | NextAuth email magic‑link, sessions in DB |
| Email | Resend (domain `gotoanalyze.com` verified) |
| Invoice storage | Supabase Storage, private bucket `invoices` |
| Contact form | Formspree form `xkoadaqy` |
| Status | Fully functional; one‑time + subscription payments both working |

---

## 3. Resume checklist

If you are picking this up cold, do these in order:

1. **Node / deps:** use NVM. `nvm use` (or Node 20+), then `npm install`.
2. **Secrets:** real values live in `.env` (local, git‑ignored) and in the Vercel
   env store (production). If `.env` is missing, recreate it from `.env.example`
   (§11) — the actual secret values are held by the owner, not in the repo.
3. **DB may be paused.** Supabase free tier pauses after ~7 days idle. If any DB
   call fails with `FATAL: (ENOTFOUND) tenant/user postgres.<ref> not found`, the
   project is paused → restore it in the Supabase dashboard (§12). A daily Vercel
   cron keep‑alive (`/api/cron/keepalive`) normally prevents this.
4. **Verify health:** `npm run check:billing` (reads latest user’s billing state)
   confirms DB connectivity.
5. **Prisma client:** `npm run prisma:generate` if types are stale.
6. **Run locally:** `npm run dev` → http://localhost:3000.
7. **E2E:** `E2E_BASE_URL="https://riopoly.gotoanalyze.com" npm run test:e2e`
   (21 tests). Or the live persona walkthrough (§14).
8. **Deploy:** `vercel --prod --yes` from the repo root.

**Danger zones:** never commit `.env*`; never force‑capture subscription payments;
Razorpay is still on TEST keys — going live is a deliberate step (§16).

---

## 4. Product guide

How each feature is meant to be used, page by page.

### 4.1 Marketing site — `/` (static `public/index.html`)
A single‑page marketing site (HTML + Tailwind CDN + GSAP/AOS animations,
`public/script.js`). Sections: **Hero → Trust → Platform (Products) → Studio promo
→ About → Use Cases (Gallery) → Why RioPoly → Contact → Footer**.

- **Top nav:** Home, Platform, About Us, Use Cases, **3D Studio** (`/color-studio`),
  **Pricing** (`/pricing`), Contact, **Sign In** (`/login`), **Request Demo** (scrolls to contact).
- **Platform tabs:** “All / Create / Present & Close” filter the product cards (JS).
- **Contact form** → posts JSON to **Formspree** (`xkoadaqy`). Client‑side validation
  (name/phone/type required; phone ≥ 7 digits) with a custom `#form-feedback` box;
  the browser’s native `required` validation fires first for empty fields.
- **WhatsApp:** floating button + inline CTA → `wa.me/919944480052` (pre‑filled text).
- **“I’m a … ” quick CTAs** pre‑fill the form’s profile/interest selects.
- **Footer legal:** Privacy Policy → `/privacy`, Terms of Use → `/terms`.

### 4.2 3D Color Studio — `/color-studio` (static Vite build in `public/color-studio/`)
Opens a **workspace chooser** splash (Interior Designer / Paint Contractor /
Design Agency). Picking one loads the WebGL scene: a furnished room with a
**floor plan**, **Themes / Paint / Materials / Rooms / Tools / Settings** panels,
**Before/After** capture, and an **AI inspiration gallery**. Users click a surface
and recolour it live, then export. Has a “← Back to RioPoly” link back to `/`.
> This is a prebuilt static bundle; its assets are served from
> `/color-studio/assets/...` with long‑cache headers. Editing the studio means
> rebuilding that Vite app (source not in this repo’s Next tree).

### 4.3 Pricing — `/pricing` (Next server page)
Lists all SKUs from `lib/plans.ts`: 4 subscriptions + 3 one‑time credit packs.
Each card shows price (GST‑inclusive), features, and a **Checkout button**.
- Agency‑Yearly (> ₹15k) shows the **RBI e‑Mandate** renewal‑auth notice.
- Clear **no‑refund** disclosure + link to `/terms`; note that sign‑in is required
  before payment.
- Clicking **Buy now / Subscribe** while logged out → redirect to `/login` (by design).

### 4.4 Sign in — `/login` (Next client page)
Email magic‑link. User enters email → “Check your inbox” screen; a 15‑minute link
is emailed via Resend. Errors are surfaced inline (`?error=…`).

### 4.5 Billing dashboard — `/billing` (Next server page, auth‑gated)
Shows: current **access** (credit balance or “Unlimited”), **active subscription**
(renewal date + Cancel button), **order history** with **downloadable GST invoices**,
and Buy/Upgrade CTAs. A “Payment received — confirming…” banner appears after checkout
(`?status=processing`) while the webhook finalizes.

### 4.6 Terms — `/terms`, Privacy — `/privacy` (Next server pages)
Static legal pages. Terms carries the **no‑refund / cancel‑anytime** policy and GST
entity details; Privacy explains data handling (form data, payments via Razorpay,
content stored in the studio).

### 4.7 Shared app header
All Next pages (pricing/billing/login/terms/privacy) render a slim header
(`app/layout.tsx`): **RioPoly logo → `/`**, plus 3D Studio / Pricing / Billing links.
Links to static routes (`/`, `/color-studio`) use plain `<a>` (not `<Link>`) to avoid
RSC‑prefetch 404s.

---

## 5. Architecture & repo layout

**Stack:** Next.js 14 App Router · React 18 · TypeScript · Prisma 5 · Supabase
(Postgres + Storage) · NextAuth 4 · Razorpay Node SDK · Resend · @react-pdf/renderer · Zod.

```
RioPoly/
├─ app/                      # Next.js App Router
│  ├─ layout.tsx             # root layout + shared SiteHeader + favicon metadata
│  ├─ providers.tsx          # NextAuth SessionProvider wrapper
│  ├─ pricing/ billing/ login/ terms/ privacy/  # pages
│  └─ api/
│     ├─ auth/[...nextauth]/route.ts   # NextAuth handler
│     ├─ orders/create/route.ts        # one-time checkout
│     ├─ subscriptions/create/route.ts # subscription checkout
│     ├─ subscriptions/cancel/route.ts # cancel at cycle end
│     ├─ webhook/razorpay/route.ts     # THE webhook (all events)
│     ├─ invoices/[id]/route.ts        # signed-URL invoice download
│     └─ cron/keepalive/route.ts       # daily DB ping (anti-pause)
├─ lib/
│  ├─ plans.ts               # SKU catalog — SINGLE SOURCE OF TRUTH
│  ├─ prisma.ts              # Prisma client singleton
│  ├─ razorpay.ts            # server-only Razorpay client
│  ├─ auth.ts                # NextAuth options (email provider + Resend)
│  ├─ session.ts             # getSessionUser() server helper
│  ├─ entitlements.ts        # access ledger (grant/consume/revoke/query)
│  ├─ gst.ts                 # place-of-supply + GST-inclusive split
│  ├─ invoice.ts             # sequential invoice numbering (advisory lock)
│  ├─ invoice-pdf.tsx        # @react-pdf/renderer PDF template
│  ├─ invoice-fulfillment.ts # render → upload → email (best-effort)
│  ├─ storage.ts             # Supabase Storage (invoices bucket)
│  ├─ email.ts               # Resend invoice email
│  └─ billing.ts             # getBillingSummary() for /billing
├─ components/
│  ├─ CheckoutButton.tsx     # client: opens Razorpay Checkout
│  └─ CancelSubscriptionButton.tsx
├─ prisma/schema.prisma      # 9 domain tables + NextAuth tables
├─ scripts/                  # ops scripts (see §13)
├─ tests/                    # Playwright E2E
├─ public/                   # static marketing site + color-studio build
│  ├─ index.html, styles.css, script.js, assets/
│  └─ color-studio/          # prebuilt Vite 3D app
├─ next.config.mjs           # rewrites (static→app) + security headers
├─ vercel.json               # cron: daily keepalive
└─ .env.example              # env var template (no secrets)
```

**Legacy docs** at repo root (`PROJECT_SUMMARY.md`, `HERO_*`, `TRUST_*`,
`VALIDATION_REPORT.md`, `TEST_INSTRUCTIONS.md`) predate this file — **this
`DOCUMENTATION.md` is the authoritative reference.**

---

## 6. Routing & the unified app

`next.config.mjs` uses **`rewrites.beforeFiles`** so static assets and Next pages
coexist under one deployment:

| Path | Serves |
|---|---|
| `/` | `public/index.html` (marketing) |
| `/color-studio`, `/color-studio/` | `public/color-studio/index.html` (3D app) |
| `/pricing`, `/billing`, `/login`, `/terms`, `/privacy` | Next server pages |
| `/api/*` | Next route handlers |

Security headers (all paths): `X-Frame-Options: DENY`, `X-Content-Type-Options:
nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. Studio assets get
`Cache-Control: immutable`.

> There is **no** separate `billing.gotoanalyze.com` — that idea was abandoned in
> favor of this single unified app.

---

## 7. Data model

Prisma → Supabase Postgres. Amounts are **integer paise** (₹1 = 100 paise).

**Design rules (non‑negotiable):**
- **Entitlement ledger:** access is *derived from `Entitlement` rows*, never from a
  flag on `User`. “Can this user do X?” = query the ledger.
- **Unified `Order`:** one‑time purchases *and* each subscription cycle write the
  same row shape, distinguished by `Order.kind` (`one_time` | `subscription_cycle`).
- **`Plan` table** is a cached snapshot of `lib/plans.ts` (PK = SKU id) so
  Orders/Subscriptions keep FK integrity even if a SKU is retired.
- **GST invoice for every paid Order**, with a sequential number per fiscal year.

**Domain tables:** `User`, `Project`, `Plan`, `Subscription`, `Entitlement`,
`Order`, `Payment`, `Invoice`, `WebhookEvent`.
**NextAuth tables:** `Account`, `Session`, `VerificationToken`.

Key fields:
- `User.billingState` / `billingCountry` → drive GST place‑of‑supply.
- `Entitlement`: `kind` (`credits|unlimited|feature_flag`), `value` (credits; null
  for unlimited), `source` (`one_time:pack-10` | `subscription:pro-monthly` |
  `manual_grant`), `grantedAt`, `expiresAt` (null = never), `consumedAt`
  (set when exhausted/refunded), plus `sourceOrderId/SubscriptionId/PaymentId`.
- `Invoice`: `invoiceNumber` `GTA-RIO-YYYY-NNNNN`, `fiscalYear`, `seq`,
  `taxablePaise/cgstPaise/sgstPaise/igstPaise/totalPaise`, `gstTreatment`, `pdfUrl`.
- `WebhookEvent.razorpayEventId` unique → idempotency.

---

## 8. Authentication

- **NextAuth** (`lib/auth.ts`), `PrismaAdapter`, **database sessions**.
- **Email provider** (magic link, 15‑min expiry). Emails sent via **Resend**;
  in dev without `RESEND_API_KEY` the link is logged to the console instead.
- Pages: sign‑in `/login`, verify `/login?check=email`.
- `session.user.id` is injected in the `session` callback.
- Server code reads the user via `getSessionUser()` (`lib/session.ts`).
- Session cookie: prod `__Secure-next-auth.session-token`, dev `next-auth.session-token`.

---

## 9. Billing & payments engine

### 9.1 Plan catalog (`lib/plans.ts`) — single source of truth
Edit this file to add/change a SKU; **never hardcode prices in routes**. Prices are
**GST‑inclusive**. `scripts/sync-plans.ts` pushes subscription SKUs to Razorpay Plans
and snapshots all SKUs into the `Plan` table.

| SKU | Kind | Price | Grants |
|---|---|---|---|
| `single-project` | one‑time | ₹499 | 1 credit, never expires |
| `pack-10` | one‑time | ₹3,999 | 10 credits, 365 days |
| `pack-50` | one‑time | ₹14,999 | 50 credits, 365 days |
| `pro-monthly` | subscription | ₹1,499/mo | unlimited |
| `pro-yearly` | subscription | ₹14,999/yr | unlimited |
| `agency-monthly` | subscription | ₹4,999/mo | unlimited + white_label + team_seats:5 |
| `agency-yearly` | subscription | ₹49,999/yr | unlimited + white_label + team_seats:5, **AFA** |

Razorpay `plan_id`s are pinned in `lib/plans.ts` (`razorpayPlanId`). **Free tier**
(no purchase): 1 saved project, watermarked exports, no PDF download.
`AFA_THRESHOLD_PAISE = 1,500,000` (₹15k) → RBI additional‑factor auth on renewals.

### 9.2 Checkout endpoints
Both are `POST`, auth‑gated, body `{ sku }`, `runtime = 'nodejs'`.

**`/api/orders/create`** (one‑time): validates SKU is `one_time` → creates a
Razorpay **Order** (amount = `pricePaise`, `notes.product=riopoly`) → inserts local
`Order` (`status=created`). Returns `{ type:'one_time', keyId, orderId, amount,
currency, name, description, prefill }`. **Entitlements are NOT granted here** — the
webhook does that. Razorpay errors → `502` with description; unknown SKU → `400`;
not signed in → `401`.

**`/api/subscriptions/create`**: validates SKU is `subscription`, resolves
`razorpayPlanId` (from catalog or `Plan` table; `409` if not synced) → creates a
Razorpay **Subscription** (`total_count` = 120 monthly / 10 yearly) → inserts local
`Subscription` (`status=created`). Returns `{ type:'subscription', keyId,
subscriptionId, name, description, prefill, additionalAuthOnRenewal }`.

**`/api/subscriptions/cancel`**: calls Razorpay cancel with
`cancel_at_cycle_end=true` and optimistically flags the local sub. Access continues
until period end.

### 9.3 CheckoutButton (`components/CheckoutButton.tsx`)
Client component. POSTs to the right endpoint; on `401` redirects to
`/login?next=…`; loads `checkout.razorpay.com/v1/checkout.js`; opens the modal with
`order_id` or `subscription_id`. On success the **handler just routes to
`/billing?status=processing`** — the webhook is the source of truth for fulfillment.

### 9.4 The webhook (`/api/webhook/razorpay`) — the heart of the system
- Reads the **raw body**, verifies `x-razorpay-signature` via **HMAC‑SHA256**
  (timing‑safe) against `RAZORPAY_WEBHOOK_SECRET`. Bad signature → `401`.
- **Idempotent:** atomically inserts a `WebhookEvent` keyed on `x-razorpay-event-id`;
  a duplicate insert → returns `{status:'duplicate'}` and does nothing.
- On handler error → marks event `failed` and returns **500 so Razorpay retries**.

**Events handled** (`handleEvent` switch):

| Event | Action |
|---|---|
| `payment.authorized` | **Safety net** for manual‑capture accounts: auto‑capture the *one‑time* order’s payment for the **order amount** (Razorpay adds customer‑borne fee on top). Ignores subscription payments and “already captured”. |
| `payment.captured` | One‑time paid → in one tx: `Order.status=paid`, create `Payment`, `grantOneTimeEntitlement`, `createInvoiceForOrder`; then `tryFulfillInvoice`. |
| `subscription.activated` | First activation → set `active`, period dates, `grantOrExtendSubscriptionEntitlement` (unlimited, `expiresAt=current_end`). |
| `subscription.charged` | Renewal/first charge → create `subscription_cycle` `Order` + `Payment` + `Invoice` (dedup by payment id), extend entitlement `expiresAt`. |
| `subscription.halted` | Dunning failed → set `halted` **and expire the entitlement now** (access stops). |
| `subscription.cancelled` | Set `cancelled`, `cancelAtCycleEnd=true` → access continues to period end. |
| `subscription.completed` | End of term → access continues to period end. |
| `refund.processed` | Mark `Payment` refunded + `Order.status=refunded` + **revoke** the entitlement from that payment. |

### 9.5 Entitlement engine (`lib/entitlements.ts`)
- `getActiveEntitlements(userId)` / `hasUnlimited(userId)` / `getCreditBalance(userId)`
  — access is queried live from the ledger (not‑consumed, within grant/expiry window).
- `consumeCredit(userId, projectId)` — unlimited users always pass; otherwise spends
  the **soonest‑expiring** credit in a transaction and links the `Project`.
- `grantOneTimeEntitlement` / `grantOrExtendSubscriptionEntitlement` /
  `revokeEntitlementForPayment` — called **inside the webhook transaction**.

---

## 10. GST & invoicing

### 10.1 Place of supply (`lib/gst.ts`)
- Country ≠ IN → **export** (0% GST).
- Tamil Nadu (our state) → **CGST 9% + SGST 9%** (intra‑state).
- Any other Indian state → **IGST 18%** (inter‑state).
- Rate is **18%**, prices are **GST‑inclusive** → tax is *back‑computed*:
  `taxable = round(gross / 1.18)`, `gst = gross − taxable` (split exact to the paise).

### 10.2 Numbering (`lib/invoice.ts`)
`createInvoiceForOrder` runs **inside the same transaction** as the Order/Payment
writes. It takes a **Postgres transaction advisory lock** (`pg_advisory_xact_lock(fiscalYear)`)
so concurrent webhooks can’t collide, then allocates
`GTA-RIO-<fiscalYear>-<NNNNN>`. Indian fiscal year = Apr 1–Mar 31, labelled by start year.

### 10.3 Fulfillment (`lib/invoice-fulfillment.ts`)
`tryFulfillInvoice` (best‑effort, never throws into the webhook):
1. Render PDF (`lib/invoice-pdf.tsx`, `@react-pdf/renderer`). *Note:* PDFs use
   `Rs.` not `₹` (Helvetica lacks the glyph). Requires `import React` for tsx; deps
   `emoji-regex-xs`, `yoga-layout` are explicit for the tsx runtime.
2. Upload to Supabase Storage private bucket `invoices` at `<fy>/<invoiceNumber>.pdf`
   (`lib/storage.ts`), save `Invoice.pdfUrl` = that path.
3. Email via Resend (`lib/email.ts`).

### 10.4 Download (`/api/invoices/[id]`)
Auth‑gated; verifies ownership; if `pdfUrl` set, **redirects to a 300‑second signed
URL** from Supabase; `409` if PDF still generating; `404` if not owner/not found.

---

## 11. Environment variables

Names below; **real values live only in `.env` (local) and the Vercel env store.**
Template: `.env.example`. Never commit `.env*`.

| Var | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | client | `https://riopoly.gotoanalyze.com` |
| `RAZORPAY_KEY_ID` | server | `rzp_test_…` now; `rzp_live_…` at go‑live |
| `RAZORPAY_KEY_SECRET` | server | secret — never client, never logged |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | client | same value as `RAZORPAY_KEY_ID` (publishable) |
| `RAZORPAY_WEBHOOK_SECRET` | server | must match the dashboard webhook secret |
| `SUPABASE_URL` | server | `https://<ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | server | |
| `SUPABASE_SERVICE_ROLE_KEY` | server | bypasses RLS — server only |
| `DATABASE_URL` | server | **pooled** PgBouncer `:6543` `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | server | **direct** `:5432` — used by Prisma Migrate |
| `NEXTAUTH_URL` | server | prod URL |
| `NEXTAUTH_SECRET` | server | `openssl rand -base64 32` |
| `RESEND_API_KEY` | server | `re_…` |
| `EMAIL_FROM` | server | e.g. `RioPoly <request@gotoanalyze.com>` |

Push local `.env` → Vercel prod with `scripts/push-vercel-env.sh` (overrides
`NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` to the prod domain).

> **Supabase connection strings use the pooler host** (`aws-…-<region>.pooler.supabase.com`)
> because Vercel serverless can’t reach Supabase’s IPv6‑only direct host. Get the
> exact string from the Supabase dashboard → Connect. The project ref is
> `oxumdcsqbftxoprmdlug`.

---

## 12. External services & setup

### 12.1 Supabase (DB + Storage)
- **Postgres** via Prisma. Project ref `oxumdcsqbftxoprmdlug`.
- **Free tier auto‑pauses after ~7 days idle.** Symptom: `FATAL: (ENOTFOUND)
  tenant/user … not found`. Fix: open the Supabase dashboard → **Restore/Resume**
  the project (takes 1–5 min). Prevention: the **daily Vercel cron keep‑alive**
  (`vercel.json` → `/api/cron/keepalive` runs `SELECT 1`). Upgrade to Pro ($25/mo)
  only when taking real payments (for automatic backups of invoice/tax data).
- **Storage:** private bucket `invoices`. Create it with `npm run setup:storage`
  (`scripts/setup-storage.ts` → `ensureInvoiceBucket`).

### 12.2 Razorpay
- **Shared MID** (`GTANALYZE SOLUTIONS PRIVATE LIMITED`, MID `SDA0zy6VzG82LI`) with
  sibling projects; RioPoly uses a **dedicated key pair + dedicated webhook**.
  Every order/subscription is tagged `notes.product = "riopoly"` for reconciliation.
- **Webhook URL:** `https://riopoly.gotoanalyze.com/api/webhook/razorpay`.
  Subscribe to: `payment.authorized`, `payment.captured`, `subscription.activated`,
  `subscription.charged`, `subscription.halted`, `subscription.cancelled`,
  `subscription.completed`, `refund.processed`. Secret → `RAZORPAY_WEBHOOK_SECRET`.
- **Plans:** created via `npm run sync:plans`; ids pinned in `lib/plans.ts`.
- **Fee bearer must be “business bears fee”** (not customer). Customer‑bearer
  disables subscriptions (“Invoices disabled because fee bearer is customer”). This
  was resolved by the RM — subscriptions now work. If it regresses, contact Razorpay.
- **Auto‑capture** should be on. The `payment.authorized` webhook is a safety‑net
  for manual‑capture accounts (one‑time only).
- Local webhook testing: expose localhost via `cloudflared` and point a test webhook
  at the tunnel.

### 12.3 Resend (email)
Domain `gotoanalyze.com` is verified (shared from a sibling project). Sends magic‑link
+ invoice emails. `EMAIL_FROM` uses `request@gotoanalyze.com`.

### 12.4 Vercel (hosting) & DNS
- Project `riopoly-billing`; domain `riopoly.gotoanalyze.com` assigned to it.
- Deploy: `vercel --prod --yes`. Build = `prisma generate && next build`.
- Cron (Hobby): daily keep‑alive defined in `vercel.json`.

### 12.5 Formspree
Contact form posts to `https://formspree.io/f/xkoadaqy` (account `request@gotoanalyze.com`).

---

## 13. Operational runbook

All commands from repo root, with NVM loaded.

```bash
# Local dev
npm install
npm run dev                     # http://localhost:3000

# Prisma
npm run prisma:generate         # regenerate client
npm run prisma:migrate          # create/apply a dev migration (uses DIRECT_URL)
npm run prisma:deploy           # apply migrations in prod
npm run prisma:studio           # DB GUI

# Plans & storage (one-time / on catalog change)
npm run sync:plans              # lib/plans.ts -> Razorpay Plans + Plan table
npm run setup:storage           # create the private 'invoices' bucket

# Diagnostics
npm run check:billing           # inspect latest user's billing/entitlements (also a DB health check)
npx tsx scripts/check-rzp.ts    # fetch a Razorpay order/payment status
npx tsx scripts/capture-rzp.ts  # manually capture an authorized payment (order amount!)
npx tsx scripts/probe-pooler.ts # discover Supabase pooler region/host

# Deploy
vercel --prod --yes
bash scripts/push-vercel-env.sh # push .env -> Vercel prod (fixes URLs)

# Tests
npm run test:e2e                                        # local baseURL
E2E_BASE_URL="https://riopoly.gotoanalyze.com" npm run test:e2e   # against prod
E2E_BASE_URL="https://riopoly.gotoanalyze.com" SLOWMO=450 npx tsx scripts/persona-walkthrough.ts  # live headed personas
```

**Common tasks**
- *DB “not found” error* → Supabase project paused → resume in dashboard (§12.1).
- *Subscriptions 502* → check Razorpay fee‑bearer = business (§12.2).
- *Invoice link shows “(generating…)”* → fulfillment async; refresh shortly.
- *Manually grant access* → insert an `Entitlement` row (`source: manual_grant`).

---

## 14. Testing

### 14.1 Playwright E2E (`tests/`, `playwright.config.ts`) — 21 tests
- `auth.setup.ts` — seeds a DB session cookie for `request@gotoanalyze.com`
  (derives cookie name/domain from `E2E_BASE_URL`).
- `public.spec.ts` — public pages + protected routes/APIs return 401 unauth’d.
- `authed.spec.ts` — billing dashboard, invoice download, checkout initiation.
- `api.spec.ts` — orders/subscriptions/invoices endpoints incl. error cases.
- Run: `E2E_BASE_URL="https://riopoly.gotoanalyze.com" npm run test:e2e`.

### 14.2 Live persona walkthrough (`scripts/persona-walkthrough.ts`)
A **headed** (visible) browser drives 5 non‑technical personas (designer, mobile
contractor, agency owner, returning customer, careful buyer) through the whole app,
narrates their thoughts, screenshots each step to `walkthrough/screenshots/`, and
writes triaged findings to `walkthrough/findings.json`. It filters known third‑party
noise (Razorpay test‑mode SDK, WebGL SSAO warnings) and treats the logged‑out
checkout `401` as the expected auth gate. Last full run: **0 bugs / 0 UX issues**.

---

## 15. Key decisions & gotchas

- **Unified single app** (marketing + studio + billing) at one domain; no separate
  billing subdomain.
- **Webhook is the only source of truth for fulfillment** — client checkout handler
  never grants access.
- **Entitlement ledger** pattern; unified `Order`; `Plan` snapshot for FK integrity.
- **GST‑inclusive pricing** with back‑computed tax; **advisory lock** for invoice
  numbering.
- **Static routes need plain `<a>`** in the Next header (not `<Link>`) — `<Link>`
  prefetch to `/` and `/color-studio` caused `_rsc` 404s.
- **PDF uses `Rs.`** not `₹` (font glyph limitation).
- **Supabase free tier pauses**; keep‑alive cron mitigates.
- **No favicon.ico file** — SVG favicon is declared in marketing HTML and app
  metadata (`app/layout.tsx` `icons`).
- **Marketing HQ = Bangalore** (operational office) vs **registered office = Tamil
  Nadu** (legal/GST) — intentional, both correct.
- **No‑refund policy** is disclosed on pricing, billing, and `/terms`; goodwill
  refunds (if ever) are net of gateway fees + revoke access.

---

## 16. Go‑live checklist & known TODOs

1. **Switch Razorpay to LIVE keys** — put `rzp_live_…` `RAZORPAY_KEY_ID/SECRET` and
   matching `NEXT_PUBLIC_RAZORPAY_KEY_ID` in the Vercel prod env; create a **live**
   webhook and set the live `RAZORPAY_WEBHOOK_SECRET`; run `npm run sync:plans` in
   LIVE mode to create live Plans and pin the new `plan_id`s.
2. Do a real ₹ test (small live payment) → confirm capture, entitlement, invoice PDF
   + email, and refund path.
3. Consider **Supabase Pro** once real revenue flows (backups for tax records).
4. Optional: real footer social links; on‑pricing “sign in first” could become a
   pre‑auth button; UptimeRobot for monitoring the keep‑alive endpoint.

---

## 17. Company / legal facts

- **Legal entity:** GTANALYZE SOLUTIONS PRIVATE LIMITED
- **GSTIN:** `33AALCG6598F1Z7` (Tamil Nadu — state code 33)
- **Razorpay MID:** `SDA0zy6VzG82LI` (shared across sibling products)
- **Support / from email:** `request@gotoanalyze.com`
- **WhatsApp / phone:** +91 99444 80052
- **Marketing HQ:** Bangalore, Karnataka · **Registered office (invoices):** Tamil Nadu
- **Invoice series:** `GTA-RIO-YYYY-NNNNN`
```
