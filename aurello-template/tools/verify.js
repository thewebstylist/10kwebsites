#!/usr/bin/env node
'use strict';
/*
 * verify.js — drive every built brand in a real browser and check the things
 * that actually break when brand copy changes.
 *
 *   node tools/verify.js            every folder in dist/
 *   node tools/verify.js aurello    just one
 *
 * Needs Playwright and a Chromium:  npm i -D playwright && npx playwright install chromium
 * Set CHROMIUM_PATH to use a browser that is already on the machine.
 *
 * Checks, per brand: every section rendered, no broken images, nothing left
 * hidden waiting for a scroll trigger, header stays pinned, structured data
 * present, no console errors or failed requests; no horizontal overflow and the
 * right nav mode from 320px to 2560px; prefers-reduced-motion keeps all content
 * and unpins every scene; the page still renders with GSAP blocked; the skip
 * link takes the first tab and the mobile menu closes on Escape; and the
 * single-file build animates from disk with zero external requests.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const VIEWPORTS = [320, 390, 768, 1024, 1440, 1920, 2560];

let playwright;
try {
  playwright = require('playwright');
} catch (e) {
  console.error('verify needs Playwright:  npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2' };

function serve(root, port) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const clean = decodeURIComponent(req.url.split('?')[0]);
      let file = path.join(root, clean);
      if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(port, () => resolve(srv));
  });
}

/* lazy images only load once they are near the viewport, so walk the page in
   viewport-sized steps rather than jumping, or the check reports false breaks */
async function walk(page, step = 700) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= h; y += step) {
    await page.evaluate((v) => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, v); }, y);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(900);
}

