/**
 * Header behaviour
 * - Slides up out of view while scrolling down, glides back in as soon as the
 *   reader scrolls up (or reaches the top). Stays put while the menu is open
 *   or while something inside it has keyboard focus.
 * - Menu button (below 1280px) opens a slide-down panel with eased motion:
 *   the panel wipes down, links rise in one after another, the page behind
 *   dims and blurs; closing plays it back in reverse. Escape, a link, or a
 *   tap on the dimmed page closes it. Reduced motion: instant open/close.
 */
import { gsap } from 'gsap';

export function initHeader(reducedMotion) {
  const header = document.getElementById('site-header');
  const toggle = document.getElementById('menu-toggle');
  const menu = document.getElementById('mobile-menu');
  const scrim = document.getElementById('menu-scrim');
  const label = toggle?.querySelector('[data-menu-label]');
  if (!header) return;

  const links = menu ? [...menu.querySelectorAll('.mobile-menu__link')] : [];
  const credit = menu?.querySelector('.mobile-menu__credit');
  let open = false;
  let tl = null;

  /* ---------- menu ---------- */
  function setOpen(next, { focusToggle = false, onClosed } = {}) {
    if (!toggle || !menu || next === open) { onClosed?.(); return; }
    open = next;
    toggle.setAttribute('aria-expanded', String(open));
    if (label) label.textContent = open ? 'Close menu' : 'Open menu';
    tl?.kill();

    if (open) {
      show();
      menu.hidden = false;
      if (scrim) scrim.hidden = false;
      if (reducedMotion) { gsap.set([menu, scrim, ...links, credit], { clearProps: 'all' }); }
      else {
        tl = gsap.timeline()
          .fromTo(menu, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.7, ease: 'expo.out' }, 0)
          .fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0)
          .fromTo(links, { y: 28, opacity: 0, filter: 'blur(6px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.65, ease: 'power3.out', stagger: 0.06 }, 0.12)
          .fromTo(credit, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' }, 0.45);
      }
      links[0]?.focus({ preventScroll: true });
      return;
    }

    const finish = () => {
      menu.hidden = true;
      if (scrim) scrim.hidden = true;
      if (focusToggle) toggle.focus();
      onClosed?.();
    };
    if (reducedMotion) { finish(); return; }
    tl = gsap.timeline({ onComplete: finish })
      .to([...links].reverse(), { y: -14, opacity: 0, duration: 0.25, ease: 'power2.in', stagger: 0.03 }, 0)
      .to(credit, { opacity: 0, duration: 0.2, ease: 'power1.in' }, 0)
      .to(menu, { clipPath: 'inset(0 0 100% 0)', duration: 0.5, ease: 'expo.inOut' }, 0.1)
      .to(scrim, { opacity: 0, duration: 0.45, ease: 'power2.inOut' }, 0.1);
  }

  toggle?.addEventListener('click', () => setOpen(!open));
  scrim?.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) setOpen(false, { focusToggle: true }); });
  window.matchMedia('(min-width: 1280px)').addEventListener('change', (m) => { if (m.matches) setOpen(false); });
  // Menu links: let the panel close first, then the smooth-scroll handler takes over.
  menu?.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    setOpen(false, { onClosed: () => window.dispatchEvent(new CustomEvent('glide-to', { detail: a.getAttribute('href') })) });
  });

  /* ---------- hide on scroll down / show on scroll up ---------- */
  function show() { header.classList.remove('is-hidden'); }
  function hide() {
    if (open || header.contains(document.activeElement)) return;
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
