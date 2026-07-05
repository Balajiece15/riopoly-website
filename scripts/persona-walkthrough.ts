/*
 * Live, headed persona walkthrough of the whole RioPoly app.
 * Runs a real (visible) browser, mimics several NON-TECHNICAL users, narrates
 * their thoughts, screenshots each step, auto-captures console/network errors,
 * and writes a triaged findings report to ./walkthrough/findings.json.
 *
 * Run:  E2E_BASE_URL="https://riopoly.gotoanalyze.com" npx tsx scripts/persona-walkthrough.ts
 */
import { chromium, devices, type Page, type BrowserContext } from '@playwright/test';
import 'dotenv/config';
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';

const BASE = process.env.E2E_BASE_URL || 'https://riopoly.gotoanalyze.com';
const { protocol, hostname } = new URL(BASE);
const IS_HTTPS = protocol === 'https:';
const COOKIE_NAME = IS_HTTPS ? '__Secure-next-auth.session-token' : 'next-auth.session-token';
const SLOWMO = Number(process.env.SLOWMO || 450);

const OUT = path.join(process.cwd(), 'walkthrough');
const SHOTS = path.join(OUT, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

type Severity = 'bug' | 'ux' | 'note';
type Finding = { persona: string; where: string; severity: Severity; title: string; detail?: string };
const findings: Finding[] = [];

function record(f: Finding) {
  findings.push(f);
  const icon = f.severity === 'bug' ? '🐞' : f.severity === 'ux' ? '⚠️ ' : '💬';
  console.log(`   ${icon} [${f.severity}] ${f.title}${f.detail ? ' — ' + f.detail : ''}`);
}

let shotN = 0;
async function shot(page: Page, name: string) {
  shotN++;
  const file = path.join(SHOTS, `${String(shotN).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file }).catch(() => {});
}

function say(persona: string, thought: string) {
  console.log(`\n👤 ${persona}: "${thought}"`);
}
function step(msg: string) {
  console.log(`   → ${msg}`);
}

// Ignore known-harmless third-party noise so findings stay meaningful:
// Tailwind CDN, React devtools, favicon, Razorpay's own test-mode SDK chatter
// (analytics beacons / fingerprinting / websockets that don't connect), and the
// WebGL post-processing (SSAO) warnings emitted by the 3D studio bundle.
const NOISE = /tailwindcss\.com|React DevTools|favicon|razorpay|ERR_CONNECTION_REFUSED|Permissions policy|unsafe header|NormalPass|SSAO|x-rtb-fingerprint|request-id|status of 401/i;

function monitor(page: Page, persona: string) {
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const t = m.text();
      if (!NOISE.test(t)) record({ persona, where: page.url(), severity: 'bug', title: 'Console error', detail: t.slice(0, 160) });
    }
  });
  page.on('pageerror', (e) => record({ persona, where: page.url(), severity: 'bug', title: 'Uncaught JS error', detail: String(e.message).slice(0, 160) }));
  page.on('response', (r) => {
    const u = r.url();
    const s = r.status();
    // 401/403 on checkout endpoints is the EXPECTED auth gate for logged-out users.
    const authGate = (s === 401 || s === 403) && /\/api\/(orders|subscriptions)\//.test(u);
    if (s >= 400 && !authGate && u.includes(hostname) && !/\.map(\?|$)/.test(u)) {
      record({ persona, where: 'network', severity: s >= 500 ? 'bug' : 'ux', title: `HTTP ${s}`, detail: u.replace(BASE, '') || '/' });
    }
  });
}

async function href(page: Page, name: string | RegExp): Promise<string | null> {
  const link = page.getByRole('link', { name }).first();
  if (!(await link.count())) return null;
  return link.getAttribute('href');
}

async function main() {
  console.log(`\n=== RioPoly live persona walkthrough ===\nTarget: ${BASE}\n`);

  // Seed an authenticated DB session for the "returning customer" persona.
  const user = await prisma.user.findUnique({ where: { email: 'request@gotoanalyze.com' } });
  const sessionToken = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 3600 * 1000);
  await prisma.session.create({ data: { sessionToken, userId: user!.id, expires } });
  const authCookie = {
    name: COOKIE_NAME, value: sessionToken, domain: hostname, path: '/',
    expires: Math.floor(expires.getTime() / 1000), httpOnly: true, secure: IS_HTTPS, sameSite: 'Lax' as const,
  };

  const browser = await chromium.launch({ headless: false, slowMo: SLOWMO });

  // ─────────────────────────────────────────────────────────
  // PERSONA 1 — Priya, interior designer, not techy. Desktop.
  // Goal: "Is this the paint-visualizer tool? Let me try it and see the price."
  // ─────────────────────────────────────────────────────────
  {
    const persona = 'Priya (interior designer)';
    console.log(`\n────────── ${persona} ──────────`);
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 850 } });
    const page = await ctx.newPage();
    monitor(page, persona);
    try {
      say(persona, "Let me open the website and see what this is.");
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: /Visualize\. Propose\./i }).first().waitFor({ timeout: 15000 });
      await page.waitForTimeout(1500);
      await shot(page, 'priya-home');
      say(persona, "Nice hero. The big button says 'Launch 3D Studio' — I'll click that in a bit. First, does the menu work?");

      step("Trying the Platform capability tabs (Create / Present & Close)");
      const presentTab = page.getByRole('button', { name: /Present & Close/i });
      if (await presentTab.count()) { await presentTab.click(); await page.waitForTimeout(1200); await shot(page, 'priya-tab-present'); }
      else record({ persona, where: '/', severity: 'note', title: "Couldn't find 'Present & Close' tab" });

      step("Scrolling to the Use Cases gallery");
      await page.locator('#gallery').scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await page.locator('.gallery-item').first().hover().catch(() => {});
      await shot(page, 'priya-gallery');

      step("Checking the footer links a curious user would click");
      await page.locator('footer').scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      const termsHref = await href(page, 'Terms of Use');
      const privacyHref = await href(page, 'Privacy Policy');
      if (termsHref === '#' || termsHref === null) record({ persona, where: 'footer', severity: 'bug', title: "'Terms of Use' footer link is dead (href='#')", detail: 'A /terms page exists but the footer does not link to it.' });
      if (privacyHref === '#' || privacyHref === null) record({ persona, where: 'footer', severity: 'bug', title: "'Privacy Policy' footer link is dead (href='#')", detail: 'No privacy page exists.' });
      await shot(page, 'priya-footer');

      say(persona, "Okay, let me actually launch the 3D Studio.");
      step("Clicking hero 'Launch 3D Studio'");
      await page.getByRole('link', { name: /Launch 3D Studio/i }).first().click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2500);
      await shot(page, 'priya-studio-chooser');
      say(persona, "It asks which workspace I am. I'm a designer — I'll pick that.");
      step("Choosing the 'Interior Designer' workspace");
      await page.getByText('Interior Designer', { exact: false }).first().click().catch(() => {});
      await page.waitForTimeout(8000); // let WebGL scene initialize
      await shot(page, 'priya-studio-scene');
      const canvases = await page.locator('canvas').count();
      if (canvases === 0) record({ persona, where: '/color-studio', severity: 'bug', title: '3D Studio scene shows no <canvas>', detail: 'Scene failed to load after choosing a workspace.' });
      else { say(persona, "I can see the 3D room with paint themes. This is the fun part."); }

      say(persona, "How much does it cost? Let me find pricing.");
      step("Navigating to /pricing");
      await page.goto(`${BASE}/pricing`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      await shot(page, 'priya-pricing');
      // Is there site chrome (header with logo → home) on the pricing page?
      const hasHeader = (await page.locator('header a[href="/"]').count()) > 0;
      if (!hasHeader) record({ persona, where: '/pricing', severity: 'ux', title: 'No logo / Home link on pricing page', detail: 'Jarring jump from the polished marketing site to a bare page with no way back.' });
      const backBilling = await href(page, /Back to billing/i);
      if (backBilling) record({ persona, where: '/pricing', severity: 'ux', title: "'← Back to billing' confuses first-time visitors", detail: 'A new visitor from the marketing site was never on billing; clicking it forces a login.' });
      const planCards = await page.getByRole('heading', { level: 3 }).count();
      step(`Saw ${planCards} plan cards`);
      if (planCards < 4) record({ persona, where: '/pricing', severity: 'bug', title: `Only ${planCards} plans rendered (expected 7)` });

      say(persona, "I'll click 'Buy now' on the single project to see what happens.");
      const buy = page.getByRole('button', { name: /Buy now/i }).first();
      if (await buy.count()) {
        await buy.click();
        await page.waitForTimeout(2500);
        await shot(page, 'priya-buy-clicked');
        if (/\/login/.test(page.url())) say(persona, "It sent me to a sign-in page. Makes sense, but it wasn't obvious I needed an account first.");
      }
    } catch (e) { record({ persona, where: 'flow', severity: 'note', title: 'Flow interrupted', detail: String((e as Error).message).slice(0, 140) }); }
    finally { await ctx.close(); }
  }

  // ─────────────────────────────────────────────────────────
  // PERSONA 2 — Ramesh, paint contractor, on his PHONE.
  // Goal: "I just want to WhatsApp/enquire quickly."
  // ─────────────────────────────────────────────────────────
  {
    const persona = 'Ramesh (contractor, mobile)';
    console.log(`\n────────── ${persona} ──────────`);
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await ctx.newPage();
    monitor(page, persona);
    try {
      say(persona, "Opening on my phone. Where's the menu?");
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await shot(page, 'ramesh-home');

      step("Tapping the hamburger menu");
      const burger = page.locator('#mobile-menu-button');
      await burger.click();
      await page.waitForTimeout(1000);
      const menuVisible = await page.locator('#mobile-menu.active, #mobile-menu:not(.hidden)').count();
      if (!menuVisible) record({ persona, where: '/', severity: 'bug', title: 'Mobile menu did not open on tap' });
      await shot(page, 'ramesh-menu');

      step("Tapping 'Contact' in the mobile menu");
      await page.locator('#mobile-menu a[href="#contact"]').first().click();
      await page.waitForTimeout(1500);
      await page.locator('#contact').scrollIntoViewIfNeeded();
      await shot(page, 'ramesh-contact');

      say(persona, "Let me type my name and a too-short phone number, like a rushed user might.");
      step("Filling name + invalid short phone + profile, then submitting to test JS validation");
      await page.locator('#f-name').fill('Ramesh');
      await page.locator('#f-phone').fill('123');
      await page.locator('#f-type').selectOption('contractor');
      await page.locator('#form-submit-btn').click();
      await page.waitForTimeout(1200);
      const feedback = page.locator('#form-feedback');
      const cls = (await feedback.count()) ? (await feedback.getAttribute('class')) || '' : 'hidden';
      const feedbackVisible = (await feedback.count()) > 0 && !cls.includes('hidden');
      if (!feedbackVisible) record({ persona, where: '/#contact', severity: 'bug', title: 'Invalid phone did not trigger an inline validation message' });
      else step('Got an inline "valid phone" validation message (good).');
      await shot(page, 'ramesh-form-validation');

      step("Checking the floating WhatsApp button");
      const waHref = await page.locator('#whatsapp-float').getAttribute('href');
      if (!waHref || !/wa\.me\/919944480052/.test(waHref)) record({ persona, where: '/', severity: 'bug', title: 'Floating WhatsApp button missing/incorrect', detail: String(waHref) });
      else say(persona, "Good, the WhatsApp button is right there — that's how I'd actually contact them.");
    } catch (e) { record({ persona, where: 'flow', severity: 'note', title: 'Flow interrupted', detail: String((e as Error).message).slice(0, 140) }); }
    finally { await ctx.close(); }
  }

  // ─────────────────────────────────────────────────────────
  // PERSONA 3 — Anita, agency owner. Desktop. Wants white-label proposals.
  // ─────────────────────────────────────────────────────────
  {
    const persona = 'Anita (agency owner)';
    console.log(`\n────────── ${persona} ──────────`);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    monitor(page, persona);
    try {
      say(persona, "I run an agency — I care about branded proposals and team plans.");
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      step("Using the 'I'm a Sales / Agency Team' quick CTA in Contact");
      await page.locator('#contact').scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      const agencyCta = page.getByText("I'm a Sales / Agency Team");
      if (await agencyCta.count()) {
        await agencyCta.click();
        await page.waitForTimeout(1000);
        const typeVal = await page.locator('#f-type').inputValue();
        const svcVal = await page.locator('#f-service').inputValue();
        if (typeVal !== 'agency' || svcVal !== 'proposals') record({ persona, where: '/#contact', severity: 'ux', title: 'Agency quick-CTA did not preset the form', detail: `type=${typeVal} service=${svcVal}` });
        else say(persona, "Nice, it pre-filled the form for an agency. Thoughtful.");
        await shot(page, 'anita-agency-preset');
      } else record({ persona, where: '/#contact', severity: 'note', title: "Agency quick-CTA not found" });

      step("Checking the 'Request Demo' nav button jumps to contact");
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      await page.getByRole('link', { name: /^Request Demo$/ }).first().click();
      await page.waitForTimeout(1200);
      await shot(page, 'anita-request-demo');
    } catch (e) { record({ persona, where: 'flow', severity: 'note', title: 'Flow interrupted', detail: String((e as Error).message).slice(0, 140) }); }
    finally { await ctx.close(); }
  }

  // ─────────────────────────────────────────────────────────
  // PERSONA 4 — Vikram, returning paying customer (AUTHENTICATED). Desktop.
  // Goal: "See my plan, download my invoice, maybe upgrade."
  // ─────────────────────────────────────────────────────────
  {
    const persona = 'Vikram (returning customer)';
    console.log(`\n────────── ${persona} ──────────`);
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 850 } });
    await ctx.addCookies([authCookie]);
    const page = await ctx.newPage();
    monitor(page, persona);
    try {
      say(persona, "I've paid before. Let me check my billing and grab an invoice.");
      await page.goto(`${BASE}/billing`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await shot(page, 'vikram-billing');
      if (!/\/billing/.test(page.url())) record({ persona, where: '/billing', severity: 'bug', title: 'Authenticated user not shown billing', detail: `landed on ${page.url()}` });

      const hasHeader = (await page.locator('header a[href="/"]').count()) > 0;
      if (!hasHeader) record({ persona, where: '/billing', severity: 'ux', title: 'No logo / Home link on billing page', detail: 'No way back to the main site from billing.' });

      step("Looking at order history + invoice links");
      const invoiceLink = page.locator('a[href^="/api/invoices/"]').first();
      if (await invoiceLink.count()) {
        const ihref = await invoiceLink.getAttribute('href');
        step(`Testing invoice download endpoint ${ihref}`);
        const resp = await page.request.get(`${BASE}${ihref}`, { maxRedirects: 0 }).catch(() => null);
        const st = resp?.status();
        if (st && (st === 200 || st === 302 || st === 307)) say(persona, "My invoice downloads. Perfect.");
        else record({ persona, where: ihref || 'invoice', severity: 'bug', title: `Invoice link returned ${st ?? 'no response'}` });
      } else record({ persona, where: '/billing', severity: 'note', title: 'No downloadable invoice link present (orders may lack stored PDFs)' });

      step("Opening Terms from the billing footer");
      await page.goto(`${BASE}/terms`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      await shot(page, 'vikram-terms');

      say(persona, "Let me try upgrading to the Pro plan.");
      await page.goto(`${BASE}/pricing`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      const subscribe = page.getByRole('button', { name: /^Subscribe$/ }).first();
      if (await subscribe.count()) {
        await subscribe.click();
        step("Waiting for Razorpay checkout to open…");
        const rzp = page.locator('.razorpay-container, iframe.razorpay-checkout-frame').first();
        const opened = await rzp.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false);
        await page.waitForTimeout(1500);
        await shot(page, 'vikram-razorpay');
        if (opened) say(persona, "The secure Razorpay payment window opened. I trust that.");
        else record({ persona, where: '/pricing', severity: 'bug', title: 'Razorpay checkout did not open on Subscribe' });
      } else record({ persona, where: '/pricing', severity: 'bug', title: "No 'Subscribe' button found" });
    } catch (e) { record({ persona, where: 'flow', severity: 'note', title: 'Flow interrupted', detail: String((e as Error).message).slice(0, 140) }); }
    finally { await ctx.close(); }
  }

  // ─────────────────────────────────────────────────────────
  // PERSONA 5 — "Skeptic", careful buyer, logged out. Desktop.
  // Goal: read policies, try signing in, judge trustworthiness.
  // ─────────────────────────────────────────────────────────
  {
    const persona = 'Skeptic (careful buyer)';
    console.log(`\n────────── ${persona} ──────────`);
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 850 } });
    const page = await ctx.newPage();
    monitor(page, persona);
    try {
      say(persona, "Before paying, I want to sign in and read the refund policy.");
      step("Signing in with an email");
      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      await page.locator('input[type="email"]').fill('persona.test@example.com');
      await shot(page, 'skeptic-login');
      await page.getByRole('button', { name: /Email me a sign-in link/i }).click();
      await page.waitForTimeout(3500);
      await shot(page, 'skeptic-login-check');
      if (/check=email/.test(page.url()) || (await page.getByText(/Check your inbox/i).count())) say(persona, "It says check my inbox. Clear enough.");
      else record({ persona, where: '/login', severity: 'bug', title: 'Login did not reach the check-email confirmation', detail: page.url() });

      step("Reading Terms while logged out, then clicking 'Back to billing'");
      await page.goto(`${BASE}/terms`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      const back = page.getByRole('link', { name: /Back to billing/i }).first();
      if (await back.count()) {
        await back.click();
        await page.waitForTimeout(1500);
        if (/\/login/.test(page.url())) record({ persona, where: '/terms', severity: 'ux', title: "'Back to billing' traps logged-out readers", detail: 'A logged-out visitor reading Terms gets bounced to a login screen instead of back to the site.' });
      }
      await shot(page, 'skeptic-terms-back');
    } catch (e) { record({ persona, where: 'flow', severity: 'note', title: 'Flow interrupted', detail: String((e as Error).message).slice(0, 140) }); }
    finally { await ctx.close(); }
  }

  await browser.close();
  await prisma.session.delete({ where: { sessionToken } }).catch(() => {});
  await prisma.$disconnect();

  // ── Report ──
  fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify(findings, null, 2));
  const bugs = findings.filter((f) => f.severity === 'bug');
  const ux = findings.filter((f) => f.severity === 'ux');
  const notes = findings.filter((f) => f.severity === 'note');
  console.log(`\n\n================= WALKTHROUGH SUMMARY =================`);
  console.log(`🐞 Bugs: ${bugs.length}   ⚠️  UX issues: ${ux.length}   💬 Notes: ${notes.length}`);
  for (const f of [...bugs, ...ux, ...notes]) {
    const icon = f.severity === 'bug' ? '🐞' : f.severity === 'ux' ? '⚠️ ' : '💬';
    console.log(`${icon} [${f.persona}] ${f.title}${f.detail ? '  — ' + f.detail : ''}`);
  }
  console.log(`\nScreenshots: ${SHOTS}`);
  console.log(`Findings JSON: ${path.join(OUT, 'findings.json')}`);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
