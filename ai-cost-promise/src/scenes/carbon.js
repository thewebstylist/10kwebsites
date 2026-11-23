/**
 * Carbon: four frosted bars rising with scroll.
 *   2024 (measured estimate) solid; projections hatched, so the eye can tell
 *   today's figure from scenarios at a glance.
 * Bars are laid out to sit above the four HTML labels beneath the canvas.
 */
import * as THREE from 'three';
import { createBase, brand, damp, rng, GLSL_SOFT_POINT } from '../lib/three-utils.js';

const VALUES = [180, 320, 300, 450]; // Mt CO2: 2024, 2030 base, 2035 base, 2035 lift-off (derived)
const PROJECTED = [0, 1, 1, 1];

export function createScene(canvas, { quality, reducedMotion, pointer }) {
  const base = createBase(canvas, { quality }, 28);
  const { renderer, scene, camera } = base;
  const C = brand();
  const rand = rng(11);
  const maxH = 2.6;

  const uniforms = {
    uTime: { value: 0 },
    uPixel: { value: quality.pixelRatio },
    uPink: { value: C.orchid200 },
    uPinkLight: { value: C.orchid100 },
    uPinkDeep: { value: C.orchid300 },
    uMagenta: { value: C.magenta },
    uInk: { value: C.ink },
  };

  const geo = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1).translate(0, 0.5, 0);
  const bars = VALUES.map((v, i) => {
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uH: { value: 0.001 }, uProj: { value: PROJECTED[i] } },
      transparent: true,
      vertexShader: /* glsl */ `
        uniform float uH; varying vec3 vN; varying vec3 vL; varying vec3 vW;
        void main(){
          vec3 p = position; p.y *= uH;
          vL = vec3(position.x, p.y, position.z);
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uH, uProj; uniform vec3 uPink, uPinkLight, uPinkDeep, uMagenta, uInk;
        varying vec3 vN; varying vec3 vL; varying vec3 vW;
        void main(){
          vec3 n = normalize(vN);
          float diff = dot(n, normalize(vec3(-0.4, 0.8, 0.6))) * 0.5 + 0.5;
          float t = clamp(vL.y / ${maxH.toFixed(2)}, 0.0, 1.0);
          vec3 col = mix(uPinkDeep, uPink, t);
          col = mix(col * 0.92, mix(col, vec3(1.0), 0.25), diff);
          // projections: diagonal hatching + lighter fill
          float hatch = step(0.5, fract((vW.x + vW.y) * 7.0));
          float a = mix(0.92, mix(0.45, 0.78, hatch), uProj);
          // top edge highlight in the saturated accent
          float top = smoothstep(uH - 0.03, uH, vL.y) * step(0.5, n.y + 0.6);
          col = mix(col, uMagenta, top * 0.7);
          gl_FragColor = vec4(col, a);
        }`,
    });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    return { mesh, mat, value: v, h: 0 };
  });

  /* ---------- CO2 haze puffing from the bar tops ---------- */
  const P = Math.round(90 * Math.max(0.5, quality.particles));
  const pData = new Float32Array(P * 4);
  for (let i = 0; i < P; i++) pData.set([Math.floor(rand() * 4), rand(), rand(), 0.5 + rand()], i * 4);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P * 3), 3));
  pGeo.setAttribute('aData', new THREE.BufferAttribute(pData, 4));
  const puffU = { uX: { value: new THREE.Vector4() }, uTop: { value: new THREE.Vector4() } };
  const puffs = new THREE.Points(pGeo, new THREE.ShaderMaterial({
    uniforms: { ...uniforms, ...puffU },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uTime, uPixel; uniform vec4 uX, uTop; attribute vec4 aData; varying float vA;
      float pick(vec4 v, float i){ return i < 0.5 ? v.x : i < 1.5 ? v.y : i < 2.5 ? v.z : v.w; }
      void main(){
        float life = fract(uTime * 0.12 * aData.w + aData.y);
        float x = pick(uX, aData.x) + (aData.z - 0.5) * 0.35 + sin(uTime + aData.y * 20.0) * 0.06 * life;
        float top = pick(uTop, aData.x);
        vec3 p = vec3(x, top + 0.05 + life * 0.9, (aData.z - 0.5) * 0.3);
        vA = sin(life * 3.14159) * smoothstep(0.05, 0.4, top);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (22.0 + life * 46.0) * uPixel * (7.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_SOFT_POINT}
      uniform vec3 uPink; varying float vA;
      void main(){ float a = softPoint(gl_PointCoord, 1.6) * vA * 0.16; if (a < 0.004) discard; gl_FragColor = vec4(uPink, a); }`,
  }));
  puffs.frustumCulled = false;
  scene.add(puffs);

  /* ---------- Baseline ---------- */
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-10, 0, 0), new THREE.Vector3(10, 0, 0)]);
  const baseline = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x1a1a2e, transparent: true, opacity: 0.12 }));
  scene.add(baseline);

  let progress = 0;
  const cam = { x: 0, y: 0 };

  function resize(w, h) {
    base.resize(w, h);
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = 9;
    const visW = 2 * halfH * dist * camera.aspect;
    const visH = 2 * halfH * dist;
    const col = visW / 4;
    const width = Math.min(col * 0.42, 1.0);
    bars.forEach((b, i) => {
      b.mesh.position.x = (i - 1.5) * col;
      b.mesh.scale.set(width, 1, width * 0.8);
      puffU.uX.value.setComponent(i, b.mesh.position.x);
    });
    // place the baseline near the bottom of the frame, scale bars to fit
    const floorY = -visH * 0.36;
    scene.position.y = floorY;
    bars.forEach((b) => (b.maxH = Math.min(maxH, visH * 0.62)));
    camera.userData.dist = dist;
  }

  function render(dt, t) {
    uniforms.uTime.value = reducedMotion ? 3 : t;
    bars.forEach((b, i) => {
      // staggered growth: each bar starts a little after the previous
      const local = THREE.MathUtils.clamp((progress - i * 0.12) / 0.64, 0, 1);
      const eased = 1 - Math.pow(1 - local, 3);
      const target = (b.value / 450) * (b.maxH || maxH) * eased;
      b.h = reducedMotion ? target : damp(b.h, target, 6, dt);
      b.mat.uniforms.uH.value = Math.max(0.001, b.h);
      puffU.uTop.value.setComponent(i, b.h);
    });
    cam.x = damp(cam.x, pointer.x * 0.25, 2, dt || 1);
    cam.y = damp(cam.y, -pointer.y * 0.2, 2, dt || 1);
    camera.position.set(cam.x, 1.2 + cam.y, camera.userData.dist || 9);
    camera.lookAt(0, 0.2, 0);
    renderer.render(scene, camera);
  }

  return { resize, render, setProgress(p) { progress = p; } };
}
