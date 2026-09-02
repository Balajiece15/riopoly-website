# RioPoly — Responsive & Readability Validation Report

**Date:** Sep 2026 · **Target:** `https://riopoly.gotoanalyze.com` (live production)
**Method:** Automated Playwright harness (`scripts/responsive-audit.ts`) — 5 viewports ×
7 routes, full‑length screenshots + measurements (horizontal overflow, axe‑core
color‑contrast/serious a11y, text < 11px, tap targets < 40px), plus interactive
states (mobile menu, studio enter/tabs/drawer). Authed `/billing` tested with a
seeded NextAuth session. **Screenshots were opened and reviewed, not just measured.**

Viewports: phone 402×874 (touch) · tablet‑portrait 820×1180 (touch) ·
tablet‑landscape 1194×834 (touch) · laptop 1440×900 · ultrawide 3440×1440.

Artifacts: `audit/baseline/` (before), `audit/fixed/` + `audit/final/` (after),
`audit/*/report.json` (raw metrics + offending selectors + screenshots).

---

## 1. Headline result

| Metric (across all 5 viewports × 7 routes) | Baseline | After |
|---|---|---|
| **Horizontal overflow** | `/login` 6px (email input) | **0px everywhere** |
| **Color‑contrast violations (axe WCAG AA)** | pricing 9, billing 3, terms 2, privacy 2 (16 total) | **0 everywhere** |
| **Text < 11px — app pages** | 0 | 0 |
| **Text < 11px — studio** | 16 (splash) / 77 (in‑studio) / 36 | 14 (minimap schematic labels only — documented) |
| **Tap targets < 40px — app pages** | pricing 14, billing 9, login 5, terms 7, privacy 6 | pricing 2, terms 2 (inline body links, WCAG‑exempt); login **0** |
| **Tap targets — marketing home (phone)** | 30 | 5 (near‑40 footer social icons) |
| **3D studio on phone** | 360px panel covered the screen → **canvas was a ~42px sliver** | **Full‑width canvas + slide‑in drawer + "⚙ Controls" toggle + ✕ close** |

---

## 2. What was fixed (by requirement)

1. **No horizontal overflow @ 360–402px** — added `overflow-x: clip` guard on
   `html, body` *and* fixed the offender: global `box-sizing: border-box`
   (the login `<input>` was content‑box, overflowing 6px). `app/globals.css`.
2. **Mobile‑first grids** — pricing/one‑time grids already use
   `repeat(auto-fit, minmax(240px,1fr))` (single column on phone). ✔ verified.
3. **Tables** — billing order history already wrapped in `overflow-x:auto` with a
   real table; renders fine at 402px. ✔ verified.
4. **Two‑pane stacking** — the studio's fixed 360px side panel now becomes a
   full‑height **drawer** on phones (`App.tsx` + `useIsMobile`), canvas full‑width.
5. **Fixed panels cap to viewport** — studio drawer width `min(360px, 92vw)`.
6. **Toolbars wrap / scroll** — app header nav is a hidden‑scrollbar strip
   (`.site-header nav { overflow-x:auto }`).
7. **Hide desktop‑only hints on touch** — studio Controls show Tap/Drag/Pinch on
   touch instead of Click/Scroll/WASD (`UIPanel`, `useIsTouch`).
8. **Canvas resize** — R3F `<Canvas>` auto‑resizes via its ResizeObserver; the
   container now goes full‑width on mobile so it no longer renders into a 42px box.
9. **Readability** — muted `#64748b` (failed AA) → `#9fb0c9`; checkout button
   `#6366f1` (4.46:1, just under AA) → `#4f46e5`; header made opaque; studio inline
   fonts floored to 11px; **inputs 16px on mobile** (app `globals.css` + studio
   media query) to stop iOS zoom; **safe‑area insets** via `viewport-fit=cover` +
   `env(safe-area-inset-*)`.
10. **Large screens** — capped content is centered (`margin: 0 auto`); verified no
    left‑hug at 3440px; full‑bleed studio canvas stays full width.
11. **Device‑adaptive nav** — desktop: full sidebar; phone: canvas + Controls
    drawer. App header collapses padding/gaps < 480px.
12. **Unverifiable claims** — see §4 (flagged for owner, not unilaterally changed).

---

## 3. Per‑viewport × route matrix (final, live)

`OK` = overflow 0 & contrast 0. Studio in‑studio text = minimap schematic labels.

| Route | phone 402 | tab‑port 820 | tab‑land 1194 | laptop 1440 | ultra 3440 |
|---|---|---|---|---|---|
| `/` (marketing) | OK | OK | OK | OK | OK |
| `/pricing` | OK | OK | OK | OK | OK |
| `/billing` (authed) | OK | OK | OK | OK | OK |
| `/login` | OK (was 6px) | OK | OK | OK | OK |
| `/terms` | OK | OK | OK | OK | OK |
| `/privacy` | OK | OK | OK | OK | OK |
| `/color-studio` | OK · drawer | OK | OK | OK | OK |

Interactive states verified: marketing mobile menu (opens, no overflow); studio
**drawer open** on phone (overflow 0, ✕ close works, canvas behind); studio tab
switches. Screenshots in `audit/final/` and `audit/fixed/`.

---

## 4. Remaining / documented exceptions (precise)

- **Inline body links** (e.g. "Terms & Refund Policy", "billing dashboard", the
  support email) measure < 40px tall. These are links *inside sentences* and are
  intentionally exempt (WCAG 2.5.8 Target Size AA exempts inline links). Standalone
  controls (buttons, CTAs, nav, hamburger, "Back to home") are all ≥ 40px (hamburger 44).
- **Studio minimap labels** (room names / dimensions) render at ~7.5–9px. This is a
  dense floor‑plan *schematic* (like map labels); a hard 11px floor would overflow
  the tiny room rectangles. Bumped from 5.5–7px for legibility; documented as an
  intentional exception. All other studio text is ≥ 11px.
- **Studio control‑panel list rows** (theme rows) are ~36px tall — above the WCAG AA
  minimum (24px); primary controls (Controls FAB, tabs, buttons, dropdown) are ≥ 40px.
- **Marketing footer social icons** are 36×40 (WCAG‑compliant); one footer CTA 336×36.
- **⚠ Owner decision needed (requirement #12):** the marketing hero stats
  ("500+ Colours & Materials", "25+ Scene Templates", "10× Faster") are unverifiable
  marketing figures. Not changed unilaterally — please confirm or I'll soften them to
  qualitative claims.

---

## 5. Not covered / caveats

- Local `next dev`/`next build` hung in this environment (host memory pressure from
  other apps), so validation ran against **live production** after each `vercel --prod`
  deploy — i.e. the real deployed result. Vercel's cloud build also gated correctness.
- Headless WebGL uses SwiftShader (CPU); the studio's first 3D frame can lag in a
  screenshot, but layout/overflow/DOM measurements are accurate regardless.
- Payment (Razorpay) and magic‑link email were not re‑exercised here (out of scope
  for the responsive pass).

## 6. How to re‑run

```bash
BASE=https://riopoly.gotoanalyze.com TAG=check npx tsx scripts/responsive-audit.ts
# report + screenshots → audit/check/
```
