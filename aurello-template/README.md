# Editorial product landing template

The Aurello spritz landing page, rebuilt as a template. Every word, colour, font,
product and image on the page comes from a single JSON file, so the same design
retargets to a different brand by writing one file and running one command.

```bash
node build.js brands/aurello.json     # → dist/aurello/
node tools/serve.js dist/aurello 4173 # → http://localhost:4173
```

Or through the package scripts: `npm run build`, `npm run serve`, `npm run verify`.

`brands/aurello.json` is the original design. `brands/halden.json` is the same
template pointed at a Nordic skincare line: different palette, motif, package
shape, voice and copy, with no change to the template itself.

## What you get

A self-contained responsive page: plain HTML, CSS and vanilla JavaScript, GSAP and
ScrollTrigger for the scroll-linked scenes, no build framework, no runtime
dependencies. Roughly 61 KB of HTML plus generated SVG assets.

Fourteen sections in order: intro loader, fixed header with a centred script
wordmark and a working mobile menu, a pinned hero where the product rises and the
headline scatters character by character, a product introduction, a lifestyle deck
of perspective cards, a colour transition where a cream wave rises into the next
section, the three-product range, an ingredients band, serving steps, a story band
with a clip-path reveal, a scroll-driven marquee, an FAQ, a closing call to action
and a footer with an oversized wordmark.

## How it is put together

```
build.js              config in, finished page out
template/index.html   the page itself, with {{tokens}} where brand content goes
brands/
  _defaults.json      merged under every brand file
  _template.json      blank starter to copy
  aurello.json        the original design as data
  halden.json         proof the same template retargets
tools/
  render.js           ~120-line Mustache subset, no dependencies
  assets.js           procedural SVG kit: motifs, packages, illustration, photos
  fetch-fonts.js      self-hosts the web fonts from npm
  art.js              image prompts out, finished photography in
  imagesize.js        intrinsic dimensions, so no <img> shifts the layout
  serve.js            static preview server
  verify.js           drives every built brand in a real browser
docs/BRIEF.md         the questions that fill in a brand file
vendor/               GSAP and the fonts, copied into every build
dist/                 build output, rebuilt clean each run
```

The build merges `_defaults.json` under the brand file, derives everything that can
be computed (rgb channels for the translucent header, the nav split around the
centred logo, serif emphasis, the favicon, every asset path), resolves each image
slot, renders the template, and writes the result.

## Filling in a brand

Work through **[docs/BRIEF.md](docs/BRIEF.md)**. It is 41 questions grouped as
brand, colour and type, products, page copy, and assets, and each one names the
config path its answer writes to.

Two things worth knowing before you start:

**`*stars*` mark the serif cut.** Wrap one or two words in a headline and they drop
into the editorial serif: `"OPEN. POUR. *GLOW.*"` renders GLOW in Roboto Slab
against Bebas Neue. It is the single mechanic that carries most of the page's
typographic character.

**Images are optional.** Every image slot falls back to a generated SVG drawn from
the brand's own palette, so a new brand looks deliberate on the first build. The
build prints what it stood in for:

```
✓ aurello.json → dist/aurello/index.html  (61.2 KB)
  i 8 brand asset(s) not on disk yet, generated stand-ins: spritz-assets/aurello-can.png, …
```

Drop the real files at those paths and rebuild. Nothing else changes.

### Real photography

The drifting background motifs are meant to stay as generated SVG. The foreground
is where real pictures belong: the product cut-outs above all, then the three
lifestyle cards and the story panel.

Two ways in, and they meet at the same command.

**If the client supplies the images.** Put them anywhere, named by slot id, and
ingest the folder:

```bash
node tools/art.js brands/aurello.json --plan          # lists the slot ids
node tools/art.js brands/aurello.json --ingest ./from-client
node build.js brands/aurello.json --inline
```

Ingest trims the dead space around a cut-out, crops and resizes photographs to
the box the page actually paints, converts to the target format, and writes the
paths back into the brand file. It refuses an opaque image in a cut-out slot
rather than writing a picture that will read as a white box, and it says when
something is too small, too heavy, or losing most of its frame to the crop.

**If the images are to be generated.** `--plan` writes one prompt per slot, built
from the brand's own palette, category, product names and card copy, and prints
the cost before anything is spent:

```bash
node tools/art.js brands/aurello.json --plan
```

```
Aurello — 7 image slots
model nano_banana_pro at 2k, 2 credits each, 14 credits for the set

── product-orange-spritz  [product, needs background removed]  2:3  -> spritz-assets/aurello-can.png
   Studio packshot of a single can of Aurello Orange Spritz, a ready-to-drink
   aperitivo. The can is vivid orange-red with a cream label band. Upright,
   centred, very slight three-quarter turn so one edge catches the light. …
```

Colours are described in words rather than hex, because `#f04a24` means nothing to
an image model and "vivid orange-red" means exactly the right thing. Generate each
prompt, put the results in a JSON map of slot id to URL or path, and ingest that:

