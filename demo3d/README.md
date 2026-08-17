# Flat to Form

A browser demo that turns flat character illustrations into interactive 3D
meshes, and puts three image-to-3D engines side by side under identical
camera, lighting and scale.

Vanilla HTML/CSS/JS. No build step, no framework. three.js is vendored and
loaded through an importmap.

```
demo3d/
├── index.html            importmap + markup
├── styles.css            dark editorial theme
├── src/
│   ├── main.js           scene, lighting, controls, UI wiring
│   ├── characters.js     the registry — one entry per character
│   ├── loadCharacter.js  GLB load, orient, normalise, material banks
│   └── disintegrate.js   per-triangle attributes + the shader patch
├── vendor/               three.js (see "vendored three" below)
├── assets/
│   ├── raw/              pre-compression masters (not shipped)
│   ├── glb/              web-ready meshes
│   └── img/              source illustrations + webp thumbnails
├── scripts/              fixtures, inspect, compress, thumbs, build, verify
└── dist/                 drag-onto-a-static-host output
```

## Status of the assets

**The three GLBs in `assets/` are stand-in fixtures, not engine output.**

The source illustrations were generated (three original characters: Vesper, a
deep-sea salvage diver; Kiro, a forest guardian; Ansel-9, a botanist android),
but this container's egress policy blocks every Higgsfield host, so neither the
images nor the engine output could be fetched to disk:

```
d8j0ntlcm91z4.cloudfront.net:443   403 to CONNECT (policy denial)
upload.higgsfield.ai:443           403 to CONNECT (policy denial)
api.higgsfield.ai:443              403 to CONNECT (policy denial)
```

So `scripts/make-fixtures.mjs` builds substitutes at the same triangle counts,
texture sizes and file weights the real engines produce (181k / 797k / 246k
triangles, 2048² PBR maps, 74 MB raw). Everything downstream — normalisation,
the compression pipeline, the viewer, `dist/` — is exercised and verified
against those.

### Dropping in the real meshes

1. Put the engine GLBs in `assets/raw/` as `01-vesper.glb`, `02-kiro.glb`,
   `03-ansel9.glb`, and the source PNGs in `assets/img/` as `NN-name-src.png`.
2. `node scripts/inspect.mjs` — see whether each file is texture- or
   geometry-bound before compressing.
3. `scripts/compress.sh && node scripts/thumbs.mjs && scripts/build.sh`
4. Set `yaw` per character in `src/characters.js` (see below), then
   `node scripts/verify.mjs`.

Nothing else changes. `src/characters.js` is the only file that knows about
specific characters.

## Scripts

| | |
|---|---|
| `node scripts/make-fixtures.mjs` | build the stand-in GLBs + placeholder sources |
| `node scripts/inspect.mjs [dir]` | geometry-vs-texture weight breakdown per file |
| `scripts/compress.sh` | `resize 2048² → webp q85 → meshopt`, raw → web |
| `node scripts/thumbs.mjs` | downscale source PNGs to 256px webp |
| `scripts/build.sh` | assemble `dist/`, fail on any missing reference |
| `node scripts/verify.mjs [url] [out]` | headless browser check + screenshots |

## Compression

Measured on the fixtures:

| file | before | after | ratio |
|---|---|---|---|
| `01-vesper.glb` | 13.5 MB | 1.7 MB | 8.0× |
| `02-kiro.glb` | 41.0 MB | 4.7 MB | 8.8× |
| `03-ansel9.glb` | 19.5 MB | 2.4 MB | 8.1× |
| **total** | **74.0 MB** | **8.8 MB** | **8.4×** |

Triangle counts are preserved exactly — 180,600 / 797,368 / 245,980 before and
after. No `simplify`, no `weld`: the differing densities are the whole point of
the comparison, and meshopt does not touch them.

Where the weight sits varies by engine, which is why `inspect.mjs` runs first:
`01` was 63% texture (a single uncompressed 2048² PNG) and got its win from
`webp`; `02` was 53% geometry across 797k triangles and got its win from
`meshopt`. Reaching for one preset would have half-fixed each.

## Things that will bite you

**`three.module.js` needs `three.core.js` beside it.** Copying only the first
gives a silent 404 and a blank page. `GLTFLoader.js` additionally has static
imports of `../utils/BufferGeometryUtils.js` and `../utils/SkeletonUtils.js`,
so the vendored tree has to mirror `examples/jsm/` exactly. `build.sh` walks
every relative reference and fails if one is missing.

**Never transform a quantized attribute in place.** `meshopt` implies
`KHR_mesh_quantization`: positions arrive as normalized int16 in an interleaved
buffer, with dequantization folded into the node transform. Baking that
transform into the geometry silently destroys the model, because
`BufferAttribute.setX` *re-normalizes on write* and clamps everything outside
±1 — the character collapses into a dome at y=1 and no error is raised.
`toFloatAttributes()` in `loadCharacter.js` deinterleaves and widens to float
first. `verify.mjs` asserts the resulting bounding box, since a stats panel
cannot see this.

**Yaw before the bounding box.** Every engine picks its own "front". The yaw
offset is applied first, then the box is measured, then the model is scaled and
centred — measuring first and rotating after swings an off-centre figure off
the turntable axis.

**OrbitControls damping retains momentum.** Setting `camera.position` directly
gets eased back on the next `update()`. `placeCamera()` disables damping for
exactly one update, places the camera, updates, and restores it.

**A plain wireframe is useless above ~1M triangles** — it renders as a solid
blob. The mesh-structure view uses `MeshNormalMaterial` with `flatShading`.

**`window.__frame(dt)`** drives one frame manually, for headless verification.
It takes an explicit delta, so simulating six seconds of idle time costs a
dozen renders rather than 360.

## Disintegrate

Geometry is converted to non-indexed so each triangle owns its vertices, then
each triangle gets `aDir` (unit vector from the mesh centre to its centroid)
and `aRand`, written identically to all three vertices so the triangle
translates rigidly instead of shearing. Materials are patched via
`onBeforeCompile`:

```glsl
transformed += aDir * uDisintegrate * (0.06 + aRand * aRand * 0.34);
```

Squaring the random keeps most triangles close and lets a few fly, which reads
as dust rather than an evenly expanding shell. The uniform object is shared by
reference across all material banks — including `customDepthMaterial`, so the
shadow dissolves with the mesh instead of leaving a ghost.

## Verification

`node scripts/verify.mjs` loads the page in headless Chromium, drives all three
characters, all three surface modes and the disintegrate slider, and asserts:

- normalisation (height 2.00, feet at y=0, centred) — geometry, not labels
- identical camera across all three characters
- three distinct triangle counts
- engine, cost, file size and thumbnail present for each
- surface mode: button state and material type agree
- auto-orbit pauses on drag and resumes after the delay
- zero console errors, zero failed requests

One caveat it encodes: three's `FileLoader` wraps the response body in a
progress-tracking `ReadableStream`, and Chromium reports the already-completed
original fetch as `ERR_ABORTED` once that wrapper is collected. A 2xx for the
same URL is proof the bytes arrived, so that case is filtered rather than
counted as a 404.

Screenshots land in `.verify/`. Under software GL the backdrop-filtered control
bar can rasterize a frame behind the canvas, so `shoot()` waits two real
animation frames before capturing, and mode state is asserted programmatically
rather than read off pixels.
