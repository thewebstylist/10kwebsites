/**
 * Electricity: a frosted city of data centres.
 * Scroll progress (0..1) raises uLevel: more windows light up in soft magenta,
 * halls grow taller, power pulses race along the streets and a warm glow
 * builds beneath the city.
 */
import * as THREE from 'three';
import { createBase, brand, damp, rng, GLSL_SOFT_POINT } from '../lib/three-utils.js';

export function createScene(canvas, { quality, reducedMotion, pointer }) {
  const base = createBase(canvas, { quality }, 30);
  const { renderer, scene, camera } = base;
  const C = brand();
  const rand = rng(21);
  const G = quality.tier === 'high' ? 9 : 7; // grid size
  const spacing = 0.62;

  const uniforms = {
    uTime: { value: 0 },
    uLevel: { value: 0.15 },
    uPixel: { value: quality.pixelRatio },
    uPink: { value: C.orchid200 },
    uPinkDeep: { value: C.orchid300 },
    uMagenta: { value: C.magenta },
    uInk: { value: C.ink },
  };

  const city = new THREE.Group();
  scene.add(city);

  /* ---------- Ground with faint street grid and a building glow ---------- */
  const groundMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
    fragmentShader: /* glsl */ `
      uniform float uLevel; uniform vec3 uPink, uInk, uMagenta; varying vec2 vUv;
      void main(){
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float fade = smoothstep(1.0, 0.35, r);
        vec2 g = abs(fract(p * ${(G * 0.5).toFixed(1)} + 0.5) - 0.5);
        float line = 1.0 - smoothstep(0.0, 0.025, min(g.x, g.y));
        float glow = smoothstep(0.85, 0.0, r) * (0.1 + 0.9 * uLevel);
        vec3 col = mix(uInk, uPink, 0.5);
        float a = fade * (line * 0.07) + glow * 0.55;
        vec3 c = mix(col, uPink, clamp(glow * 2.0, 0.0, 1.0));
        gl_FragColor = vec4(c, a);
      }`,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(G * spacing * 1.7, G * spacing * 1.7), groundMat);
  ground.rotation.x = -Math.PI / 2;
  city.add(ground);

  /* ---------- Buildings (instanced boxes) ---------- */
  const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const count = G * G;
  const seeds = new Float32Array(count);
  const bMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uLevel; attribute float aSeed;
      varying vec3 vN; varying vec3 vL; varying vec3 vS; varying float vSeed;
      void main(){
        float grow = mix(0.5, 1.0, smoothstep(aSeed * 0.7, aSeed * 0.7 + 0.3, uLevel));
        vec3 p = position; p.y *= grow;
        vS = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz) * grow, length(instanceMatrix[2].xyz));
        vL = p; vSeed = aSeed;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uLevel, uTime; uniform vec3 uPink, uPinkDeep, uMagenta, uInk;
      varying vec3 vN; varying vec3 vL; varying vec3 vS; varying float vSeed;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      void main(){
        vec3 n = normalize(vN);
        vec3 L = normalize(vec3(-0.5, 0.9, 0.4));
        float diff = dot(n, L) * 0.5 + 0.5;
        vec3 baseCol = mix(vec3(0.95, 0.945, 0.975), vec3(1.0), diff);
        baseCol = mix(baseCol, uPink, 0.05 * (1.0 - abs(n.y)));
        // window grid on the side faces, in world-scaled units
        float side = 1.0 - abs(n.y);
        float u = abs(n.x) > 0.5 ? (vL.z + 0.5) * vS.z : (vL.x + 0.5) * vS.x;
        float v = vL.y * vS.y;
        vec2 cell = floor(vec2(u / 0.15, v / 0.13));
        vec2 f = fract(vec2(u / 0.15, v / 0.13));
        float win = smoothstep(0.24, 0.3, f.x) * smoothstep(0.76, 0.7, f.x) * smoothstep(0.3, 0.36, f.y) * smoothstep(0.7, 0.64, f.y) * side * step(0.12, v);
        float h = hash(cell + vSeed * 17.0);
        float lit = step(h, uLevel * 0.92) * (0.85 + 0.15 * sin(uTime * 3.0 + h * 50.0));
        vec3 winCol = mix(uPinkDeep, uMagenta, step(0.85, h) * uLevel);
        vec3 col = mix(baseCol, mix(baseCol * 0.965, winCol, lit), win);
        // roof: soft pink equipment strip that warms with load
        float roof = step(0.5, n.y);
        float vent = roof * smoothstep(0.2, 0.15, length(vL.xz)) * step(0.5, vSeed) * uLevel;
        col = mix(col, uPinkDeep, vent * 0.7);
        // crisp edges keep white forms legible on a white page
        vec3 e = (0.5 - abs(vec3(vL.x, vL.y - 0.5, vL.z))) * vS;
        float edge = 0.0;
        if (abs(n.x) > 0.5) edge = min(e.y, e.z);
        else if (abs(n.z) > 0.5) edge = min(e.x, e.y);
        else edge = min(e.x, e.z);
        col = mix(col, uInk, (1.0 - smoothstep(0.0, 0.01, edge)) * 0.12);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const buildings = new THREE.InstancedMesh(boxGeo, bMat, count);
  const m = new THREE.Matrix4();
  let k = 0;
  for (let i = 0; i < G; i++) {
    for (let j = 0; j < G; j++) {
      const x = (i - (G - 1) / 2) * spacing;
      const z = (j - (G - 1) / 2) * spacing;
      const centre = 1 - Math.hypot(x, z) / (G * spacing * 0.75);
      const h = 0.25 + rand() * 0.55 + Math.max(0, centre) * 0.9;
      const w = 0.34 + rand() * 0.14;
      const d = 0.34 + rand() * 0.14;
      m.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d));
      buildings.setMatrixAt(k, m);
      seeds[k] = rand();
      k++;
    }
  }
  boxGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  city.add(buildings);

  /* ---------- Power pulses along the streets ---------- */
  const P = Math.round(220 * Math.max(0.5, quality.particles));
  const pData = new Float32Array(P * 4); // lane, axis, speed, offset
  const pPos = new Float32Array(P * 3);
  for (let i = 0; i < P; i++) {
    const lane = Math.floor(rand() * (G + 1)) - G / 2;
    pData.set([lane * spacing, rand() > 0.5 ? 1 : 0, 0.08 + rand() * 0.18, rand()], i * 4);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('aData', new THREE.BufferAttribute(pData, 4));
  const span = G * spacing * 1.2;
  const pMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uTime, uPixel, uLevel; attribute vec4 aData; varying float vA;
      void main(){
        float s = (fract(uTime * aData.z * (0.4 + uLevel) + aData.w) - 0.5) * ${span.toFixed(2)};
        vec3 p = aData.y > 0.5 ? vec3(aData.x, 0.03, s) : vec3(s, 0.03, aData.x);
        vA = smoothstep(${(span / 2).toFixed(2)}, ${(span / 3).toFixed(2)}, abs(s)) * (0.2 + 0.8 * uLevel);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = 6.0 * uPixel * (8.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_SOFT_POINT}
      uniform vec3 uMagenta; varying float vA;
      void main(){ float a = softPoint(gl_PointCoord, 2.0) * vA; if (a < 0.01) discard; gl_FragColor = vec4(uMagenta, a); }`,
  });
  const pulses = new THREE.Points(pGeo, pMat);
  pulses.frustumCulled = false;
  city.add(pulses);

  /* ---------- Heat shimmer rising above the city ---------- */
  const S = Math.round(260 * quality.particles) + 40;
  const sData = new Float32Array(S * 4);
  for (let i = 0; i < S; i++) sData.set([(rand() - 0.5) * G * spacing, (rand() - 0.5) * G * spacing, rand(), 0.6 + rand()], i * 4);
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(S * 3), 3));
  sGeo.setAttribute('aData', new THREE.BufferAttribute(sData, 4));
  const sMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uTime, uPixel, uLevel; attribute vec4 aData; varying float vA;
      void main(){
        float life = fract(uTime * 0.08 * aData.w + aData.z);
        vec3 p = vec3(aData.x + sin(uTime + aData.z * 20.0) * 0.08, 0.4 + life * 2.4, aData.y);
        vA = sin(life * 3.14159) * uLevel * 0.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (30.0 + life * 70.0) * uPixel * (8.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_SOFT_POINT}
      uniform vec3 uPink; varying float vA;
      void main(){ float a = softPoint(gl_PointCoord, 2.2) * vA * 0.16; if (a < 0.003) discard; gl_FragColor = vec4(uPink, a); }`,
  });
  const shimmer = new THREE.Points(sGeo, sMat);
  shimmer.frustumCulled = false;
  city.add(shimmer);

  /* ---------- State ---------- */
  let target = 0.15;
  const cam = { x: 0, y: 0 };
  let dist = 9;

  function resize(w, h) {
    base.resize(w, h);
    const aspect = w / h;
    dist = aspect < 0.9 ? 11.5 : 8.2;
  }

  function render(dt, t) {
    uniforms.uTime.value = reducedMotion ? 4 : t;
    uniforms.uLevel.value = reducedMotion ? target : damp(uniforms.uLevel.value, target, 3, dt);
    city.rotation.y = reducedMotion ? 0.6 : 0.6 + t * 0.04;
    cam.x = damp(cam.x, pointer.x * 0.6, 2, dt || 1);
    cam.y = damp(cam.y, -pointer.y * 0.4, 2, dt || 1);
    camera.position.set(cam.x, dist * 0.62 + cam.y, dist);
    camera.lookAt(0, 0.45, 0);
    renderer.render(scene, camera);
  }

  return {
    resize,
    render,
    setProgress(p) { target = 0.12 + p * 0.88; },
  };
}
