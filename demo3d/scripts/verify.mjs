// Headless verification.
//
// Loads the page, drives every character / surface mode / slider position, and
// fails loudly on console errors, failed requests or wrong stats.
//
//   usage: node scripts/verify.mjs [baseUrl] [outDir]

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] || 'http://127.0.0.1:8123';
const SHOTS = resolve(HERE, '..', process.argv[3] || '../.verify');
mkdirSync(SHOTS, { recursive: true });

// same camera for every character, so the comparison is honest
const CAM = [2.15, 1.52, 3.55];  // matches CAM_HOME in main.js

const errors = [];
const failedRequests = [];
const consoleLog = [];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--disable-dev-shm-usage', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(120000);

page.on('console', (m) => {
  consoleLog.push(`[${m.type()}] ${m.text()}`);
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
const netLog = [];
const served = new Set();   // urls that came back 2xx with a body

page.on('request', (r) => netLog.push(`REQ  ${r.resourceType()} ${r.url()}`));
page.on('requestfinished', (r) => netLog.push(`FIN  ${r.resourceType()} ${r.url()}`));

page.on('response', (r) => {
  netLog.push(`RES  ${r.status()} ${r.url()}`);
  if (r.status() >= 200 && r.status() < 300) served.add(r.url());
  if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`);
});

page.on('requestfailed', (r) => {
  const url = r.url();
  const why = r.failure()?.errorText ?? '';
  netLog.push(`FAIL ${r.resourceType()} ${url} ${why}`);

  // three's FileLoader wraps the response body in a progress-tracking
  // ReadableStream; when that wrapper is collected Chromium reports the
  // already-completed original fetch as ERR_ABORTED. The bytes did arrive —
  // a 2xx for the same URL is the proof — so this is noise, not a 404.
  if (why === 'net::ERR_ABORTED' && served.has(url)) {
    netLog.push(`     ↑ benign: 2xx already received for this url`);
    return;
  }
  failedRequests.push(`${url} — ${why} [${r.resourceType()}]`);
});

console.log(`→ ${BASE}`);
await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });

// wait for the first character
await page.waitForFunction(() => window.__app?.ready === true, null, { timeout: 120000 });
console.log('✓ first character ready\n');

const results = [];
const modeProblems = [];

async function frames(n = 4) {
  await page.evaluate((k) => { for (let i = 0; i < k; i++) window.__frame(1 / 60); }, n);
}

async function shoot(name) {
  // The control bar sits on a backdrop-filter layer, which the compositor
  // rasterizes out of band. Wait for two real animation frames so the DOM and
  // the canvas are committed together, otherwise a capture can pair a fresh
  // canvas with a stale control bar.
  await page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))));
  const buf = await page.screenshot({ path: join(SHOTS, `${name}.png`) });
  return buf.length;
}

for (let i = 0; i < 3; i++) {
  await page.evaluate((k) => window.__app.select(k), i);
  await page.waitForFunction(() => window.__app.ready === true, null, { timeout: 180000 });

  // deterministic camera — identical for all three
  await page.evaluate((c) => window.__app.placeCamera(c), CAM);
  await page.evaluate(() => window.__app.setDisintegrate(0));
  await page.evaluate(() => window.__app.setMode('texture'));
  await frames(6);

  const info = await page.evaluate(() => ({
    stats: window.__app.stats,
    bbox: window.__app.bbox,
    camera: window.__app.camera,
    render: window.__app.renderInfo,
    panel: {
      idx: document.getElementById('statIdx').textContent,
      name: document.getElementById('statName').textContent,
      engine: document.getElementById('statEngine').textContent,
      cost: document.getElementById('statCost').textContent,
      tris: document.getElementById('statTris').textContent,
      verts: document.getElementById('statVerts').textContent,
      size: document.getElementById('statSize').textContent,
    },
    thumb: (() => {
      const im = document.getElementById('sourceImg');
      return { src: im.getAttribute('src'), w: im.naturalWidth, h: im.naturalHeight };
    })(),
  }));

  const id = info.stats.id;
  await shoot(`${i + 1}-${id}-texture`);

  // surface modes — assert the state rather than trusting the pixels; under
  // software rendering the backdrop-filtered control bar can lag a frame
  // behind the canvas in a capture
  const expectMat = { texture: 'MeshStandardMaterial', clay: 'MeshStandardMaterial', normals: 'MeshNormalMaterial' };
  for (const mode of ['clay', 'normals']) {
    await page.evaluate((m) => window.__app.setMode(m), mode);
    const state = await page.evaluate(() => ({
      active: [...document.getElementById('modes').children]
        .filter((b) => b.classList.contains('is-active')).map((b) => b.dataset.mode),
      mats: window.__app.materials,
    }));
    const ok = state.active.length === 1 && state.active[0] === mode
      && state.mats.length === 1 && state.mats[0] === expectMat[mode];
    if (!ok) modeProblems.push(`${id}/${mode}: active=${state.active} mats=${state.mats}`);
    await frames(4);
    await shoot(`${i + 1}-${id}-${mode}`);
  }

  // disintegrate sweep, back on the textured surface
  await page.evaluate(() => window.__app.setMode('texture'));
  for (const v of [0.35, 1.0]) {
    await page.evaluate((x) => window.__app.setDisintegrate(x), v);
    await frames(4);
    await shoot(`${i + 1}-${id}-disintegrate-${String(v).replace('.', '_')}`);
  }
  await page.evaluate(() => window.__app.setDisintegrate(0));
  await frames(2);

  results.push(info);

  console.log(`${info.panel.idx}  ${info.panel.name.padEnd(9)} ${info.panel.engine.padEnd(14)} ` +
    `${info.panel.tris.padStart(9)} tris  ${info.panel.verts.padStart(9)} verts  ` +
    `${info.panel.size.padStart(8)}  ${info.panel.cost.padStart(6)}`);
  const bb = info.bbox;
  console.log(`    bbox y ${bb.min[1].toFixed(4)} → ${bb.max[1].toFixed(4)}  ` +
    `x ${bb.min[0].toFixed(3)}…${bb.max[0].toFixed(3)}  z ${bb.min[2].toFixed(3)}…${bb.max[2].toFixed(3)}`);
  console.log(`    camera ${info.camera.map((n) => n.toFixed(3)).join(', ')}  ` +
    `· draws ${info.render.calls} · thumb ${info.thumb.w}×${info.thumb.h} ${info.thumb.src}`);
}

// ── auto-orbit ──────────────────────────────────────────────────────
// The frame driver takes an explicit dt, so idle time can be simulated in a
// handful of renders instead of hundreds — software GL is far too slow for the
// literal 60 fps version.
// a genuine drag on the canvas, so the pause is triggered the way a user
// triggers it rather than by poking internals
await page.mouse.move(800, 500);
await page.mouse.down();
await page.mouse.move(880, 500, { steps: 6 });
await page.mouse.up();

const orbit = await page.evaluate(() => {
  const read = () => window.__app.turntable;
  const afterDrag = read();
  for (let i = 0; i < 4; i++) window.__frame(0.25);   // 1.0s — inside the pause
  const held = read();
  for (let i = 0; i < 12; i++) window.__frame(0.4);   // +4.8s — past the resume delay
  return { afterDrag, held, moved: read() };
});
await shoot('4-autoorbit');

const paused = Math.abs(orbit.held - orbit.afterDrag) < 1e-9;
const resumed = orbit.moved - orbit.held > 0.05;
console.log(`\n${paused ? '✓' : '✗'} auto-orbit paused during/after drag ` +
  `(${orbit.afterDrag.toFixed(4)} → ${orbit.held.toFixed(4)} rad over 1.0s)`);
console.log(`${resumed ? '✓' : '✗'} auto-orbit resumed after the delay ` +
  `(${orbit.held.toFixed(4)} → ${orbit.moved.toFixed(4)} rad over 4.8s)`);

// ── checks ──────────────────────────────────────────────────────────
console.log('\n── checks ─────────────────────────────────────────────');
const problems = [];

console.log(`${modeProblems.length === 0 ? '✓' : '✗'} surface modes: button state + material type agree`);
modeProblems.forEach((m) => console.log(`      ${m}`));
if (modeProblems.length) problems.push('surface mode desync');

if (!paused) problems.push('turntable kept spinning through the drag');
if (!resumed) problems.push('turntable never resumed after the drag');

// normalisation: uniform height, feet on the deck, centred on the turntable.
// A quantized attribute transformed in place clamps and collapses the model,
// and that is invisible in a stats panel — so assert the geometry itself.
const normalised = results.every((r) => {
  const [ , y0 ] = r.bbox.min, [ x1, y1, z1 ] = r.bbox.max, [ x0, , z0 ] = r.bbox.min;
  return Math.abs(y1 - y0 - 2.0) < 0.01     // TARGET_HEIGHT
      && Math.abs(y0) < 0.01                 // feet at y = 0
      && Math.abs((x0 + x1) / 2) < 0.01      // centred in x
      && Math.abs((z0 + z1) / 2) < 0.01;     // centred in z
});
console.log(`${normalised ? '✓' : '✗'} normalised: height 2.00, feet at y=0, centred on the turntable`);
if (!normalised) problems.push('character not normalised (height / feet / centring)');

const camsMatch = results.every((r) =>
  r.camera.every((v, k) => Math.abs(v - CAM[k]) < 1e-6));
console.log(`${camsMatch ? '✓' : '✗'} identical camera across all three`);
if (!camsMatch) problems.push('camera drifted between characters');

const uniqueTris = new Set(results.map((r) => r.stats.triangles));
console.log(`${uniqueTris.size === 3 ? '✓' : '✗'} three distinct triangle counts: ${[...uniqueTris].join(', ')}`);
if (uniqueTris.size !== 3) problems.push('triangle counts not distinct');

const labelled = results.every((r) => r.panel.engine && r.panel.engine !== '—' && r.panel.cost !== '—');
console.log(`${labelled ? '✓' : '✗'} engine + cost labelled for each`);
if (!labelled) problems.push('missing engine/cost label');

const sized = results.every((r) => /MB$/.test(r.panel.size));
console.log(`${sized ? '✓' : '✗'} file size reported for each`);
if (!sized) problems.push('missing file size');

const thumbs = results.every((r) => r.thumb.w > 0 && r.thumb.src.endsWith('.webp'));
console.log(`${thumbs ? '✓' : '✗'} source thumbnails decoded (webp)`);
if (!thumbs) problems.push('thumbnail did not decode');

console.log(`${errors.length === 0 ? '✓' : '✗'} console errors: ${errors.length}`);
errors.slice(0, 10).forEach((e) => console.log(`      ${e}`));
if (errors.length) problems.push(`${errors.length} console errors`);

console.log(`${failedRequests.length === 0 ? '✓' : '✗'} failed requests / 404s: ${failedRequests.length}`);
failedRequests.slice(0, 10).forEach((e) => console.log(`      ${e}`));
if (failedRequests.length) problems.push(`${failedRequests.length} failed requests`);

writeFileSync(join(SHOTS, 'results.json'),
  JSON.stringify({ results, errors, failedRequests, consoleLog, netLog }, null, 2));

await browser.close();

console.log(`\nscreenshots → ${SHOTS}`);
if (problems.length) {
  console.log(`\nFAILED: ${problems.join('; ')}`);
  process.exit(1);
}
console.log('\nALL CHECKS PASSED');
