/**
 * Environment + quality profile, computed once.
 * Every 3D scene reads QUALITY so mobile / low-power devices get fewer
 * particles, a lower pixel ratio and a capped frame rate.
 */
const mq = (q) => typeof window !== 'undefined' && window.matchMedia(q).matches;

export const REDUCED_MOTION = mq('(prefers-reduced-motion: reduce)');
export const IS_MOBILE = mq('(max-width: 899px)') || mq('(pointer: coarse)');
const LOW_CORES = (navigator.hardwareConcurrency || 8) <= 4;

export const QUALITY = {
  tier: IS_MOBILE || LOW_CORES ? 'low' : 'high',
  pixelRatio: Math.min(window.devicePixelRatio || 1, IS_MOBILE ? 1.25 : 1.75),
  fps: IS_MOBILE || LOW_CORES ? 30 : 60,
  particles: IS_MOBILE ? 0.35 : 1, // multiplier for particle counts
};

/** True if a WebGL context can actually be created. */
export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

/** Read a brand token defined in main.css (single source of truth). */
export function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
