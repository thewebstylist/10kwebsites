# UNDRWTR — ABYSS Mark II

**Tagline:** Rated for the dark.
**Premise:** A titanium dive watch rated to 3,000 m. The scroll *is* the depth gauge: the page darkens as the watch sinks from sunlit water to the midnight zone, and a live meter counts the descent.
**Brand status:** Fictional. Disclosed in the footer, along with the imagery being AI generated.

---

## The technique (as briefed)

Not Three.js. A **canvas image-sequence scrub**: each clip is split into 150 JPEG frames, and scroll position selects which frame paints onto a full-viewport canvas.

- 3 chapters × 150 frames = 450 frames
- 1600 px wide, JPEG quality 3, named `frames/<chapter>/frame_0001.jpg`
- Scroll → target progress → lerped `shown` → frame index → canvas paint
- Repaint happens **only when the frame index changes**; the rAF loop rests when converged and when the chapter is off-screen

---

## Assets generated (Higgsfield)

| Asset | Model | Notes |
|---|---|---|
| Anchor image | `nano_banana_pro` (2K, 16:9) | Titanium case, deep blue dial, green lume, sunlit water. Used as image reference on every clip. |
| Clip A "the drop" | `seedance_2_0`, 1080p, 10s | Watch breaks the surface, bubbles bloom, rays wheel, it begins to sink. |
| Clip B "the descent" | `seedance_2_0`, 1080p, 10s | The keystone. One continuous sink, turquoise → indigo → black. |
| Clip C "the lume" | `seedance_2_0`, 1080p, 10s | Macro in true black, chained from clip B's final frame. |

**Verified descent curve (clip B, mean luma 0–255):**

| t | 0s | 2s | 4s | 6s | 8s | 9.9s |
|---|---|---|---|---|---|---|
| mean | 89.5 | 70.3 | 44.8 | 16.9 | 2.0 | 1.6 |

Max pixel stays 250+ throughout, so the frame goes black while the lume stays lit. That is the brief's whole idea, measured rather than assumed.

**Clip C took three attempts.** Attempt 1 rendered a flat green block across the lower frame and stray numerals. Attempt 2 pushed into a macro but kept adding ambient light (mean luma climbed to 38). Attempt 3 chained off clip B's final frame (mean 1.52) and held true black end to end: **1.34 → 1.65 → 1.95 → 2.38**, max 255. That chaining also makes the descent flow seamlessly into the lume chapter.

---

## Palette

| Token | Value | Use |
|---|---|---|
| `--sunlit` | `#0E3A5C` | Page background at 0 m |
| `--twilight` | `#071B30` | Midpoint of the descent, and the static-mode ground |
| `--midnight` | `#000000` | 3,000 m and everything below it |
| `--bone` | `#E9EDEA` | All body and display text |
| `--lume` | `#B8FF9E` | Meter, callouts, glow, CTA, focus rings only |

The background interpolates `#0E3A5C → #071B30 → #000000` in sync with descent progress, written to the DOM only when the rounded RGB triplet actually changes.

## Type

- **Display:** Instrument Serif — huge, high contrast, carries "ABYSS" at 17rem without looking like a default.
- **Body:** Archivo.
- **Mono:** IBM Plex Mono — the depth meter, overlines, and all instrument labels. Reads like dive-computer telemetry.

---

## Signature element: the depth rail

A fixed hairline rail on the right edge with 21 tick marks and a glowing lume head that tracks descent progress, paired with the live meter counting to 3,000 M. It is the concept made literal, and removing it would gut the page. It hides below 760 px and on short screens, where there is no room for it.

## Depth mapping (a deliberate deviation)

A linear 0→3,000 M map would put the "200 M, sunlight ends" callout at 6.7% of the chapter, flashing past before anyone could read it. The meter instead counts truthfully but is **paced by ocean zone**:

| Scroll progress | Depth | Zone |
|---|---|---|
| 0.00 → 0.30 | 0 → 200 m | Sunlit |
| 0.30 → 0.65 | 200 → 1,000 m | Twilight |
| 0.65 → 1.00 | 1,000 → 3,000 m | Midnight |

The readout is always the real depth, the callouts land on readable stretches of scroll, and the descent accelerates as it deepens, which is what sinking actually feels like.

---

## Page structure

1. **Hero** (clip A, 420vh) — "ABYSS" in huge serif, overline "MARK II. RATED FOR THE DARK."
2. **The Descent** (clip B, 1000vh) — live meter, synced background, three callouts with hairline lume leader lines: 200 M sunlight ends / 1,000 M twilight zone / 3,000 M midnight zone, still ticking.
3. **The Lume** (clip C, 420vh) — the macro glowing in true black.
4. **Specs** — six-cell grid on black, hairline dividers: titanium, sapphire, helium valve, depth, movement, lume.
5. **CTA** — "Reserve the Mark II", email field, small print.

## The one interactive moment

**Charge the lume.** Press and hold the dial; charge builds over ~1.1s and the markers light. Release and it decays over ~2.6s rather than snapping off. It makes the visitor perform the brand's single idea: put light in, get light back in the dark. Reduced motion gets the finished state with no hold required.

## Mobile and reduced motion

Five gates, matched character-for-character between the CSS media queries and the JS, and re-evaluated live on rotate, resize, and preference flips:

1. `(max-width: 720px)`
2. `(orientation: portrait) and (max-width: 1024px)`
3. `(orientation: portrait) and (pointer: coarse)`
4. `(orientation: landscape) and (pointer: coarse) and (max-height: 560px)`
5. `(prefers-reduced-motion: reduce)`

In static mode no frames are requested at all. Each chapter becomes a flow panel with its clip looping as an MP4 over a flat `#071B30`, text pinned to its finished state, and the scrub loop never runs.

## Performance

- Concurrency-limited frame queue (10 in flight) so the browser's connection pool is not swamped and the progress bar tells the truth
- Frame-rate-independent lerp, normalized to a 60fps reference
- Canvas promoted to its own compositor layer
- Meter text throttled to ~10Hz and written only when the string changes
- Band opacity and `--k` delta-gated at 0.004 / 0.008
- All animation paused on hidden tabs

---

## Copy gate

Zero em dashes, zero stock words (leverage, seamless, empower, robust, actionable, data-driven, solutions, testament, delve, elevate), zero "it's not just X, it's Y" constructions. Verified by grep over the whole file, hero captions and lower sections alike.
