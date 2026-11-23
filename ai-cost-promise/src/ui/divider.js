/**
 * Before/after divider in the hero. Drag (pointer/touch) or use the keyboard
 * (arrows, Home/End, double-click resets). Updates:
 *   --split on the hero (colour veils), the 3D seam via setParam, ARIA values.
 */
import { setParam } from '../lib/scene-manager.js';

export function initDivider() {
  const hero = document.querySelector('.hero');
  const handle = document.getElementById('divider');
  if (!hero || !handle) return;
  const sideCost = document.getElementById('side-cost');
  const sidePromise = document.getElementById('side-promise');
  let value = 0.5;
  let raf = 0;

  const describe = (v) =>
    v < 0.35 ? 'Leaning towards the promise' : v > 0.65 ? 'Leaning towards the cost' : 'Evenly balanced';

  function apply(v, interacted = true) {
    value = Math.min(0.92, Math.max(0.08, v));
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      hero.style.setProperty('--split', `${(value * 100).toFixed(2)}%`);
      handle.setAttribute('aria-valuenow', Math.round(value * 100));
      handle.setAttribute('aria-valuetext', describe(value));
      // the side with more room comes forward
      // (never below 0.72 so the text keeps AA contrast)
      sideCost.style.opacity = Math.min(1, 0.72 + value * 0.6).toFixed(2);
      sidePromise.style.opacity = Math.min(1, 0.72 + (1 - value) * 0.6).toFixed(2);
      setParam('hero', 'balance', value);
    });
    if (interacted) handle.classList.add('was-used');
  }

  const fromEvent = (e) => {
    const r = hero.getBoundingClientRect();
    return (e.clientX - r.left) / r.width;
  };

  handle.addEventListener('pointerdown', (e) => {
    handle.setPointerCapture(e.pointerId);
    handle.classList.add('is-dragging');
    apply(fromEvent(e));
  });
  handle.addEventListener('pointermove', (e) => {
    if (handle.hasPointerCapture(e.pointerId)) apply(fromEvent(e));
  });
  const end = (e) => {
    handle.classList.remove('is-dragging');
    if (handle.hasPointerCapture?.(e.pointerId)) handle.releasePointerCapture(e.pointerId);
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
  handle.addEventListener('dblclick', () => apply(0.5));

  handle.addEventListener('keydown', (e) => {
    const stepSize = e.shiftKey ? 0.1 : 0.04;
    const map = { ArrowLeft: -stepSize, ArrowDown: -stepSize, ArrowRight: stepSize, ArrowUp: stepSize };
    if (e.key in map) { e.preventDefault(); apply(value + map[e.key]); }
    else if (e.key === 'Home') { e.preventDefault(); apply(0); }
    else if (e.key === 'End') { e.preventDefault(); apply(1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apply(0.5); }
  });

  apply(0.5, false);
}
