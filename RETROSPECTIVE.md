# RioPoly — Engineering Retrospective: My Mistakes, Learnings & Best Practices

> An honest, self-authored record of the errors and hallucinations I (the AI
> agent) made while building RioPoly, the root-cause patterns behind them, and
> the durable best practices they produced. Kept so the same mistakes are not
> repeated in future sessions. Companion to `AGENTS.md`, `DOCUMENTATION.md`,
> `SECURITY.md`. Last updated: **Aug 2026**.

---

## Why this document exists

The owner relies on Cursor for end-to-end development and asked for a transparent
account of every mistake made so far, plus the learnings. Documenting failures is
how the project gets *more* reliable over time, not less. Each entry is: **what I
got wrong → how it surfaced → the fix → the lesson**.

---

## 1. Errors & hallucinations I created (by category)

### A. Dependency / tooling hallucinations (assumed things worked without verifying)
| # | Mistake | How it surfaced | Fix | Lesson |
|---|---|---|---|---|
| A1 | Ran a `tsx` script using JSX without importing React | `React is not defined` | `import React` in `lib/invoice-pdf.tsx` | `tsx` uses the classic JSX runtime — needs an explicit React import outside Next's build. |
| A2 | Assumed `@react-pdf/renderer` transitive deps resolve automatically | `Cannot find module 'emoji-regex-xs'` | `npm i emoji-regex-xs` | `tsx`'s loader doesn't always resolve transitive deps; install them explicitly. |
| A3 | Same as A2 for `yoga-layout/load` | `Cannot find module 'yoga-layout/load'` | `npm i yoga-layout` | Confirm peer/transitive deps rather than assuming. |
| A4 | Assumed the PDF font could render `₹` | Rupee glyph rendered blank | Use `Rs.` text in PDFs | Standard PDF fonts (Helvetica) lack the ₹ glyph. Verify glyph coverage. |

### B. Build / environment misconfigurations
| # | Mistake | How it surfaced | Fix | Lesson |
|---|---|---|---|---|
| B1 | Instantiated `Resend` at module top-level | `Missing API key` broke `next build` | Lazy-instantiate inside the send function | Never construct clients needing secrets at import time; build has no secrets. |
| B2 | Ran `next build` while `next dev` was active | `/pricing` served 404s (corrupted `.next`) | Kill dev, clear `.next`, restart | Don't build and dev against the same `.next` simultaneously. |
| B3 | Built a Postgres URL without URL-encoding the password | Connection parse failures (`$` in password) | URL-encode (`$` → `%24`) | Special chars in connection strings must be percent-encoded. |
| B4 | Assumed Supabase direct connection works on Vercel | IPv6-only host unreachable from serverless | Use the IPv4 **pooler** URL (`:6543`) | Vercel serverless needs Supabase's pooled connection, not the direct host. |
| B5 | `StrReplace` on a non-unique placeholder (`rzp_test_REPLACE_ME`) | Edit failed — multiple matches | Target each line with more context | Make `old_string` unique; provide surrounding context. |

### C. Payments / Razorpay
| # | Mistake | How it surfaced | Fix | Lesson |
|---|---|---|---|---|
| C1 | Assumed payments auto-capture | Payment `authorized` but never `captured`; entitlement never granted | Added a `payment.authorized` safety-net capture; advised enabling auto-capture | Razorpay accounts can be on manual capture; handle it. |
| C2 | `capture-rzp.ts` captured the fee-inflated amount | Capture rejected/incorrect | Capture the **order amount**; Razorpay adds fee on top | Capture the order amount, not the customer-facing inflated total. |
| C3 | Didn't anticipate fee-bearer=customer blocking subscriptions | `BAD_REQUEST_ERROR: invoices disabled because fee bearer is customer` | Had owner switch to business-bears-fee via RM | Razorpay subscriptions require business-bears-fee. |
| C4 | Endpoints returned empty 500s on Razorpay failure | `Unexpected end of JSON input` in the client | Wrapped Razorpay calls in try/catch → clean JSON 502 | Always return structured JSON errors; never empty 500s. |

