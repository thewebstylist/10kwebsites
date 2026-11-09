# Black Onyx Financial Group, Inc. · Design Package

Redesign of https://blackonyxfinancialgroup.com/ (10k-websites skill, Tier 1).
Every line of copy below ships verbatim. Band ranges are starting points, validated by the flick test.

## Build state

- **Brand type:** real company, real content, no usable photos available to this session (the live
  domain and stock-media hosts are blocked by the session network). Visuals are original
  computer-rendered artwork (black onyx stone with gold-filled fractures), made in-repo by
  `render/onyx.html` + `render/render.js` and encoded with ffmpeg. Re-render any time.
- **What the live site is:** a formal public notice of a transfer of assets (Resolution #9),
  not a services or wealth-management site. The redesign keeps that purpose exactly.
- **Content rule:** no invented services, performance figures, client counts, team, or
  testimonials. Every factual line comes from the live site. The two disclaimers ("There are no
  securities being offered on this website." and the S.E.C. notice) stay verbatim and prominent.
  `robots: noindex, nofollow` is preserved from the live site.
- **Logo:** the live `logo.png` could not be fetched here, so the nav uses a drawn onyx-gem mark
  plus a type wordmark. Swap in the real logo file at `site/assets/logo.png` when available.
- **Tier:** 1, one 6 s rendered shot, 520vh hero. Phones and reduced motion get the static hero.
- **Contact handling:** mailto (as on the live site). No backend form.

## 1. Brand premise

**Transfer.** Black onyx is permanence: a record cut in stone. Gold is the asset. The hero
footage shows gold travelling along a seam in polished onyx, from one side to the other, the
way the assets travel from the LLC to the Inc. The page carries the same seam down its left
margin through every Article, and the one interactive moment lets the visitor trace the
transfer themselves.

## 2. Palette

```css
:root{
  --canvas:#0B0C0D;        /* polished onyx, a hair cool, never pure black */
  --panel:#121416;
  --accent:#D4AF5A;        /* gold leaf: CTA, seam, key figures */
  --accent-hover:#E6C676;
  --accent-muted:rgba(212,175,90,.22);
  --text-secondary:#A39C8E;
  --text-primary:#ECE6D8;  /* vellum */
  --paper:#EDE7DA;         /* the S.E.C. notice document panel */
  --ink:#16140F;
}
```

Carve-out said out loud: dark canvas + gold accent + an inscriptional serif is on the skill's
"AI cliché" list, but here it IS the subject's world: the client's own brand is Black Onyx in
black and gold (live site: #0A0906 / #C9A34E / Marcellus). The redesign earns it with the
rendered onyx footage, the kintsugi seam signature, and a light paper "document" panel that
breaks the dark run.

## 3. Type trio

- Display: **Marcellus** 400 (the client's existing face; inscriptional, carved-in-stone).
- Body: **Instrument Sans** 400 / 500 / 600.
- Mono: **IBM Plex Mono** 400 / 500 (filing numbers, labels, the ledger).

## 4. Band map (hero, 520vh)

| Band | Range | Footage moment | Copy (verbatim) | Entrance |
|---|---|---|---|---|
| 1 | 0.00 to 0.21 | dim onyx, gold dust falling, latent veins | kicker "Public Notice · Resolution #9" / H1 "Transfer of Assets" | approach from depth (load ramp) |
| 2 | 0.23 to 0.47 | gold ignites on the seam at left and starts to run | "From" / "Black Onyx Financial Group, LLC" | grid snap-align, left to right |
| 3 | 0.49 to 0.73 | the white-hot front crosses to the right | "To" / "Black Onyx Financial Group, Inc." | drift with the flow |
| 4 | 0.75 to 1.00 | every vein lit, camera at rest | "A matter of public record." / "There are no securities being offered on this website. This website is solely for the purpose of providing public notice of the transfer of assets as shown above and on the corresponding documents page." / CTAs "Review the particulars" and "Request access to documents" / mono "Wyoming · C.I.K. # 0001357642 · Resolution #9" | word rise into staged settle |

Persistent chip on the hero from the first frame: "There are no securities being offered on this website."

## 5. Static hero copy

Same words as bands 1 to 4, stacked over the ending frame.

## 6. Below the fold

1. Ticker: "Transfer of Assets · Resolution #9 · Wyoming · C.I.K. # 0001357642 · Exhibit A · 8,706 Instruments"
2. Article I · Particulars: the nine-row ledger from the live site.
3. The transfer, traced (interactive): The Darnell Trust → Black Onyx Financial Group, LLC →
   Resolution #9 → Black Onyx Financial Group, Inc., with "In consideration: 100 Preferred Class A
   Shares with Conversion Rights". Press and hold "Hold to trace the transfer".
4. Article II · Resolution #9: the published excerpt as a pull quote, with its paragraph.
5. Article III · Exhibit A: 8,706 Instruments / $3,000,305,270.00 Stated total valuation, the
   Access paragraph, over the ambient gold loop.
6. Article IV · S.E.C. Notice: verbatim, on the paper panel.
7. Article V · Contact: Board Chair, address, email, corporate record, related notice, CTA
   "Request Access to Documents".
8. Footer: disclaimer, links, copyright.

## 7. Vector layer

- The seam: one gold SVG line that draws itself down the left margin with scroll, lighting a
  diamond node at each Article. Hidden under 1100px. Drawn in full under reduced motion.
- The trace diagram path and nodes.
- Onyx-gem mark (nav, favicon).
- Fixed environment: whisper-level gold dust canvas + static grain.

## 8. Engineering list

Blob fetch with the loading ring and watchdog, dt-normalized lerp, gated seeks, delta-gated DOM
writes, band pacing plus the flick test, four-layer legibility, five live static-hero gates,
complete without video, reduced motion live in both directions, quality floor.

## 9. Copy gate

All viewer-facing lines above ship verbatim. The built page must pass the Phase 9 grep gate
(zero em dashes, zero stock words) and the AI-tell sweep before anyone sees it.
