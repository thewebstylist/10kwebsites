// Where does the weight actually sit? Geometry or textures?
//
// It varies a lot by engine — one file can be almost entirely mesh data while
// another is almost entirely uncompressed PNG. They need different fixes, so
// look before reaching for a preset.
//
//   usage: node scripts/inspect.mjs [dir]

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const dir = resolve(HERE, '..', process.argv[2] || 'assets/raw');

// compressed files carry EXT_meshopt_compression; without the decoder
// registered the read throws "Missing required extension"
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

const mb = (b) => (b / 1048576).toFixed(2).padStart(7) + ' MB';
const pct = (n, d) => (d ? ((n / d) * 100).toFixed(0) : '0').padStart(3) + '%';

let totals = { file: 0, geo: 0, tex: 0, tris: 0 };

for (const name of readdirSync(dir).filter((f) => f.endsWith('.glb')).sort()) {
  const path = join(dir, name);
  const fileBytes = statSync(path).size;
  const doc = await io.read(path);
  const root = doc.getRoot();

  let geo = 0, tris = 0, verts = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      const pos = prim.getAttribute('POSITION');
      tris += (idx ? idx.getCount() : pos.getCount()) / 3;
      verts += pos.getCount();
      if (idx) geo += idx.getArray().byteLength;
      for (const sem of prim.listSemantics()) {
        geo += prim.getAttribute(sem).getArray().byteLength;
      }
    }
  }

  const texRows = root.listTextures().map((t) => ({
    slot: t.getName() || '(unnamed)',
    mime: t.getMimeType(),
    size: t.getSize()?.join('×') ?? '?',
    bytes: t.getImage()?.byteLength ?? 0,
  }));
  const tex = texRows.reduce((a, t) => a + t.bytes, 0);

  totals.file += fileBytes; totals.geo += geo; totals.tex += tex; totals.tris += tris;

  const ext = root.listExtensionsUsed().map((e) => e.extensionName);
  // meshopt buffers are decompressed on read, so the in-memory accessor size is
  // not what sits on disk — report it as "decoded" and drop the share figure
  const packed = ext.includes('EXT_meshopt_compression');

  console.log(`\n${'─'.repeat(72)}`);
  console.log(`${name}   ${mb(fileBytes)}   ${Math.round(tris).toLocaleString()} tris · ${verts.toLocaleString()} verts`);
  console.log(`${'─'.repeat(72)}`);
  console.log(`  geometry   ${mb(geo)}   ${packed ? '(decoded; meshopt-packed on disk)' : pct(geo, fileBytes)}`);
  console.log(`  textures   ${mb(tex)}   ${pct(tex, fileBytes)}   (${texRows.length} map${texRows.length === 1 ? '' : 's'})`);
  for (const t of texRows) {
    console.log(`      · ${t.slot.padEnd(22)} ${String(t.size).padStart(9)}  ${t.mime.padEnd(10)} ${mb(t.bytes)}`);
  }
  console.log(`  extensions ${ext.length ? ext.join(', ') : 'none'}`);
  if (!packed) {
    console.log(`  verdict    ${tex > geo ? 'texture-bound → resize + webp does the work'
                                          : 'geometry-bound → meshopt does the work'}`);
  }
}

console.log(`\n${'═'.repeat(72)}`);
console.log(`TOTAL      ${mb(totals.file)}   geometry ${mb(totals.geo)} · textures ${mb(totals.tex)}`);
console.log(`           ${Math.round(totals.tris).toLocaleString()} triangles across ${readdirSync(dir).filter(f => f.endsWith('.glb')).length} files`);
