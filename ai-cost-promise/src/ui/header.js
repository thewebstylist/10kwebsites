/**
 * Header behaviour
 * - Slides up out of view while scrolling down, glides back in as soon as the
 *   reader scrolls up (or reaches the top). Stays put while the menu is open
 *   or while something inside it has keyboard focus.
 * - Menu button (below 1280px): opens a slide-down panel; Escape, a link
 *   click or a click outside closes it. ARIA state kept in sync.
 */
export function initHeader(reducedMotion) {
  const header = document.getElementById('site-header');
  const toggle = document.getElementById('menu-toggle');
  const menu = document.getElementById('mobile-menu');
  const label = toggle?.querySelector('[data-menu-label]');
  if (!header) return;

  /* ---------- menu ---------- */
  const isOpen = () => toggle?.getAttribute('aria-expanded') === 'true';
  const setOpen = (open, { focusToggle = false } = {}) => {
    if (!toggle || !menu) return;
    toggle.setAttribute('aria-expanded', String(open));
    if (label) label.textContent = open ? 'Close menu' : 'Open menu';
    menu.hidden = !open;
    if (open) { show(); menu.querySelector('a')?.focus(); }
    else if (focusToggle) toggle.focus();
  };
  toggle?.addEventListener('click', () => setOpen(!isOpen()));
  menu?.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) setOpen(false, { focusToggle: true }); });
  document.addEventListener('click', (e) => { if (isOpen() && !header.contains(e.target)) setOpen(false); });
  window.matchMedia('(min-width: 1280px)').addEventListener('change', (m) => { if (m.matches) setOpen(false); });

  /* ---------- hide on scroll down / show on scroll up ---------- */
  function show() { header.classList.remove('is-hidden'); }
  function hide() {
    if (isOpen() || header.contains(document.activeElement)) return;
    header.classList.add('is-hidden');
  }
  if (reducedMotion) return; // keep the header steady for reduced-motion readers

  let lastY = window.scrollY;
  let ticking = false;
  const THRESHOLD = 6; // px of travel before reacting, ignores jitter
  const update = () => {
    const y = window.scrollY;
    const dy = y - lastY;
    if (y < header.offsetHeight * 1.5) show();          // near the top: always visible
    else if (dy > THRESHOLD) hide();                     // scrolling down
    else if (dy < -THRESHOLD) show();                    // scrolling up
    if (Math.abs(dy) > THRESHOLD) lastY = y;
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  header.addEventListener('focusin', show);
}
