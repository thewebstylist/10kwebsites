// Downscale the source illustrations for the thumbnail slot.
//
// They render at ~128px wide, so shipping the full-resolution PNG wastes
// megabytes. 256px wide covers 2× displays with room to spare.
//
//   usage: node scripts/thumbs.mjs

import sharp from 'sharp';
import { readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(HERE, '../assets/img');

const WIDTH = 256;   // rendered at 128 CSS px
const QUALITY = 82;

const sources = readdirSync(DIR).filter((f) => /-src\.(png|jpe?g)$/i.test(f)).sort();

if (!sources.length) {
  console.error(`no *-src.png in ${DIR}`);
  process.exit(1);
}

let before = 0, after = 0;

for (const name of sources) {
  const src = join(DIR, name);
  const out = join(DIR, basename(name).replace(/\.(png|jpe?g)$/i, '.webp'));

  await sharp(src)
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(out);

  const b = statSync(src).size, a = statSync(out).size;
  before += b; after += a;
  console.log(`${name.padEnd(22)} ${(b / 1024).toFixed(0).padStart(6)} KB → ${(a / 1024).toFixed(0).padStart(5)} KB  ${(b / a).toFixed(0)}x`);
}

console.log(`${'─'.repeat(56)}`);
console.log(`${'TOTAL'.padEnd(22)} ${(before / 1024).toFixed(0).padStart(6)} KB → ${(after / 1024).toFixed(0).padStart(5)} KB  ${(before / after).toFixed(0)}x`);
