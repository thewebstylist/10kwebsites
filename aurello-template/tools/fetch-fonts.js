#!/usr/bin/env node
'use strict';
/*
 * fetch-fonts.js — self-host the template's web fonts.
 *
 *   node tools/fetch-fonts.js                      the four default families
 *   node tools/fetch-fonts.js dm-sans:400,500 …    any @fontsource family
 *
 * Downloads each family from the @fontsource packages on npm, copies the latin
 * woff2 files into vendor/fonts/ and writes a fonts.css beside them. When that
 * file exists, build.js links it instead of the Google Fonts URL, so a built
 * page has no external requests at all.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'vendor', 'fonts');

/* family slug : weights : the CSS font-family name to declare */
const DEFAULTS = [
  ['bebas-neue', ['400'], 'Bebas Neue'],
  ['roboto-slab', ['300', '400'], 'Roboto Slab'],
  ['dm-sans', ['400', '500'], 'DM Sans'],
  ['caveat', ['600'], 'Caveat']
];

const TITLE = (slug) => slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

function parseArgs(argv) {
  const list = argv.slice(2).filter((a) => !a.startsWith('-'));
  if (!list.length) return DEFAULTS;
  return list.map((spec) => {
    const [slug, weights] = spec.split(':');
    return [slug, (weights || '400').split(','), TITLE(slug)];
  });
}

function main() {
  const families = parseArgs(process.argv);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fonts-'));
  fs.mkdirSync(OUT, { recursive: true });

  const faces = [];
  for (const [slug, weights, family] of families) {
    const pkg = `@fontsource/${slug}`;
    process.stdout.write(`· ${pkg} … `);
    let tgz;
    try {
      tgz = execFileSync('npm', ['pack', pkg, '--silent'], { cwd: tmp, encoding: 'utf8' }).trim().split('\n').pop();
    } catch (e) {
      console.log('FAILED (skipped)');
      continue;
    }
    execFileSync('tar', ['-xzf', tgz], { cwd: tmp });
    const filesDir = path.join(tmp, 'package', 'files');
    let copied = 0;
    for (const weight of weights) {
      const name = `${slug}-latin-${weight}-normal.woff2`;
      const src = path.join(filesDir, name);
      if (!fs.existsSync(src)) { console.log(`\n  ! ${name} not in package`); continue; }
      fs.copyFileSync(src, path.join(OUT, name));
      faces.push(
        `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;` +
        `src:url('./${name}') format('woff2');` +
        `unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,` +
        `U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}`
      );
      copied++;
    }
    fs.rmSync(path.join(tmp, 'package'), { recursive: true, force: true });
    console.log(`${copied} weight(s)`);
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  if (!faces.length) { console.error('No fonts fetched.'); process.exit(1); }
  fs.writeFileSync(path.join(OUT, 'fonts.css'), `/* self-hosted via tools/fetch-fonts.js */\n${faces.join('\n')}\n`);
  console.log(`\n✓ vendor/fonts/fonts.css written (${faces.length} faces). Rebuild to use it.`);
}

if (require.main === module) main();
