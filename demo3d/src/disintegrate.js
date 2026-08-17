// Disintegration: push every triangle outward along its own vector.
//
// The geometry is converted to non-indexed so each triangle owns its three
// vertices outright, then each triangle gets two attributes:
//
//   aDir   the unit vector from the mesh centre to the triangle's centroid
//   aRand  a per-triangle random value in [0,1)
//
// Both are written identically to all three vertices of the triangle, so the
// triangle translates rigidly instead of shearing apart. The vertex shader
// offsets by `aDir * u * (0.06 + aRand * aRand * 0.34)` — squaring the random
// keeps most triangles close and lets a few fly, which reads as dust rather
// than an even expanding shell.

import * as THREE from 'three';

/**
 * Convert to non-indexed and attach the per-triangle attributes.
 * @param {THREE.BufferGeometry} geometry
 * @param {THREE.Vector3} centre  mesh centre in the same space as the positions
 * @returns {THREE.BufferGeometry} a non-indexed geometry carrying aDir/aRand
 */
export function prepareGeometry(geometry, centre) {
  const geo = geometry.index ? geometry.toNonIndexed() : geometry;

  const pos = geo.attributes.position;
  const triCount = pos.count / 3;

  const dir = new Float32Array(pos.count * 3);
  const rnd = new Float32Array(pos.count);

  const cx = centre.x, cy = centre.y, cz = centre.z;

  for (let t = 0; t < triCount; t++) {
    const a = t * 3;

    // centroid of this triangle
    const ux = (pos.getX(a) + pos.getX(a + 1) + pos.getX(a + 2)) / 3 - cx;
    const uy = (pos.getY(a) + pos.getY(a + 1) + pos.getY(a + 2)) / 3 - cy;
    const uz = (pos.getZ(a) + pos.getZ(a + 1) + pos.getZ(a + 2)) / 3 - cz;

    let len = Math.hypot(ux, uy, uz);
    // a triangle sitting exactly on the centre has no outward direction; give
    // it an arbitrary one so it still takes part
    const nx = len > 1e-6 ? ux / len : 0;
    const ny = len > 1e-6 ? uy / len : 1;
    const nz = len > 1e-6 ? uz / len : 0;

    const r = Math.random();

    for (let k = 0; k < 3; k++) {
      const v = (a + k) * 3;
      dir[v] = nx; dir[v + 1] = ny; dir[v + 2] = nz;
      rnd[a + k] = r;
    }
  }

  geo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
  return geo;
}

const CHUNK_DECL = /* glsl */`
  attribute vec3 aDir;
  attribute float aRand;
  uniform float uDisintegrate;
`;

const CHUNK_APPLY = /* glsl */`
  transformed += aDir * uDisintegrate * (0.06 + aRand * aRand * 0.34);
`;

/**
 * Patch a material so it honours the shared uDisintegrate uniform.
 * The uniform object is shared by reference, so every patched material on the
 * character moves together from a single `.value` write.
 *
 * @param {THREE.Material} material
 * @param {{value:number}} uniform
 * @param {string} key  cache key suffix — materials compiled with and without
 *                      this patch must not share a program
 */
export function patchMaterial(material, uniform, key = 'dis') {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDisintegrate = uniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + CHUNK_DECL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + CHUNK_APPLY);
  };
  // three keys programs by material type; append ours so a patched and an
  // unpatched material of the same type never collide in the program cache
  material.customProgramCacheKey = () => key;
  return material;
}
