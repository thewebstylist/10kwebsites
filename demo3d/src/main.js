import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CHARACTERS, TARGET_HEIGHT } from './characters.js';
import { loadCharacter } from './loadCharacter.js';

// ── constants ───────────────────────────────────────────────────────

const CAM_HOME = new THREE.Vector3(2.15, 1.52, 3.55);
const CAM_TARGET = new THREE.Vector3(0, TARGET_HEIGHT * 0.5, 0);
const AUTO_SPEED = 0.16;        // rad/s
const RESUME_DELAY = 2.6;       // s of stillness before the turntable restarts

// ── dom ─────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);
const el = {
  canvas: $('scene'), switcher: $('switcher'), hint: $('hint'),
  loader: $('loader'), loaderName: $('loaderName'), loaderFill: $('loaderFill'),
  loaderPct: $('loaderPct'), loaderNote: $('loaderNote'),
  sourceImg: $('sourceImg'), sourceMeta: $('sourceMeta'),
  statIdx: $('statIdx'), statName: $('statName'), statRole: $('statRole'),
  statEngine: $('statEngine'), statCost: $('statCost'), statTris: $('statTris'),
  statVerts: $('statVerts'), statSize: $('statSize'), statDraws: $('statDraws'),
  statSettings: $('statSettings'),
  modes: $('modes'), dis: $('dis'), disVal: $('disVal'),
};

const nf = new Intl.NumberFormat('en-US');

// ── renderer / scene ────────────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({
  canvas: el.canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07070a);
scene.fog = new THREE.Fog(0x07070a, 7.5, 16);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.copy(CAM_HOME);

const controls = new OrbitControls(camera, el.canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.target.copy(CAM_TARGET);
controls.minDistance = 1.4;
controls.maxDistance = 9;
controls.maxPolarAngle = Math.PI * 0.94;
controls.enablePan = false;

// ── lighting: warm key, cool rim, soft fill ─────────────────────────

const key = new THREE.DirectionalLight(0xffd9b0, 3.1);
key.position.set(3.4, 5.0, 3.0);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.radius = 4;
key.shadow.bias = -0.0012;
key.shadow.normalBias = 0.022;
{
  const c = key.shadow.camera;
  c.near = 0.5; c.far = 16; c.left = -3; c.right = 3; c.top = 3.6; c.bottom = -1.2;
  c.updateProjectionMatrix();
}
scene.add(key);

const rim = new THREE.DirectionalLight(0x76a8ff, 2.5);
rim.position.set(-3.6, 2.6, -3.4);
scene.add(rim);

const fill = new THREE.DirectionalLight(0xfff2e4, 0.5);
fill.position.set(-1.6, 1.1, 3.4);
scene.add(fill);

scene.add(new THREE.HemisphereLight(0x9fb6ff, 0x140f0a, 0.5));

// a single warm bounce under the figure keeps the feet from going to mud
const bounce = new THREE.PointLight(0xff8a44, 4.2, 5.5, 2);
bounce.position.set(0, 0.16, 1.5);
scene.add(bounce);

// ── ground ──────────────────────────────────────────────────────────

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(5.2, 96).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.96, metalness: 0.0 }),
);
ground.position.y = -0.001;
ground.receiveShadow = true;
scene.add(ground);

// a faint ring so the turntable reads as a plinth rather than a void
const ring = new THREE.Mesh(
  new THREE.RingGeometry(1.32, 1.34, 128).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xff7a34, transparent: true, opacity: 0.16 }),
);
ring.position.y = 0.002;
scene.add(ring);

// ── turntable ───────────────────────────────────────────────────────

const turntable = new THREE.Group();
scene.add(turntable);

// ── state ───────────────────────────────────────────────────────────

const cache = new Map();          // id -> loaded character
const sizes = new Map();          // id -> bytes on the wire
let current = null;
let currentDef = null;
let mode = 'texture';
let idleFor = RESUME_DELAY;
let dragging = false;
let switching = false;
let firstLoadDone = false;

// ── camera placement ────────────────────────────────────────────────

// Damping keeps momentum, so a bare `camera.position.set` is eased back on the
// next update(). Disable damping for exactly one update to place it for real.
function placeCamera(position, target) {
  const damping = controls.enableDamping;
  controls.enableDamping = false;
  camera.position.copy(position);
  controls.target.copy(target);
  controls.update();
  controls.enableDamping = damping;
}

// ── switcher ────────────────────────────────────────────────────────

