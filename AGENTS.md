# AGENTS.md — RioPoly (start here)

> Auto-loaded orientation for any AI agent / new chat. **Read this first, then
> read `DOCUMENTATION.md` (full system reference) and `SECURITY.md` (security
> posture) before doing non-trivial work.** Keep all three current when you change
> the system — the owner relies on Cursor for end-to-end development and must not
> lose context between chats.

## What this is
**RioPoly** — a B2B SaaS 3D paint-visualization & proposal platform.
*Visualize. Propose. Close.* One **unified Next.js 14 (App Router)** app serves the
marketing site + 3D studio + billing/auth, deployed at **`https://riopoly.gotoanalyze.com`**.
Operator: **GTANALYZE SOLUTIONS PRIVATE LIMITED** (GSTIN `33AALCG6598F1Z7`, Tamil Nadu).

## Documentation map (the source of truth)
| File | Contents |
|---|---|
| **`AGENTS.md`** (this) | Orientation + golden rules + quick commands |
| **`DOCUMENTATION.md`** | Full end-to-end reference: product, architecture, data model, billing engine, GST, env vars, services, runbook, testing, change log |
| **`SECURITY.md`** | Data classification, controls, automated defenses, secret rotation, incident runbook, audit steps |
| **`RETROSPECTIVE.md`** | Honest catalog of past agent mistakes/hallucinations + the best practices they established. Read before repeating past patterns. |

The older root `*.md` files (`PROJECT_SUMMARY.md`, `HERO_*`, `TRUST_*`,
`VALIDATION_REPORT.md`, `TEST_INSTRUCTIONS.md`) are **legacy scratch notes** — ignore
for authority; the three files above win.

## Current status (Jul 2026)
- Marketing + 3D studio + billing all **live** at `riopoly.gotoanalyze.com`.
- One-time **and** subscription payments **working** (Razorpay fee-bearer fixed).
- Razorpay still on **TEST keys** — going live is a deliberate step (see `DOCUMENTATION.md` §16).
- DB: Supabase **free tier** + daily keep-alive cron (prevents auto-pause).
- Security: RLS on all tables + daily self-healing cron; `CRON_SECRET` set; migrated
  to new Supabase `sb_secret` key and disabled the old leaked legacy JWT keys.

## Golden rules (do not violate)
1. **Never commit secrets.** `.env*` are git-ignored; only `.env.example` (placeholders) is tracked. Never paste real secrets into files that get committed.
2. **The Razorpay webhook is the ONLY source of truth for fulfillment** — never grant entitlements from the browser/checkout callback.
3. **RLS must stay ON for every public table.** After a migration that adds a table, run `npx tsx scripts/enable-rls.ts` (the daily `security-check` cron also self-heals).
4. **`lib/plans.ts` is the single source of truth for SKUs/prices.** Never hardcode prices in routes. Run `npm run sync:plans` after changing subscription SKUs.
5. **Server secrets never enter client (`'use client'`) modules** — `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` stay server-only.
6. **Amounts are integer paise; prices are GST-inclusive.**
7. **Only commit/push when the user asks.** Deploys go out via `vercel --prod --yes` (CLI, decoupled from git).
8. **`/`, `/color-studio` are static rewrites — link to them with plain `<a>`, not `<Link>`** (avoids RSC-prefetch 404s).

## First-run / resume (details in `DOCUMENTATION.md` §3)
```bash
nvm use            # Node 20+
npm install
npm run prisma:generate
npm run check:billing   # DB health check (also detects a paused Supabase project)
npm run dev             # http://localhost:3000
# Deploy: vercel --prod --yes
# E2E:    E2E_BASE_URL="https://riopoly.gotoanalyze.com" npm run test:e2e
```
If DB calls fail with `FATAL: (ENOTFOUND) tenant/user … not found`, the Supabase
project is **paused** → restore it in the Supabase dashboard.

## Key facts
- Vercel project `riopoly-billing`; GitHub `Balajiece15/riopoly-website` (branch `main`).
- Supabase project ref `oxumdcsqbftxoprmdlug`. Contact/email `request@gotoanalyze.com`. WhatsApp/phone `+91 99444 80052`.
- Invoice series `GTA-RIO-YYYY-NNNNN`. Formspree form `xkoadaqy`.
