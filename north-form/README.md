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
--accent:#c24f20;     /* orange, hue 18deg  */
--teal:#0f869b;       /* brand accent, hue 189deg — complementary to --accent */
--teal-lift:#1199b1;  /* same hue lifted, for small text on dark grounds */
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

- Hero: `data-aura-video-preset="scroll-scrub"`. The hero pins and the video's
  `currentTime` is driven straight from scroll position — forward as you scroll
  down, backward as you scroll up. Nothing calls `play()`, so it also works
  where autoplay is blocked.

  Phones do the same with three concessions: the pin is 110% of viewport
  height instead of 150%, the seek threshold is 0.03s instead of 0.008s so a
  touch flick does not queue a seek per frame, and the video is primed with a
  muted `play()`/`pause()` pair. That last one is not optional on iOS: Safari
  leaves a video undecoded until it has played once, so seeking a never-played
  element paints the poster and nothing else. If autoplay is refused (low power
  mode) the priming retries on the first touch.

  `ScrollTrigger.config({ ignoreMobileResize: true })` stops the address bar
  hiding from refreshing every pinned trigger mid-scroll.
- Project 01: `data-aura-video-preset="loop-in-view"` — an IntersectionObserver
  (threshold .25) plays it in view and pauses it out of view.
- Cinematic closer: `data-aura-video-preset="loop-in-view"`, autoplaying on a
  loop under the same scale 1.12 → 1 scrub. Scene cuts are fine here precisely
  because it is not scrubbed — the viewer is not driving the playhead, so a cut
  reads as editing rather than as the page glitching.

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
| `hero.mp4` | 832x1104, 6s, mono | scroll-scrubbed hero, `-g 6` for seeking |
| `project-01.mp4` | 1284x716, 10s | project 01, loops in view |
| `hero-poster.jpg` / `project-01-poster.jpg` | frame 0 of each clip | first paint |
| `gown.jpg` | full-length figure | `.intro-portrait`, suits the 3:4 angled frame |
| `mohawk.jpg` | orange monarchs | project 02, the colour moment |
| `koi-man.jpg` | underwater, mono | project 03 |
| `afro.jpg` | white ground | project 04, contrast against the paper section |
| `cinematic.mp4` | 1284x716, 10s, colour | looping closer behind the final section |
| 8 x 800px stills | mono portraits | capability hovers and archive previews |

Three of the uploads are screenshots of the site rather than content and are
deliberately not built; `build-assets.sh` records what every source picture
actually is, since the Higgsfield filenames are opaque.

Images are JPEG q3: 1600px for anything full-width, 800px for cards and the
320x400 archive previews. Videos are stripped of audio, since every video on
the page is muted. Total shipped media is about 6MB.

To swap any slot, change the `src` (or `data-preview`) to another file in
`assets/`. The mapping lives in one place per slot, so nothing else moves.

## Social preview

`assets/og-image.jpg` is the hero rendered at 1200x630 (the 1.91:1 ratio the
platforms expect), captured at 2x and downscaled so the wordmark stays sharp.
Regenerate it by loading the page at 1440x756, parking the hero video at about
2.15s, screenshotting, and scaling to 1200x630.

**Before going live, replace `https://YOUR-DOMAIN.com` in the two `og:url` /
`og:image` tags with the real origin.** Facebook and LinkedIn will not resolve
a relative `og:image`; the preview silently degrades to plain text. The
placeholder is deliberately obvious so it fails loudly rather than quietly.

## Gradients

`--grad-bar` and `--grad-dot` run from `--accent` to `--teal`. Because those two
are complementary, a straight two-stop blend desaturates to a muddy olive
(#686a5e) halfway across, so both ramps route through rust (#a2452b) and slate
(#3a6f80) instead. Every stop clears 3:1 against `--ink`, which is the bar for
the ticker's large type.

`--grad-dot` is radial with the orange thrown to the top-left edge, so the
cursor label's 10px text still sits on teal at 4.60:1 rather than on the
gradient's weaker middle. The scroll-progress bar carries no text, so it takes
the full ramp.

## Colour contrast

The brand accent is a fill as often as it is text, so both directions were
checked rather than assumed:

| Pair | Ratio | Verdict |
|---|---|---|
| `--ink` on `--teal` (ticker, archive hover, buttons, badge) | 4.60:1 | passes AA |
| `--teal` on `#101010` (capability hover heading, large) | 4.44:1 | passes AA large |
| `--teal` on `#111` at 11px (dark-card price) | 4.41:1 | **fails** — uses `--teal-lift` at 5.59:1 |

That last row is why `--teal-lift` exists. It is the same 189deg hue raised in
lightness, so it reads as one colour while clearing AA at small sizes.

## A note on the Tailwind CDN

The CDN build is a JIT that reads class names from the DOM at runtime, so the
site always picks up new utilities. Anything that *precompiles* Tailwind
against a snapshot of the html (the offline preview build does) goes stale the
moment a utility is renamed — the class disappears from the stylesheet and the
element silently loses that style with no console error. Renaming `acid` to
`teal` did exactly that to the two `!bg-teal` buttons. If you add a build step,
recompile on every change rather than caching the css.

## Section motion

One `reveal()` helper drives every section entrance — engagement cards,
archive rows, FAQ, footer — so the easing and stagger rhythm are identical
across the page. That shared rhythm is what makes it read as one motion system
rather than a pile of separate effects. Reveals run once; replaying them on
every pass turns scrolling into strobing, and the continuous life comes from
the scrubbed parallax instead.

**Use `fromTo`, not `from`, for anything with a ScrollTrigger.** A bare
`gsap.from()` records the element's current value as its destination. If a
`ScrollTrigger.refresh()` lands after the from-state has been applied, it
records the from-value as the end value: the tween then runs to completion and
leaves the element permanently invisible, with no error anywhere. That bug hit
the archive rows and is why the helper is explicit at both ends.

On phones the projects head is not sticky. It is meant to ride over the media
column on difference blend, and stacked to a single column there is nothing
beside it to blend against, so it just sits on the copy.