```bash
node tools/art.js brands/aurello.json --ingest results.json
```

Product slots need their background removed between generation and ingest. Shape
the prompt to make that easy — a flat, contrasting, seamless backdrop, the whole
product inside the frame with margin — which is what the generated prompts already
ask for.

Tune the look with the `art` block: `style` is one sentence of film stock, light
and time of day that gets appended to every prompt; `background` is what product
shots stand on; `negative` is what must never appear. Any slot can carry its own
`prompt` to override the generated one.

`--audit` checks what is already wired in:

```bash
node tools/art.js brands/aurello.json --audit
```

### Colour

Four colours and three card tints run the whole page:

| Token | Where it lands |
|-------|----------------|
| `primary` | hero and every pinned scene, roughly half the page |
| `cream` | product range, serving steps, closing section |
| `deep` | ingredients band, footer, every shadow |
| `soft` | one quiet band behind the FAQ |
| `tints` | one pastel per product card |

### Motifs and package shapes

`theme.motif` picks the shape that drifts through the page: `slice`, `leaf`,
`spark`, `wave`, `bloom`, `arc`, `ring`, `bolt`. Each product's `shape` picks the
generated package: `can`, `bottle`, `jar`, `box`, `tube`, `pouch`. Both are ignored
once real artwork is supplied.

### Brand context

`brand.category` and `brand.tagline` are emitted as schema.org `Brand` structured
data alongside the meta tags, so search results and link previews get the same
description the page does. `brand.fictional` is the switch that prints
`brand.disclosure` in the footer: a concept brand always discloses, a real one
never does.

### Dropping a section

Set `"enabled": false` on `hero`, `intro`, `lifestyle`, `transition`, `range`,
`ingredients`, `steps`, `story`, `marquee`, `faq` or `find`. The section and its
markup disappear; nothing else needs touching.

### Pacing the scroll

`scrollHeight` on each pinned scene sets how long it holds. `400vh` is four screens
of scrolling for one screen of content. Lower it for a faster page, raise it for a
slower, more cinematic one.

## Fonts and GSAP

Both are vendored into `vendor/` and copied into every build, so a built page makes
no external requests at all and works offline.

```bash
node tools/fetch-fonts.js                    # the four default families
node tools/fetch-fonts.js inter:400,600 …    # any @fontsource family
```

Delete `vendor/fonts/`, or set `theme.useLocalFonts` to `false`, and the build
falls back to the Google Fonts URL in `theme.fontsUrl`. Delete `vendor/*.js` and the page loads GSAP from a CDN, and if
that fails too it still renders completely, just without the motion.

## Accessibility and motion

Semantic sectioning, alt text on every meaningful image, a skip link, visible
3px focus rings, a keyboard-operable mobile menu that closes on Escape, and native
`<details>` accordions.

`prefers-reduced-motion: reduce` keeps every pixel of content and drops the motion:
pinned sections collapse to normal flow, the loader never runs, the card deck
becomes a stack, and nothing is left hidden waiting for a scroll trigger. The same
holds if GSAP fails to load, because reveal elements only hide themselves once the
animation engine has confirmed it is running.

## Build options

```bash
node build.js                          # every brands/*.json
node build.js brands/x.json            # one
node build.js brands/x.json --out DIR  # somewhere else
node build.js --no-assets              # reuse assets already on disk
node build.js brands/x.json --inline   # also emit one portable single file
node build.js brands/x.json --artifact # also emit a body-only fragment
node build.js brands/x.json --out DIR --clean   # wipe DIR/assets first
```

`--inline` folds the fonts, GSAP and every image into the HTML and writes
`<brand>.single.html` next to the normal build: around 460 KB, no external
requests, opens straight from disk or an email attachment and still animates.

`--artifact` writes `<brand>.artifact.html`, the same fully inlined page as a
body fragment, for hosts that supply their own `<!doctype>`, `<head>` and
`<body>` and render only what sits inside the body. Styles and structured data
come first, then the content, with the body's own attributes reapplied at
runtime.

`dist/` is owned by the build and rebuilt clean each run. A caller-supplied
`--out` is only cleaned when `--clean` is passed.

## Checking a build

```bash
npm i -D playwright && npx playwright install chromium   # once
npm run verify
```

Twenty-two checks per brand, run in a real browser: every section rendered, no
broken images, nothing left hidden waiting for a scroll trigger, the header stays
pinned, structured data present, no console errors or failed requests; no
horizontal overflow, the right nav mode, three product cards and an un-orphaned
footer arrow at 320, 390, 768, 1024, 1440, 1920 and 2560px; reduced motion keeps
all content and unpins every scene; the page still renders with GSAP blocked; the
skip link takes the first tab and the mobile menu closes on Escape; and the
single-file build animates from disk with zero external requests.

Worth running after any copy change, because the three things that break first
are a product name long enough to wrap, a headline long enough to reach three
lines, and a nav with more than five links.

## Deploying

The output folder is the whole site. Upload `dist/<brand>/` to any static host.
There is no server, no database and no build step at the far end.
