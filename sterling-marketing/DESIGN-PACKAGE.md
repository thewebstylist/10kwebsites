# Sterling Marketing — Design Package

The single source of truth for this build. Written before generation, consumed by the
build in Phase 8. Every line of copy here ships verbatim. Palette hex values and band
ranges are starting points, finalized from the approved footage and the flick test.

---

## Build state (resume from here)

- **Skill:** 10k-websites (installed at `.claude/skills/10k-websites/`)
- **Brand type:** Concept / demo brand — invent and generate everything; footer discloses it is a concept brand.
- **Feeling:** Premium and refined. Sleek, expensive, understated luxury, with dynamic motion underneath.
- **Hero concept chosen:** **Liquid Sterling** — a ribbon of molten liquid silver pours straight down a dark refined void and settles into a mirror-still pool. Scrolling down is the pour.
- **Tier:** Tier 1, single continuous shot (~6s), ~400vh hero.
- **Mobile:** static composed hero (poster/ending frame + captions); scrub video plays on laptop/desktop.

### Spend rules (user-set)
- **No 4K images.** Generate stills at 1k (nano_banana_pro 1k ≈ 2 credits). 4K is not permitted.
- Always preflight exact cost (`get_cost: true`) and get the user's explicit yes before spending.

### Hero starting frame (already generated)
- Model: `nano_banana_pro`, 4K, 16:9. Cost: **4 credits**. Job id: `736ac7a4-b314-4cde-8637-74b08f4aeed4`. Output: 5504×3072 PNG.
- Prompt (reuse / re-roll from this):
  > A single vertical ribbon of molten liquid silver begins to fall from the top center of the frame, caught at the very first instant of its descent, composed as the first moment of a motion where the metal will pour straight down the center and gather into a still mirror pool far below. Cold cinematic key light rakes from the upper left, throwing hard specular glints along the liquid metal's edge while the surrounding air holds deep receding shadow. The world is one continuous dark refined space, edge to edge with no borders or panels: cool charcoal graphite tinted faintly blue, brushed with liquid platinum and mercury-bright silver where the light catches, the calm darkness on the left and right reading as soft receding depth within the same space. Fine particulate mist and a few drifting motes of cold light hang in the air. Calm negative space held on the left and right thirds where captions will live, the molten stream kept in the central lane. Cinematic, photorealistic, shallow depth of field, ultra detailed, 16:9. No text, no logos, no lettering anywhere.

### Next steps when the network is open
1. Download the approved frame; inspect for trademarks/anatomy/composition; confirm caption negative space.
2. Preflight the video across the top 2-3 video models (`get_cost: true`), present real prices (~10 to 55 credits), user picks the model.
3. Generate the ~6s image-to-video pour; inspect start/mid/end frames; run the VIDEO GATE with the user.
4. ffmpeg: scrub-encode (`-g 8 -keyint_min 8`), poster, ending frame; supporting stills in the same world.
5. Build the site (below), self-test, preview, deploy (Hostinger, Phase 10).

### Credits so far: 4 (hero frame). Balance was 3312 at start (Creator plan).

### Network hosts to allowlist for this environment
- `*.cloudfront.net` — Higgsfield renders (images + video). **This is the current blocker.**
- `*.higgsfield.ai`, `mcp.higgsfield.ai` — generation API.
- Fonts (if not self-hosted): `fonts.googleapis.com`, `fonts.gstatic.com`, `api.fontshare.com`, `cdn.fontshare.com`.
- Hostinger deploy (Phase 10): `*.hostinger.com`, `developers.hostinger.com`, `api.hostinger.com`.

---

## 1. The brand premise

Sterling is the hallmark of proven worth. Real sterling silver is stamped `·925` to certify its
purity, and Sterling Marketing works the same way: it only stamps its mark on work that measures up.
Raw budget is poured in, refined, tested, and set into results that carry a verifiable mark. The whole
site teaches one idea — marketing you can assay — and every section, the interactive moment, and the
closing line serve it.

## 2. The palette as CSS tokens (direction; finalize from footage)

```css
:root{
  --canvas:#0E1116;        /* cool charcoal graphite, tinted blue, never pure black */
  --panel:#161B22;         /* raised surfaces, cards */
  --silver:#D7DEE3;        /* liquid-platinum highlight, headlines over dark */
  --accent:#6E9DB8;        /* steel-blue, the CTA and rare emphasis only */
  --accent-hover:#84B2CC;
  --accent-muted:#2A3A45;  /* borders, glows, particles at whisper level */
  --text-primary:#EEF2F5;
  --text-secondary:#9AA7B0;
}
```

Accent appears in rare doses only: the call to action, focus states, one or two emphasis moments.

## 3. The type trio

- **Display:** Clash Display (Fontshare), weights 500/600. Modern premium grotesque with real character. Chosen over a serif to sidestep the dark-canvas-plus-high-contrast-serif AI cliche.
- **Body:** Satoshi (Fontshare), weights 400/500. Clean, refined, humanist-geometric.
- **Mono:** Space Mono, weight 400. Carries the `·925` hallmark figures and small assay labels.

Never Inter or Roboto as display. Self-host the woff2 files into `assets/fonts/` if the font CDNs are not allowlisted.

## 4. The band map (Tier 1, trimmed — ranges are starting points)

