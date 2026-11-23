/**
 * Shared Three.js helpers: renderer setup, brand colours for shaders and a few
 * GLSL snippets used by several scenes.
 *
 * Colour note: custom ShaderMaterials here write sRGB values straight to the
 * (alpha) canvas, so brand hexes appear exactly as specified in main.css.
 */
import * as THREE from 'three';
import { token } from './env.js';

/** Brand hex -> raw sRGB vec3 (no colour-space conversion), for shaders. */
export function srgb(hex) {
  const h = hex.replace('#', '');
  return new THREE.Vector3(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  );
}

/** Brand palette pulled from the CSS tokens (falls back to the spec hexes). */
export function brand() {
  const t = (n, f) => token(n) || f;
  return {
    ink: srgb(t('--color-ink', '#1a1a2e')),
    orchid100: srgb(t('--color-orchid-100', '#fbe6f6')),
    orchid200: srgb(t('--color-orchid-200', '#f2a7e3')),
    orchid300: srgb(t('--color-orchid-300', '#e77fd0')),
    orchid700: srgb(t('--color-orchid-700', '#a3268a')),
    magenta: srgb(t('--color-magenta', '#ff3bd4')),
    sky100: srgb(t('--color-sky-100', '#ddeffc')),
    sky200: srgb(t('--color-sky-200', '#8fcbf5')),
    sky300: srgb(t('--color-sky-300', '#4db3ee')),
    sky700: srgb(t('--color-sky-700', '#0a6aae')),
    blue: srgb(t('--color-blue', '#0599f2')),
  };
}

export function createBase(canvas, { quality }, fov = 35) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: quality.tier === 'high',
    alpha: true,
    premultipliedAlpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 200);
  return {
    renderer,
    scene,
    camera,
    size: { w: 1, h: 1 },
    resize(w, h) {
      this.size = { w, h };
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
  };
}

/** Smoothly approach a target (frame-rate independent). */
export const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));

/** Deterministic pseudo-random, so scenes look the same on every load. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Evenly distributed points on a unit sphere (Fibonacci lattice). */
export function fibonacciSphere(n) {
  const pts = [];
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = g * i;
    pts.push(new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r));
  }
  return pts;
}

/** GLSL: soft round sprite falloff for gl_PointCoord. */
export const GLSL_SOFT_POINT = /* glsl */ `
  // Smooth plateau falloff: reads as a soft glow rather than a hard dot.
  float softPoint(vec2 pc, float hardness) {
    float d = clamp(length(pc - 0.5) * 2.0, 0.0, 1.0);
    return pow(1.0 - smoothstep(0.0, 1.0, d), hardness);
  }
`;
