/**
 * Water: a translucent glass droplet that fills as you scroll.
 * The liquid is the droplet shape clipped at a wavy waterline; back faces are
 * painted as the surface, so the cut reads as a solid, filled volume.
 */
import * as THREE from 'three';
import { createBase, brand, damp, rng, GLSL_SOFT_POINT } from '../lib/three-utils.js';

/** Deform a sphere into a teardrop (pointed top, full rounded base). */
function dropletGeometry(segments) {
  const g = new THREE.SphereGeometry(1, segments, segments);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const up = Math.max(0, v.y);
    const pinch = 1 - Math.pow(up, 1.35) * 0.92;
    v.x *= pinch;
    v.z *= pinch;
    v.y = v.y + up * up * 0.65;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export function createScene(canvas, { quality, reducedMotion, pointer }) {
  const base = createBase(canvas, { quality }, 30);
  const { renderer, scene, camera } = base;
  const C = brand();
  const rand = rng(3);

  const uniforms = {
    uTime: { value: 0 },
    uLevel: { value: -0.7 }, // waterline in droplet-local y
    uPixel: { value: quality.pixelRatio },
    uPink: { value: C.orchid200 },
    uPinkLight: { value: C.orchid100 },
    uPinkDeep: { value: C.orchid300 },
    uMagenta: { value: C.magenta },
    uInk: { value: C.ink },
    uBlue: { value: C.sky300 },
  };

  const drop = new THREE.Group();
  drop.position.y = -0.2;
  scene.add(drop);
  const geo = dropletGeometry(quality.tier === 'high' ? 128 : 72);

  /* ---------- Liquid ---------- */
  const liquidMat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    transparent: true,
    vertexShader: /* glsl */ `
      varying vec3 vL; varying vec3 vN; varying vec3 vV;
      void main(){
        vL = position;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uLevel, uTime; uniform vec3 uPink, uPinkLight, uPinkDeep, uMagenta;
      varying vec3 vL; varying vec3 vN; varying vec3 vV;
      void main(){
        float wave = sin(vL.x * 7.0 + uTime * 1.6) * 0.025 + sin(vL.z * 9.0 - uTime * 1.2) * 0.018;
        float line = uLevel + wave;
        if (vL.y > line) discard;
        if (!gl_FrontFacing) {
          // seen from inside: paint as the liquid's top surface
          gl_FragColor = vec4(mix(uPinkLight, uPink, 0.35), 0.92);
          return;
        }
        float depth = clamp((line - vL.y) / 2.0, 0.0, 1.0);
        vec3 col = mix(uPink, uPinkDeep, depth);
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        col = mix(col, vec3(1.0), f * 0.35);
        float meniscus = smoothstep(line - 0.035, line, vL.y);
        col = mix(col, uMagenta, meniscus * 0.55);
        gl_FragColor = vec4(col, 0.82);
      }`,
  });
  const liquid = new THREE.Mesh(geo, liquidMat);
  liquid.scale.setScalar(0.94);
  liquid.renderOrder = 1;
  drop.add(liquid);

  /* ---------- Rising bubbles inside the liquid ---------- */
  const B = Math.round(90 * Math.max(0.5, quality.particles));
  const bData = new Float32Array(B * 4);
  for (let i = 0; i < B; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 0.62;
    bData.set([Math.cos(a) * r, Math.sin(a) * r, rand(), 0.6 + rand() * 0.8], i * 4);
  }
  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(B * 3), 3));
  bGeo.setAttribute('aData', new THREE.BufferAttribute(bData, 4));
  const bubbles = new THREE.Points(bGeo, new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uTime, uLevel, uPixel; attribute vec4 aData; varying float vA;
      void main(){
        float bottom = -0.86;
        float life = fract(uTime * 0.12 * aData.w + aData.z);
        float y = mix(bottom, uLevel - 0.04, life);
        float pinch = 1.0 - pow(max(0.0, y), 1.35) * 0.92;
        vec3 p = vec3(aData.x * pinch + sin(uTime * 2.0 + aData.z * 30.0) * 0.02, y, aData.y * pinch);
        vA = step(bottom + 0.02, uLevel) * smoothstep(0.0, 0.15, life) * smoothstep(1.0, 0.85, life);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (2.0 + aData.w * 3.5) * uPixel * (6.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float ring = smoothstep(1.0, 0.75, d) * (0.5 + 0.5 * smoothstep(0.3, 0.8, d));
        float a = ring * vA * 0.9; if (a < 0.01) discard;
        gl_FragColor = vec4(1.0, 1.0, 1.0, a);
      }`,
  }));
  bubbles.scale.setScalar(0.94);
  bubbles.renderOrder = 2;
  bubbles.frustumCulled = false;
  drop.add(bubbles);

  /* ---------- Glass shell ---------- */
  const glass = (side, strength, order) => {
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uStrength: { value: strength } },
      transparent: true,
      depthWrite: false,
      side,
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vV; varying vec3 vL;
        void main(){
          vL = position;
          vec4 w = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vV = normalize(cameraPosition - w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uPinkDeep, uInk; uniform float uStrength;
        varying vec3 vN; varying vec3 vV; varying vec3 vL;
        void main(){
          vec3 n = normalize(vN);
          float f = pow(1.0 - abs(dot(n, normalize(vV))), 2.2);
          // a single soft specular streak sells the glass
          float spec = pow(max(dot(reflect(-normalize(vV), n), normalize(vec3(-0.6, 0.7, 0.5))), 0.0), 40.0);
          vec3 col = mix(uPinkDeep, uInk, 0.25);
          float a = (f * 0.5 + 0.03) * uStrength;
          gl_FragColor = vec4(mix(col, vec3(1.0), spec), a + spec * 0.8 * uStrength);
        }`,
    }));
    mesh.renderOrder = order;
    return mesh;
  };
  drop.add(glass(THREE.BackSide, 0.4, 0));
  drop.add(glass(THREE.FrontSide, 1, 3));

  /* ---------- Ripples and soft shadow beneath ---------- */
  const ripple = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 5),
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
      fragmentShader: /* glsl */ `
        uniform float uTime, uLevel; uniform vec3 uPinkDeep, uInk; varying vec2 vUv;
        void main(){
          float r = length(vUv - 0.5) * 2.0;
          float shadow = smoothstep(0.45, 0.0, r) * 0.10;
          float rings = smoothstep(0.92, 1.0, sin(r * 34.0 - uTime * 2.2)) * smoothstep(1.0, 0.25, r) * smoothstep(0.18, 0.3, r);
          float fillAmt = clamp((uLevel + 0.9) / 2.3, 0.0, 1.0);
          float a = shadow + rings * (0.12 + 0.25 * fillAmt);
          gl_FragColor = vec4(mix(uInk, uPinkDeep, rings > 0.01 ? 1.0 : 0.3), a);
        }`,
    }),
  );
  ripple.rotation.x = -Math.PI / 2;
  ripple.position.y = -1.22;
  scene.add(ripple);

  /* ---------- State ---------- */
  const LOW = -0.86;
  const HIGH = 1.46;
  let target = LOW + 0.15;
  const cam = { x: 0, y: 0 };
  let dist = 7.5;

  function resize(w, h) {
    base.resize(w, h);
    dist = w / h < 0.9 ? 9.5 : 7.4;
  }

  function render(dt, t) {
    uniforms.uTime.value = reducedMotion ? 2 : t;
    uniforms.uLevel.value = reducedMotion ? target : damp(uniforms.uLevel.value, target, 2.5, dt);
    drop.rotation.y = reducedMotion ? 0 : Math.sin(t * 0.3) * 0.25;
    cam.x = damp(cam.x, pointer.x * 0.5, 2, dt || 1);
    cam.y = damp(cam.y, -pointer.y * 0.35, 2, dt || 1);
    camera.position.set(cam.x, 0.9 + cam.y, dist);
    camera.lookAt(0, 0.1, 0);
    renderer.render(scene, camera);
  }

  return {
    resize,
    render,
    setProgress(p) { target = LOW + 0.1 + p * (HIGH - LOW - 0.2); },
  };
}