### D. Security (things that should have been on from day one)
| # | Mistake | How it surfaced | Fix | Lesson |
|---|---|---|---|---|
| D1 | Prisma-created tables had **no RLS** | Supabase alert: public tables readable via PostgREST | Enabled RLS on all tables + daily self-healing cron | Supabase exposes a public API over `public`; RLS must be ON always. |
| D2 | A service-role key was pasted into chat | (Owner-visible) exposure risk | Rotated to a scoped `sb_secret` key; disabled legacy JWT keys | Never surface secrets in chat; use the scratch-file hand-off. |

### E. Testing false-positives I created (the harness was wrong, not the app)
| # | Mistake | How it surfaced | Fix | Lesson |
|---|---|---|---|---|
| E1 | Persona test checked for `<canvas>` **before** choosing a studio workspace | False "3D Studio shows no canvas" bug | Choose a workspace first, then assert | Model the real user flow; don't assert before the UI is ready. |
| E2 | Used over-strict locators → false "no logo/Home link" | False UX bug on billing | Assert `header a[href="/"]` directly | Precise, intent-matching locators; avoid brittle role/name guesses. |
| E3 | Read a screenshot taken before a sticky header painted | Thought the header was missing | Verify in DOM, not just a screenshot | Screenshots can race rendering; confirm against the DOM. |
| E4 | Confused run-1 vs run-2 screenshots (numbering shifted) | Misread an old Razorpay screenshot | Re-check file timestamps / re-run | Don't cross-reference stale artifacts across runs. |
| E5 | Strict-mode locator matched 2 elements (`#mobile-menu a[href="#contact"]`) | Flow interrupted | Add `.first()` / disambiguate | Playwright strict mode fails on multiple matches. |
| E6 | Form probe tested native `checkValidity()` but the real check was in JS | Misreported which emails were blocked | Rewrote to unit-test the validator + a real submit | Test the actual validation path, not a proxy for it. |

### F. Regressions I introduced (then fixed)
| # | Mistake | How it surfaced | Fix | Lesson |
|---|---|---|---|---|
| F1 | New shared header used `<Link>` to static routes `/` and `/color-studio` | `_rsc` prefetch 404s in the console | Use plain `<a>` for static-rewrite routes | Next `<Link>` prefetches RSC; static rewrites 404 on that. |
| F2 | Marketing JS/comments still said "Miracle Paints" after rebrand | Stale branding | Renamed to RioPoly | Grep for old brand names after a rebrand. |

### G. This session (Aug 2026) — iteration mistakes
| # | Mistake | How it surfaced | Fix | Lesson |
|---|---|---|---|---|
| G1 | First email regex still accepted `a@b` and unbounded length | Form probe caught it | Require dotted TLD + 254 cap | Native `type=email` is lax; validate stricter server+client. |
| G2 | Second regex still accepted `<script>...@x.com` | Form probe caught it | Restrict local-part charset (RFC dot-atom) | Iterate validators against an adversarial matrix. |
| G3 | Malformed tool call (`notify_on_output` given a string) | Tool error | Re-issued correctly | Match tool schemas exactly. |
| G4 | E2E "fails gracefully" test only accepted the fee-bearer message | Test red on a *different* graceful failure (dead keys) | Accept any clean JSON 502/409 | Assert the *contract* (graceful JSON error), not one specific message. |

---

## 2. Root-cause patterns (the "why" behind the mistakes)

1. **Assuming instead of verifying** (A1–A4, C1) — I assumed a library/behavior worked. *Countermeasure: verify APIs/behaviors before relying on them (read the installed type defs, run a probe).*
2. **Not modeling the real user flow** (E1, E6) — tests asserted state before the UI/logic reached it. *Countermeasure: script the exact human sequence.*
3. **Brittle assertions** (E2–E5, G4) — over-specific locators/messages. *Countermeasure: assert intent/contract, not incidental detail.*
4. **Conflating code bugs with environment issues** (C3, D1, dead keys, paused DB) — a red test looked like a code bug when it was config. *Countermeasure: classify findings as code vs environment; skip/annotate env issues.*
5. **Secrets hygiene lapses** (D2) — convenient but risky. *Countermeasure: never echo secrets; use the scratch-file hand-off; rotate if exposed.*

