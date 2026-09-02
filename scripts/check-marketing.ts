import { chromium } from '@playwright/test';
const MEASURE = `(() => {
  let n = 0; const ex = [];
  for (const el of Array.from(document.querySelectorAll('a,button,input,select,[role=button]'))) {
    const r = el.getBoundingClientRect(); if (r.width===0||r.height===0) continue;
    const cs = getComputedStyle(el); if (cs.visibility==='hidden'||cs.display==='none') continue;
    if (r.width<40||r.height<40){ n++; if(ex.length<10) ex.push(el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+' '+Math.round(r.width)+'x'+Math.round(r.height)); }
  }
  const ham = document.querySelector('#mobile-menu-button');
  const hr = ham ? ham.getBoundingClientRect() : null;
  return { n, ex, hamburger: hr ? Math.round(hr.width)+'x'+Math.round(hr.height) : 'none',
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
})()`;
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 402, height: 874 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  await p.goto('https://riopoly.gotoanalyze.com/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2000);
  const m = await p.evaluate(MEASURE);
  console.log('MARKETING phone:', JSON.stringify(m));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
