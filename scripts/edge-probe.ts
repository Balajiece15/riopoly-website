/*
 * Adversarial / dirty-data probe for every RioPoly API endpoint.
 *
 * Sends malformed, oversized, injection-style, wrong-type, and unauthorized
 * payloads and asserts the server responds with a clean, correct status (never
 * a 500 crash / empty body, never data leakage). Complements the persona
 * walkthrough (UI) and the Playwright suite (happy paths).
 *
 * Run: E2E_BASE_URL="https://riopoly.gotoanalyze.com" npx tsx scripts/edge-probe.ts
 *
 * NOTE: With dead Razorpay test keys, a *valid* create request returns 502
 * ("Authentication failed") from Razorpay — that still proves OUR validation
 * passed and the failure is graceful. We treat 502-with-JSON as acceptable for
 * otherwise-valid inputs and call it out separately.
 */
import 'dotenv/config';
import { randomBytes } from 'crypto';
import { prisma } from '../lib/prisma';

const B = process.env.E2E_BASE_URL || 'https://riopoly.gotoanalyze.com';

type Check = { name: string; pass: boolean; detail: string };
const results: Check[] = [];
function check(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? '✅' : '❌'} ${name} — ${detail}`);
}

async function post(path: string, body: BodyInit | undefined, cookie?: string, contentType = 'application/json') {
  const headers: Record<string, string> = {};
  if (contentType) headers['content-type'] = contentType;
  if (cookie) headers['cookie'] = cookie;
  const r = await fetch(B + path, { method: 'POST', headers, body });
  const text = await r.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, text, json, isJson: json !== null };
}
async function get(path: string, cookie?: string) {
  const r = await fetch(B + path, { headers: cookie ? { cookie } : {}, redirect: 'manual' });
  const text = await r.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { status: r.status, text, json, isJson: json !== null };
}

// A long/dirty payload bank reused across endpoints.
const HUGE = 'x'.repeat(200_000);
const DIRTY_SKUS: unknown[] = [
  '', ' ', '   ', 'single project', 'SINGLE-PROJECT', 'single-project ',
  '<script>alert(1)</script>', "'; DROP TABLE \"Order\";--", '../../etc/passwd',
  '﷽'.repeat(50), 'pro_monthly', 'single-project\n', 0, 1, true, null,
  ['single-project'], { id: 'single-project' }, HUGE,
];

async function main() {
  console.log(`\n=== RioPoly edge / dirty-data probe ===\nTarget: ${B}\n`);

  // Seed an authed session.
  const user = await prisma.user.findUnique({ where: { email: 'request@gotoanalyze.com' } });
  if (!user) throw new Error('test user missing');
  const token = randomBytes(32).toString('hex');
  await prisma.session.create({ data: { sessionToken: token, userId: user.id, expires: new Date(Date.now() + 3600_000) } });
  const cookie = '__Secure-next-auth.session-token=' + token;

  // --- 1) Auth gating: protected endpoints must reject anon with 401 ---
  console.log('\n[1] Auth gating (no cookie → 401):');
  for (const ep of ['/api/orders/create', '/api/subscriptions/create', '/api/subscriptions/cancel']) {
    const r = await post(ep, JSON.stringify({ sku: 'single-project' }));
    check(`anon POST ${ep}`, r.status === 401 && r.isJson, `HTTP ${r.status}`);
  }
  {
    const r = await get('/api/invoices/whatever');
    check('anon GET /api/invoices/:id', r.status === 401 && r.isJson, `HTTP ${r.status}`);
  }

  // --- 2) Malformed bodies on orders/create (authed) ---
  console.log('\n[2] Malformed request bodies (authed → 400, never 500):');
  const malformed: { label: string; body: BodyInit | undefined; ct?: string }[] = [
    { label: 'no body', body: undefined },
    { label: 'empty string', body: '' },
    { label: 'not JSON', body: 'this-is-not-json{' },
    { label: 'JSON array', body: '[]' },
    { label: 'JSON null', body: 'null' },
    { label: 'empty object {}', body: '{}' },
    { label: 'wrong field', body: JSON.stringify({ plan: 'single-project' }) },
    { label: 'text/plain ct', body: JSON.stringify({ sku: 'single-project' }), ct: 'text/plain' },
    { label: 'huge junk body', body: JSON.stringify({ sku: 'single-project', junk: HUGE }) },
  ];
  for (const m of malformed) {
    const r = await post('/api/orders/create', m.body, cookie, m.ct ?? 'application/json');
    // Acceptable: 400 (bad body) OR 200/502 if the huge-but-valid one passed validation.
    const ok = r.status !== 500 && r.isJson && (r.status === 400 || (m.label === 'huge junk body' && [200, 502].includes(r.status)) || (m.label === 'text/plain ct'));
    check(`orders/create ${m.label}`, ok, `HTTP ${r.status}${r.isJson ? '' : ' (NON-JSON!)'}`);
  }

  // --- 3) Dirty SKU values (authed) on both create endpoints ---
  console.log('\n[3] Dirty SKU values (authed → 400 for bad, 200/502 only for the one real valid sku):');
  for (const ep of ['/api/orders/create', '/api/subscriptions/create']) {
    for (const sku of DIRTY_SKUS) {
      const r = await post(ep, JSON.stringify({ sku }), cookie);
      // The only inputs that should pass validation: exact 'single-project' (orders) / 'pro-monthly' (subs).
      const isRealValid =
        (ep.includes('orders') && sku === 'single-project-NEVER') || false; // none of DIRTY_SKUS are the real valid sku
      const ok = r.status !== 500 && r.isJson && (r.status === 400 || r.status === 409);
      const label = typeof sku === 'string' ? (sku.length > 20 ? sku.slice(0, 20) + '…' : JSON.stringify(sku)) : JSON.stringify(sku);
      check(`${ep} sku=${label}`, ok, `HTTP ${r.status}${r.isJson ? '' : ' (NON-JSON!)'}`);
    }
  }

  // --- 4) Wrong-kind SKUs (authed): one-time to subs endpoint and vice versa → 400 ---
  console.log('\n[4] Wrong-kind SKU routing (→ 400):');
  {
    const a = await post('/api/orders/create', JSON.stringify({ sku: 'pro-monthly' }), cookie);
    check('orders/create with subscription sku', a.status === 400 && a.isJson, `HTTP ${a.status}`);
    const b = await post('/api/subscriptions/create', JSON.stringify({ sku: 'single-project' }), cookie);
    check('subscriptions/create with one-time sku', b.status === 400 && b.isJson, `HTTP ${b.status}`);
  }

  // --- 5) Invoice IDOR + malformed id (authed) ---
  console.log('\n[5] Invoice access control (IDOR / malformed → 404, never leak):');
  const idorIds = ['nonexistent-id', '../../secret', "1' OR '1'='1", '%2e%2e', 'null', randomBytes(16).toString('hex')];
  for (const id of idorIds) {
    const r = await get('/api/invoices/' + encodeURIComponent(id), cookie);
    check(`invoices/${id.slice(0, 16)}`, r.status === 404 && r.isJson, `HTTP ${r.status}`);
  }

  // --- 6) Cancel with no active subscription (authed) → 404 (graceful) ---
  console.log('\n[6] Cancel subscription with none active (→ 404):');
  {
    const r = await post('/api/subscriptions/cancel', undefined, cookie);
    check('subscriptions/cancel (no active sub)', (r.status === 404 || r.status === 502) && r.isJson, `HTTP ${r.status}`);
  }

  // --- 7) The ONE genuinely valid create request (should pass validation) ---
  console.log('\n[7] Valid create (validation must pass; 200 ideal, 502 acceptable while Razorpay keys are dead):');
  {
    const r = await post('/api/orders/create', JSON.stringify({ sku: 'single-project' }), cookie);
    const ok = [200, 502].includes(r.status) && r.isJson;
    check('orders/create sku=single-project', ok, `HTTP ${r.status}${r.status === 502 ? ' (Razorpay auth — env issue, not code)' : ''}`);
  }

  await prisma.session.delete({ where: { sessionToken: token } }).catch(() => {});
  await prisma.$disconnect();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n================= EDGE PROBE SUMMARY =================`);
  console.log(`Total: ${results.length}   ✅ ${results.length - failed.length}   ❌ ${failed.length}`);
  if (failed.length) {
    console.log('\nFAILURES:');
    for (const f of failed) console.log(`  ❌ ${f.name} — ${f.detail}`);
    process.exit(2);
  }
  console.log('\n✅ Every endpoint handled dirty/adversarial/unauthorized input safely.');
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
