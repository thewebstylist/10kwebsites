#!/usr/bin/env node
'use strict';
/*
 * art.js — real photography for the foreground slots.
 *
 *   node tools/art.js brands/x.json --plan
 *       Writes art/<brand>.plan.json and prints one prompt per image slot plus
 *       the credit cost. Generates nothing and spends nothing.
 *
 *   node tools/art.js brands/x.json --ingest results.json
 *   node tools/art.js brands/x.json --ingest ./incoming
 *       Takes finished images, whether generated or shot or supplied by the
 *       client, and normalises each one into the slot the brand file points at:
 *       trims, resizes, converts, and reports anything that will not sit right.
 *
 *   node tools/art.js brands/x.json --audit
 *       Checks the real images already wired into the brand file.
 *
 * The model calls themselves are not made here. This environment reaches the
 * image service through an assistant tool rather than an API key, so the
 * deterministic half lives in this script and the generating half is driven by
 * whoever runs it. --plan hands over the exact prompts; --ingest takes the
 * results back. That split also means the same command normalises a client's
 * own photographs, which is the more common case.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { imageSize } = require('./imagesize');

const ROOT = path.join(__dirname, '..');

/* show a path relative to the project when it lives inside it, absolute when
   it does not, rather than a stack of ../../.. */
function shortPath(abs) {
  const rel = path.relative(ROOT, abs);
  return rel.startsWith('..') ? abs : rel;
}

/* Target boxes come from what the template actually paints, doubled for
   retina, with headroom: a product cut-out reaches ~540 CSS px tall, a
   lifestyle card ~560, the story panel ~760. */
const KINDS = {
  product: { aspect: '2:3', height: 1400, alpha: true, format: 'png',
             note: 'transparent cut-out, rotated and drop-shadowed by the page' },
  photo:   { aspect: '4:5', width: 1200, height: 1500, alpha: false, format: 'webp',
             note: 'fills a rounded card, cropped to cover' },
  story:   { aspect: '4:5', width: 1600, height: 2000, alpha: false, format: 'webp',
             note: 'full-height panel revealed by a clip-path wipe' },
  muse:    { aspect: '3:4', width: 1200, alpha: true, format: 'png',
             note: 'oversized illustration sitting behind the product' }
};

const slug = (s) => String(s || '').toLowerCase().normalize('NFKD')
  .replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-') || 'x';

/* the page's serif-emphasis markup is for the page, not for a model */
const plain = (s) => String(s || '').replace(/\*([^*]+)\*/g, '$1').trim();

/* An image model cannot read #f04a24. Say the colour out loud instead: hue
   name from the wheel, plus what its lightness and saturation actually look
   like. "a vivid orange-red" gets a usable can back; the hex does not. */
const HUES = [
  [0, 'red'], [14, 'orange-red'], [28, 'orange'], [42, 'amber'], [54, 'yellow'],
  [70, 'yellow-green'], [90, 'green'], [150, 'emerald green'], [175, 'teal'],
  [195, 'cyan'], [215, 'sky blue'], [235, 'blue'], [260, 'indigo'],
  [280, 'violet'], [300, 'magenta'], [335, 'pink'], [352, 'rose pink'], [360, 'red']
];

