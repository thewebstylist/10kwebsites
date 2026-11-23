/**
 * Citations: numbers every [data-cite] marker in order of first appearance,
 * builds the Sources list, and shows an accessible hover/focus tooltip.
 */
import { SOURCES, STATUS_LABELS } from '../data/sources.js';

const order = [];

function numberFor(key) {
  let i = order.indexOf(key);
  if (i === -1) { order.push(key); i = order.length - 1; }
  return i + 1;
}

/** Number any citation markers (call again after inserting new ones). */
export function refreshCites(root = document) {
  root.querySelectorAll('a.cite[data-cite]:not([data-n])').forEach((a) => {
    const key = a.dataset.cite;
    const src = SOURCES[key];
    if (!src) { console.warn('Unknown source', key); a.remove(); return; }
    const n = numberFor(key);
    a.dataset.n = n;
    a.textContent = n;
    a.href = `#src-${key}`;
    a.setAttribute('aria-label', `Source ${n}: ${src.publisher}, ${src.year}`);
  });
}

function buildList() {
  const list = document.getElementById('sources-list');
  if (!list) return;
  // Sources not cited in the body still appear, after the cited ones.
  Object.keys(SOURCES).forEach((k) => numberFor(k));
  list.innerHTML = order
    .map((key, i) => {
      const s = SOURCES[key];
      return `<li id="src-${key}">
        <span class="font-bold text-ink-3">${i + 1}.</span>
        <div>
          <p><span class="font-semibold text-ink">${s.publisher}</span> (${s.year}). <a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.title}<span class="sr-only"> (opens in a new tab)</span></a></p>
          <p class="caption mt-1">${s.note}</p>
          <p class="mt-2"><span class="chip chip--${s.status}">${STATUS_LABELS[s.status]}</span></p>
        </div>
      </li>`;
    })
    .join('');
}

function setupTooltip() {
  const tip = document.getElementById('cite-tip');
  if (!tip) return;
  let hideTimer;

  const show = (a) => {
    const s = SOURCES[a.dataset.cite];
    if (!s) return;
    clearTimeout(hideTimer);
    tip.innerHTML = `<strong>${s.publisher} · ${s.year}</strong><em class="not-italic">${s.title}</em><p class="mt-2">${s.note}</p><p class="mt-2"><span class="chip chip--${s.status}">${STATUS_LABELS[s.status]}</span></p>`;
    const r = a.getBoundingClientRect();
    const w = Math.min(340, window.innerWidth - 32);
    tip.style.maxWidth = `${w}px`;
    const left = Math.min(Math.max(16, r.left + r.width / 2 - w / 2), window.innerWidth - w - 16);
    tip.style.left = `${left}px`;
    tip.classList.add('is-visible');
    const h = tip.offsetHeight;
    const above = r.top - h - 10;
    tip.style.top = `${above > 12 ? above : r.bottom + 10}px`;
  };
  const hide = () => { hideTimer = setTimeout(() => tip.classList.remove('is-visible'), 80); };

  document.addEventListener('mouseover', (e) => { const a = e.target.closest?.('a.cite'); if (a) show(a); });
  document.addEventListener('mouseout', (e) => { if (e.target.closest?.('a.cite')) hide(); });
  document.addEventListener('focusin', (e) => { const a = e.target.closest?.('a.cite'); if (a) show(a); });
  document.addEventListener('focusout', (e) => { if (e.target.closest?.('a.cite')) hide(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') tip.classList.remove('is-visible'); });
  window.addEventListener('scroll', () => tip.classList.remove('is-visible'), { passive: true });
}

export function initCitations() {
  refreshCites();
  buildList();
  setupTooltip();
}
