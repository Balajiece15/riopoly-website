# RioPoly — Security Posture & Runbook

> Maintained as the authoritative security reference for RioPoly
> (`riopoly.gotoanalyze.com`), operated by GTANALYZE SOLUTIONS PRIVATE LIMITED.
> Companion to `DOCUMENTATION.md`. Last updated: **July 2026**.

---

## 1. Scope & data sensitivity

RioPoly stores and processes:

| Data | Sensitivity | Where |
|---|---|---|
| User email, name, billing state/GSTIN/address | **PII** | `User` table |
| Auth session tokens, verification tokens | **Critical** (account takeover) | `Session`, `VerificationToken`, `Account` |
| Orders, payments, invoices (amounts, GST, invoice PDFs) | **Financial / legal** | `Order`, `Payment`, `Invoice`, Storage |
| 3D projects / scenes | Business content | `Project` |
| **Card / bank details** | Handled entirely by Razorpay | **Never stored by us** |

We are **not** a card data environment — Razorpay Checkout collects and stores all
payment instrument data. We only store Razorpay ids, amounts, and status.

---

## 2. Security controls in place

### 2.1 Secrets management
- All secrets live in `.env` (local) and the **Vercel encrypted env store** (prod).
- `.gitignore` blocks `.env*` (except `.env.example`), `CREDENTIALS*.md`, `*.pem`.
  Verified: no secret files are tracked in git.
- `.env.example` holds **placeholders only**.
- Server-only secrets are never imported into client (`'use client'`) modules:
  - `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` → `lib/razorpay.ts`,
    webhook route (server only).
  - `SUPABASE_SERVICE_ROLE_KEY` → `lib/storage.ts` (server only; bypasses RLS).
  - Only `NEXT_PUBLIC_RAZORPAY_KEY_ID` (publishable) is client-exposed.

### 2.2 Database — Row-Level Security (RLS)  ← primary control
- Supabase exposes a **public PostgREST API** over the `public` schema, gated only
  by RLS + the anon key. **RLS is enabled on every public table with no permissive
  policies**, so anon/PostgREST access is fully denied.
- The app is unaffected because it accesses the DB only via **Prisma as the
  table-owner `postgres` role** and **Storage via the service-role key** — both
  **bypass RLS** by design.
- **Automated & self-healing:** `/api/cron/security-check` runs **daily** (Vercel
  Cron) and re-enables RLS on any table missing it — so a table added by a future
  migration cannot stay publicly exposed for more than ~24h. Manual/immediate pass:
  `npx tsx scripts/enable-rls.ts`. Shared logic: `lib/security.ts`.
- **Verified:** anon REST calls to `User`/`Session`/`Invoice`/`Order` return `0 rows`.

### 2.3 Authentication & sessions
- NextAuth (`lib/auth.ts`) with **email magic-link** (15-min expiry) and
  **database-backed sessions**. No passwords stored.
- Session cookie is `httpOnly`, `secure` (prod `__Secure-` prefix), `SameSite=Lax`.
- Server code authorizes via `getSessionUser()` (`lib/session.ts`); protected
  pages/APIs return `401`/redirect when unauthenticated.

### 2.4 Payments & webhook integrity
- `POST /api/webhook/razorpay` verifies `x-razorpay-signature` with
  **HMAC-SHA256** over the **raw body**, **timing-safe** (`crypto.timingSafeEqual`).
  Bad/missing signature → `401`.
- **Idempotent:** each event is claimed by unique `x-razorpay-event-id` in
  `WebhookEvent`; duplicates are no-ops. Failures return `500` so Razorpay retries.
- Fulfillment (entitlements + invoice) happens **only** in the verified webhook,
  never from the browser checkout callback.

### 2.5 Invoices & storage
- Invoice PDFs live in a **private** Supabase Storage bucket (`invoices`).
- Download via `/api/invoices/[id]` requires auth **and ownership check**, then
  issues a **300-second signed URL**. No public/object listing.

