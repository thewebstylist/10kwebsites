/**
 * UNDRWTR self-test. Drives the built _site in real Chromium and asserts the
 * things the brief actually promises, by measurement rather than by eye:
 *
 *   1. the loader reaches 100% and unlocks
 *   2. the descent visibly darkens the FILM (canvas luma falls)
 *   3. the descent darkens the PAGE (background interpolates to black)
 *   4. the meter counts to 3,000 M
 *   5. the lume macro glows in true black (low mean, high max)
 *   6. no console errors
 *   7. the phone gate serves the looping video and requests zero frames
 *   8. reduced motion requests zero frames
 *
 * Exits non-zero on any failure, so CI goes red instead of shipping a broken page.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
const results = [];
let failed = 0;

function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ::  ' + detail : ''}`);
}

/** Mean and max luma of the chapter's canvas, sampled in the browser. */
const CANVAS_STATS = (sel) => {
  const c = document.querySelector(sel);
  if (!c) return null;
  const g = c.getContext('2d');
  const w = Math.min(c.width, 240), h = Math.min(c.height, 135);
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const o = off.getContext('2d');
  o.drawImage(c, 0, 0, w, h);
  const d = o.getImageData(0, 0, w, h).data;
  let sum = 0, max = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    sum += l; if (l > max) max = l; n++;
  }
  return { mean: sum / n, max };
};

async function settle(page, ms = 900) {
  await page.waitForTimeout(ms);
}

/** Scroll to an absolute y and let the lerp converge. */
async function scrollTo(page, y) {
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await settle(page, 800);
}

