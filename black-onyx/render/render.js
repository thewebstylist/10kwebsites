// Renders frames of onyx.html to PNG. Usage:
// node render.js <outdir> <w> <h> <json-list-of-frame-options>
// or node render.js <outdir> <w> <h> hero <frames>   |  loop <frames> <offx> <offy> <zoom> <seed>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
(async () => {
  const [out, w, h, kind, ...rest] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  let frames = [];
  if (kind === 'hero') { const n = +rest[0]; for (let i = 0; i < n; i++) frames.push({ mode: 0, t: i / (n - 1), frame: i }); }
  else if (kind === 'loop') { const n = +rest[0]; for (let i = 0; i < n; i++) frames.push({ mode: 1, loop: i / n, off: [+rest[1], +rest[2]], zoom: +rest[3], seed: +rest[4], frame: i }); }
  else frames = JSON.parse(kind);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve(__dirname, 'onyx.html')); await p.waitForFunction(() => window.ready);
  const t0 = Date.now();
  for (let i = 0; i < frames.length; i++) {
    const url = await p.evaluate(o => window.renderFrame(o), { ...frames[i], w: +w, h: +h });
    fs.writeFileSync(path.join(out, String(i).padStart(4, '0') + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    if (i % 20 === 0) console.log(i, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
  await b.close();
})();
