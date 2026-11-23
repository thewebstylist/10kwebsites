/**
 * Scroll choreography (GSAP + ScrollTrigger).
 * Motion-allowed: staggered reveals, scrubbed scenes, a pinned constellation.
 * Reduced motion: no pinning, no scrubbed transforms; content simply fades in
 * and 3D scenes jump to the state that matches the text being read.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { setProgress } from '../lib/scene-manager.js';
import { MILESTONES } from '../data/milestones.js';
import { SOURCES } from '../data/sources.js';
import { refreshCites } from './citations.js';

gsap.registerPlugin(ScrollTrigger);

export function initChoreography(reducedMotion) {
  header();
  stories(reducedMotion);
  carbon(reducedMotion);
  milestones(reducedMotion);
  if (reducedMotion) {
    gentleFades();
  } else {
    heroIntro();
    reveals();
    queryBars();
    turn();
    balance();
  }
  navState();
}

/** Re-measure every trigger in page order (call after late layout changes). */
export function refreshAll() {
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
}

/* ---------- Header background once the page scrolls ---------- */
function header() {
  const el = document.getElementById('site-header');
  ScrollTrigger.create({ start: 40, end: 'max', onToggle: (s) => el.classList.toggle('is-scrolled', s.isActive) });
}

/* ---------- Highlight the nav link for the section in view ---------- */
function navState() {
  const links = [...document.querySelectorAll('.nav-link')];
  links.forEach((a) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    ScrollTrigger.create({
      trigger: target,
      start: 'top 45%',
      end: 'bottom 45%',
      onToggle: (s) => {
        if (s.isActive) links.forEach((l) => l.setAttribute('aria-current', l === a ? 'true' : 'false'));
        else a.setAttribute('aria-current', 'false');
      },
    });
  });
}

