#!/usr/bin/env node
'use strict';
/*
 * build.js — turn a brand file into a finished, self-contained landing page.
 *
 *   node build.js                       build every brands/*.json
 *   node build.js brands/aurello.json   build one
 *   node build.js brands/x.json --out ../my-site
 *   node build.js --no-assets           reuse whatever is already in assets/
 *
 * Output: dist/<slug>/index.html + dist/<slug>/assets/*
 */

const fs = require('fs');
const path = require('path');
const { render } = require('./tools/render');
const kit = require('./tools/assets');

const ROOT = __dirname;
const TEMPLATE = path.join(ROOT, 'template', 'index.html');
const DEFAULTS = path.join(ROOT, 'brands', '_defaults.json');

/* section ids the nav hrefs point at — keep these stable across brands */
const IDS = {
  hero: 'hero', intro: 'intro', lifestyle: 'moments', range: 'range',
  ingredients: 'inside', steps: 'serve', story: 'story', faq: 'faq', find: 'find'
};

/* ------------------------------------------------------------------ utils */
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function deepMerge(base, over) {
  if (!isPlain(base) || !isPlain(over)) return over === undefined ? base : over;
  const out = Object.assign({}, base);
  for (const k of Object.keys(over)) {
    out[k] = isPlain(base[k]) && isPlain(over[k]) ? deepMerge(base[k], over[k]) : over[k];
  }
  return out;
}

function hexToRgb(hex) {
  let h = String(hex || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return '0, 0, 0';
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ');
}

function mix(hex, target, amount) {
  const a = hexToRgb(hex).split(', ').map(Number);
  const b = hexToRgb(target).split(', ').map(Number);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * amount));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

const slug = (s) => String(s || '')
  .toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-') || 'brand';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);

/* *word* in any headline becomes the editorial serif cut */
function emphasise(str) {
  return escapeHtml(str).replace(/\*([^*]+)\*/g, '<span class="serif">$1</span>');
}

const warnings = [];
const missingAssets = [];
const warn = (m) => { warnings.push(m); };

/* ------------------------------------------------------------- asset slot */
/* A slot is either a real file the brand supplied, or a generated stand-in. */
function makeSlotResolver(configDir, outAssets, writeAssets) {
  const written = new Set();

  function write(name, svg) {
    if (!writeAssets) return 'assets/' + name;
    if (!written.has(name)) {
      fs.writeFileSync(path.join(outAssets, name), svg);
      written.add(name);
    }
    return 'assets/' + name;
  }

  function copyReal(rel) {
    if (!rel) return null;
    const candidates = [path.resolve(configDir, rel), path.resolve(ROOT, rel), path.resolve(process.cwd(), rel)];
    const found = candidates.find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
    if (!found) { missingAssets.push(rel); return null; }
    const name = path.basename(found);
    if (writeAssets && !written.has(name)) {
      fs.copyFileSync(found, path.join(outAssets, name));
      written.add(name);
    }
    return 'assets/' + name;
  }

  return { write, copyReal };
}

