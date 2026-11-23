/**
 * Eased in-page navigation. Every link to a section (#id) glides there with a
 * soft ease-in-out instead of jumping, then moves keyboard focus to the target
 * so screen-reader and keyboard users land in the right place.
 * Reduced motion: an instant jump (still with focus management).
 */
import { gsap } from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';

gsap.registerPlugin(ScrollToPlugin);

export function initSmoothAnchors(reducedMotion) {
  // Our own glide replaces the CSS smooth-scroll fallback.
  document.documentElement.style.scrollBehavior = 'auto';

  const glide = (hash) => {
    const target = hash && hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (!target) return false;
    const land = () => {
      if (!target.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      history.replaceState(null, '', hash);
    };
    const y = hash === '#top' ? 0 : target;
    const offsetY = hash === '#top' ? 0 : (document.getElementById('site-header')?.offsetHeight || 0);
    if (reducedMotion) { gsap.set(window, { scrollTo: { y, offsetY, autoKill: false } }); land(); return true; }
    const distance = Math.abs((y === 0 ? 0 : target.getBoundingClientRect().top + window.scrollY) - window.scrollY);
    gsap.to(window, {
      scrollTo: { y, offsetY, autoKill: true },
      duration: Math.min(1.8, 0.7 + distance / 4000), // longer trips take a little longer
      ease: 'power3.inOut',
      overwrite: true,
      onComplete: land,
    });
    return true;
  };

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.classList.contains('skip-link')) return; // skip link keeps its native, instant jump
    if (glide(a.getAttribute('href'))) e.preventDefault();
  });
  window.addEventListener('glide-to', (e) => glide(e.detail));
}