### 2.6 HTTP & transport
- Security headers (all paths, `next.config.mjs`): `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- HTTPS everywhere (Vercel + `gotoanalyze.com`).
- Cron endpoints accept an optional `CRON_SECRET` bearer check.

---

## 3. Automated proactive controls (cron)

| Cron | Schedule | Purpose |
|---|---|---|
| `/api/cron/keepalive` | daily 06:00 UTC | `SELECT 1` — prevents Supabase free-tier auto-pause |
| `/api/cron/security-check` | daily 07:00 UTC | **Self-heals RLS** on all public tables; logs any fix |

Both honor `CRON_SECRET` when set (Vercel auto-sends it on cron invocations).
`security-check` only ever *enables* RLS (hardening only — cannot leak or destroy
data), so it is safe even if triggered manually.

---

## 4. Secret inventory & rotation

| Secret | Exposure risk | How to rotate |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | **High** (full DB, bypasses RLS) | Supabase → Settings → API → roll `service_role` → update `.env` + Vercel |
| `RAZORPAY_KEY_SECRET` | High (create charges/refunds) | Razorpay → API Keys → regenerate → update env; re-verify webhook |
| `RAZORPAY_WEBHOOK_SECRET` | Medium (forge webhooks) | Razorpay → Webhooks → edit secret → update `RAZORPAY_WEBHOOK_SECRET` |
| `NEXTAUTH_SECRET` | High (forge sessions) | `openssl rand -base64 32` → update env (invalidates existing sessions) |
| `RESEND_API_KEY` | Medium (send email as us) | Resend dashboard → roll key → update env |
| `SUPABASE_ANON_KEY` | **Low while RLS is on** (publishable) | Roll only if abused; safe to be public with RLS |
| `CRON_SECRET` | Low | `openssl rand -hex 32` → update env |

Push updated env to prod: `bash scripts/push-vercel-env.sh` (or set in Vercel UI),
then redeploy.

> **Action item:** the `SUPABASE_SERVICE_ROLE_KEY` was pasted into a chat earlier.
> It is server-only and RLS-independent, so rotating it is recommended hygiene.

---

## 5. Incident response runbook

1. **Suspected key leak** → rotate the affected secret (§4) immediately; redeploy.
   For `NEXTAUTH_SECRET`, rotating also logs everyone out (expected).
2. **Suspected DB exposure** → run `npx tsx scripts/enable-rls.ts` and confirm anon
   REST returns 0 rows (see §7). Review Supabase logs.
3. **Fraudulent/duplicate charges** → inspect `WebhookEvent`, `Payment`, `Order`
   (`npm run check:billing`, `scripts/check-rzp.ts`); refunds flow through
   `refund.processed` (auto-revokes entitlements).
4. **Data integrity** → on Supabase Pro, restore from PITR backup. (Free tier has
   no automatic backups — see §6.)

---

## 6. Recommended hardening / backlog

- [ ] **Rotate the Supabase service-role key** (was exposed in chat) — §4.
- [ ] **Set `CRON_SECRET`** in Vercel to lock the cron endpoints.
- [ ] **Supabase Pro** once real payments flow → automatic daily backups of
      financial/tax records.
- [ ] Optional: **disable the Supabase Data API** (PostgREST) entirely — we never
      use it; RLS already closes it, this is belt-and-suspenders.
- [ ] Consider rate-limiting on `/api/*` (e.g. Vercel/Upstash) before scale.
- [ ] Add a Content-Security-Policy header once the third-party origins
      (Razorpay, fonts, CDNs) are enumerated.

---

## 7. How to audit (verification)

```bash
# 1) Every public table has RLS enabled (self-heals if not):
npx tsx scripts/enable-rls.ts

# 2) Anon REST API returns NO data (attacker's view) — expect "0 rows":
npx tsx -e "import('dotenv/config').then(async()=>{const u=process.env.SUPABASE_URL,k=process.env.SUPABASE_ANON_KEY;for(const t of ['User','Session','Invoice','Order']){const r=await fetch(u+'/rest/v1/'+t+'?select=*&limit=5',{headers:{apikey:k,Authorization:'Bearer '+k}});const j=await r.json();console.log(t,r.status,Array.isArray(j)?j.length+' rows':j.message)}})"

# 3) No secrets tracked in git:
git ls-files | grep -Ei '\.env($|\.)[^e]|credential|\.pem' || echo "clean"

# 4) Daily security cron is healthy (checked/fixed counts):
curl -s https://riopoly.gotoanalyze.com/api/cron/security-check
```