/* --------------------------------------------------------------- derive */
function derive(cfg, slots) {
  const t = cfg.theme;
  const colors = t.colors;
  const brandUpper = String(cfg.brand.name || '').toUpperCase();

  if (!kit.MOTIF_NAMES.includes(t.motif)) {
    warn(`unknown motif "${t.motif}", falling back to "slice". Available: ${kit.MOTIF_NAMES.join(', ')}`);
    t.motif = 'slice';
  }

  /* Motif and illustration each come in two colourways, one for the light
     grounds and one for the colour blocks. A supplied file wins in both. */
  const realMotif = slots.copyReal(cfg.assets.motif);
  const realMuse = slots.copyReal(cfg.assets.muse);
  const motifSrc = realMotif || slots.write('motif-light.svg', kit.motif(t.motif, colors.cream));
  const motifSrcInk = realMotif || slots.write('motif-ink.svg', kit.motif(t.motif, colors.primary));
  const museSrc = realMuse || slots.write('muse-light.svg', kit.muse(colors.cream));
  const museSrcInk = realMuse || slots.write('muse-ink.svg', kit.muse(colors.primary));

  /* products ---------------------------------------------------------- */
  const tints = [0, 1, 2].map((i) => (t.tints && t.tints[i]) || mix(colors.cream, colors.primary, 0.1 + i * 0.06));

  const products = (cfg.range.products || []).map((p, i) => {
    const tint = p.tint || tints[i % tints.length];
    const body = p.color || colors.primary;
    const item = Object.assign({}, p, {
      tint,
      alt: p.alt || `${cfg.brand.name} ${p.name}`,
      src: (p.image && slots.copyReal(p.image)) || slots.write(`product-${slug(p.name) || i + 1}.svg`, kit.product({
        shape: p.shape || 'can',
        body,
        ink: p.labelColor || mix(body, colors.deep, 0.4),
        shade: mix(body, colors.deep, 0.42),
        light: mix(body, '#ffffff', 0.3),
        panel: p.labelBg || colors.cream,
        motif: t.motif,
        brandName: cfg.brand.name,
        productName: p.name,
        meta: p.meta,
        alt: p.alt || `${cfg.brand.name} ${p.name}`
      }))
    });
    return item;
  });
  cfg.range.products = products;

  /* the cut-out used in each cinematic scene */
  function sceneProduct(spec, key) {
    if (spec.image) {
      const real = slots.copyReal(spec.image);
      if (real) return real;
    }
    const ref = products[spec.productIndex || 0];
    if (ref && !spec.shape && !spec.tint) return ref.src;
    const body = spec.tint || colors.primary;
    return slots.write(`product-scene-${key}.svg`, kit.product({
      shape: spec.shape || 'can',
      body,
      ink: mix(body, colors.deep, 0.4),
      shade: mix(body, colors.deep, 0.42),
      light: mix(body, '#ffffff', 0.3),
      panel: colors.cream,
      motif: t.motif,
      brandName: cfg.brand.name,
      productName: (ref && ref.name) || cfg.brand.name,
      meta: (ref && ref.meta) || '',
      alt: spec.alt || `${cfg.brand.name} product`
    }));
  }

  /* photography slots ------------------------------------------------- */
  cfg.lifestyle.cards = (cfg.lifestyle.cards || []).map((c, i) => Object.assign({}, c, {
    alt: c.alt || c.headline || 'Lifestyle image',
    src: (c.image && slots.copyReal(c.image)) || slots.write(`shot-${i + 1}.svg`, kit.photo({
      label: c.label || c.headline,
      seed: (c.headline || '') + i,
      base: tints[i % tints.length],
      ink: colors.deep,
      accent: colors.primary,
      motifName: t.motif
    }))
  }));

  const storySrc = (cfg.story.image && slots.copyReal(cfg.story.image)) ||
    slots.write('shot-story.svg', kit.photo({
      label: cfg.story.eyebrow || cfg.brand.name,
      seed: 'story-' + cfg.brand.name,
      base: colors.soft, ink: colors.deep, accent: colors.primary, motifName: t.motif
    }));

  /* headline emphasis + copy passes ----------------------------------- */
  cfg.lifestyle.copy = (cfg.lifestyle.copy || []).map(emphasise);

  /* nav split around the centred logo */
  const links = cfg.nav.links || [];
  const half = Math.ceil(links.length / 2);

  /* marquee: one run of the phrase per span, repeated wide enough to travel */
  const phrase = [cfg.marquee.text, cfg.marquee.flourish].filter(Boolean).join(' ');
  const marquee = Array.from({ length: cfg.marquee.repeat || 6 }, () => phrase);

  const initial = brandUpper.slice(0, 1) || 'A';
  const favicon = 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${colors.primary}"/>` +
    `<text x="16" y="23" font-family="Arial Narrow,Impact,sans-serif" font-size="21" fill="${colors.cream}" text-anchor="middle">${escapeHtml(initial)}</text></svg>`);

  const localFonts = fs.existsSync(path.join(ROOT, 'vendor', 'fonts', 'fonts.css')) && cfg.theme.useLocalFonts !== false;

  return {
    brandUpper,
    favicon,
    fonts: { local: localFonts, href: localFonts ? 'vendor/fonts/fonts.css' : cfg.theme.fontsUrl },
    ids: IDS,
    rgb: { primary: hexToRgb(colors.primary), cream: hexToRgb(colors.cream), deep: hexToRgb(colors.deep) },
    tints,
    motifSrc, motifSrcInk, museSrc, museSrcInk,
    nav: { left: links.slice(0, half), right: links.slice(half) },
    hero: { productSrc: sceneProduct(cfg.hero.product || {}, 'hero') },
    intro: { productSrc: sceneProduct(cfg.intro.product || {}, 'intro'), headingHtml: emphasise(cfg.intro.heading) },
    transition: { productSrc: sceneProduct(cfg.transition.product || {}, 'transition') },
    range: { headingHtml: emphasise(cfg.range.heading) },
    ingredients: { headingHtml: emphasise(cfg.ingredients.heading) },
    story: { src: storySrc, headingHtml: emphasise(cfg.story.heading) },
    faq: { headingHtml: emphasise(cfg.faq.heading) },
    find: { headingHtml: emphasise(cfg.find.heading) },
    marquee
  };
}

