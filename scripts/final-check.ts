/* Focused final verification: phone tap-targets on app pages + studio drawer-open. */
import { chromium } from '@playwright/test';
import path from 'path';
const OUT = path.join(process.cwd(), 'audit', 'final');
const BASE = 'https://riopoly.gotoanalyze.com';

const MEASURE_TAP = `(() => {
  let n = 0; const ex = [];
  for (const el of Array.from(document.querySelectorAll('a,button,input,select,[role=button]'))) {
    const r = el.getBoundingClientRect(); if (r.width===0||r.height===0) continue;
    const cs = getComputedStyle(el); if (cs.visibility==='hidden'||cs.display==='none') continue;
    if (r.width<40||r.height<40){ n++; if(ex.length<8) ex.push((el.tagName.toLowerCase())+' '+Math.round(r.width)+'x'+Math.round(r.height)+' "'+(el.textContent||'').trim().slice(0,16)+'"'); }
  }
  const overflow = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
  return { n, ex, overflow };
})()`;

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 402, height: 874 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();

  for (const route of ['/pricing', '/terms']) {
    await p.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1500);
    const m = await p.evaluate(MEASURE_TAP);
    console.log(`${route}: overflow=${(m as any).overflow} tap<40=${(m as any).n} ${JSON.stringify((m as any).ex)}`);
  }

  // Studio drawer-open
  await p.goto(BASE + '/color-studio', { waitUntil: 'domcontentloaded' });
  await p.getByRole('button', { name: /Interior Designer/i }).first().click();
  await p.locator('canvas').first().waitFor({ timeout: 20000 });
  await p.waitForTimeout(8000);
  const fab = p.getByRole('button', { name: /Controls/i }).first();
  console.log('studio FAB present:', await fab.count());
  await fab.click();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: path.join(OUT, 'phone-402__studio__drawer-open.png'), fullPage: false });
  const sm = await p.evaluate(MEASURE_TAP);
  console.log(`studio drawer-open: overflow=${(sm as any).overflow} tap<40=${(sm as any).n} ${JSON.stringify((sm as any).ex)}`);
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
