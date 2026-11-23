# The Cost and the Promise of AI

A single-page, evidence-led portrait of Ai by **Sterling Creations Ai** (light theme, softened).

**House style:** the brand always writes **Ai** with a lowercase i (trademark), including inside
all-caps labels (wrap it in `.ai-mark` there). Other organizations' names and publication titles keep their
own spelling (OpenAI, Mistral AI, "Energy and AI"). The audience is in the US: use gallons, fluid ounces
and US spelling; convert metric source figures and note the conversion in `src/data/sources.js`.
**Logo:** always the official Sterling Creations Ai mark (`public/brand/`, exported from
`reference/brand/logo/sterling-creations-ai-logo.png`, source: SterlingCreations.Ai/brand-kit). Never redraw it.
One half shows the environmental cost (electricity, water, carbon, per-prompt footprint);
the other shows the benefits (medicine, climate and materials science, access, learning, work).
Every figure is cited, with estimates, company-reported and disputed figures labelled.

## Run it

```bash
npm install
npm run dev       # local dev server
npm run build     # production build in dist/
npm run preview   # serve the build at http://localhost:4173
```

Stack: Vite, vanilla JS, Three.js, GSAP + ScrollTrigger, Tailwind CSS v4, Montserrat (Google Fonts).

## Structure

```
index.html                 All content and semantic structure
src/main.js                Entry: wires citations, scenes, UI and scroll choreography
src/styles/main.css        Brand tokens (@theme) and component styles (cascade layer)
src/data/sources.js        Every source: publisher, year, URL, status, note
src/data/milestones.js     Constellation timeline entries
src/lib/env.js             Reduced motion, mobile detection, quality tiers, WebGL check
src/lib/scene-manager.js   Lazy-loads scenes, one shared RAF loop, pause off-screen, FPS cap
src/lib/three-utils.js     Renderer setup, brand colours for shaders, helpers
src/scenes/hero.js         Split glass globe: pink heat haze vs blue node network
src/scenes/grid.js         Data-centre city whose windows light up with electricity figures
src/scenes/water.js        Glass droplet that fills through the water statistics
src/scenes/carbon.js       Rising CO2 bars (projections hatched)
src/scenes/helix.js        DNA helix with a scanning band for medical breakthroughs
src/scenes/constellation.js  Camera flight through AI milestones
src/ui/*.js                Citations + tooltips, count-ups, divider, calculator, GSAP timelines
```

## Brand tokens

Defined once in `src/styles/main.css` under `@theme`, and read by the 3D scenes at runtime.
Large areas use the softened orchid (`#F2A7E3`, `#E77FD0`) and sky (`#8FCBF5`, `#4DB3EE`);
the saturated brand hues (`#FF3BD4`, `#0599F2`) appear only as thin rules, glows, hover and
focus accents. Key numbers use text-safe deep tones (`#A3268A`, `#0A6AAE`, both above 5.5:1 on white)
with the saturated hue in their glow, so they meet WCAG AA.

## Performance and accessibility

- three.js (~137 kB gzip) is only fetched when the first scene nears the viewport.
- Scenes render only while visible, at 60 fps (30 fps on mobile / low-core devices), with fewer
  particles and a lower pixel ratio on mobile.
- No WebGL: static gradient fallbacks, the rest of the page works unchanged.
- `prefers-reduced-motion`: no pinning, scrubbing or auto-rotation; content fades in gently,
  3D scenes show static frames that still match the text, and the timeline becomes a list.
- Semantic landmarks, skip link, keyboard-operable divider (arrows, Home/End, Enter resets)
  and calculator (radiogroup with arrow keys), screen-reader-safe count-ups.
- Audited with axe-core (WCAG 2.1 A/AA): no violations.

## Updating figures

Edit `src/data/sources.js`; citation numbers, tooltips and the Sources list regenerate
automatically. Figures in the copy live in `index.html` next to their `data-cite` markers.

## Deployment (Cloudflare Pages)

Live at **https://cost-and-promise-of-ai.pages.dev**, built by Cloudflare Pages straight from GitHub
(`thewebstylist/10kwebsites`).

- Root directory `ai-cost-promise`, build command `npm run build`, output `dist`, `NODE_VERSION=22`.
- Production branch: `claude/ai-cost-promise-site-hof814` (switch to `main` once merged).
- Once the Cloudflare GitHub app has access to this repo, every push that touches
  `ai-cost-promise/` rebuilds and redeploys in about a minute, and other branches get preview URLs.
  Until then, trigger a deploy of the branch from the Cloudflare dashboard or API
  (POST `/accounts/{id}/pages/projects/cost-and-promise-of-ai/deployments` with `branch`).
