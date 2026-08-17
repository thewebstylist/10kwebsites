# NORTH/FORM

Single-file recreation of the NORTH/FORM creative-studio landing page.
Open `index.html` directly, or serve the folder — there is no build step.

## Stack

Loaded from CDN, nothing bundled:

| Dependency | Version | Purpose |
|---|---|---|
| Tailwind CSS | CDN (JIT in browser) | layout utilities, 12-column grid spans, spacing |
| GSAP | 3.12.5 | all scroll and hover motion |
| GSAP ScrollTrigger | 3.12.5 | scrub, pin, progress |
| Lenis | 1.0.42 | smooth scroll (`duration: 1.15`, `wheelMultiplier: 0.9`) |
| Google Fonts | — | Space Grotesk (headings), Inter (body) |

Tailwind carries structural layout. Everything with an exact spec value
(the ticker rotation, the noise filter, the clip-path masks, the hover
transitions) lives in the `<style>` block, because those values are the design.

## Design tokens

```css
--ink:#0b0b0b;  --paper:#efeee9;  --muted:#a5a59f;
--accent:#c24f20;  --acid:#d7ff45;
--line:rgba(11,11,11,.18);
```

## Layer stack

| z-index | Layer |
|---|---|
| 1000 | `.preloader` |
| 999 | `.noise` (opacity .03, `mix-blend-mode: multiply`) |
| 995 | `.scroll-progress` (3px, `--accent`, scaleX 0→1) |
| 200 | `.cursor-label` (82px, lerp `cx += (mx-cx)*.14`) |
| 150 | `.archive-preview` (320×400, `translate(-50%,-50%)`) |
| 90 | `.site-header` (`mix-blend-mode: difference` until `.is-scrolled`) |
| 80 | `.nav-overlay` (mobile menu, under the header so the toggle stays live) |

## Scrub values

Deliberately not uniform, matching the source:

- `.hero-media`, `.hero-word`, `.hero-topcopy`, `#cinematicBg`, ticker drift,
  scroll-progress — `scrub: true`
- `.project` media parallax and `.cinematic-card`
  (`rotation: 18`, `xPercent: 120`) — `scrub: 1`

## Source quirks preserved

- Ticker is `rotate(-1.2deg)` with `margin-left: -2%` and `width: 104%`.
  It is deliberately wider than the viewport; the section wrapper uses
  `overflow-x: clip` to contain it without creating a scroll container
  (which would break the sticky projects head).
- `.noise` uses the inline `feTurbulence` data URI, `baseFrequency='.8'`, filter `#n`.
- `.diagonal-top` still exists, and the 2026 overrides sit on top of it:
  `.redesign-2026` sets `clip-path: none`, `.mask-wedge` and `.mask-blade`
  replace it with specific polygons.
- Border radii are explicit: `999px` on pills, `3px` on project media and cards.
- Breakpoints are exactly `900px` and `640px`. At 900px the project grid and the
  12-column `.grid12` collapse to flex columns.

## Media

Videos are `muted playsinline preload="metadata"`.

- Hero: `data-aura-video-preset="scroll-scrub"`. On desktop the hero pins for
  150% of viewport height and the video's `currentTime` is driven straight from
  scroll position — forward as you scroll down, backward as you scroll up.
  Nothing calls `play()`, so it also works where autoplay is blocked. On mobile
  it loops instead, because seeking during a touch scroll is jittery on phones.
- Project 01: `data-aura-video-preset="loop-in-view"` — an IntersectionObserver
  (threshold .25) plays it in view and pauses it out of view.
- Cinematic: static image, scale 1.12 → 1 on scrub.

### Re-encode the hero for scrubbing

**The hosted hero mp4 currently carries a single keyframe for the entire clip.**
Scrubbing seeks to arbitrary timestamps, and every seek has to decode forward
from the nearest keyframe — with one keyframe that means decoding from frame
zero every time, which stutters badly. Re-encode with a dense keyframe interval
and replace the hosted file:

```sh
# every frame seekable — largest, smoothest
ffmpeg -i hero.mp4 -an -c:v libx264 -preset slow -crf 23 -g 1 \
       -pix_fmt yuv420p -movflags +faststart hero-scrub.mp4

# keyframe every 6 frames — about 40% smaller, still smooth at 24fps
ffmpeg -i hero.mp4 -an -c:v libx264 -preset slow -crf 23 -g 6 \
       -pix_fmt yuv420p -movflags +faststart hero-scrub.mp4
```

Audio is stripped because every video on the page is muted. Adding a WebM/VP9
`<source>` above the mp4 is worth doing if you can host a second file: it is
smaller at equal quality and seeks faster.

The supplied clips are **832×1104 portrait**, 4 and 6 seconds. That is why
`.hero-media` sets `object-position: 50% 22%` — a wide viewport crops portrait
footage hard, and centred framing lands on the subject's chin.

## Asset note

The brief supplied three URLs (hero video, project 01 video, cinematic
background) plus a reference to portraits "#8, #9, #11, #13, #15, #16, #20,
#22, #38, #39" from a Source Inventory that was not included. Every image slot
therefore points at the one supplied image URL — the cinematic background —
so nothing is invented and nothing is a stock substitute. The slots that want
their own portrait once those URLs are available:

- `.intro-portrait` in the studio section
- `.project-media` for projects 02, 03, 04
- `.cap-row .image` ×4 in capabilities
- `data-preview` on the 8 `.archive-row` items

Swapping any of them is a one-line `src` / `data-preview` change.