const chips = CHARACTERS.map((def, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip';
  b.innerHTML =
    `<span class="chip__name">${def.name}</span>` +
    `<span class="chip__num">${def.index}</span>` +
    `<i class="chip__bar"></i>`;
  b.setAttribute('aria-label', `${def.name} — ${def.engine}`);
  b.addEventListener('click', () => select(i));
  el.switcher.append(b);
  return b;
});

function markChips(activeIndex, loadingIndex = -1) {
  chips.forEach((c, i) => {
    c.classList.toggle('is-active', i === activeIndex);
    c.classList.toggle('is-loading', i === loadingIndex);
    if (i !== loadingIndex) c.querySelector('.chip__bar').style.width = '0%';
  });
}

// ── stats ───────────────────────────────────────────────────────────

function paintStats(def, entry) {
  el.statIdx.textContent = def.index;
  el.statName.textContent = def.name;
  el.statRole.textContent = def.role;
  el.statEngine.textContent = def.engine;
  el.statCost.textContent = `${def.credits} cr`;
  el.statCost.classList.add('is-accent');
  el.statSettings.textContent = def.settings;

  el.statTris.textContent = entry ? nf.format(entry.stats.triangles) : '—';
  el.statVerts.textContent = entry ? nf.format(entry.stats.vertices) : '—';
  el.statDraws.textContent = entry ? nf.format(entry.stats.meshes) : '—';

  const bytes = sizes.get(def.id);
  el.statSize.textContent = bytes ? `${(bytes / 1048576).toFixed(1)} MB` : '—';
}

function paintSource(def) {
  el.sourceImg.src = def.thumb;
  el.sourceImg.alt = `Source illustration for ${def.name}`;
  el.sourceMeta.textContent = `${def.index} · ${def.name}`;
}

// ── loading ui ──────────────────────────────────────────────────────

function showLoader(def) {
  el.loaderName.textContent = def.name;
  el.loaderNote.textContent = 'downloading mesh';
  setLoaderProgress(0);
  el.loader.classList.remove('is-done');
}

function setLoaderProgress(f) {
  if (f < 0) {
    // no Content-Length: show an indeterminate-ish crawl rather than lying
    el.loaderNote.textContent = 'downloading mesh';
    return;
  }
  el.loaderFill.style.width = `${Math.round(f * 100)}%`;
  el.loaderPct.textContent = String(Math.round(f * 100));
}

function hideLoader() {
  el.loaderNote.textContent = 'ready';
  setLoaderProgress(1);
  el.loader.classList.add('is-done');
}

// ── selection ───────────────────────────────────────────────────────

async function select(i) {
  if (switching) return;
  const def = CHARACTERS[i];
  if (currentDef === def && cache.has(def.id)) return;

  switching = true;
  currentDef = def;
  paintSource(def);
  paintStats(def, cache.get(def.id) || null);
  markChips(i, cache.has(def.id) ? -1 : i);

  let entry = cache.get(def.id);

  if (!entry) {
    const chipBar = chips[i].querySelector('.chip__bar');
    const useOverlay = !firstLoadDone;
    if (useOverlay) showLoader(def);

    const onProgress = (f) => {
      if (useOverlay) setLoaderProgress(f);
      if (f >= 0) chipBar.style.width = `${Math.round(f * 100)}%`;
    };

    try {
      // real byte progress needs a Content-Length; note the size for the panel
      entry = await loadCharacter(def, onProgress);
    } catch (err) {
      console.error(err);
      el.loaderNote.textContent = 'failed — see console';
      switching = false;
      markChips(i, -1);
      return;
    }

    // record transfer size where the browser exposes it
    const nav = performance.getEntriesByType('resource')
      .find((r) => r.name.endsWith(def.glb));
    if (nav) sizes.set(def.id, nav.encodedBodySize || nav.transferSize || 0);

    cache.set(def.id, entry);
    if (useOverlay) hideLoader();
    firstLoadDone = true;
  }

  // swap in
  if (current) turntable.remove(current.group);
  current = entry;
  turntable.add(entry.group);
  entry.setMode(mode);
  entry.uniform.value = Number(el.dis.value);

  turntable.rotation.y = 0;
  placeCamera(CAM_HOME, CAM_TARGET);

  paintStats(def, entry);
  markChips(i, -1);
  switching = false;
  render();
}

// ── surface modes ───────────────────────────────────────────────────

