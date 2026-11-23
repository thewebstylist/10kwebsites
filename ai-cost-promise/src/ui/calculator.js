/**
 * "Your year in Ai" calculator: text prompts, images and video clips.
 *
 * For each activity: per-unit energy (Wh) comes from the chosen, cited preset.
 * Water: text presets carry their own published per-prompt figure (mL);
 * images and video use the US data-center average of ~1.3 gal per kWh
 * (direct cooling + power generation, derived from LBNL 2024: 228 bn gal / 176 TWh).
 *
 * yearly kWh     = Σ count/day × Wh/unit × 365 / 1000
 * yearly gallons = Σ count/day × mL/unit × 365 / 3785.41
 */
import { gsap } from 'gsap';
import { smartFormat } from './format.js';

const ML_PER_GALLON = 3785.41;
const ML_PER_WH = (228e9 * ML_PER_GALLON) / 176e12; // ≈ 4.9 mL per Wh (≈ 1.3 gal/kWh)
const PHONE_WH = 15;
const BULB_W = 10;
const GLASS_ML = 236.59; // 8 US fl oz
// Meter scale: everything maxed out at the upper-end assumptions
const MAX = { text: [300, 2.9, 45], images: [200, 2.9], videos: [50, 944] };
const MAX_WH_DAY = MAX.text[0] * MAX.text[1] + MAX.images[0] * MAX.images[1] + MAX.videos[0] * MAX.videos[1];
const MAX_ML_DAY = MAX.text[0] * MAX.text[2] + (MAX.images[0] * MAX.images[1] + MAX.videos[0] * MAX.videos[1]) * ML_PER_WH;
const MAX_KWH = (MAX_WH_DAY * 365) / 1000;
const MAX_GAL = (MAX_ML_DAY * 365) / ML_PER_GALLON;

export function initCalculator(reducedMotion) {
  const form = document.getElementById('calc-form');
  if (!form) return;

  const groups = [...form.querySelectorAll('[data-group]')].map((el) => {
    const g = {
      name: el.dataset.group,
      range: el.querySelector('input[type="range"]'),
      number: el.querySelector('input[type="number"]'),
      opts: [...el.querySelectorAll('.seg__opt')],
      source: el.querySelector('[data-source]'),
    };
    g.preset = g.opts.find((o) => o.getAttribute('aria-checked') === 'true') || g.opts[0];
    return g;
  });

  const out = Object.fromEntries([...document.querySelectorAll('[data-calc]')].map((el) => [el.dataset.calc, el]));
  const meters = Object.fromEntries([...document.querySelectorAll('[data-meter]')].map((el) => [el.dataset.meter, el]));
  const mix = Object.fromEntries([...document.querySelectorAll('[data-mix]')].map((el) => [el.dataset.mix, el]));
  const share = Object.fromEntries([...document.querySelectorAll('[data-share]')].map((el) => [el.dataset.share, el]));
  const insight = document.querySelector('[data-insight]');
  const shown = { kwh: 0, gallons: 0, phones: 0, bulb: 0, glasses: 0 };
  const logPct = (v, max) => `${Math.max(2, (Math.log10(1 + v) / Math.log10(1 + max)) * 100).toFixed(1)}%`;

  const count = (g) => Math.max(0, Math.min(Number(g.number.max), parseInt(g.number.value, 10) || 0));
  const whPer = (g) => parseFloat(g.preset.dataset.wh);
  const mlPer = (g) => (g.preset.dataset.ml ? parseFloat(g.preset.dataset.ml) : whPer(g) * ML_PER_WH);

  function update() {
    let whDay = 0;
    let mlDay = 0;
    const perGroupWh = {};
    for (const g of groups) {
      const n = count(g);
      perGroupWh[g.name] = n * whPer(g);
      whDay += perGroupWh[g.name];
      mlDay += n * mlPer(g);
      g.range.style.setProperty('--p', `${(Math.min(n, Number(g.range.max)) / Number(g.range.max)) * 100}%`);
    }
    const yearWh = whDay * 365;
    const next = {
      kwh: yearWh / 1000,
      gallons: (mlDay * 365) / ML_PER_GALLON,
      phones: yearWh / PHONE_WH,
      bulb: yearWh / BULB_W,
      glasses: (mlDay * 365) / GLASS_ML,
    };
    meters.kwh.style.width = logPct(next.kwh, MAX_KWH);
    meters.gallons.style.width = logPct(next.gallons, MAX_GAL);

    // Electricity mix
    for (const name of ['text', 'images', 'videos']) {
      const pct = whDay > 0 ? (perGroupWh[name] / whDay) * 100 : 0;
      if (mix[name]) mix[name].style.width = `${pct}%`;
      if (share[name]) share[name].textContent = `${pct > 0 && pct < 1 ? '<1' : pct > 99 && pct < 100 ? '>99' : Math.round(pct)}%`;
    }

    // One clear comparison: how many text prompts one video (or image) equals
    const text = groups.find((g) => g.name === 'text');
    const vid = groups.find((g) => g.name === 'videos');
    const img = groups.find((g) => g.name === 'images');
    if (insight && text && vid && img) {
      const perVideo = Math.round(whPer(vid) / whPer(text));
      const perImage = whPer(img) / whPer(text);
      insight.textContent = `One video clip uses about as much electricity as ${perVideo.toLocaleString('en-US')} text prompts; one image, about ${perImage < 10 ? perImage.toFixed(1) : Math.round(perImage)}.`;
    }

    const write = () => Object.keys(next).forEach((k) => { if (out[k]) out[k].textContent = smartFormat(shown[k]); });
    if (reducedMotion) { Object.assign(shown, next); write(); return; }
    gsap.to(shown, { ...next, duration: 0.7, ease: 'power3.out', overwrite: true, onUpdate: write });
  }

  for (const g of groups) {
    g.range.addEventListener('input', () => { g.number.value = g.range.value; update(); });
    g.number.addEventListener('input', () => {
      const v = parseInt(g.number.value, 10);
      if (!Number.isNaN(v)) g.range.value = Math.min(Number(g.range.max), Math.max(0, v));
      update();
    });
    const select = (opt, focus = false) => {
      g.preset = opt;
      g.opts.forEach((o) => {
        const on = o === opt;
        o.setAttribute('aria-checked', String(on));
        o.tabIndex = on ? 0 : -1;
      });
      if (g.source) g.source.textContent = opt.dataset.src || '';
      if (focus) opt.focus();
      update();
    };
    g.opts.forEach((o, i) => {
      o.addEventListener('click', () => select(o));
      o.addEventListener('keydown', (e) => {
        const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (d) { e.preventDefault(); select(g.opts[(i + d + g.opts.length) % g.opts.length], true); }
      });
    });
    select(g.preset);
  }
}