/* -------------------------------------------------------------- validate */
function validate(cfg) {
  const required = [
    ['brand.name', cfg.brand.name],
    ['meta.title', cfg.meta.title],
    ['hero.line1', cfg.hero.line1]
  ];
  required.forEach(([k, v]) => { if (!v) warn(`missing required field: ${k}`); });

  if (!cfg.nav.links || !cfg.nav.links.length) warn('nav.links is empty — the header will have no navigation');
  if (cfg.range.enabled && (cfg.range.products || []).length !== 3) {
    warn(`range.products has ${(cfg.range.products || []).length} entries — the grid is designed for 3`);
  }
  (cfg.range.products || []).forEach((p) => {
    if (p.shape && !kit.SHAPE_NAMES.includes(p.shape)) {
      warn(`unknown product shape "${p.shape}" on "${p.name}". Available: ${kit.SHAPE_NAMES.join(', ')}`);
    }
  });
  if (cfg.lifestyle.enabled && (cfg.lifestyle.cards || []).length !== 3) {
    warn(`lifestyle.cards has ${(cfg.lifestyle.cards || []).length} entries — the deck is tuned for 3`);
  }
}

/* ----------------------------------------------------------------- build */
function buildOne(configPath, opts) {
  const defaults = JSON.parse(fs.readFileSync(DEFAULTS, 'utf8'));
  delete defaults._comment;
  const brandFile = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const cfg = deepMerge(defaults, brandFile);

  cfg.meta.title = cfg.meta.title || `${cfg.brand.name}${cfg.brand.tagline ? ' — ' + cfg.brand.tagline : ''}`;
  cfg.meta.description = cfg.meta.description || cfg.brand.tagline || '';
  cfg.meta.themeColor = cfg.meta.themeColor || cfg.theme.colors.primary;
  cfg.brand.wordmark = cfg.brand.wordmark || cfg.brand.name;

  validate(cfg);

  const outDir = opts.out || path.join(ROOT, 'dist', slug(cfg.brand.name));
  const outAssets = path.join(outDir, 'assets');
  /* dist/ belongs to the build, so it is rebuilt clean. A caller-supplied --out
     is somebody else's folder and is only cleaned when they ask for it. */
  const owned = !opts.out || opts.clean;
  if (owned && fs.existsSync(outAssets)) fs.rmSync(outAssets, { recursive: true, force: true });
  fs.mkdirSync(outAssets, { recursive: true });

  const slots = makeSlotResolver(path.dirname(path.resolve(configPath)), outAssets, opts.assets !== false);
  cfg.derived = derive(cfg, slots);

  let html = render(fs.readFileSync(TEMPLATE, 'utf8'), cfg);
  const leftovers = html.match(/\{\{[^}]*\}\}/g);
  if (leftovers) warn(`unresolved template tags: ${Array.from(new Set(leftovers)).join(' ')}`);

  html = html.replace('<!--INLINE-SCRIPTS-->', '');
  fs.writeFileSync(path.join(outDir, 'index.html'), html);

  /* ship local GSAP when it is vendored, so the page animates with no CDN */
  const vendorSrc = path.join(ROOT, 'vendor');
  if (opts.assets !== false && fs.existsSync(vendorSrc)) {
    const vendorOut = path.join(outDir, 'vendor');
    fs.mkdirSync(vendorOut, { recursive: true });
    fs.cpSync(vendorSrc, vendorOut, { recursive: true });
  }

  if (opts.inline) {
    const single = inlineEverything(render(fs.readFileSync(TEMPLATE, 'utf8'), cfg), outDir);
    const file = path.join(outDir, `${slug(cfg.brand.name)}.single.html`);
    fs.writeFileSync(file, single);
    console.log(`  + ${path.relative(process.cwd(), file)}  (${(Buffer.byteLength(single) / 1024).toFixed(0)} KB, one portable file)`);
  }

  return { outDir, html, cfg };
}

