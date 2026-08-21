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
node build.js brands/x.json --out DIR --clean   # wipe DIR/assets first
```

`--inline` folds the fonts, GSAP and every image into the HTML and writes
`<brand>.single.html` next to the normal build: around 460 KB, no external
requests, opens straight from disk or an email attachment and still animates.

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