let failures = 0;
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? '  -- ' + detail : ''}`);
}

async function verifyBrand(browser, slug, url, singleFile) {
  console.log(`\n=== ${slug} ===`);

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [], failed = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => failed.push(r.url()));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(3400);

  const missing = await page.evaluate((sel) => sel.filter((s) => !document.querySelector(s)),
    ['.header', '.hero', '#range', '#inside', '#serve', '#story', '.marq', '#faq', '#find', '.footer']);
  check('every section rendered', missing.length === 0, missing.join(','));

  await walk(page);
  const state = await page.evaluate(() => ({
    broken: Array.from(document.images).filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.currentSrc),
    hidden: Array.from(document.querySelectorAll('.anim')).filter((e) => getComputedStyle(e).opacity === '0').length,
    headerTop: Math.round(document.querySelector('.header').getBoundingClientRect().top),
    jsonLd: !!document.querySelector('script[type="application/ld+json"]')
  }));
  check('no broken images', state.broken.length === 0, state.broken.join(','));
  check('nothing left hidden after a full scroll', state.hidden === 0, String(state.hidden));
  check('header stays pinned', state.headerTop === 0);
  check('structured data present', state.jsonLd);
  check('no console errors', errors.length === 0, errors.join(' | '));
  check('no failed requests', failed.length === 0, failed.join(' | '));
  await page.close();

  for (const width of VIEWPORTS) {
    const p = await browser.newPage({ viewport: { width, height: 900 } });
    await p.goto(url, { waitUntil: 'load' });
    await p.waitForTimeout(2600);
    const r = await p.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      nav: getComputedStyle(document.querySelector('.nav-group')).display !== 'none',
      burger: getComputedStyle(document.querySelector('#burger')).display !== 'none',
      cards: document.querySelectorAll('.p-card').length,
      arrowOrphaned: (() => {
        const a = document.querySelector('.footer-cta');
        if (!a || !a.firstChild) return false;
        const rects = (() => { const r = document.createRange(); r.selectNodeContents(a.firstChild); return r.getClientRects(); })();
        const last = rects[rects.length - 1];
        const arw = a.querySelector('.arw').getBoundingClientRect();
        return Math.abs(arw.top - last.top) >= last.height;
      })()
    }));
    check(`${width}px: no overflow, one nav mode, 3 cards, arrow not orphaned`,
      r.overflow === 0 && r.nav !== r.burger && r.cards === 3 && !r.arrowOrphaned, JSON.stringify(r));
    await p.close();
  }

  const rm = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const rmErr = [];
  rm.on('pageerror', (e) => rmErr.push(e.message));
  await rm.goto(url, { waitUntil: 'load' });
  await rm.waitForTimeout(1600);
  const r1 = await rm.evaluate(() => ({
    loader: !!document.querySelector('#loader'),
    pinned: getComputedStyle(document.querySelector('.hero .stage')).position,
    hidden: Array.from(document.querySelectorAll('.anim')).filter((e) => getComputedStyle(e).opacity === '0').length,
    cards: Array.from(document.querySelectorAll('.life-card')).filter((e) => getComputedStyle(e).opacity !== '0').length,
    overflow: document.documentElement.scrollWidth - window.innerWidth
  }));
  check('reduced motion: no loader, unpinned, nothing hidden, cards shown, no overflow',
    !r1.loader && r1.pinned === 'relative' && r1.hidden === 0 && r1.cards === 3 && r1.overflow === 0, JSON.stringify(r1));
  check('reduced motion: no errors', rmErr.length === 0, rmErr.join(' | '));
  await rm.close();

  const ng = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const ngErr = [];
  ng.on('pageerror', (e) => ngErr.push(e.message));
  await ng.route('**/gsap.min.js', (r) => r.abort());
  await ng.route('**/ScrollTrigger.min.js', (r) => r.abort());
  await ng.goto(url, { waitUntil: 'load' });
  await ng.waitForTimeout(3400);
  const r2 = await ng.evaluate(() => ({
    loader: !!document.querySelector('#loader'),
    hidden: Array.from(document.querySelectorAll('.anim')).filter((e) => getComputedStyle(e).opacity === '0').length,
    hero: getComputedStyle(document.querySelector('.hero-title')).opacity
  }));
  check('GSAP blocked: loader cleared, nothing hidden, hero visible',
    !r2.loader && r2.hidden === 0 && r2.hero === '1', JSON.stringify(r2));
  check('GSAP blocked: no errors', ngErr.length === 0, ngErr.join(' | '));
  await ng.close();

  const kb = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await kb.goto(url, { waitUntil: 'load' });
  await kb.waitForTimeout(3000);
  await kb.keyboard.press('Tab');
  const focus = await kb.evaluate(() => ({
    tag: document.activeElement.tagName, ring: getComputedStyle(document.activeElement).outlineWidth }));
  await kb.click('#burger');
  await kb.waitForTimeout(400);
  const opened = await kb.evaluate(() => document.querySelector('#mobileMenu').classList.contains('open'));
  await kb.keyboard.press('Escape');
  await kb.waitForTimeout(400);
  const closed = await kb.evaluate(() => !document.querySelector('#mobileMenu').classList.contains('open'));
  check('skip link takes the first tab with a visible ring', focus.tag === 'A' && focus.ring !== '0px', JSON.stringify(focus));
  check('mobile menu opens, and Escape closes it', opened && closed);
  await kb.close();

  if (singleFile && fs.existsSync(singleFile)) {
    const sf = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const sfErr = [], external = [];
    sf.on('pageerror', (e) => sfErr.push(e.message));
    sf.on('request', (r) => { const u = r.url(); if (!u.startsWith('file:') && !u.startsWith('data:')) external.push(u); });
    await sf.goto('file://' + singleFile, { waitUntil: 'load' });
    await sf.waitForTimeout(3200);
    await walk(sf);
    const r3 = await sf.evaluate(() => ({
      gsap: !!window.gsap,
      broken: Array.from(document.images).filter((i) => !i.complete || i.naturalWidth === 0).length
    }));
    check('single file: animates, no broken images, zero external requests',
      r3.gsap && r3.broken === 0 && external.length === 0,
      JSON.stringify({ ...r3, external: external.slice(0, 3) }));
    check('single file: no errors', sfErr.length === 0, sfErr.join(' | '));
    await sf.close();
  }
}

async function main() {
  if (!fs.existsSync(DIST)) { console.error('Nothing in dist/. Run: node build.js --inline'); process.exit(2); }
  const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const brands = fs.readdirSync(DIST)
    .filter((d) => fs.existsSync(path.join(DIST, d, 'index.html')))
    .filter((d) => !only.length || only.includes(d));
  if (!brands.length) { console.error('No built brands found in dist/.'); process.exit(2); }

  const browser = await playwright.chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

  let port = 4300;
  for (const slug of brands) {
    const dir = path.join(DIST, slug);
    const srv = await serve(dir, port);
    try {
      await verifyBrand(browser, slug, `http://localhost:${port}/`, path.join(dir, `${slug}.single.html`));
    } finally {
      srv.close();
      port++;
    }
  }

  await browser.close();
  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