/* ------------------------------------------------------- single-file build */
/* Folds the fonts, GSAP and every generated asset into the HTML, so the page
   is one file that can be opened from disk or emailed and still animates. */
const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2' };

function dataUri(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  if (ext === '.svg') {
    return 'data:image/svg+xml,' + encodeURIComponent(fs.readFileSync(file, 'utf8'))
      .replace(/'/g, '%27').replace(/"/g, '%22');
  }
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

function inlineEverything(html, outDir) {
  const fontsCss = path.join(outDir, 'vendor', 'fonts', 'fonts.css');
  if (fs.existsSync(fontsCss)) {
    const css = fs.readFileSync(fontsCss, 'utf8').replace(/url\('\.\/([^']+)'\)/g, (m, name) => {
      const f = path.join(path.dirname(fontsCss), name);
      return fs.existsSync(f) ? `url('${dataUri(f)}')` : m;
    });
    /* replacer functions, not strings: minified sources contain $& and $1,
       which String.replace would otherwise treat as substitution patterns */
    html = html.replace(/<link rel="stylesheet" href="vendor\/fonts\/fonts\.css">/,
      () => `<style>${css}</style>`);
  }

  const gsapFiles = ['gsap.min.js', 'ScrollTrigger.min.js']
    .map((f) => path.join(outDir, 'vendor', f)).filter(fs.existsSync);
  if (gsapFiles.length === 2) {
    const bundled = gsapFiles.map((f) => `<script>${fs.readFileSync(f, 'utf8')}</script>`).join('\n');
    html = html.replace('<!--INLINE-SCRIPTS-->', () => bundled);
  }
  html = html.replace('<!--INLINE-SCRIPTS-->', '');

  html = html.replace(/(src|href)="assets\/([^"]+)"/g, (m, attr, name) => {
    const f = path.join(outDir, 'assets', name);
    return fs.existsSync(f) ? `${attr}="${dataUri(f)}"` : m;
  });
  return html;
}

/* ------------------------------------------------------------------- cli */
function main(argv) {
  const args = argv.slice(2);
  const opts = { assets: !args.includes('--no-assets'), clean: args.includes('--clean'),
                 inline: args.includes('--inline') };
  const outIdx = args.indexOf('--out');
  if (outIdx > -1) opts.out = path.resolve(args[outIdx + 1]);

  let files = args.filter((a) => a.endsWith('.json'));
  if (!files.length) {
    files = fs.readdirSync(path.join(ROOT, 'brands'))
      .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
      .map((f) => path.join(ROOT, 'brands', f));
  }
  if (!files.length) { console.error('No brand files found in brands/'); process.exit(1); }

  files.forEach((f) => {
    warnings.length = 0;
    missingAssets.length = 0;
    const res = buildOne(f, files.length > 1
      ? { assets: opts.assets, clean: opts.clean, inline: opts.inline } : opts);
    const kb = (Buffer.byteLength(res.html) / 1024).toFixed(1);
    console.log(`✓ ${path.basename(f)} → ${path.relative(process.cwd(), res.outDir)}/index.html  (${kb} KB)`);
    var uniqMissing = Array.from(new Set(missingAssets));
    if (uniqMissing.length) {
      console.log(`  i ${uniqMissing.length} brand asset(s) not on disk yet, generated stand-ins: ${uniqMissing.join(', ')}`);
    }
    warnings.forEach((w) => console.log(`  ! ${w}`));
  });
}

if (require.main === module) main(process.argv);
module.exports = { buildOne, deepMerge, hexToRgb, mix, slug };
