/*
 * Responsive audit harness — RioPoly (marketing + app pages + 3D studio).
 *
 * For each viewport × route: full-length screenshot + measurements:
 *   - horizontal overflow (scrollWidth − clientWidth) + offending elements
 *   - text smaller than 11px (visible)
 *   - tap targets smaller than 40px (visible interactive elements)
 *   - color-contrast + serious/critical a11y (axe-core)
 * Plus INTERACTIVE states (mobile menu, studio enter/tabs/floor-plan).
 *
 * Run: BASE=https://riopoly.gotoanalyze.com npx tsx scripts/responsive-audit.ts
 *      BASE=http://localhost:3000 (local)   TAG=baseline
 */
import { chromium, devices, type Page, type BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import 'dotenv/config';
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';

const BASE = (process.env.BASE || 'https://riopoly.gotoanalyze.com').replace(/\/$/, '');
const TAG = process.env.TAG || 'audit';
const { protocol, hostname } = new URL(BASE);
const IS_HTTPS = protocol === 'https:';
const COOKIE_NAME = IS_HTTPS ? '__Secure-next-auth.session-token' : 'next-auth.session-token';

const OUT = path.join(process.cwd(), 'audit', TAG);
fs.mkdirSync(OUT, { recursive: true });

type VP = { name: string; w: number; h: number; touch: boolean };
const VIEWPORTS: VP[] = [
  { name: 'phone-402', w: 402, h: 874, touch: true },
  { name: 'tablet-portrait-820', w: 820, h: 1180, touch: true },
  { name: 'tablet-landscape-1194', w: 1194, h: 834, touch: true },
  { name: 'laptop-1440', w: 1440, h: 900, touch: false },
  { name: 'ultrawide-3440', w: 3440, h: 1440, touch: false },
];
const ROUTES = ['/', '/pricing', '/terms', '/privacy', '/login', '/billing', '/color-studio'];

type Finding = {
  viewport: string; route: string; state: string;
  overflowPx: number; offenders: string[];
  smallText: number; smallTextEx: string[];
  smallTap: number; smallTapEx: string[];
  contrast: number; contrastEx: string[];
  a11ySerious: number;
  shot: string;
};
const findings: Finding[] = [];

const MEASURE = `() => {
  const vw = document.documentElement.clientWidth;
  const overflowPx = Math.max(0, document.documentElement.scrollWidth - vw, document.body ? document.body.scrollWidth - vw : 0);
  const sel = (el) => {
    const id = el.id ? '#' + el.id : '';
    const cls = (el.className && typeof el.className === 'string') ? '.' + el.className.trim().split(/\\s+/).slice(0,2).join('.') : '';
    return (el.tagName.toLowerCase() + id + cls).slice(0, 60);
  };
  const all = Array.from(document.querySelectorAll('*'));
  const offenders = [];
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 2 && r.left < vw) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed') continue; // fixed overlays measured separately
      offenders.push(sel(el) + ' (right=' + Math.round(r.right) + ')');
    }
  }
  // small text (visible, has direct text)
  const smallTextEx = [];
  let smallText = 0;
  for (const el of all) {
    const hasText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!hasText) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const fs = parseFloat(cs.fontSize);
    if (fs && fs < 11) { smallText++; if (smallTextEx.length < 6) smallTextEx.push(sel(el) + ' ' + fs.toFixed(1) + 'px "' + el.textContent.trim().slice(0,20) + '"'); }
  }
  // small tap targets
  const smallTapEx = [];
  let smallTap = 0;
  for (const el of Array.from(document.querySelectorAll('a,button,input,select,textarea,[role=button]'))) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (r.width < 40 || r.height < 40) { smallTap++; if (smallTapEx.length < 6) smallTapEx.push(sel(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); }
  }
  return { overflowPx, offenders: offenders.slice(0, 10), smallText, smallTextEx, smallTap, smallTapEx };
}`;

async function fullShot(page: Page, name: string): Promise<string> {
  const file = path.join(OUT, name + '.png');
  await page.screenshot({ path: file, fullPage: true }).catch(async () => {
    await page.screenshot({ path: file }).catch(() => {});
  });
  return path.relative(process.cwd(), file);
}

async function measurePage(page: Page, vp: VP, route: string, state: string): Promise<void> {
  // MEASURE is an arrow-fn source string; wrap as an IIFE so evaluate runs it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m: any = (await page.evaluate('(' + MEASURE + ')()').catch(() => null))
    ?? { overflowPx: -1, offenders: [], smallText: 0, smallTextEx: [], smallTap: 0, smallTapEx: [] };
  let contrast = 0, a11ySerious = 0; const contrastEx: string[] = [];
  try {
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    for (const v of res.violations) {
      if (v.id === 'color-contrast') { contrast += v.nodes.length; for (const n of v.nodes.slice(0, 4)) contrastEx.push((n.target?.[0] ?? '').toString().slice(0, 50)); }
      if (v.impact === 'serious' || v.impact === 'critical') a11ySerious += v.nodes.length;
    }
  } catch { /* axe may fail on some pages */ }
  const shot = await fullShot(page, `${vp.name}__${route.replace(/\W+/g, '_') || 'home'}__${state}`);
  const f: Finding = {
    viewport: vp.name, route, state,
    overflowPx: m.overflowPx, offenders: m.offenders,
    smallText: m.smallText, smallTextEx: m.smallTextEx,
    smallTap: m.smallTap, smallTapEx: m.smallTapEx,
    contrast, contrastEx, a11ySerious, shot,
  };
  findings.push(f);
  const flag = (f.overflowPx > 2 ? `OVERFLOW ${f.overflowPx}px ` : '') + (f.contrast ? `contrast:${f.contrast} ` : '') + (f.smallText ? `text<11:${f.smallText} ` : '') + (f.smallTap ? `tap<40:${f.smallTap}` : '');
  console.log(`  [${vp.name}] ${route} (${state}) ${flag || 'ok'}`);
  if (f.overflowPx > 2 && f.offenders.length) console.log(`     ↳ offenders: ${f.offenders.slice(0, 4).join(' | ')}`);
}

async function main() {
  console.log(`\n=== Responsive audit — ${BASE} (tag=${TAG}) ===\n`);

  // Seed an authed session for /billing.
  let cookie: { name: string; value: string; domain: string; path: string; httpOnly: boolean; secure: boolean; sameSite: 'Lax' } | null = null;
  let sessionToken = '';
  try {
    const user = await prisma.user.findUnique({ where: { email: 'request@gotoanalyze.com' } });
    if (user) {
      sessionToken = randomBytes(32).toString('hex');
      await prisma.session.create({ data: { sessionToken, userId: user.id, expires: new Date(Date.now() + 3600_000) } });
      cookie = { name: COOKIE_NAME, value: sessionToken, domain: hostname, path: '/', httpOnly: true, secure: IS_HTTPS, sameSite: 'Lax' };
      console.log('Seeded auth session for /billing\n');
    }
  } catch (e) { console.log('WARN: could not seed session (billing will be logged-out):', String((e as Error).message).slice(0, 80)); }

  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--no-sandbox'] });

  for (const vp of VIEWPORTS) {
    console.log(`\n──────── ${vp.name} (${vp.w}x${vp.h}${vp.touch ? ' touch' : ''}) ────────`);
    const ctx: BrowserContext = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      hasTouch: vp.touch,
      isMobile: vp.touch && vp.w < 900,
      deviceScaleFactor: 1,
    });
    if (cookie) await ctx.addCookies([cookie]);
    const page = await ctx.newPage();

    for (const route of ROUTES) {
      try {
        await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(route === '/color-studio' ? 3500 : 1500);
        await measurePage(page, vp, route, 'load');

        // Interactive states
        if (route === '/' && vp.touch) {
          const burger = page.locator('#mobile-menu-button');
          if (await burger.count()) {
            await burger.click().catch(() => {});
            await page.waitForTimeout(700);
            await measurePage(page, vp, route, 'mobile-menu-open');
          }
        }
        if (route === '/color-studio') {
          const persona = page.getByRole('button', { name: /Interior Designer/i }).first();
          if (await persona.count()) {
            await persona.click().catch(() => {});
            await page.waitForTimeout(6000);
            await measurePage(page, vp, route, 'studio-entered');
            // open a couple of tabs
            for (const tab of ['Tools', 'Rooms']) {
              const t = page.getByRole('button', { name: new RegExp(tab, 'i') }).first();
              if (await t.count()) { await t.click().catch(() => {}); await page.waitForTimeout(900); }
            }
            await measurePage(page, vp, route, 'studio-rooms-tab');
          }
        }
      } catch (e) {
        console.log(`  [${vp.name}] ${route} ERROR: ${String((e as Error).message).slice(0, 80)}`);
      }
    }
    await ctx.close();
  }

  await browser.close();
  if (sessionToken) await prisma.session.delete({ where: { sessionToken } }).catch(() => {});
  await prisma.$disconnect();

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(findings, null, 2));

  // Summary matrix
  console.log(`\n\n================= AUDIT SUMMARY (${TAG}) =================`);
  const problems = findings.filter((f) => f.overflowPx > 2 || f.contrast > 0 || f.smallText > 0 || f.smallTap > 0);
  console.log(`Total states measured: ${findings.length} | with issues: ${problems.length}`);
  console.log(`\nviewport | route (state) | overflow | contrast | text<11 | tap<40`);
  for (const f of findings) {
    if (f.overflowPx > 2 || f.contrast > 0 || f.smallText > 0 || f.smallTap > 0) {
      console.log(`${f.viewport} | ${f.route} (${f.state}) | ${f.overflowPx > 2 ? f.overflowPx + 'px' : '-'} | ${f.contrast || '-'} | ${f.smallText || '-'} | ${f.smallTap || '-'}`);
    }
  }
  console.log(`\nReport: ${path.relative(process.cwd(), path.join(OUT, 'report.json'))}  |  Screenshots: ${path.relative(process.cwd(), OUT)}`);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