el.modes.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-mode]');
  if (!btn) return;
  mode = btn.dataset.mode;
  [...el.modes.children].forEach((b) => b.classList.toggle('is-active', b === btn));
  current?.setMode(mode);
  render();
});

// ── disintegrate ────────────────────────────────────────────────────

el.dis.addEventListener('input', () => {
  const v = Number(el.dis.value);
  el.disVal.textContent = v.toFixed(2);
  if (current) current.uniform.value = v;
  render();
});

// ── auto-orbit / interaction ────────────────────────────────────────

controls.addEventListener('start', () => {
  dragging = true;
  idleFor = 0;
  el.hint.classList.add('is-hidden');
});
controls.addEventListener('end', () => { dragging = false; idleFor = 0; });
el.canvas.addEventListener('wheel', () => { idleFor = 0; el.hint.classList.add('is-hidden'); }, { passive: true });

// the hint has said its piece by then
setTimeout(() => el.hint.classList.add('is-hidden'), 7000);

// ── resize ──────────────────────────────────────────────────────────

function resize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
addEventListener('resize', resize);
resize();

// ── frame loop ──────────────────────────────────────────────────────

let lastT = 0;

function render() {
  renderer.render(scene, camera);
}

function step(dt) {
  if (dragging) {
    idleFor = 0;
  } else {
    idleFor += dt;
    if (idleFor > RESUME_DELAY) {
      // ease back in over ~1s so it does not snap into motion
      const ramp = Math.min((idleFor - RESUME_DELAY) / 1.0, 1);
      turntable.rotation.y += AUTO_SPEED * ramp * dt;
    }
  }
  controls.update();
  render();
}

function tick(t = performance.now()) {
  // clamp so a backgrounded tab does not resume with a giant jump
  const dt = lastT ? Math.min((t - lastT) / 1000, 0.1) : 1 / 60;
  lastT = t;
  step(dt);
  requestAnimationFrame(tick);
}

// Manual frame driver — lets a headless harness advance and render the scene
// deterministically when requestAnimationFrame is not being serviced.
window.__frame = (dt = 1 / 60) => { step(dt); return true; };
window.__app = {
  get current() { return currentDef?.id ?? null; },
  get stats() { return current ? { ...current.stats, id: currentDef.id } : null; },
  select: (i) => select(i),
  setMode: (m) => {
    mode = m;
    [...el.modes.children].forEach((b) => b.classList.toggle('is-active', b.dataset.mode === m));
    current?.setMode(m);
    render();
  },
  setDisintegrate: (v) => {
    el.dis.value = String(v);
    el.dis.dispatchEvent(new Event('input'));
  },
  placeCamera: (p, t) => placeCamera(
    new THREE.Vector3(...p),
    t ? new THREE.Vector3(...t) : CAM_TARGET,
  ),
  get camera() { return camera.position.toArray(); },
  get turntable() { return turntable.rotation.y; },
  // Tuning aid for the per-character yaw offset. Every engine picks its own
  // "front", and the offset has to be applied before the bounding-box
  // normalisation — so this drops the cached mesh and reloads through the
  // real path rather than spinning the group after the fact, which would
  // walk an off-centre figure off the turntable axis.
  //
  //   __app.setYaw(90)   → try 90°, then write `yaw: Math.PI / 2` into
  //                        src/characters.js for that character
  setYaw(degrees) {
    if (!currentDef) return null;
    currentDef.yaw = (degrees * Math.PI) / 180;
    cache.get(currentDef.id)?.dispose();
    cache.delete(currentDef.id);
    if (current) { turntable.remove(current.group); current = null; }
    const i = CHARACTERS.indexOf(currentDef);
    currentDef = null;
    select(i);
    return `${currentDef?.id ?? CHARACTERS[i].id}: yaw ${degrees}°  →  yaw: ${(degrees * Math.PI / 180).toFixed(4)}`;
  },
  get yaw() { return currentDef ? (currentDef.yaw * 180) / Math.PI : null; },

  get materials() {
    if (!current) return null;
    return [...new Set(current.group.children.map((m) => m.material.type))];
  },
  get bbox() {
    if (!current) return null;
    const b = new THREE.Box3().setFromObject(current.group);
    return { min: b.min.toArray(), max: b.max.toArray() };
  },
  get ready() { return !switching && !!current; },
  get renderInfo() { return { ...renderer.info.render, programs: renderer.info.programs?.length ?? 0 }; },
};

// ── go ──────────────────────────────────────────────────────────────

tick();
select(0);
