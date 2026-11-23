/**
 * Medicine: a rotating DNA double helix in soft blues.
 * Scroll progress sweeps a bright "reading" band up the helix, the way a
 * model scans sequence and structure; motes orbit like data around it.
 */
import * as THREE from 'three';
import { createBase, brand, damp, rng, GLSL_SOFT_POINT } from '../lib/three-utils.js';

export function createScene(canvas, { quality, reducedMotion, pointer }) {
  const base = createBase(canvas, { quality }, 30);
  const { renderer, scene, camera } = base;
  const C = brand();
  const rand = rng(5);

  const uniforms = {
    uTime: { value: 0 },
    uScan: { value: -2 },
    uPixel: { value: quality.pixelRatio },
    uBlue: { value: C.sky300 },
    uBlueSoft: { value: C.sky200 },
    uBlueLight: { value: C.sky100 },
    uBlueDeep: { value: C.blue },
    uLilac: { value: new THREE.Vector3(0.72, 0.66, 0.95) },
    uInk: { value: C.ink },
  };

  const helix = new THREE.Group();
  helix.rotation.z = 0.32;
  scene.add(helix);

  const PAIRS = quality.tier === 'high' ? 44 : 30;
  const R = 0.62;
  const step = 0.105;
  const twist = 0.42;
  const yOff = (PAIRS - 1) * step * 0.5;

  // Shared lit shader for instanced spheres & rungs, coloured per instance.
  const litMat = () =>
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        attribute vec3 aColor; attribute float aY;
        varying vec3 vN; varying vec3 vV; varying vec3 vC; varying float vY;
        void main(){
          vC = aColor; vY = aY;
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
          vV = normalize(cameraPosition - w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uScan; uniform vec3 uBlueDeep;
        varying vec3 vN; varying vec3 vV; varying vec3 vC; varying float vY;
        void main(){
          vec3 n = normalize(vN);
          float diff = dot(n, normalize(vec3(-0.4, 0.7, 0.6))) * 0.5 + 0.5;
          float rim = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 2.5);
          vec3 col = mix(vC * 0.82, mix(vC, vec3(1.0), 0.45), diff);
          col = mix(col, vec3(1.0), rim * 0.5);
          float band = exp(-pow((vY - uScan) * 3.2, 2.0));
          col = mix(col, uBlueDeep, band * 0.75);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });

  /* ---------- Backbone spheres ---------- */
  const sGeo = new THREE.IcosahedronGeometry(1, quality.tier === 'high' ? 3 : 2);
  const spheres = new THREE.InstancedMesh(sGeo, litMat(), PAIRS * 2);
  const sCol = new Float32Array(PAIRS * 2 * 3);
  const sY = new Float32Array(PAIRS * 2);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const strandA = C.sky300;
  const strandB = uniforms.uLilac.value;
  for (let i = 0; i < PAIRS; i++) {
    const a = i * twist;
    const y = i * step - yOff;
    const pA = new THREE.Vector3(Math.cos(a) * R, y, Math.sin(a) * R);
    const pB = new THREE.Vector3(Math.cos(a + Math.PI) * R, y, Math.sin(a + Math.PI) * R);
    m.compose(pA, q, new THREE.Vector3().setScalar(0.07));
    spheres.setMatrixAt(i * 2, m);
    m.compose(pB, q, new THREE.Vector3().setScalar(0.07));
    spheres.setMatrixAt(i * 2 + 1, m);
    sCol.set([strandA.x, strandA.y, strandA.z], i * 6);
    sCol.set([strandB.x, strandB.y, strandB.z], i * 6 + 3);
    sY[i * 2] = y;
    sY[i * 2 + 1] = y;
  }
  sGeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(sCol, 3));
  sGeo.setAttribute('aY', new THREE.InstancedBufferAttribute(sY, 1));
  helix.add(spheres);

  /* ---------- Base-pair rungs (two half-rungs per pair, different hues) ---------- */
  const rGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1).translate(0, 0.5, 0);
  const rungs = new THREE.InstancedMesh(rGeo, litMat(), PAIRS * 2);
  const rCol = new Float32Array(PAIRS * 2 * 3);
  const rY = new Float32Array(PAIRS * 2);
  const up = new THREE.Vector3(0, 1, 0);
  const palette = [C.sky200, C.sky100, uniforms.uLilac.value, C.sky300];
  for (let i = 0; i < PAIRS; i++) {
    const a = i * twist;
    const y = i * step - yOff;
    const pA = new THREE.Vector3(Math.cos(a) * R, y, Math.sin(a) * R);
    const pB = new THREE.Vector3(Math.cos(a + Math.PI) * R, y, Math.sin(a + Math.PI) * R);
    const mid = pA.clone().add(pB).multiplyScalar(0.5);
    [[pA, mid], [pB, mid]].forEach(([from, to], h) => {
      const dir = to.clone().sub(from);
      const len = dir.length();
      q.setFromUnitVectors(up, dir.normalize());
      m.compose(from, q, new THREE.Vector3(0.022, len, 0.022));
      rungs.setMatrixAt(i * 2 + h, m);
      const c = palette[(i + h * 2 + Math.floor(rand() * 2)) % 4];
      rCol.set([c.x, c.y, c.z], (i * 2 + h) * 3);
      rY[i * 2 + h] = y;
    });
  }
  rGeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(rCol, 3));
  rGeo.setAttribute('aY', new THREE.InstancedBufferAttribute(rY, 1));
  helix.add(rungs);

  /* ---------- Backbone ribbons (smooth tubes through the spheres) ---------- */
  const ribbonMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `uniform vec3 uBlueSoft; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5); gl_FragColor = vec4(uBlueSoft, 0.18 + f * 0.4); }`,
  });
  [0, Math.PI].forEach((phase) => {
    const pts = [];
    for (let i = 0; i <= PAIRS * 3; i++) {
      const s = i / 3;
      const a = s * twist + phase;
      pts.push(new THREE.Vector3(Math.cos(a) * R, s * step - yOff, Math.sin(a) * R));
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), PAIRS * 6, 0.028, 8, false);
    helix.add(new THREE.Mesh(tube, ribbonMat));
  });

  /* ---------- Orbiting motes ---------- */
  const M = Math.round(240 * Math.max(0.5, quality.particles));
  const mData = new Float32Array(M * 4);
  for (let i = 0; i < M; i++) mData.set([rand() * Math.PI * 2, (rand() - 0.5) * PAIRS * step * 1.2, 1.0 + rand() * 1.1, 0.4 + rand()], i * 4);
  const mGeo = new THREE.BufferGeometry();
  mGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(M * 3), 3));
  mGeo.setAttribute('aData', new THREE.BufferAttribute(mData, 4));
  const motes = new THREE.Points(mGeo, new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uTime, uPixel; attribute vec4 aData; varying float vA;
      void main(){
        float a = aData.x + uTime * 0.15 * aData.w;
        vec3 p = vec3(cos(a) * aData.z, aData.y + sin(uTime * 0.5 + aData.x) * 0.05, sin(a) * aData.z);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = smoothstep(-9.0, -5.0, mv.z) * 0.8;
        gl_PointSize = (2.0 + aData.w * 3.0) * uPixel * (6.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_SOFT_POINT}
      uniform vec3 uBlue; varying float vA;
      void main(){ float a = softPoint(gl_PointCoord, 2.0) * vA; if (a < 0.01) discard; gl_FragColor = vec4(uBlue, a); }`,
  }));
  motes.frustumCulled = false;
  helix.add(motes);

  /* ---------- State ---------- */
  let target = 0;
  const cam = { x: 0, y: 0 };
  let dist = 7;
  const scanMin = -yOff - 0.4;
  const scanMax = yOff + 0.4;

  function resize(w, h) {
    base.resize(w, h);
    dist = w / h < 0.9 ? 8.6 : 6.6;
  }

  function render(dt, t) {
    uniforms.uTime.value = reducedMotion ? 2 : t;
    const scan = scanMin + target * (scanMax - scanMin);
    uniforms.uScan.value = reducedMotion ? scan : damp(uniforms.uScan.value, scan, 3, dt);
    helix.rotation.y = reducedMotion ? 0.4 : t * 0.25;
    cam.x = damp(cam.x, pointer.x * 0.5, 2, dt || 1);
    cam.y = damp(cam.y, -pointer.y * 0.4, 2, dt || 1);
    camera.position.set(cam.x, cam.y, dist);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }

  return { resize, render, setProgress(p) { target = p; } };
}