function describeColour(hex) {
  let h = String(hex || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return String(hex || '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let hue = 0;
  if (d !== 0) {
    if (max === r) hue = 60 * (((g - b) / d) % 6);
    else if (max === g) hue = 60 * ((b - r) / d + 2);
    else hue = 60 * ((r - g) / d + 4);
  }
  if (hue < 0) hue += 360;

  if (sat < 0.08) {
    if (l > 0.92) return 'near-white';
    if (l > 0.7) return 'light warm grey';
    if (l > 0.35) return 'mid grey';
    return 'near-black';
  }
  const name = (HUES.find(([stop]) => hue <= stop) || HUES[HUES.length - 1])[1];
  const warm = hue >= 20 && hue <= 60;
  /* colours this family of brands has a real word for, which a hue name misses */
  if (l > 0.88 && hue >= 30 && hue <= 60 && d < 0.22) return 'cream';
  if (l > 0.8 && hue >= 12 && hue < 30) return 'pale peach';
  if (l < 0.35 && (hue >= 340 || hue <= 18) && d < 0.5) return 'deep wine red';

  const tone = l > 0.86 ? 'very pale ' : l > 0.72 ? 'pale ' : l < 0.22 ? 'very deep ' : l < 0.38 ? 'deep ' : '';
  /* judge punch by chroma, not HSL saturation: a pale tint scores high on
     saturation while reading as a soft wash, and calling it vivid is wrong */
  const punch = d > 0.55 ? 'vivid ' : d < 0.14 ? 'muted ' : '';
  return `${tone}${punch}${name}`.trim();
}

function loadConfig(file) {
  const defaults = JSON.parse(fs.readFileSync(path.join(ROOT, 'brands', '_defaults.json'), 'utf8'));
  delete defaults._comment;
  const brand = JSON.parse(fs.readFileSync(file, 'utf8'));
  const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const merge = (a, b) => {
    if (!isPlain(a) || !isPlain(b)) return b === undefined ? a : b;
    const out = Object.assign({}, a);
    for (const k of Object.keys(b)) out[k] = isPlain(a[k]) && isPlain(b[k]) ? merge(a[k], b[k]) : b[k];
    return out;
  };
  return { cfg: merge(defaults, brand), raw: brand };
}

/* ------------------------------------------------------------- prompting -- */
/* The art direction the template is built around, expressed once. Everything
   below layers the specific subject on top of it. */
function houseStyle(cfg) {
  const c = cfg.theme.colors;
  return [
    cfg.art.style,
    `Colour world: ${describeColour(c.primary)} dominant, ${describeColour(c.cream)} in the light, ` +
      `${describeColour(c.deep)} in the shadows.`,
    'Warm, sun-soaked, editorial. Real photographic grain, no plastic render sheen.',
    cfg.art.negative
  ].filter(Boolean).join(' ');
}

function productPrompt(cfg, p) {
  const shape = p.shape || 'can';
  const colour = p.color || cfg.theme.colors.primary;
  return [
    `Studio packshot of a single ${shape} of ${cfg.brand.name} ${p.name}, a ${cfg.brand.category}.`,
    `The ${shape} is ${describeColour(colour)} with a ${describeColour(cfg.theme.colors.cream)} label band.`,
    'Upright, centred, very slight three-quarter turn so one edge catches the light.',
    'The whole product is inside the frame with generous empty space on every side, nothing cropped or touching an edge.',
    `Plain seamless ${cfg.art.background} in a flat mid tone that contrasts the product, so the subject cuts out cleanly.`,
    'Large soft key light from the upper left, gentle falloff, one crisp specular highlight down the edge, soft contact shadow directly under the base.',
    'Sharp throughout, high material detail, commercial product photography.',
    houseStyle(cfg)
  ].join(' ');
}

function photoPrompt(cfg, card, wide) {
  const moment = [card.headline, card.body].filter(Boolean).map(plain).join('. ');
  return [
    `Editorial lifestyle photograph for a ${cfg.brand.category} brand. ${moment}`,
    wide ? 'Wider framing with room for the scene to breathe.' : 'Vertical framing, subject in the lower two thirds.',
    'Candid and unposed, real people at ease, natural light, shallow depth of field, 35mm.',
    'Shot late in the day when the light goes warm and long.',
    houseStyle(cfg)
  ].join(' ');
}

function musePrompt(cfg) {
  return [
    `A single large decorative line illustration for ${cfg.brand.name}, a ${cfg.brand.category}.`,
    'Continuous thin outlines only, no fill, no shading, drawn in one weight.',
    'Centred on a fully transparent background, generous margin, nothing cropped.',
    houseStyle(cfg)
  ].join(' ');
}

/* ----------------------------------------------------------------- plan -- */
function buildPlan(cfg, brandFile) {
  const brandSlug = slug(cfg.brand.name);
  const fallbackDir = `art/${brandSlug}`;
  const slots = [];

  (cfg.range.products || []).forEach((p) => {
    const id = `product-${slug(p.name)}`;
    slots.push({
      id, kind: 'product', label: p.name,
      target: p.image || `${fallbackDir}/${id}.png`,
      writesTo: p.image ? null : { path: `range.products[name=${p.name}].image` },
      aspect: KINDS.product.aspect,
      cutout: true,
      prompt: p.prompt || productPrompt(cfg, p)
    });
  });

  (cfg.lifestyle.cards || []).forEach((c, i) => {
    const id = `shot-${i + 1}`;
    slots.push({
      id, kind: 'photo', label: c.headline || id,
      target: c.image || `${fallbackDir}/${id}.webp`,
      writesTo: c.image ? null : { path: `lifestyle.cards[${i}].image` },
      aspect: KINDS.photo.aspect,
      prompt: c.prompt || photoPrompt(cfg, c)
    });
  });

  if (cfg.story.enabled) {
    slots.push({
      id: 'shot-story', kind: 'story', label: cfg.story.heading,
      target: cfg.story.image || `${fallbackDir}/shot-story.webp`,
      writesTo: cfg.story.image ? null : { path: 'story.image' },
      aspect: KINDS.story.aspect,
      prompt: cfg.story.prompt || photoPrompt(cfg, { headline: cfg.story.heading, body: (cfg.story.paragraphs || [])[0] }, true)
    });
  }

  if (cfg.art.muse) {
    slots.push({
      id: 'muse', kind: 'muse', label: 'illustration',
      target: cfg.assets.muse || `${fallbackDir}/muse.png`,
      writesTo: cfg.assets.muse ? null : { path: 'assets.muse' },
      aspect: KINDS.muse.aspect,
      cutout: true,
      prompt: cfg.art.musePrompt || musePrompt(cfg)
    });
  }

  return {
    brand: cfg.brand.name,
    brandFile: path.relative(ROOT, path.resolve(brandFile)),
    model: cfg.art.model,
    resolution: cfg.art.resolution,
    creditsPerImage: cfg.art.resolution === '4k' ? 4 : 2,
    slots
  };
}

/* --------------------------------------------------------------- ingest -- */
function requireSharp() {
  try {
    return require('sharp');
  } catch (e) {
    console.error('--ingest needs sharp for resizing and format conversion:  npm i sharp');
    process.exit(2);
  }
}

function fetchToTemp(url, id) {
  const tmp = path.join(ROOT, 'art', '.tmp');
  fs.mkdirSync(tmp, { recursive: true });
  const out = path.join(tmp, `${id}-${Date.now()}`);
  /* curl rather than fetch: it already honours this environment's proxy config */
  execFileSync('curl', ['-sSfL', '-o', out, url], { stdio: ['ignore', 'ignore', 'inherit'] });
  return out;
}

function resolveSources(arg, slots) {
  const found = {};
  const stat = fs.existsSync(arg) ? fs.statSync(arg) : null;
  if (stat && stat.isDirectory()) {
    for (const f of fs.readdirSync(arg)) {
      const id = path.basename(f, path.extname(f));
      if (slots.some((s) => s.id === id)) found[id] = path.join(arg, f);
    }
    return found;
  }
  if (stat && stat.isFile()) return JSON.parse(fs.readFileSync(arg, 'utf8'));
  throw new Error(`--ingest needs a directory or a JSON map, got: ${arg}`);
}

async function ingestOne(sharp, slot, source, opts) {
  const spec = KINDS[slot.kind];
  const local = /^https?:\/\//.test(source) ? fetchToTemp(source, slot.id) : path.resolve(source);
  if (!fs.existsSync(local)) throw new Error(`source missing: ${source}`);

  const target = path.resolve(ROOT, slot.target);
  const ext = path.extname(target).toLowerCase();
  const notes = [];

  let img = sharp(local, { failOn: 'none' });
  const meta = await img.metadata();

  if (spec.alpha) {
    if (!meta.hasAlpha) {
      /* An opaque photo in a cut-out slot is not a smaller problem than a
         missing file, it is a worse one: the page rotates this and casts a
         shadow on it, so a rectangle of background reads as a bug. Refuse
         rather than write something unusable. */
      if (!opts.force) {
        return { skipped: true, notes: [
          'opaque image in a cut-out slot. Remove its background first, then ingest again.',
          'Pass --force to write it as-is anyway.'
        ] };
      }
      notes.push('written with its background still attached, because --force was passed');
    }
    /* a cut-out arrives with dead space around it; trimming makes the page's
       own sizing and rotation consistent across every product */
    img = img.trim({ threshold: 1 });
    if (ext !== '.png' && ext !== '.webp') {
      notes.push(`${path.basename(target)} cannot hold transparency; give this slot a .png path`);
    }
  }

  if (spec.width && spec.height && !spec.alpha) {
    const srcRatio = meta.width / meta.height;
    const dstRatio = spec.width / spec.height;
    const kept = Math.min(srcRatio, dstRatio) / Math.max(srcRatio, dstRatio);
    if (kept < 0.7) {
      notes.push(`source is ${srcRatio > dstRatio ? 'much wider' : 'much taller'} than the slot, so about ` +
                 `${Math.round((1 - kept) * 100)}% of the frame is cropped away`);
    }
    img = img.resize(spec.width, spec.height, { fit: 'cover', position: 'attention' });
  } else {
    /* never upscale: a cut-out enlarged past its real resolution just looks
       soft on the page, and saying so is more useful than hiding it */
    img = img.resize({ height: spec.height, width: spec.width, fit: 'inside', withoutEnlargement: true });
  }

  if (ext === '.webp') img = img.webp({ quality: 82, effort: 5 });
  else if (ext === '.jpg' || ext === '.jpeg') img = img.jpeg({ quality: 86, mozjpeg: true });
  else img = img.png({ compressionLevel: 9, palette: !spec.alpha });

  const { data, info } = await img.toBuffer({ resolveWithObject: true });

  if (spec.height && info.height < spec.height * 0.8) {
    notes.push(`ends up ${info.width}x${info.height}, short of the ${spec.height}px this slot shows on a retina screen; ` +
               'generate or shoot it larger rather than upscaling');
  }
  const kb = Math.round(data.length / 1024);
  if (kb > 700) notes.push(`${kb} KB is heavy; a .webp target would cut it by roughly half`);

  if (!opts.dryRun) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
  }
  return { target: shortPath(target), size: { width: info.width, height: info.height }, notes, kb };
}

/* patch the brand file so slots that had no path now point at what was written */
function patchBrandFile(brandFile, writes) {
  if (!writes.length) return 0;
  const raw = JSON.parse(fs.readFileSync(brandFile, 'utf8'));
  let n = 0;
  for (const w of writes) {
    const m = w.path.match(/^range\.products\[name=(.+)\]\.image$/);
    if (m) {
      const p = (raw.range && raw.range.products || []).find((x) => x.name === m[1]);
      if (p) { p.image = w.value; n++; }
      continue;
    }
    const l = w.path.match(/^lifestyle\.cards\[(\d+)\]\.image$/);
    if (l) {
      const c = (raw.lifestyle && raw.lifestyle.cards || [])[Number(l[1])];
      if (c) { c.image = w.value; n++; }
      continue;
    }
    if (w.path === 'story.image') { raw.story = raw.story || {}; raw.story.image = w.value; n++; continue; }
    if (w.path === 'assets.muse') { raw.assets = raw.assets || {}; raw.assets.muse = w.value; n++; }
  }
  fs.writeFileSync(brandFile, JSON.stringify(raw, null, 2) + '\n');
  return n;
}

/* ---------------------------------------------------------------- audit -- */
function audit(plan) {
  let problems = 0;
  for (const slot of plan.slots) {
    const file = path.resolve(ROOT, slot.target);
    const spec = KINDS[slot.kind];
    if (!fs.existsSync(file)) { console.log(`  --   ${slot.id}: not on disk yet (${slot.target})`); continue; }
    const size = imageSize(file);
    const kb = Math.round(fs.statSync(file).size / 1024);
    const issues = [];
    if (!size) issues.push('unreadable header');
    else {
      if (spec.height && size.height < spec.height * 0.7) issues.push(`only ${size.height}px tall, wants ~${spec.height}`);
      if (spec.alpha && path.extname(file).toLowerCase() === '.jpg') issues.push('JPEG cannot hold transparency');
    }
    if (kb > 900) issues.push(`${kb} KB is heavy for the web`);
    if (issues.length) problems++;
    console.log(`  ${issues.length ? 'note' : 'ok  '} ${slot.id}: ${size ? size.width + 'x' + size.height : '?'} ${kb} KB${issues.length ? ' — ' + issues.join('; ') : ''}`);
  }
  return problems;
}

/* ------------------------------------------------------------------ cli -- */
async function main() {
  const args = process.argv.slice(2);
  const brandFile = args.find((a) => a.endsWith('.json') && a.includes('brands'))
    || args.find((a) => a.endsWith('.json'));
  if (!brandFile) {
    console.error('usage: node tools/art.js brands/<brand>.json --plan | --ingest <dir|map.json> | --audit');
    process.exit(2);
  }
  const { cfg } = loadConfig(brandFile);
  const plan = buildPlan(cfg, brandFile);

  if (args.includes('--audit')) {
    console.log(`\n${plan.brand}: auditing ${plan.slots.length} image slots\n`);
    const problems = audit(plan);
    console.log(`\n${problems ? problems + ' slot(s) need attention' : 'every slot on disk looks right'}`);
    return;
  }

  const ingestIdx = args.indexOf('--ingest');
  if (ingestIdx > -1) {
    const sharp = requireSharp();
    const sources = resolveSources(args[ingestIdx + 1], plan.slots);
    const dryRun = args.includes('--dry-run');
    const writes = [];
    console.log(`\n${plan.brand}: ingesting ${Object.keys(sources).length} image(s)${dryRun ? ' (dry run)' : ''}\n`);
    for (const slot of plan.slots) {
      if (!sources[slot.id]) continue;
      try {
        const r = await ingestOne(sharp, slot, sources[slot.id], { dryRun, force: args.includes('--force') });
        if (r.skipped) {
          console.log(`  skip ${slot.id}: not written`);
          r.notes.forEach((n) => console.log(`       ! ${n}`));
          continue;
        }
        console.log(`  ok   ${slot.id} -> ${r.target}  ${r.size.width}x${r.size.height}  ${r.kb} KB`);
        r.notes.forEach((n) => console.log(`       ! ${n}`));
        if (slot.writesTo) writes.push({ path: slot.writesTo.path, value: r.target });
      } catch (e) {
        console.log(`  FAIL ${slot.id}: ${e.message}`);
      }
    }
    const patched = dryRun ? 0 : patchBrandFile(path.resolve(brandFile), writes);
    if (patched) console.log(`\n  ${patched} image path(s) written into ${brandFile}`);
    console.log('\nRebuild to see them:  node build.js ' + brandFile + ' --inline');
    fs.rmSync(path.join(ROOT, 'art', '.tmp'), { recursive: true, force: true });
    return;
  }

  /* default: --plan */
  const outDir = path.join(ROOT, 'art');
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${slug(cfg.brand.name)}.plan.json`);
  fs.writeFileSync(file, JSON.stringify(plan, null, 2) + '\n');

  const byTarget = {};
  plan.slots.forEach((s) => { (byTarget[s.target] = byTarget[s.target] || []).push(s.id); });
  const clashes = Object.entries(byTarget).filter(([, ids]) => ids.length > 1);

  console.log(`\n${plan.brand} — ${plan.slots.length} image slots`);
  console.log(`model ${plan.model} at ${plan.resolution}, ${plan.creditsPerImage} credits each, ` +
              `${plan.slots.length * plan.creditsPerImage} credits for the set\n`);
  for (const s of plan.slots) {
    console.log(`── ${s.id}  [${s.kind}${s.cutout ? ', needs background removed' : ''}]  ${s.aspect}  -> ${s.target}`);
    console.log(`   ${s.prompt}\n`);
  }
  if (clashes.length) {
    console.log('Shared targets — these slots write to one file, so the last one ingested wins:');
    clashes.forEach(([target, ids]) => console.log(`  ! ${ids.join(' and ')} both point at ${target}`));
    console.log('  Give each its own path in the brand file if they should be different pictures.\n');
  }
  console.log(`Plan written to ${path.relative(process.cwd(), file)}`);
  console.log('Nothing generated and nothing spent. Next: generate each prompt, then');
  console.log(`  node tools/art.js ${brandFile} --ingest results.json`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
