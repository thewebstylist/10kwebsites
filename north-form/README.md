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

### Why the hero is encoded the way it is

Scrubbing seeks to arbitrary timestamps, and every seek decodes forward from
the nearest keyframe. The Higgsfield export carries a single keyframe for the
whole clip, so seeking it directly decodes from frame zero every time and
stutters. `assets/hero.mp4` is therefore re-encoded with a keyframe every six
frames — a quarter second at 24fps — which seeks cleanly without the size
blow-up of an all-intra encode:

```sh
ffmpeg -i source.mp4 -an -vf scale=1280:-2 -c:v libx264 -preset slow \
       -crf 24 -g 6 -pix_fmt yuv420p -movflags +faststart hero.mp4
```

Rebuild the whole asset folder from the originals with
`scratchpad/build-assets.sh`. Audio is stripped throughout, since every video
on the page is muted.

If you re-export the hero from Higgsfield, re-encode it the same way or the
scrub will stutter.

## Assets

The site ships its own media from `north-form/assets/`, built from the
originals in `reference/assets/` (Higgsfield exports, kept as the archive).
Nothing is fetched from a third-party host any more.

| File | From | Used for |
|---|---|---|
| `hero.mp4` | 1284x716, 10s | scroll-scrubbed hero, `-g 6` for seeking |
| `project-01.mp4` | 1284x716, 10s | project 01, loops in view |
| `hero-poster.jpg` / `project-01-poster.jpg` | frame 0 of each clip | first paint |
| `gown.jpg` | full-length figure | `.intro-portrait`, suits the 3:4 angled frame |
| `mohawk.jpg` | orange monarchs | project 02, the colour moment |
| `koi-man.jpg` | underwater, mono | project 03 |
| `afro.jpg` | white ground | project 04, contrast against the paper section |
| `koi-blonde-a.jpg` | wide, deep negative space | cinematic background |
| 8 x 800px stills | mono portraits | capability hovers and archive previews |

Images are JPEG q3: 1600px for anything full-width, 800px for cards and the
320x400 archive previews. Videos are stripped of audio, since every video on
the page is muted. Total shipped media is about 6MB.

To swap any slot, change the `src` (or `data-preview`) to another file in
`assets/`. The mapping lives in one place per slot, so nothing else moves.