/* ---------- Hero entrance ---------- */
function heroIntro() {
  gsap.from('.hero-reveal', { y: 34, opacity: 0, duration: 1.3, ease: 'power3.out', stagger: 0.12, delay: 0.15 });
  gsap.from('.divider', { opacity: 0, duration: 1.4, delay: 0.9, ease: 'power2.out' });
  // Content drifts up and softens as the hero leaves.
  gsap.to('.hero__content', {
    yPercent: -18, opacity: 0.2, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
}

/* ---------- Generic reveals ---------- */
function reveals() {
  gsap.utils.toArray('.reveal').forEach((el) => {
    gsap.from(el, { y: 40, opacity: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 86%', once: true } });
  });
  gsap.utils.toArray('[data-stagger]').forEach((group) => {
    gsap.from(group.children, {
      y: 50, opacity: 0, duration: 1.1, ease: 'power3.out', stagger: 0.14,
      scrollTrigger: { trigger: group, start: 'top 84%', once: true },
    });
  });
}

function gentleFades() {
  gsap.utils.toArray('.reveal, [data-stagger] > *, .balance-reveal').forEach((el) => {
    gsap.from(el, { opacity: 0, duration: 0.6, ease: 'none', scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
  });
}

/* ---------- Scrollytelling: sticky 3D visual + stepped facts ---------- */
function stories(reducedMotion) {
  document.querySelectorAll('[data-story]').forEach((story) => {
    const name = story.dataset.story;
    const steps = [...story.querySelectorAll('.story__step')];
    const readout = story.querySelector('[data-readout]');
    const rails = [...story.querySelectorAll('.rail i')];

    const activate = (i) => {
      steps.forEach((s, j) => s.classList.toggle('is-active', j === i));
      rails.forEach((r, j) => r.style.setProperty('--fill', j <= i ? 1 : 0));
      if (readout) readout.textContent = steps[i].dataset.readout || '';
      if (reducedMotion) setProgress(name, parseFloat(steps[i].dataset.level || '1'));
    };
    steps.forEach((step, i) => {
      ScrollTrigger.create({
        trigger: step,
        start: 'top 62%',
        end: 'bottom 62%',
        onToggle: (s) => s.isActive && activate(i),
      });
    });
    activate(0);

    if (!reducedMotion) {
      // Continuous progress across the whole story drives the 3D scene.
      ScrollTrigger.create({
        trigger: story.querySelector('.story__steps'),
        start: 'top 70%',
        end: 'bottom 55%',
        scrub: true,
        onUpdate: (s) => setProgress(name, s.progress),
      });
    }
  });
}

/* ---------- Carbon bars rise with scroll ---------- */
function carbon(reducedMotion) {
  const wrap = document.querySelector('.bars-wrap');
  if (!wrap) return;
  if (reducedMotion) {
    ScrollTrigger.create({ trigger: wrap, start: 'top 90%', once: true, onEnter: () => setProgress('carbon', 1) });
    return;
  }
  ScrollTrigger.create({
    trigger: wrap,
    start: 'top 90%',
    end: 'center 45%',
    scrub: 0.6,
    onUpdate: (s) => setProgress('carbon', s.progress),
  });
}

/* ---------- Per-query bars ---------- */
function queryBars() {
  gsap.from('#qbars .qbar__fill', {
    scaleX: 0, duration: 1.4, ease: 'power3.out', stagger: 0.12,
    scrollTrigger: { trigger: '#qbars', start: 'top 82%', once: true },
  });
}

/* ---------- "And yet." ---------- */
function turn() {
  const words = gsap.utils.toArray('.turn-word');
  gsap.fromTo(words,
    { opacity: 0.08, y: 60, letterSpacing: '0.04em' },
    { opacity: 1, y: 0, letterSpacing: '-0.035em', stagger: 0.25, ease: 'power2.out',
      scrollTrigger: { trigger: '.turn', start: 'top 85%', end: 'center 55%', scrub: true } });
}

/* ---------- Constellation timeline (pinned) ---------- */
function milestones(reducedMotion) {
  const section = document.getElementById('milestones');
  if (!section) return;
  const card = section.querySelector('[data-interactive]');
  const list = section.querySelector('[data-ms-list]');
  const dotsWrap = section.querySelector('[data-ms-dots]');
  const el = {
    kicker: section.querySelector('[data-ms-kicker]'),
    year: section.querySelector('[data-ms-year]'),
    title: section.querySelector('[data-ms-title]'),
    body: section.querySelector('[data-ms-body]'),
  };
  const citeHTML = (keys) => keys.filter((k) => SOURCES[k]).map((k) => `<a class="cite" data-cite="${k}"></a>`).join('');

  // Static list (used with reduced motion), always built for completeness.
  list.innerHTML = MILESTONES.map((m) => `
    <li class="grid grid-cols-[72px_1fr] gap-3 py-2">
      <span class="font-black text-sky-700 text-xl">${m.year}</span>
      <span><b class="font-bold">${m.title}.</b> <span class="text-ink-2">${m.body}</span>${citeHTML(m.cites)}</span>
    </li>`).join('');
  refreshCites(list);

  if (reducedMotion) { setProgress('constellation', 1); return; }

  let current = -1;
  let st;
  const dots = MILESTONES.map((m, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', `${m.year}: ${m.title}`);
    b.addEventListener('click', () => {
      // jump the scroll position to that milestone
      if (!st) return;
      const y = st.start + (st.end - st.start) * (i / (MILESTONES.length - 1));
      window.scrollTo({ top: y + 2, behavior: 'smooth' });
    });
    dotsWrap.appendChild(b);
    return b;
  });

  const show = (i) => {
    if (i === current) return;
    current = i;
    const m = MILESTONES[i];
    dots.forEach((d, j) => d.setAttribute('aria-current', j === i ? 'true' : 'false'));
    gsap.to([el.kicker, el.year, el.title, el.body], {
      opacity: 0, y: -8, duration: 0.18, ease: 'power1.in', stagger: 0.02,
      onComplete: () => {
        el.kicker.textContent = `${m.year} · ${m.kicker}`;
        el.year.textContent = m.year;
        el.title.textContent = m.title;
        el.body.innerHTML = m.body + citeHTML(m.cites);
        refreshCites(el.body);
        gsap.fromTo([el.kicker, el.year, el.title, el.body], { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', stagger: 0.04 });
      },
    });
  };

  st = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => `+=${window.innerHeight * MILESTONES.length * 0.55}`,
    pin: true,
    scrub: 0.5,
    onUpdate: (s) => {
      setProgress('constellation', s.progress);
      show(Math.round(s.progress * (MILESTONES.length - 1)));
    },
  });
  show(0);
  card.removeAttribute('hidden');
}

/* ---------- Finding the Balance: the two worlds merge ---------- */
function balance() {
  gsap.utils.toArray('.balance-reveal').forEach((el) =>
    gsap.from(el, { y: 30, opacity: 0, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } }));
  gsap.fromTo('.merge--pink', { xPercent: -60 }, { xPercent: 0, ease: 'none', scrollTrigger: { trigger: '.balance', start: 'top bottom', end: 'center center', scrub: true } });
  gsap.fromTo('.merge--blue', { xPercent: 60 }, { xPercent: 0, ease: 'none', scrollTrigger: { trigger: '.balance', start: 'top bottom', end: 'center center', scrub: true } });
}
