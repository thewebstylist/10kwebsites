// Build stand-in character GLBs at realistic complexity.
//
// These are FIXTURES, not engine output. They exist so the viewer and the
// compression pipeline can be exercised and verified end to end at the same
// triangle counts, texture sizes and file weights the real engines produce.
// Drop the real GLBs over the top of assets/glb/*.glb and nothing else changes.
//
//   usage: node scripts/make-fixtures.mjs

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Document, NodeIO } from '@gltf-transform/core';
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../assets/glb');
const RAW = resolve(HERE, '../assets/raw');
const IMG = resolve(HERE, '../assets/img');

// ── deterministic rng, so fixtures are reproducible ─────────────────

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ── minimal PNG encoder (RGB8, filter 0) ────────────────────────────

function crc32(buf) {
  let c, table = crc32.t;
  if (!table) {
    table = crc32.t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgb) {
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── procedural texture maps ─────────────────────────────────────────

function makeTexture(size, kind, palette, seed) {
  const rand = rng(seed);
  const buf = Buffer.alloc(size * size * 3);
  const [ra, ga, ba] = palette[0];
  const [rb, gb, bb] = palette[1];
  const [rc, gc, bc] = palette[2];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 3;
      const u = x / size, v = y / size;

      // panel seams + horizontal banding, so the map has real structure
      const seam = (x % 256 < 3 || y % 256 < 3) ? 1 : 0;
      const band = Math.sin(v * Math.PI * 9.0) * 0.5 + 0.5;
      const blot = Math.sin(u * 31.0 + v * 17.0) * Math.cos(u * 13.0 - v * 23.0);

      // grain keeps the PNG from over-compressing, matching real baked maps
      const n = (rand() - 0.5) * 26;

      if (kind === 'normal') {
        buf[i]     = clamp(128 + blot * 34 + n * 0.5 + seam * 40);
        buf[i + 1] = clamp(128 + band * 22 - 11 + n * 0.5 - seam * 40);
        buf[i + 2] = clamp(238 + n * 0.2);
      } else if (kind === 'orm') {
        buf[i]     = 255;                                  // occlusion
        buf[i + 1] = clamp(150 + band * 60 + n - seam * 70); // roughness
        buf[i + 2] = clamp(seam ? 200 : 30 + blot * 22);     // metalness
      } else {
        const t = band * 0.55 + (blot * 0.5 + 0.5) * 0.45;
        buf[i]     = clamp(mix(ra, rb, t) + (seam ? (rc - 128) : 0) + n);
        buf[i + 1] = clamp(mix(ga, gb, t) + (seam ? (gc - 128) : 0) + n);
        buf[i + 2] = clamp(mix(ba, bb, t) + (seam ? (bc - 128) : 0) + n);
      }
    }
  }
  return encodePNG(size, size, buf);
}

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const mix = (a, b, t) => a + (b - a) * t;

// ── humanoid geometry ───────────────────────────────────────────────

