/**
 * Hero: a glassy neural globe split down the middle.
 *
 * Everything is shaded in WORLD space against a vertical seam at x = uSplit,
 * so as the globe turns, each point crosses from one world into the other:
 *   cost side (x < seam)     warm pink haze and heat particles drifting off
 *   promise side (x > seam)  crisp blue nodes with pulsing connections
 * The draggable divider moves the seam (setParam('balance', 0..1)).
 */
import * as THREE from 'three';
import { createBase, brand, damp, rng, fibonacciSphere, GLSL_SOFT_POINT } from '../lib/three-utils.js';

export function createScene(canvas, { quality, reducedMotion, pointer }) {
  const base = createBase(canvas, { quality }, 32);
  const { renderer, scene, camera } = base;
  const C = brand();
  const rand = rng(7);

  const uniforms = {
    uTime: { value: 0 },
    uSplit: { value: 0 },       // seam x in world units
    uCostW: { value: 0.5 },     // 0..1 weight of the cost world (from balance)
    uPixel: { value: quality.pixelRatio },
    uPink: { value: C.orchid200 },
    uPinkDeep: { value: C.orchid300 },
    uMagenta: { value: C.magenta },
    uBlue: { value: C.sky300 },
    uBlueSoft: { value: C.sky200 },
    uBlueDeep: { value: C.blue },
    uInk: { value: C.ink },
  };

  // Shared GLSL: 0 on cost side, 1 on promise side, soft across the seam.
  const SIDE = /* glsl */ `
    uniform float uSplit;
    float promiseSide(float x, float soft) { return smoothstep(uSplit - soft, uSplit + soft, x); }
  `;

  const spin = new THREE.Group(); // rotates; seam/ring do not
  scene.add(spin);

  /* ---------- Glass shell (front + faint back for thickness) ---------- */
  const shellMat = (side, strength) =>
    new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uStrength: { value: strength } },
      transparent: true,
      depthWrite: false,
      side,
      vertexShader: /* glsl */ `
        varying vec3 vWorld; varying vec3 vN; varying vec3 vV;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          vN = normalize(mat3(modelMatrix) * normal);
          vV = normalize(cameraPosition - w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        ${SIDE}
        uniform vec3 uPinkDeep, uBlue, uInk; uniform float uStrength;
        varying vec3 vWorld; varying vec3 vN; varying vec3 vV;
        void main() {
          float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4);
          float s = promiseSide(vWorld.x, 0.12);
          vec3 col = mix(uPinkDeep, uBlue, s);
          // a soft shadowed underside gives the glass volume on a white page
          float under = smoothstep(0.2, -1.0, vN.y) * 0.05;
          float a = f * 0.55 * uStrength + 0.025 * uStrength;
          gl_FragColor = vec4(mix(col, uInk, under / max(a + under, 0.001) * 0.6), a + under);
        }`,
    });
  const shellGeo = new THREE.SphereGeometry(1, 96, 64);
  spin.add(new THREE.Mesh(shellGeo, shellMat(THREE.BackSide, 0.35)));
  spin.add(new THREE.Mesh(shellGeo, shellMat(THREE.FrontSide, 1)));

  /* ---------- Orbital rings for a futuristic, glassy frame ---------- */
  const ringMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() { vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      ${SIDE}
      uniform vec3 uPinkDeep, uBlue; varying vec3 vWorld;
      void main() {
        float s = promiseSide(vWorld.x, 0.1);
        float depth = smoothstep(-1.2, 1.0, vWorld.z);
        gl_FragColor = vec4(mix(uPinkDeep, uBlue, s), 0.10 + 0.28 * depth);
      }`,
  });
  const ringGeo = new THREE.BufferGeometry().setFromPoints(
    new THREE.EllipseCurve(0, 0, 1.18, 1.18, 0, Math.PI * 2).getPoints(160).map((p) => new THREE.Vector3(p.x, 0, p.y)),
  );
  const rings = new THREE.Group();
  [[0.32, 0.1], [-0.55, 0.9], [1.25, -0.4]].forEach(([rx, rz], i) => {
    const l = new THREE.LineLoop(ringGeo, ringMat);
    l.rotation.set(rx, 0, rz);
    l.scale.setScalar(1 + i * 0.07);
    rings.add(l);
  });
  scene.add(rings);

  /* ---------- Nodes on the sphere ---------- */
  const N = Math.round(560 * Math.max(0.5, quality.particles));
  const nodes = fibonacciSphere(N).map((v) => v.multiplyScalar(1.0));
  const nPos = new Float32Array(N * 3);
  const nSeed = new Float32Array(N);
  nodes.forEach((v, i) => { nPos.set([v.x, v.y, v.z], i * 3); nSeed[i] = rand(); });
  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(nPos, 3));
  nodeGeo.setAttribute('aSeed', new THREE.BufferAttribute(nSeed, 1));
  const nodeMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      ${SIDE}
      uniform float uTime, uPixel, uCostW; attribute float aSeed;
      varying float vSide; varying float vFace; varying float vPulse;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vSide = promiseSide(w.x, 0.08);
        vFace = smoothstep(-0.6, 0.6, dot(normalize(w.xyz), normalize(cameraPosition)));
        vPulse = 0.5 + 0.5 * sin(uTime * 1.6 + aSeed * 40.0);
        vec4 mv = viewMatrix * w;
        float size = mix(2.2, 5.0 + 5.0 * vPulse * step(0.82, aSeed), vSide);
        gl_PointSize = size * uPixel * (6.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_SOFT_POINT}
      uniform vec3 uBlue, uBlueDeep, uPinkDeep; uniform float uCostW;
      varying float vSide; varying float vFace; varying float vPulse;
      void main() {
        float core = softPoint(gl_PointCoord, 3.0);
        float halo = softPoint(gl_PointCoord, 1.2) * 0.35;
        vec3 blue = mix(uBlue, uBlueDeep, core);
        vec3 col = mix(uPinkDeep, blue, vSide);
        float a = (core + halo * vSide) * mix(0.28, 0.95, vSide) * mix(0.25, 1.0, vFace);
        a *= mix(1.0, 0.75 + 0.5 * (1.0 - uCostW), vSide);
        if (a < 0.01) discard;
        gl_FragColor = vec4(col, a);
      }`,
  });
  spin.add(new THREE.Points(nodeGeo, nodeMat));

  /* ---------- Connections between neighbouring nodes ---------- */
  const seg = [];
  const segT = [];
  const segSeed = [];
  const maxD = 0.24;
  for (let i = 0; i < N; i++) {
    let links = 0;
    for (let j = i + 1; j < N && links < 3; j++) {
      if (nodes[i].distanceTo(nodes[j]) < maxD && rand() > 0.35) {
        seg.push(nodes[i].x, nodes[i].y, nodes[i].z, nodes[j].x, nodes[j].y, nodes[j].z);
        segT.push(0, 1);
        const s = rand();
        segSeed.push(s, s);
        links++;
      }
    }
  }
  const linkGeo = new THREE.BufferGeometry();
  linkGeo.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
  linkGeo.setAttribute('aT', new THREE.Float32BufferAttribute(segT, 1));
  linkGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(segSeed, 1));
  const linkMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float aT; attribute float aSeed;
      varying float vT; varying float vSeed; varying vec3 vWorld;
      void main() {
        vT = aT; vSeed = aSeed;
        vec4 w = modelMatrix * vec4(position * 1.002, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      ${SIDE}
      uniform float uTime; uniform vec3 uBlueSoft, uBlueDeep;
      varying float vT; varying float vSeed; varying vec3 vWorld;
      void main() {
        float s = promiseSide(vWorld.x, 0.06);
        float face = smoothstep(-0.5, 0.7, dot(normalize(vWorld), normalize(cameraPosition)));
        float head = fract(uTime * (0.25 + vSeed * 0.35) + vSeed * 9.0);
        float pulse = smoothstep(0.18, 0.0, abs(vT - head));
        float a = s * face * (0.16 + 0.7 * pulse);
        if (a < 0.01) discard;
        gl_FragColor = vec4(mix(uBlueSoft, uBlueDeep, pulse), a);
      }`,
  });
  spin.add(new THREE.LineSegments(linkGeo, linkMat));

  /* ---------- Heat haze: warm particles drifting off the cost side ---------- */
  const H = Math.round(1500 * quality.particles);
  const hDir = new Float32Array(H * 3);
  const hData = new Float32Array(H * 4); // phase, speed, size, warmth
  for (let i = 0; i < H; i++) {
    const v = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
    // bias emitters towards the cost hemisphere so the haze reads clearly
    if (v.x > 0.2 && rand() > 0.3) v.x *= -1;
    hDir.set([v.x, v.y, v.z], i * 3);
    hData.set([rand(), 0.05 + rand() * 0.09, 0.6 + rand() * 1.6, rand()], i * 4);
  }
  const hazeGeo = new THREE.BufferGeometry();
  hazeGeo.setAttribute('position', new THREE.BufferAttribute(hDir, 3));
  hazeGeo.setAttribute('aData', new THREE.BufferAttribute(hData, 4));
  const hazeMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      ${SIDE}
      uniform float uTime, uPixel, uCostW; attribute vec4 aData;
      varying float vAlpha; varying float vWarm; varying float vSpark;
      void main() {
        float life = fract(uTime * aData.y + aData.x);
        vec3 dir = normalize(position);
        // emit from a slowly turning surface, then drift outward + upward in world space
        float ang = uTime * 0.06;
        mat2 r = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
        dir.xz = r * dir.xz;
        vec3 p = dir * (0.98 + life * 0.85);
        p.y += life * life * 0.55;
        p.x += sin(uTime * 0.7 + aData.x * 31.0) * 0.05 * life;
        p.z += cos(uTime * 0.6 + aData.x * 17.0) * 0.05 * life;
        float cost = 1.0 - promiseSide(dir.x, 0.18);
        float costNow = 1.0 - promiseSide(p.x, 0.25);
        vSpark = step(0.975, aData.w);
        vWarm = aData.w;
        vAlpha = sin(life * 3.14159) * cost * costNow * (0.35 + 0.9 * uCostW);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        float size = mix(aData.z * (18.0 + life * 46.0), 3.5, vSpark);
        gl_PointSize = size * uPixel * (6.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_SOFT_POINT}
      uniform vec3 uPink, uPinkDeep, uMagenta;
      varying float vAlpha; varying float vWarm; varying float vSpark;
      void main() {
        float soft = softPoint(gl_PointCoord, mix(2.2, 2.6, vSpark));
        vec3 col = mix(uPink, uPinkDeep, vWarm);
        col = mix(col, uMagenta, vSpark * 0.8);
        float a = soft * vAlpha * mix(0.075, 0.6, vSpark);
        if (a < 0.004) discard;
        gl_FragColor = vec4(col, a);
      }`,
  });
  const haze = new THREE.Points(hazeGeo, hazeMat);
  haze.frustumCulled = false;
  scene.add(haze);

  /* ---------- Seam ring: where the two worlds meet ---------- */
  const seamGeo = new THREE.BufferGeometry().setFromPoints(
    new THREE.EllipseCurve(0, 0, 1.004, 1.004, 0, Math.PI * 2).getPoints(180).map((p) => new THREE.Vector3(0, p.x, p.y)),
  );
  const seamMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);}`,
    fragmentShader: /* glsl */ `
      uniform vec3 uMagenta, uBlueDeep; varying vec3 vL;
      void main(){
        float front = smoothstep(-0.6, 0.8, vL.z);
        vec3 col = mix(uMagenta, uBlueDeep, smoothstep(0.6, -0.6, vL.y));
        gl_FragColor = vec4(col, 0.12 + 0.5 * front);
      }`,
  });
  const seam = new THREE.LineLoop(seamGeo, seamMat);
  scene.add(seam);

  /* ---------- State ---------- */
  let balance = 0.5;      // divider position 0..1 across the viewport
  let visibleW = 4;       // world width visible at the globe's depth
  const cam = { x: 0, y: 0 };
  const camDist = { value: 6.2 };

  function applySplit() {
    const x = THREE.MathUtils.clamp((balance - 0.5) * visibleW, -1.25, 1.25);
    uniforms.uSplit.value = x;
    uniforms.uCostW.value = 1 - balance;
    const r = Math.sqrt(Math.max(0, 1 - x * x));
    seam.position.x = x;
    seam.scale.set(1, r, r);
    seam.visible = r > 0.02;
  }

  function resize(w, h) {
    base.resize(w, h);
    const aspect = w / h;
    // Fit the globe: big on desktop, contained on narrow portrait screens.
    const targetFrac = aspect < 0.8 ? 0.34 : 0.205; // globe radius as fraction of the limiting dimension
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const limit = aspect < 1 ? aspect : 1;
    camDist.value = 1 / (targetFrac * 2 * halfH * limit) * 1.0;
    // Nudge the globe below centre so it sits under the headline.
    const shift = aspect < 0.8 ? 0.12 : 0.185; // globe centre sits at (50 + shift*100)% of the hero
    camera.setViewOffset(w, h, 0, -h * shift, w, h);
    canvas.closest('.hero')?.style.setProperty('--globe-y', `${(50 + shift * 100).toFixed(1)}%`);
    visibleW = 2 * halfH * camDist.value * aspect;
    applySplit();
  }

  function render(dt, t) {
    uniforms.uTime.value = reducedMotion ? 7.5 : t;
    if (!reducedMotion) spin.rotation.y += dt * 0.08;
    rings.rotation.y = -t * 0.03;
    // Subtle mouse parallax: the camera drifts, the seam stays vertical.
    cam.x = damp(cam.x, pointer.x * 0.45, 2.5, dt || 1);
    cam.y = damp(cam.y, -pointer.y * 0.3, 2.5, dt || 1);
    camera.position.set(cam.x, cam.y + 0.15, camDist.value);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }

  return {
    resize,
    render,
    setParam(key, v) {
      if (key === 'balance') { balance = v; applySplit(); }
    },
  };
}
