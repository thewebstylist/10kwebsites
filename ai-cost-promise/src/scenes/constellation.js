/**
 * Milestones: a constellation the camera flies through as you scroll.
 * Each star is a milestone; the path between visited stars lights up.
 */
import * as THREE from 'three';
import { createBase, brand, damp, rng, GLSL_SOFT_POINT } from '../lib/three-utils.js';
import { MILESTONES } from '../data/milestones.js';

export function createScene(canvas, { quality, reducedMotion, pointer }) {
  const base = createBase(canvas, { quality }, 45);
  const { renderer, scene, camera } = base;
  const C = brand();
  const rand = rng(17);
  const n = MILESTONES.length;
  const GAP = 3.4;

  const uniforms = {
    uTime: { value: 0 },
    uPixel: { value: quality.pixelRatio },
    uActive: { value: 0 },
    uBlue: { value: C.sky300 },
    uBlueSoft: { value: C.sky200 },
    uBlueDeep: { value: C.blue },
    uPink: { value: C.orchid300 },
    uInk: { value: C.ink },
  };

  // Milestone positions along a gentle 3D curve
  const stars = MILESTONES.map((_, i) => new THREE.Vector3(Math.sin(i * 1.25) * 1.6, Math.cos(i * 0.85) * 0.8 + 0.3, -i * GAP));
  const path = new THREE.CatmullRomCurve3(stars, false, 'catmullrom', 0.4);

  /* ---------- Background star field ---------- */
  const F = Math.round(1800 * quality.particles) + 300;
  const fPos = new Float32Array(F * 3);
  const fSeed = new Float32Array(F);
  for (let i = 0; i < F; i++) {
    fPos.set([(rand() - 0.5) * 18, (rand() - 0.5) * 10, 6 - rand() * (n * GAP + 14)], i * 3);
    fSeed[i] = rand();
  }
  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  fGeo.setAttribute('aSeed', new THREE.BufferAttribute(fSeed, 1));
  scene.add(new THREE.Points(fGeo, new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uTime, uPixel; attribute float aSeed; varying float vA; varying float vPink;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vA = (0.35 + 0.35 * sin(uTime * 1.2 + aSeed * 60.0)) * smoothstep(-26.0, -3.0, mv.z) * smoothstep(-0.2, -1.5, mv.z);
        vPink = step(0.9, aSeed);
        gl_PointSize = (1.5 + aSeed * 2.5) * uPixel * (5.0 / max(1.0, -mv.z * 0.35));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_SOFT_POINT}
      uniform vec3 uBlue, uPink; varying float vA; varying float vPink;
      void main(){ float a = softPoint(gl_PointCoord, 2.0) * vA; if (a < 0.01) discard; gl_FragColor = vec4(mix(uBlue, uPink, vPink * 0.6), a); }`,
  })));

  /* ---------- Path line, lit up to the active milestone ---------- */
  const SEG = n * 40;
  const linePts = path.getPoints(SEG);
  const lGeo = new THREE.BufferGeometry().setFromPoints(linePts);
  lGeo.setAttribute('aU', new THREE.BufferAttribute(new Float32Array(linePts.map((_, i) => i / SEG)), 1));
  scene.add(new THREE.Line(lGeo, new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uN: { value: n - 1 } },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `attribute float aU; varying float vU; varying float vZ; void main(){ vU = aU; vec4 mv = modelViewMatrix * vec4(position,1.0); vZ = mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform float uActive, uN, uTime; uniform vec3 uBlueSoft, uBlueDeep; varying float vU; varying float vZ;
      void main(){
        float lit = step(vU * uN, uActive + 0.001);
        float fade = smoothstep(-30.0, -2.0, vZ) * smoothstep(-0.2, -1.2, vZ);
        float dash = 0.6 + 0.4 * step(0.5, fract(vU * 140.0 - uTime * 0.5));
        gl_FragColor = vec4(mix(uBlueSoft, uBlueDeep, lit), mix(0.22 * dash, 0.85, lit) * fade);
      }`,
  })));

  /* ---------- Milestone stars ---------- */
  const sGeo = new THREE.BufferGeometry().setFromPoints(stars);
  sGeo.setAttribute('aIndex', new THREE.BufferAttribute(new Float32Array(stars.map((_, i) => i)), 1));
  const starPts = new THREE.Points(sGeo, new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uActive, uPixel, uTime; attribute float aIndex; varying float vOn; varying float vNear;
      void main(){
        float d = abs(aIndex - uActive);
        vNear = smoothstep(1.0, 0.0, d);
        vOn = step(aIndex, uActive + 0.5);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float pulse = 1.0 + 0.12 * sin(uTime * 2.0 + aIndex);
        gl_PointSize = mix(26.0, 80.0, vNear) * pulse * uPixel * (4.0 / max(1.0, -mv.z));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_SOFT_POINT}
      uniform vec3 uBlue, uBlueDeep, uBlueSoft; varying float vOn; varying float vNear;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float core = softPoint(gl_PointCoord, 6.0);
        float halo = softPoint(gl_PointCoord, 1.4) * 0.45;
        float ring = smoothstep(0.06, 0.0, abs(d - 0.72)) * vNear * 0.8;
        vec3 col = mix(uBlueSoft, uBlueDeep, max(vOn, vNear));
        float a = core + halo * (0.4 + 0.6 * vNear) + ring;
        if (a < 0.01) discard;
        gl_FragColor = vec4(col, min(a, 1.0));
      }`,
  }));
  starPts.frustumCulled = false;
  scene.add(starPts);

  /* ---------- Camera rig ---------- */
  let target = 0;
  let current = 0;
  const cam = { x: 0, y: 0 };
  const tmp = new THREE.Vector3();
  const look = new THREE.Vector3();

  function render(dt, t) {
    uniforms.uTime.value = reducedMotion ? 1 : t;
    current = reducedMotion ? target : damp(current, target, 4, dt);
    const idx = current * (n - 1);
    uniforms.uActive.value = idx;
    const u = Math.min(0.9999, current);
    path.getPointAt(u, tmp);
    path.getPointAt(Math.min(1, u + 0.02), look);
    cam.x = damp(cam.x, pointer.x * 0.6, 2, dt || 1);
    cam.y = damp(cam.y, -pointer.y * 0.4, 2, dt || 1);
    if (reducedMotion) {
      // one calm overview of the whole constellation
      camera.position.set(4.5, 3.2, 6);
      camera.lookAt(0, 0, -n * GAP * 0.45);
      uniforms.uActive.value = n - 1;
    } else {
      camera.position.set(tmp.x * 0.6 + 0.8 + cam.x, tmp.y + 0.6 + cam.y, tmp.z + 4.2);
      camera.lookAt(look.x * 0.8, look.y, look.z - 1.0);
    }
    renderer.render(scene, camera);
  }

  return {
    resize: (w, h) => base.resize(w, h),
    render,
    setProgress(p) { target = p; },
  };
}
