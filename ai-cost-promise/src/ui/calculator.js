/**
 * Per-query footprint calculator.
 * yearly energy (kWh) = prompts/day × Wh/prompt × 365 / 1000
 * yearly water  (L)   = prompts/day × mL/prompt × 365 / 1000
 * Comparisons: phone charge ≈ 15 Wh, 10 W LED bulb, 250 mL glass.
 */
import { gsap } from 'gsap';
import { smartFormat } from './format.js';

const PHONE_WH = 15;
const BULB_W = 10;
const GLASS_L = 0.25;
// Meter scale: the maximum the calculator can show (300 prompts at upper-end values)
const MAX_KWH = (300 * 2.9 * 365) / 1000;
const MAX_L = (300 * 45 * 365) / 1000;

export function initCalculator(reducedMotion) {
  const range = document.getElementById('calc-range');
  const number = document.getElementById('calc-number');
  const presets = [...document.querySelectorAll('#calc-presets .preset')];
  if (!range || !number) return;

  const out = Object.fromEntries([...document.querySelectorAll('[data-calc]')].map((el) => [el.dataset.calc, el]));
  const meters = Object.fromEntries([...document.querySelectorAll('[data-meter]')].map((el) => [el.dataset.meter, el]));
  const shown = { kwh: 0, litres: 0, phones: 0, bulb: 0, glasses: 0 };
  let preset = presets.find((p) => p.getAttribute('aria-checked') === 'true') || presets[1];

  const logPct = (v, max) => `${Math.max(2, (Math.log10(1 + v) / Math.log10(1 + max)) * 100).toFixed(1)}%`;

  function update() {
    const prompts = Math.max(1, Math.min(5000, parseInt(number.value, 10) || 1));
    const wh = parseFloat(preset.dataset.wh);
    const ml = parseFloat(preset.dataset.ml);
    const yearWh = prompts * wh * 365;
    const next = {
      kwh: yearWh / 1000,
      litres: (prompts * ml * 365) / 1000,
      phones: yearWh / PHONE_WH,
      bulb: yearWh / BULB_W,
      glasses: (prompts * ml * 365) / 1000 / GLASS_L,
    };
    range.style.setProperty('--p', `${((Math.min(prompts, 300) - 1) / 299) * 100}%`);
    meters.kwh.style.width = logPct(next.kwh, MAX_KWH);
    meters.litres.style.width = logPct(next.litres, MAX_L);

    const write = () => Object.keys(next).forEach((k) => { if (out[k]) out[k].textContent = smartFormat(shown[k]); });
    if (reducedMotion) { Object.assign(shown, next); write(); return; }
    gsap.to(shown, { ...next, duration: 0.7, ease: 'power3.out', overwrite: true, onUpdate: write });
  }

  range.addEventListener('input', () => { number.value = range.value; update(); });
  number.addEventListener('input', () => {
    const v = parseInt(number.value, 10);
    if (!Number.isNaN(v)) range.value = Math.min(300, Math.max(1, v));
    update();
  });

  // Radiogroup semantics: click, arrows move selection, roving tabindex.
  const select = (p, focus = false) => {
    preset = p;
    presets.forEach((x) => {
      const on = x === p;
      x.setAttribute('aria-checked', on);
      x.tabIndex = on ? 0 : -1;
    });
    if (focus) p.focus();
    update();
  };
  presets.forEach((p, i) => {
    p.addEventListener('click', () => select(p));
    p.addEventListener('keydown', (e) => {
      const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (d) { e.preventDefault(); select(presets[(i + d + presets.length) % presets.length], true); }
    });
  });

  select(preset);
}
