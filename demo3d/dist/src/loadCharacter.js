// Load one character GLB and normalise it so all three engines land on the
// same turntable at the same height, whatever units and orientation they
// happened to emit.
//
// Order matters: the yaw offset is applied *before* the bounding box is
// measured. Measuring first and rotating after would swing an off-centre
// figure away from the turntable axis.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { deinterleaveGeometry } from 'three/addons/utils/BufferGeometryUtils.js';
import { prepareGeometry, patchMaterial } from './disintegrate.js';
import { TARGET_HEIGHT } from './characters.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

/**
 * Flatten a meshopt/quantized geometry to plain, non-normalized Float32
 * attributes.
 *
 * `meshopt` implies KHR_mesh_quantization, so positions arrive as normalized
 * int16 in an interleaved buffer, with the dequantization folded into the node
 * transform. Baking that transform straight into the geometry silently
 * destroys it: `BufferAttribute.setX` re-normalizes on write, so every
 * coordinate outside ±1 is clamped and the model collapses. Widen to float
 * first, then transforms are safe.
 */
function toFloatAttributes(geometry) {
  const geo = geometry;

  // deinterleaveGeometry mutates in place and returns nothing
  if (Object.values(geo.attributes).some((a) => a.isInterleavedBufferAttribute)) {
    deinterleaveGeometry(geo);
  }

  for (const [name, attr] of Object.entries(geo.attributes)) {
    if (attr.array instanceof Float32Array && !attr.normalized) continue;

    const out = new Float32Array(attr.count * attr.itemSize);
    for (let i = 0; i < attr.count; i++) {
      const o = i * attr.itemSize;
      // getX/getY/... denormalize on read
      out[o] = attr.getX(i);
      if (attr.itemSize > 1) out[o + 1] = attr.getY(i);
      if (attr.itemSize > 2) out[o + 2] = attr.getZ(i);
      if (attr.itemSize > 3) out[o + 3] = attr.getW(i);
    }
    geo.setAttribute(name, new THREE.BufferAttribute(out, attr.itemSize));
  }

  return geo;
}

/**
 * @param {object} def          entry from CHARACTERS
 * @param {(f:number)=>void} onProgress  0..1, -1 while the total is unknown
 * @returns {Promise<{group:THREE.Group, stats:object, setMode:Function, uniform:{value:number}, dispose:Function}>}
 */
export function loadCharacter(def, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    loader.load(
      def.glb,
      (gltf) => {
        try {
          resolve(build(gltf, def));
        } catch (err) {
          reject(err);
        }
      },
      (evt) => {
        // lengthComputable is false when the server sends no Content-Length
        onProgress(evt.lengthComputable && evt.total > 0 ? evt.loaded / evt.total : -1);
      },
      (err) => reject(new Error(`Failed to load ${def.glb}: ${err?.message || err}`)),
    );
  });
}

function build(gltf, def) {
  const root = gltf.scene;

  // 1 ─ orient first
  root.rotation.set(0, def.yaw || 0, 0);
  root.updateMatrixWorld(true);

  // 2 ─ measure the oriented figure
  const box = new THREE.Box3().setFromObject(root);
  if (!isFinite(box.min.y) || box.isEmpty()) {
    throw new Error(`${def.id}: empty bounding box — no renderable geometry`);
  }
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());

  const scale = TARGET_HEIGHT / (size.y || 1);

  // 3 ─ one matrix that scales to target height, centres in x/z and drops the
  //     feet onto y = 0
  const normalise = new THREE.Matrix4()
    .makeTranslation(-centre.x * scale, -box.min.y * scale, -centre.z * scale)
    .multiply(new THREE.Matrix4().makeScale(scale, scale, scale));

  // 4 ─ bake every world matrix into the geometry, so the meshes end up in a
  //     flat group in final world units. This keeps the disintegrate offsets
  //     in world space (no per-character scale factor in the shader) and stops
  //     nested node scales from skewing the outward directions.
  const meshes = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => { if (o.isMesh) meshes.push(o); });

  const group = new THREE.Group();
  group.name = def.id;

  const uniform = { value: 0 };
  const baked = new Map();   // geometry -> already baked? (GLBs reuse geometry)

  let triangles = 0;
  let vertices = 0;
  const originals = [];
  const clays = [];
  const normals = [];

  for (const mesh of meshes) {
    const world = new THREE.Matrix4().multiplyMatrices(normalise, mesh.matrixWorld);

    // a geometry shared by several meshes must not be baked twice
    let geo = mesh.geometry;
    if (baked.has(geo)) geo = geo.clone();
    baked.set(mesh.geometry, true);

    // count before toNonIndexed, so "vertices" is the real, shared-vertex count
    triangles += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
    vertices += geo.attributes.position.count;

    geo = toFloatAttributes(geo);
    geo.applyMatrix4(world);

    const localCentre = new THREE.Vector3(0, TARGET_HEIGHT / 2, 0);
    geo = prepareGeometry(geo, localCentre);
    geo.computeBoundingSphere();

    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;

    const original = mat.clone();
    original.side = THREE.FrontSide;
    patchMaterial(original, uniform, 'dis-orig');

    const clay = new THREE.MeshStandardMaterial({
      color: 0xcfc7ba, roughness: 0.94, metalness: 0.0,
      envMapIntensity: 0.35,
    });
    patchMaterial(clay, uniform, 'dis-clay');

    // above ~1M triangles a wireframe renders as a solid blob; flat-shaded
    // normals keep the facets readable at any density
    const normal = new THREE.MeshNormalMaterial({ flatShading: true });
    patchMaterial(normal, uniform, 'dis-norm');

    const out = new THREE.Mesh(geo, original);
    out.castShadow = true;
    out.receiveShadow = false;
    out.frustumCulled = true;

    // shadows have to dissolve with the mesh or the character casts a ghost
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    patchMaterial(depth, uniform, 'dis-depth');
    out.customDepthMaterial = depth;

    group.add(out);
    originals.push(original);
    clays.push(clay);
    normals.push(normal);
  }

  if (!meshes.length) throw new Error(`${def.id}: GLB contains no meshes`);

  const banks = { texture: originals, clay: clays, normals: normals };

  function setMode(mode) {
    const bank = banks[mode] || banks.texture;
    group.children.forEach((child, i) => { child.material = bank[i]; });
  }

  function dispose() {
    group.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      o.customDepthMaterial?.dispose();
    });
    [...originals, ...clays, ...normals].forEach((m) => {
      for (const key of Object.keys(m)) {
        const v = m[key];
        if (v && v.isTexture) v.dispose();
      }
      m.dispose();
    });
  }

  return {
    group,
    uniform,
    setMode,
    dispose,
    stats: {
      triangles: Math.round(triangles),
      vertices,
      meshes: meshes.length,
      scale,
    },
  };
}
