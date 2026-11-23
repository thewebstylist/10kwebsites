/**
 * Count-up numbers. The final value is already in the HTML (for no-JS, SEO and
 * screen readers); with motion allowed we animate visually from zero when the
 * number scrolls into view. Screen readers get the final value via aria-label.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { formatNumber } from './format.js';

export function initCounters(reducedMotion) {
  if (reducedMotion) return;
  document.querySelectorAll('[data-count]').forEach((el) => {
    const end = parseFloat(el.dataset.count);
    const opts = { decimals: parseInt(el.dataset.decimals || '0', 10), format: el.dataset.format };
    const finalText = el.textContent;
    shieldForScreenReaders(el.closest('.num'));
    const state = { v: 0 };
    el.textContent = formatNumber(0, opts);
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () =>
        gsap.to(state, {
          v: end,
          duration: end >= 1000 && opts.format === 'plain' ? 1.4 : 1.8,
          ease: 'power3.out',
          onUpdate: () => (el.textContent = formatNumber(state.v, opts)),
          onComplete: () => (el.textContent = finalText),
        }),
    });
  });
}

/** Give assistive tech the final value once, and hide the animating digits. */
function shieldForScreenReaders(num) {
  if (!num || num.dataset.sr) return;
  num.dataset.sr = '1';
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = num.textContent.replace(/\s+/g, ' ').trim();
  [...num.childNodes].forEach((n) => {
    if (n.nodeType === 1) n.setAttribute('aria-hidden', 'true');
    else if (n.nodeType === 3 && n.textContent.trim()) {
      const w = document.createElement('span');
      w.setAttribute('aria-hidden', 'true');
      w.textContent = n.textContent;
      n.replaceWith(w);
    }
  });
  num.prepend(sr);
}
