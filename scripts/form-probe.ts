/*
 * Dirty-data probe for the user-facing FORMS (login + contact), in a real
 * browser. Only exercises validation-BLOCKING paths so we never actually submit
 * to Resend/Formspree (no inbox spam). Confirms bad input is rejected cleanly,
 * XSS strings don't execute, and the page never crashes.
 *
 * Run: E2E_BASE_URL="https://riopoly.gotoanalyze.com" npx tsx scripts/form-probe.ts
 */
import { chromium } from '@playwright/test';
import { isValidEmail } from '../lib/validation';

const B = process.env.E2E_BASE_URL || 'https://riopoly.gotoanalyze.com';

type Check = { name: string; pass: boolean; detail: string };
const results: Check[] = [];
function check(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? '✅' : '❌'} ${name} — ${detail}`);
}

let dialogFired = false;

async function main() {
  console.log(`\n=== RioPoly form dirty-data probe ===\nTarget: ${B}\n`);

  // ---------- LOGIN validator (source-of-truth matrix, no network) ----------
  console.log('[LOGIN] isValidEmail() matrix (no magic-link is sent):');
  const invalidEmails = [
    'notanemail', 'a@', '@b.com', 'a b@c.com', 'a@b', 'plainaddress',
    'two@@at.com', '<script>alert(1)</script>@x.com', ' ', '',
    'a'.repeat(300) + '@x.com', 'user@domain', 'user@.com', 'user@dom.',
  ];
  for (const e of invalidEmails) {
    check(`rejects "${e.slice(0, 24)}"`, !isValidEmail(e), isValidEmail(e) ? 'ACCEPTED (bad!)' : 'blocked');
  }
  const validEmails = ['good.user@example.com', 'a@b.co', 'x+tag@sub.domain.io', 'Test@Company.COM'];
  for (const e of validEmails) {
    check(`accepts "${e}"`, isValidEmail(e), isValidEmail(e) ? 'valid' : 'WRONGLY BLOCKED');
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  // Any alert() means an XSS string executed → hard fail.
  page.on('dialog', async (d) => { dialogFired = true; await d.dismiss().catch(() => {}); });
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  // ---------- LOGIN end-to-end: bad email shows inline error, blocks submit ----------
  console.log('\n[LOGIN] browser: bad email shows inline error and does NOT submit:');
  await page.goto(`${B}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill('a@b'); // native-valid but our JS rejects it
  await page.getByRole('button', { name: /Email me a sign-in link/i }).click();
  await page.waitForTimeout(800);
  const alertVisible = (await page.getByRole('alert').count()) > 0;
  const stillOnLoginForm = !/check=email/.test(page.url()) && (await page.locator('input[type="email"]').count()) > 0;
  check('bad email "a@b" shows inline error', alertVisible, alertVisible ? 'alert shown' : 'NO alert');
  check('bad email did NOT submit / navigate', stillOnLoginForm, stillOnLoginForm ? 'stayed on form' : 'NAVIGATED (bad!)');

  // ---------- CONTACT (marketing) ----------
  console.log('\n[CONTACT] JS validation blocks bad input; XSS strings are inert:');
  await page.goto(`${B}/`, { waitUntil: 'domcontentloaded' });
  await page.locator('#contact').scrollIntoViewIfNeeded();

  // 1) Empty submit → the browser's native "required" (name) blocks it; no crash.
  await page.locator('#form-submit-btn').click().catch(() => {});
  await page.waitForTimeout(400);

  // 2) Fill name+profile but an INVALID short phone → JS shows inline error, no network send.
  await page.locator('#f-name').fill('<img src=x onerror=alert(1)>'); // XSS attempt in name
  await page.locator('#f-phone').fill('12');
  await page.locator('#f-type').selectOption('contractor');
  await page.locator('#form-submit-btn').click();
  await page.waitForTimeout(600);
  const fb = page.locator('#form-feedback');
  const cls = (await fb.count()) ? (await fb.getAttribute('class')) || '' : 'hidden';
  const shownErr = (await fb.count()) > 0 && !cls.includes('hidden');
  check('contact blocks invalid phone with inline error', shownErr, shownErr ? 'inline error shown' : 'no error shown');

  // 3) Oversized message must not crash the page.
  await page.locator('#f-phone').fill('9944480052');
  await page.locator('#f-message').fill('A'.repeat(100_000));
  const stillResponsive = await page.locator('#form-submit-btn').isEnabled();
  check('contact handles a 100k-char message without breaking', stillResponsive, 'form still responsive');

  // Global safety assertions
  check('no XSS alert() executed anywhere', !dialogFired, dialogFired ? 'ALERT FIRED (XSS!)' : 'no dialog');
  check('no uncaught page errors', pageErrors.length === 0, pageErrors.length ? pageErrors[0].slice(0, 80) : 'none');

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n================= FORM PROBE SUMMARY =================`);
  console.log(`Total: ${results.length}   ✅ ${results.length - failed.length}   ❌ ${failed.length}`);
  if (failed.length) {
    for (const f of failed) console.log(`  ❌ ${f.name} — ${f.detail}`);
    process.exit(2);
  }
  console.log('\n✅ Forms reject dirty input cleanly; XSS inert; no crashes.');
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
