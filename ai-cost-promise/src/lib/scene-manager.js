/**
 * SceneManager
 * - Lazy-loads each Three.js scene module when its container nears the viewport
 *   (three.js itself is only downloaded with the first scene).
 * - Runs ONE shared requestAnimationFrame loop, rendering only scenes that are
 *   on screen, at a capped frame rate.
 * - Stores scroll "progress" for scenes before they exist, so ScrollTrigger can
 *   drive scenes that are still loading.
 * - Reduced motion: scenes render on demand only (progress / resize / pointer).
 */
import { QUALITY, REDUCED_MOTION, hasWebGL } from './env.js';

const LOADERS = {
  hero: () => import('../scenes/hero.js'),
  grid: () => import('../scenes/grid.js'),
  water: () => import('../scenes/water.js'),
  carbon: () => import('../scenes/carbon.js'),
  helix: () => import('../scenes/helix.js'),
  constellation: () => import('../scenes/constellation.js'),
};

const entries = new Map(); // name -> { el, canvas, scene, visible, progress, state }
let running = false;
let last = 0;
const frameInterval = 1000 / QUALITY.fps;
const pointer = { x: 0, y: 0 }; // normalised -1..1, shared by all scenes

export const webglAvailable = hasWebGL();

// Debug handle for automated visual checks (?debug in the URL).
if (typeof location !== 'undefined' && location.search.includes('debug')) window.__scenes = entries;

export function initScenes() {
  if (!webglAvailable) {
    document.documentElement.classList.add('no-webgl');
    return;
  }

  const nearIO = new IntersectionObserver(onNear, { rootMargin: '60% 0px 60% 0px' });
  const visIO = new IntersectionObserver(onVisible, { rootMargin: '0px', threshold: 0 });

  document.querySelectorAll('[data-scene]').forEach((el) => {
    const name = el.dataset.scene;
    if (!LOADERS[name]) return;
    entries.set(name, { name, el, canvas: el.querySelector('canvas'), scene: null, visible: false, progress: 0, state: 'idle', dirty: true });
    nearIO.observe(el);
    visIO.observe(el);
  });

  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    if (REDUCED_MOTION) markAllDirty();
  }, { passive: true });

  const ro = new ResizeObserver((items) => {
    for (const it of items) {
      for (const e of entries.values()) {
        if (e.el === it.target && e.scene) { resize(e); e.dirty = true; }
      }
    }
  });
  entries.forEach((e) => ro.observe(e.el));

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { last = 0; tick(performance.now()); }
  });
}

function onNear(items) {
  for (const it of items) {
    if (!it.isIntersecting) continue;
    const e = [...entries.values()].find((x) => x.el === it.target);
    if (e && e.state === 'idle') load(e);
  }
}

function onVisible(items) {
  for (const it of items) {
    const e = [...entries.values()].find((x) => x.el === it.target);
    if (!e) continue;
    e.visible = it.isIntersecting;
    if (e.visible) { e.dirty = true; if (e.state === 'idle') load(e); }
  }
  startLoop();
}

async function load(e) {
  e.state = 'loading';
  try {
    const mod = await LOADERS[e.name]();
    e.scene = mod.createScene(e.canvas, { quality: QUALITY, reducedMotion: REDUCED_MOTION, pointer });
    resize(e);
    e.scene.setProgress?.(e.progress);
    for (const [k, v] of Object.entries(e.params || {})) e.scene.setParam?.(k, v);
    e.scene.render(0, 0); // first frame immediately
    e.state = 'ready';
    e.el.classList.add('is-ready');
    e.dirty = true;
    startLoop();
  } catch (err) {
    console.warn(`[scene:${e.name}] failed, showing static fallback`, err);
    e.state = 'failed';
  }
}

function resize(e) {
  const r = e.el.getBoundingClientRect();
  e.scene.resize(Math.max(1, r.width), Math.max(1, r.height));
}

function startLoop() {
  if (running) return;
  running = true;
  requestAnimationFrame(tick);
}

let t0 = performance.now();
function tick(now) {
  if (document.hidden) { running = false; return; }
  const anyVisible = [...entries.values()].some((e) => e.visible && e.state === 'ready');
  if (!anyVisible) { running = false; return; }
  requestAnimationFrame(tick);

  if (now - last < frameInterval - 1) return; // frame-rate cap
  const dt = Math.min(0.1, last ? (now - last) / 1000 : 0.016);
  last = now;
  const t = (now - t0) / 1000;

  for (const e of entries.values()) {
    if (!e.visible || e.state !== 'ready') continue;
    if (REDUCED_MOTION && !e.dirty) continue; // static unless something changed
    e.scene.render(REDUCED_MOTION ? 0 : dt, REDUCED_MOTION ? 0 : t);
    e.dirty = false;
  }
}

function markAllDirty() { entries.forEach((e) => (e.dirty = true)); startLoop(); }

/** Drive a scene from scroll (0..1). Safe to call before the scene loads. */
export function setProgress(name, p) {
  const e = entries.get(name);
  if (!e) return;
  e.progress = p;
  e.dirty = true;
  if (e.scene) e.scene.setProgress?.(p);
  startLoop();
}

/** Send an arbitrary parameter (e.g. hero balance) to a scene. */
export function setParam(name, key, value) {
  const e = entries.get(name);
  if (!e) return;
  e.params = { ...(e.params || {}), [key]: value };
  e.dirty = true;
  e.scene?.setParam?.(key, value); // otherwise applied on load
  startLoop();
}