// Segment counts are dialled to land near a target triangle budget; the
// figure is a stand-in silhouette, not a sculpt.
function buildFigure({ detail, chunky = false, ears = false }) {
  const d = detail;
  const parts = [];
  const add = (geo, x, y, z, sx = 1, sy = 1, sz = 1) => {
    geo.scale(sx, sy, sz);
    geo.translate(x, y, z);
    parts.push(geo);
  };

  const headR = chunky ? 0.30 : 0.24;
  const headY = chunky ? 1.34 : 1.60;
  const torsoY = chunky ? 0.86 : 1.05;
  const armSpan = chunky ? 0.40 : 0.34;
  const armLen = chunky ? 0.42 : 0.66;
  const legLen = chunky ? 0.44 : 0.86;

  // head
  add(new THREE.SphereGeometry(headR, d * 2, d), 0, headY, 0, 1, 1.08, 0.94);

  if (ears) {
    add(new THREE.SphereGeometry(headR * 0.55, d, d), -headR * 0.92, headY + headR * 0.62, 0, 0.5, 1.25, 0.85);
    add(new THREE.SphereGeometry(headR * 0.55, d, d), headR * 0.92, headY + headR * 0.62, 0, 0.5, 1.25, 0.85);
  }

  // neck
  add(new THREE.CylinderGeometry(0.075, 0.095, 0.13, d, Math.max(2, d >> 3)), 0, headY - headR * 1.02, 0);

  // torso
  add(new THREE.SphereGeometry(1, d * 2, d), 0, torsoY, 0,
    chunky ? 0.36 : 0.28, chunky ? 0.34 : 0.40, chunky ? 0.27 : 0.19);

  // hips
  add(new THREE.SphereGeometry(1, d * 2, d), 0, torsoY - (chunky ? 0.28 : 0.36), 0,
    chunky ? 0.30 : 0.23, 0.16, chunky ? 0.24 : 0.17);

  for (const s of [-1, 1]) {
    // upper + lower arm, hanging clear of the torso
    add(new THREE.CylinderGeometry(0.062, 0.052, armLen, d, Math.max(2, d >> 3)),
      s * armSpan, torsoY - armLen * 0.18, 0);
    add(new THREE.CylinderGeometry(0.052, 0.044, armLen * 0.92, d, Math.max(2, d >> 3)),
      s * (armSpan + 0.035), torsoY - armLen * 1.06, 0);
    // hand
    add(new THREE.SphereGeometry(0.062, d, d),
      s * (armSpan + 0.05), torsoY - armLen * 1.56, 0, 0.85, 1.25, 0.55);
    // shoulder
    add(new THREE.SphereGeometry(0.085, d, d), s * armSpan * 0.86, torsoY + (chunky ? 0.18 : 0.26), 0);

    // legs
    add(new THREE.CylinderGeometry(0.082, 0.068, legLen, d, Math.max(2, d >> 3)),
      s * 0.135, legLen * 0.5 + 0.06, 0);
    // foot
    add(new THREE.BoxGeometry(0.15, 0.09, 0.27, d >> 1, d >> 2, d >> 1),
      s * 0.135, 0.045, 0.045);
  }

  const merged = mergeGeometries(parts.map((g) => {
    const c = new THREE.BufferGeometry();
    c.setAttribute('position', g.attributes.position);
    c.setAttribute('normal', g.attributes.normal);
    c.setAttribute('uv', g.attributes.uv);
    c.setIndex(g.index);
    return c;
  }), false);

  merged.computeVertexNormals();
  return merged;
}