---

## 3. Best practices established (the durable rules)

These are now encoded in `AGENTS.md` / `.cursor/rules/riopoly.mdc` and enforced in code/tests:

**Architecture & payments**
- The **Razorpay webhook is the only source of truth for fulfillment** — never grant access from the browser callback.
- **Entitlement ledger**: access is derived from `Entitlement` rows, never a `User` flag.
- **Unified `Order`** row for one-time + subscription cycles; **`lib/plans.ts` is the only price source**; money is **integer paise**.
- **Webhook idempotency** via `x-razorpay-event-id`; **HMAC-SHA256** signature verification; return **500 to trigger retry**, **clean JSON errors** otherwise (never empty 500s).
- **GST-inclusive** pricing back-computed; invoice numbers serialized with a **Postgres advisory lock**.

**Security**
- **RLS on every public table**, kept on by a **daily self-healing cron**; re-run `scripts/enable-rls.ts` after adding tables.
- **Never commit secrets**; only `.env.example` (placeholders). Hand secrets over via a git-ignored scratch file, never chat. Rotate anything exposed.
- **Server secrets never enter `'use client'` modules.**
- **Cron endpoints gated by `CRON_SECRET`.**

**Framework specifics**
- **Static-rewrite routes (`/`, `/color-studio`) use plain `<a>`**, not `<Link>` (avoids RSC-prefetch 404s).
- **Lazy-instantiate** clients that need secrets (Resend) so `next build` doesn't need them.
- **Vercel + Supabase** → use the **pooler** connection URL; percent-encode passwords.
- Auth is **server-side (`getServerSession`)**; the client `SessionProvider` polling is disabled since nothing uses `useSession`.

**Validation & robustness**
- Validate **stricter than `type=email`** (dotted TLD, length cap, safe charset), on **both client and server**.
- Every API endpoint must handle **dirty/adversarial/unauthorized input** with a clean status (400/401/404), never a 500 or data leak. Verified by `scripts/edge-probe.ts` (61 checks) and `scripts/form-probe.ts`.

**Testing discipline**
- Keep durable harnesses: **`scripts/persona-walkthrough.ts`** (5 non-technical personas, headed), **`scripts/edge-probe.ts`** (adversarial API), **`scripts/form-probe.ts`** (dirty-data forms), plus the Playwright suite.
- **Model the real user flow**; use **precise locators**; **assert the contract**, not one message.
- **Distinguish code bugs from environment blockers** — tests `test.skip()` with a clear reason when Razorpay keys are invalid, so red = our bug, skip = fix the credential.

---

## 4. Anti-hallucination protocol (self-imposed)

Before using an external/library API I'm not 100% sure of:
1. **Read the installed type definitions** (e.g., confirmed `normalizeIdentifier` in `next-auth/providers/email.d.ts` before using it).
2. **Run a tiny probe** against the real service (e.g., tested the new Supabase key with an upload before wiring it in).
3. **Verify env/credentials are live** before blaming code (a 401 from Razorpay or `ENOTFOUND` from Postgres is an *environment* signal).
4. **Re-run after every fix**; never claim "fixed" without a green check.
5. **Prefer verifiable facts over confident guesses**; when unsure, say so and check.

---

## 5. Current known non-code blocker (Aug 2026)

- **Razorpay TEST keys are invalid/expired** (`401 Authentication failed` from both prod and local). This breaks *checkout only*; our code handles it gracefully (clean 502, tests skip with a clear reason). **Resolution (owner action):** regenerate test keys in the Razorpay dashboard → update `.env` + Vercel → redeploy → run `npm run sync:plans`. Not a code defect.

Everything else — marketing site, 3D studio, navigation, forms (with dirty data), login/auth, billing dashboard, invoices, terms/privacy, security controls — is verified working end-to-end (0 code bugs across the persona walkthrough, 19/19 applicable E2E tests, 61/61 edge-probe checks, 24/24 form-probe checks).