async function run() {
  const browser = await chromium.launch();

  // ---------- Desktop: the full scrub ----------
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  const proxyReqs = [], fullReqs = [];
  page.on('request', (r) => {
    const u = r.url();
    if (!/\/frames\//.test(u)) return;
    if (/\/proxy\//.test(u)) proxyReqs.push(u); else fullReqs.push(u);
  });

  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });

  // 1. loader reaches 100% and unlocks, on the proxy tier alone
  await page.waitForSelector('#loader.done', { timeout: 180000 });
  const unlockMs = Date.now() - t0;
  const fullAtUnlock = fullReqs.length;
  const pctText = await page.$eval('#ld-pct', (e) => e.textContent.trim());
  check('loader reaches 100% and unlocks', pctText === '100%', `readout was "${pctText}"`);
  check('all 450 proxy frames were requested', proxyReqs.length === 450, `${proxyReqs.length} proxy requests`);
  check('loader does not wait on the full tier', fullAtUnlock === 0,
    `${fullAtUnlock} full-tier requests before unlock, unlocked in ${unlockMs}ms`);

  const heights = await page.evaluate(() => ({
    hero: document.querySelector('#hero').offsetHeight,
    descent: document.querySelector('#descent').offsetHeight,
    lume: document.querySelector('#lume').offsetHeight,
    vh: window.innerHeight,
    doc: document.body.scrollHeight
  }));

  // Sample the descent at five points through its pinned range.
  const dTop = await page.evaluate(() => document.querySelector('#descent').offsetTop);
  const dSpan = heights.descent - heights.vh;
  const samples = [];
  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    await scrollTo(page, dTop + dSpan * p);
    const stats = await page.evaluate(CANVAS_STATS, '[data-canvas="descent"]');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const meter = await page.evaluate(() => {
      const n = document.querySelector('#g-num');
      return n ? n.textContent.trim() : null;
    });
    samples.push({ p, ...stats, bg, meter });
    console.log(`   descent p=${p}  canvasMean=${stats.mean.toFixed(1)}  bg=${bg}  meter=${meter}`);
  }

  // 2. the film darkens
  const filmFalls = samples[0].mean > samples[4].mean + 25;
  check('descent darkens the film', filmFalls,
    `canvas mean ${samples[0].mean.toFixed(1)} -> ${samples[4].mean.toFixed(1)}`);

  // the film should still hold a bright lume at the bottom
  check('lume stays lit at the bottom of the descent', samples[4].max > 120,
    `max luma ${samples[4].max.toFixed(0)}`);

  // 3. the page background darkens in sync
  const rgb = (s) => (s.match(/\d+/g) || []).map(Number);
  const bgStart = rgb(samples[0].bg), bgEnd = rgb(samples[4].bg);
  const startSum = bgStart.reduce((a, b) => a + b, 0);
  const endSum = bgEnd.reduce((a, b) => a + b, 0);
  check('page background interpolates toward black', startSum > 60 && endSum < 30,
    `${samples[0].bg} -> ${samples[4].bg}`);

  // 4. the meter counts to 3,000
  const firstMeter = parseInt(samples[0].meter.replace(/,/g, ''), 10);
  const lastMeter = parseInt(samples[4].meter.replace(/,/g, ''), 10);
  check('meter starts at 0 M', firstMeter === 0, `read ${samples[0].meter}`);
  check('meter reaches 3,000 M', lastMeter === 3000, `read ${samples[4].meter}`);
  const monotonic = samples.every((s, i, a) =>
    i === 0 || parseInt(s.meter.replace(/,/g, ''), 10) >= parseInt(a[i - 1].meter.replace(/,/g, ''), 10));
  check('meter counts monotonically down', monotonic,
    samples.map((s) => s.meter).join(' -> '));

  // 5. the lume macro glows in true black
  const lTop = await page.evaluate(() => document.querySelector('#lume').offsetTop);
  const lSpan = heights.lume - heights.vh;
  await scrollTo(page, lTop + lSpan * 0.6);
  const lume = await page.evaluate(CANVAS_STATS, '[data-canvas="lume"]');
  console.log(`   lume  mean=${lume.mean.toFixed(2)}  max=${lume.max.toFixed(0)}`);
  check('lume macro is true black', lume.mean < 18, `mean luma ${lume.mean.toFixed(2)}`);
  check('lume macro still glows', lume.max > 120, `max luma ${lume.max.toFixed(0)}`);

  // hero paints something
  await scrollTo(page, 200);
  const hero = await page.evaluate(CANVAS_STATS, '[data-canvas="drop"]');
  check('hero canvas paints', hero && hero.mean > 5, `mean luma ${hero ? hero.mean.toFixed(1) : 'n/a'}`);

  // scrub hard, then confirm the page is still alive and correct
  for (const y of [dTop, dTop + dSpan * 0.9, dTop + dSpan * 0.1, dTop + dSpan]) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(60);
  }
  await settle(page, 1200);
  const afterFast = await page.evaluate(CANVAS_STATS, '[data-canvas="descent"]');
  check('survives fast scrubbing', afterFast && afterFast.mean < 40,
    `mean luma ${afterFast ? afterFast.mean.toFixed(1) : 'n/a'} at the bottom`);

  // the form works
  await page.evaluate(() => document.querySelector('#cta').scrollIntoView());
  await settle(page, 600);
  await page.fill('#email', 'diver@example.com');
  await page.click('#reserve-form button[type=submit]');
  await settle(page, 400);
  const okVisible = await page.$eval('#form-ok', (e) => e.classList.contains('on'));
  check('reserve form shows its success state', okVisible);

  // the background upgrade actually happens and actually replaces frames
  await page.waitForFunction(() => window.__undrwtr && window.__undrwtr.upgraded() > 0,
    null, { timeout: 120000 });
  await page.waitForFunction(() => window.__undrwtr.upgraded() >= window.__undrwtr.total(),
    null, { timeout: 240000 }).catch(() => {});
  const up = await page.evaluate(() => ({
    upgraded: window.__undrwtr.upgraded(),
    total: window.__undrwtr.total(),
    w0: window.__undrwtr.frameWidth('descent', 0),
    w149: window.__undrwtr.frameWidth('lume', 149)
  }));
  check('full tier upgrades in the background', up.upgraded === up.total,
    `${up.upgraded}/${up.total} frames upgraded`);
  check('upgraded frames really are the 1600px tier', up.w0 === 1600 && up.w149 === 1600,
    `descent[0] ${up.w0}px, lume[149] ${up.w149}px`);
  check('full tier was fetched after unlock, not before', fullReqs.length > 0 && fullAtUnlock === 0,
    `${fullReqs.length} full-tier requests total`);

  // 6. no console errors
  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 4).join(' | '));

  await ctx.close();

  // ---------- Phone: the static gate ----------
  const mctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true
  });
  const mp = await mctx.newPage();
  const mFrames = [];
  const mVideos = [];
  mp.on('request', (r) => {
    if (/\/frames\//.test(r.url())) mFrames.push(r.url());
    if (/loop-.*\.mp4/.test(r.url())) mVideos.push(r.url());
  });
  const mErrors = [];
  mp.on('pageerror', (e) => mErrors.push(e.message));
  await mp.goto(BASE, { waitUntil: 'domcontentloaded' });
  await settle(mp, 3000);
  const loaderGone = await mp.$eval('#loader', (e) => e.classList.contains('done'));
  check('phone: loader unlocks without frames', loaderGone);
  check('phone: requests zero frames', mFrames.length === 0, `${mFrames.length} frame requests`);
  check('phone: loads the looping video fallback', mVideos.length > 0, `${mVideos.length} loop videos`);
  const noHScroll = await mp.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth + 1);
  check('phone: no sideways scroll', noHScroll);
  check('phone: no page errors', mErrors.length === 0, mErrors.slice(0, 3).join(' | '));
  await mctx.close();

  // ---------- Reduced motion ----------
  const rctx = await browser.newContext({
    viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce'
  });
  const rp = await rctx.newPage();
  const rFrames = [];
  rp.on('request', (r) => { if (/\/frames\//.test(r.url())) rFrames.push(r.url()); });
  await rp.goto(BASE, { waitUntil: 'domcontentloaded' });
  await settle(rp, 3000);
  check('reduced motion: requests zero frames', rFrames.length === 0, `${rFrames.length} frame requests`);
  const rLoader = await rp.$eval('#loader', (e) => e.classList.contains('done'));
  check('reduced motion: loader unlocks', rLoader);
  await rctx.close();

  await browser.close();

  console.log('\n' + '='.repeat(60));
  console.log(`${results.length - failed}/${results.length} checks passed`);
  if (failed) {
    console.log('\nFailures:');
    results.filter((r) => !r.ok).forEach((r) => console.log(`  - ${r.name}: ${r.detail || ''}`));
  }
  process.exit(failed ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