function triCount(geo) {
  return (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
}

// tune `detail` until the triangle count lands near the target
function figureForBudget(target, opts) {
  let best = null;
  for (let d = 6; d <= 260; d += 2) {
    const geo = buildFigure({ ...opts, detail: d });
    const t = triCount(geo);
    if (!best || Math.abs(t - target) < Math.abs(best.t - target)) {
      best?.geo.dispose();
      best = { geo, t, d };
    } else {
      geo.dispose();
      if (t > target) break;
    }
  }
  return best;
}

// ── glb assembly ────────────────────────────────────────────────────

async function writeGLB(path, geo, maps, name) {
  const doc = new Document();
  const buffer = doc.createBuffer();

  const pos = geo.attributes.position.array;
  const nor = geo.attributes.normal.array;
  const uv = geo.attributes.uv.array;
  const idx = geo.index.array;

  // POSITION bounds are derived by the writer from the accessor array
  const aPos = doc.createAccessor('POSITION').setType('VEC3')
    .setArray(new Float32Array(pos)).setBuffer(buffer);
  const aNor = doc.createAccessor('NORMAL').setType('VEC3')
    .setArray(new Float32Array(nor)).setBuffer(buffer);
  const aUv = doc.createAccessor('TEXCOORD_0').setType('VEC2')
    .setArray(new Float32Array(uv)).setBuffer(buffer);
  const aIdx = doc.createAccessor('indices').setType('SCALAR')
    .setArray(new Uint32Array(idx)).setBuffer(buffer);

  const material = doc.createMaterial(name)
    .setRoughnessFactor(1).setMetallicFactor(1)
    .setBaseColorFactor([1, 1, 1, 1]);

  for (const [slot, png] of Object.entries(maps)) {
    const tex = doc.createTexture(`${name}-${slot}`)
      .setImage(new Uint8Array(png))
      .setMimeType('image/png')
      .setURI(`${name}-${slot}.png`);
    if (slot === 'baseColor') material.setBaseColorTexture(tex);
    if (slot === 'normal') material.setNormalTexture(tex);
    if (slot === 'orm') material.setMetallicRoughnessTexture(tex);
  }

  const prim = doc.createPrimitive()
    .setAttribute('POSITION', aPos)
    .setAttribute('NORMAL', aNor)
    .setAttribute('TEXCOORD_0', aUv)
    .setIndices(aIdx)
    .setMaterial(material);

  const mesh = doc.createMesh(name).addPrimitive(prim);
  const node = doc.createNode(name).setMesh(mesh);
  doc.createScene('scene').addChild(node);

  const glb = await new NodeIO().writeBinary(doc);
  writeFileSync(path, glb);
  return glb.byteLength;
}

// ── the three characters ────────────────────────────────────────────

const SPECS = [
  {
    file: '01-vesper.glb', name: 'vesper', target: 184000, seed: 11,
    opts: {}, maps: ['baseColor'],
    palette: [[62, 96, 104], [176, 118, 66], [206, 168, 96]],
  },
  {
    file: '02-kiro.glb', name: 'kiro', target: 800000, seed: 23,
    opts: { chunky: true, ears: true }, maps: ['baseColor', 'normal', 'orm'],
    palette: [[92, 104, 58], [186, 152, 92], [226, 216, 196]],
  },
  {
    file: '03-ansel9.glb', name: 'ansel9', target: 250000, seed: 37,
    opts: {}, maps: ['baseColor', 'orm'],
    palette: [[218, 212, 200], [148, 116, 74], [255, 138, 60]],
  },
];

// ── stand-in source illustrations ───────────────────────────────────
// 2:3 portrait placeholders at full illustration resolution, so the thumbnail
// downscaling step has something real to chew on.

function makeSourcePlaceholder(spec) {
  const W = 1024, H = 1536;
  const rand = rng(spec.seed + 7);
  const buf = Buffer.alloc(W * H * 3);
  const [a, b, c] = spec.palette;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const v = y / H, u = x / W;

      // flat studio backdrop, very slightly graded
      let r = 196 - v * 24, g = 194 - v * 24, bl = 190 - v * 24;

      // a crude standing silhouette: head, torso, two arms, two legs
      const cx = Math.abs(u - 0.5);
      const inHead = Math.hypot((u - 0.5) * 2.6, (v - 0.17) * 1.7) < 0.115;
      const inTorso = v > 0.25 && v < 0.56 && cx < 0.155 - (v - 0.25) * 0.06;
      const inArm = v > 0.27 && v < 0.60 && cx > 0.175 && cx < 0.235;
      const inLeg = v > 0.56 && v < 0.93 && cx > 0.035 && cx < 0.135;

      if (inHead || inTorso || inArm || inLeg) {
        const t = (Math.sin(v * 22) * 0.5 + 0.5) * 0.6 + u * 0.4;
        r = mix(a[0], b[0], t); g = mix(a[1], b[1], t); bl = mix(a[2], b[2], t);
        if (inHead) { r = mix(r, c[0], 0.45); g = mix(g, c[1], 0.45); bl = mix(bl, c[2], 0.45); }
        // three-quarter key from the left
        const shade = 1 - cx * 0.9 + (u < 0.5 ? 0.08 : -0.06);
        r *= shade; g *= shade; bl *= shade;
      }

      const n = (rand() - 0.5) * 9;
      buf[i] = clamp(r + n); buf[i + 1] = clamp(g + n); buf[i + 2] = clamp(bl + n);
    }
  }
  return encodePNG(W, H, buf);
}

mkdirSync(OUT, { recursive: true });
mkdirSync(RAW, { recursive: true });
mkdirSync(IMG, { recursive: true });

for (const spec of SPECS) {
  const t0 = Date.now();
  const { geo, t, d } = figureForBudget(spec.target, spec.opts);

  const maps = {};
  for (const slot of spec.maps) {
    maps[slot] = makeTexture(2048, slot === 'baseColor' ? 'albedo' : slot,
      spec.palette, spec.seed + slot.length);
  }

  const bytes = await writeGLB(resolve(RAW, spec.file), geo, maps, spec.name);

  const srcName = spec.file.replace(/\.glb$/, '-src.png');
  writeFileSync(resolve(IMG, srcName), makeSourcePlaceholder(spec));
  console.log(
    `${spec.file.padEnd(16)} detail=${String(d).padStart(3)}  ` +
    `tris=${String(Math.round(t)).padStart(7)}  ` +
    `maps=${spec.maps.length}  ` +
    `${(bytes / 1048576).toFixed(1)} MB  (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
  );
}

console.log(`\nraw fixtures written to assets/raw/ — run scripts/compress.sh next`);
