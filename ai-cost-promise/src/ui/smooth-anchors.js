/**
 * Shareable, eased in-page navigation.
 *
 * - Every link to a section (#id) glides there (power3.inOut) instead of
 *   jumping, lands just below the header and moves keyboard focus there.
 * - The address bar always names the section: it updates the moment a link is
 *   tapped (with a Back-button entry), and quietly follows the reader while
 *   scrolling, so copying or sharing the URL links to the section in view.
 * - Opening a shared link (e.g. /#calculator) lands on that section once the
 *   page's layout has settled (fonts, pinned timeline).
 * Reduced motion: instant jumps, same addresses and focus handling.
 */
import { gsap } from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';

gsap.registerPlugin(ScrollToPlugin);

// Linkable sections, in page order. Nested ones (energy inside cost) win while in view.
const SECTION_IDS = ['ledger', 'cost', 'energy', 'water', 'carbon', 'per-prompt', 'promise', 'medicine', 'discovery', 'milestones', 'people', 'calculator', 'balance', 'sources'];

export function initSmoothAnchors(reducedMotion) {
  const header = () => document.getElementById('site-header');
  const sections = SECTION_IDS.map((id) => document.getElementById(id)).filter(Boolean);
  let gliding = false;

  const setAddress = (hash, push = false) => {
    const url = hash ? `${location.pathname}${location.search}${hash}` : `${location.pathname}${location.search}`;
    if (url === `${location.pathname}${location.search}${location.hash}`) return;
    history[push ? 'pushState' : 'replaceState'](null, '', url);
  };

  const targetFor = (hash) => (hash && hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null);

  function glide(hash, { push = true, instant = reducedMotion } = {}) {
    const target = targetFor(hash);
    if (!target) return false;
    const toTop = hash === '#top';
    setAddress(toTop ? '' : hash, push);
    const land = () => {
      gliding = false;
      if (!target.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    };
    const y = toTop ? 0 : target;
    const offsetY = toTop ? 0 : header()?.offsetHeight || 0;
    gliding = true;
    if (instant) { gsap.set(window, { scrollTo: { y, offsetY, autoKill: false } }); land(); return true; }
    const distance = Math.abs((toTop ? 0 : target.getBoundingClientRect().top + window.scrollY) - window.scrollY);
    gsap.to(window, {
      scrollTo: { y, offsetY, autoKill: true },
      onInterrupt: () => { gliding = false; },
      duration: Math.min(1.8, 0.7 + distance / 4000), // longer trips take a little longer
      ease: 'power3.inOut',
      overwrite: true,
      onComplete: land,
    });
    return true;
  }

  // Clicks on any in-page link
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.classList.contains('skip-link')) return; // skip link keeps its native, instant jump
    if (glide(a.getAttribute('href'))) e.preventDefault();
  });
  window.addEventListener('glide-to', (e) => glide(e.detail));
  // Back / Forward between sections
  window.addEventListener('popstate', () => {
    if (location.hash) glide(location.hash, { push: false });
    else gsap.to(window, { scrollTo: 0, duration: reducedMotion ? 0 : 1, ease: 'power3.inOut' });
  });

  // Address follows the reader while scrolling (replaceState: no history spam)
  let ticking = false;
  const sync = () => {
    ticking = false;
    if (gliding) return;
    const line = window.innerHeight * 0.35;
    let current = null;
    for (const el of sections) {
      const r = el.getBoundingClientRect();
      if (r.top <= line && r.bottom > line && (!current || r.top >= current.r.top)) current = { el, r };
    }
    setAddress(current ? `#${current.el.id}` : '');
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; setTimeout(() => requestAnimationFrame(sync), 120); }
  }, { passive: true });

  // Arriving from a shared link: land precisely once layout has settled
  const initial = location.hash;
  if (initial && targetFor(initial)) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const settle = () => requestAnimationFrame(() => requestAnimationFrame(() => glide(initial, { push: false, instant: true })));
    (document.fonts?.ready || Promise.resolve()).then(() => setTimeout(settle, 250));
  }
}