| Band | Range | Footage moment | Copy (verbatim) | Entrance |
|---|---|---|---|---|
| 1 | 0.00–0.15 | the pour begins, metal falling from top | "Anyone can spend your budget." | drift-down |
| 2 | 0.18–0.36 | metal streams and gathers | "We make it come back heavier." | word-punch |
| 3 | 0.40–0.56 | stream narrows, refined | "Run by seniors. Never handed to juniors." | grid snap-align |
| 4 | 0.60–0.76 | metal tested, glinting | "Every move measured. Every dollar traced." | scatter |
| 5 (settle) | 0.80–1.00 | pool at rest, mirror-still | Headline: "The standard, stamped." · Sub: "Marketing, assayed and proven." · CTA: "Request your growth audit" | word-by-word rise into staged settle |

## 5. The static-hero copy block (phones, reduced motion)

- Headline: **"The standard, stamped."**
- Subline: "Growth marketing, assayed and proven. Run by seniors, measured to the dollar."
- CTA: "Request your growth audit"

## 6. The below-fold outline (verbatim copy; everything funnels to one CTA: "Request your growth audit")

**Nav:** wordmark `STERLING` with the hallmark mark · links: Method, Results, FAQ, Contact · button "Request your growth audit".

**A. The problem.**
Kicker: "Why most agencies get fired"
Headline: "You didn't hire an agency for posts. You hired one for profit."
Lede: "Somewhere between the pitch and the invoice, most agencies swap the senior team for juniors, run the same playbook they run on everyone, and can't tell you what any of it earned. That is the work we exist to replace."

**B. The Sterling standard** — three hallmark pillars, each stamped `·925`:
1. Senior-led — "The people in your pitch are the people on your account. No handoffs."
2. Measured — "Every campaign tied to revenue you can see, not vanity metrics."
3. Custom-cast — "Built from your market and your numbers. Nothing stamped from a template."

**C. Proof** — figures stamped like hallmarks (illustrative, concept brand):
- "3.4x average return on ad spend"
- "$40M+ in revenue influenced"
- "0 accounts handed to juniors"
*The one interactive moment lives here:* **press and hold to assay** — holding stamps the hallmark and lights the figure in, mirroring the assay idea. Reduced motion gets the finished state instantly.

**D. The method** — four steps, the metal's own journey:
1. Melt — "We audit everything and reduce it to what actually moves revenue."
2. Refine — "We build the strategy around your market, not a template."
3. Cast — "We launch, and the work goes live under senior hands."
4. Assay — "We measure against your dollars and report what each play earned."

**E. FAQ** (answers the real objections):
- Q "Will I get the senior team or juniors?" A "The team in your pitch is the team on your account. Always."
- Q "How do you prove ROI?" A "Every campaign ties to revenue you can see, reported monthly, with no vanity metrics."
- Q "Do you run the same playbook on everyone?" A "No. We build from your market and your numbers. Nothing is stamped from a template."
- Q "How fast do results come?" A "You get measurable signal from month one, not after a paid testing period."

**F. Words from clients** (illustrative, concept brand): two short quotes, attributed to fictional roles.
- "They found money we were leaving on the table in week two." — VP Growth, DTC brand
- "First agency that could actually show me what it earned." — Founder, B2B SaaS

**G. The close / form.**
Headline: "Find out what your marketing is really earning."
CTA: "Request your growth audit"
Form fields: Name · Company · Work email · Monthly marketing budget (select) · What are you trying to grow? (message)
Button: "Request your growth audit"
Success state: "Request received. A senior strategist will reach out within one business day." (JS-only success on this concept site; swap to mailto or a form service for a live business.)

**Footer:** nav repeat · hallmark mark · disclosure: "Sterling Marketing is a concept brand created as a design demonstration. Figures and testimonials shown are illustrative."

## 7. The vector layer plan

- **The Sterling hallmark (signature element):** an inline SVG assay-mark — a lozenge/shield holding an S and `·925` — drawn hand-built. Self-draws on scroll, recurs as section dividers, and is the object the press-and-hold interaction stamps.
- **Assay hairlines:** thin self-drawing rules between sections, drawn on scroll.
- **Particles:** fine metallic motes drifting at whisper level (canvas or CSS), paused off-screen and on hidden tabs, final state shown under reduced motion.
- **Fixed background environment:** one slow cool-graphite gradient drift plus faint grain, cycling 60s+, behind everything.

## 8. The engineering list (full standard, no half-remembering)

Blob fetch with the streamed loading ring · dt-normalized lerp that rests · gated deadlock-safe seeks ·
delta-gated DOM writes · band pacing validated by the flick test · the four-layer legibility system with
the worst-frame audit at 3.5:1+ · the five static-hero gates kept live with change listeners ·
complete-without-video · the quality floor · the whole-site-animated standard. All per
`.claude/skills/10k-websites/references/scrub-pipeline.md`.

## 9. The copy gate line

Every viewer-facing line above ships verbatim and the built page must pass the Phase 9 grep gate
(zero em dashes, zero stock words) plus the body-copy AI-tell sweep before anyone sees it. The `·925`
hallmark device and the metal-metaphor triplets (Melt / Refine / Cast / Assay) are deliberate brand
craft and stay; the sweep hunts only what drifted in uninvited.
