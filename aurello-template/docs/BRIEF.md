# The brand brief

Everything on the page comes from one JSON file in `brands/`. This is the list of
questions that fills it in. Work top to bottom: each question names the exact
config path its answer writes to, so the answers can be dropped straight into a
brand file with no interpretation step.

Nothing here is mandatory. Skip a question and the section either falls back to a
sensible default or switches itself off with `"enabled": false`.

**Two conventions to know before you start**

- **`*stars*` mark the serif cut.** In any headline, wrap the one or two words that
  should drop into the high-contrast editorial serif: `"OPEN. POUR. *GLOW.*"`.
  That single mechanic carries most of the page's typographic character. Use it
  once per headline, never on the whole line.
- **Every image slot is optional.** Leave `image` empty and the build draws a
  stand-in from the brand's own palette. Fill it in later and rebuild; nothing
  else changes.

---

## A. The brand

| # | Question | Writes to |
|---|----------|-----------|
| 1 | What is the brand called? | `brand.name` |
| 2 | How is the name written in the header, marks and all? (`Aurello®`, `Halden°`) | `brand.wordmark` |
| 3 | One line that says what it is and how it feels. This runs under the loader and in the hero. | `brand.tagline` |
| 4 | What category is it, in plain words? ("ready-to-drink aperitivo", "Nordic skincare") | `brand.category` |
| 5 | Real brand, or a concept? A concept adds a disclosure line to the footer. | `brand.fictional`, `brand.disclosure` |
| 6 | Page title and meta description for search and link previews. Leave blank to build them from 1 and 3. | `meta.title`, `meta.description` |

## B. Colour and type

The whole page runs on four colours plus three card tints. Pick them once.

| # | Question | Writes to |
|---|----------|-----------|
| 7 | **The loud one.** Fills the hero and every cinematic scene, roughly half the page. | `theme.colors.primary` |
| 8 | **The light ground.** Product range, serving steps and closing section sit on it. | `theme.colors.cream` |
| 9 | **The deep one.** Ingredients band and footer. Should be the primary, much darker. | `theme.colors.deep` |
| 10 | **The soft one.** A single quiet band behind the FAQ. | `theme.colors.soft` |
| 11 | Three pastel tints, one per product card. They should differ from each other clearly. | `theme.tints` |
| 12 | **The motif** that drifts through the page: `slice`, `leaf`, `spark`, `wave`, `bloom`, `arc`, `ring`, `bolt`. | `theme.motif` |
| 13 | Fonts. The default set is Bebas Neue (display), Roboto Slab (serif), DM Sans (body), Caveat (logo). Swapping any of them means changing the family list and the stylesheet URL together. | `theme.fonts.*`, `theme.fontsUrl` |
| 14 | Corner radius and page width, if the defaults (28px / 1280px) are wrong for the brand. | `theme.radius`, `theme.maxWidth` |

## C. The products

Three cards. The grid is built for exactly three; two or four will build but the
rhythm suffers. For each one:

| # | Question | Writes to |
|---|----------|-----------|
| 15 | Product name. | `range.products[].name` |
| 16 | One line on what it actually is. | `range.products[].subtitle` |
| 17 | The spec line: size, strength, serving temperature, whatever the category prints. | `range.products[].meta` |
| 18 | Package shape: `can`, `bottle`, `jar`, `box`, `tube`, `pouch`. Only used when there is no photo. | `range.products[].shape` |
| 19 | The product's own colour, and the pastel behind it on the card. | `range.products[].color`, `.tint` |
| 20 | A transparent cut-out photo, if there is one. | `range.products[].image` |

## D. The words on the page

Section by section, in the order a visitor meets them.

| # | Section | Question | Writes to |
|---|---------|----------|-----------|
| 21 | Header | Five navigation labels and where each points. | `nav.links` |
| 22 | Header | The one CTA that looks different from the rest. | `nav.cta` |
| 23 | Hero | Two lines of enormous type. Short. Two or three words each. | `hero.line1`, `hero.line2` |
| 24 | Hero | The quiet line underneath. | `hero.support` |
| 25 | Intro | Eyebrow, headline with a `*starred*` word, one paragraph, one button. | `intro.*` |
| 26 | Lifestyle | Four to six short lines about the moment the brand belongs to. Alternate shouted lines with `*serif asides*`. | `lifestyle.copy` |
| 27 | Lifestyle | Three cards: small label, big headline, two lines of copy, a photo. | `lifestyle.cards` |
| 28 | Transition | Two lines of the biggest type on the page, before the colour changes. | `transition.line1`, `.line2` |
| 29 | Range | Eyebrow, headline, one paragraph introducing the three products. | `range.eyebrow`, `.heading`, `.body` |
| 30 | Inside | Eyebrow, headline, paragraph, and three things that are actually in the product. | `ingredients.*` |
| 31 | Steps | Heading and three numbered steps for using or serving it. | `steps.heading`, `.items` |
| 32 | Story | Eyebrow, headline, two paragraphs of origin, a button, a photo. | `story.*` |
| 33 | Marquee | The three-beat phrase that runs across the page, and a flourish character. | `marquee.text`, `.flourish` |
| 34 | FAQ | Four real questions with plain answers. The ones people actually ask before buying. | `faq.items` |
| 35 | Closing | Headline, paragraph, button for the final call to action. | `find.*` |
| 36 | Footer | Big CTA line, one-sentence brand statement, three link columns, small print, copyright. | `footer.*` |

## E. Assets

| # | Question | Writes to |
|---|----------|-----------|
| 37 | Product cut-outs, as transparent PNGs? | `range.products[].image`, `hero/intro/transition.product.image` |
| 38 | Three lifestyle photographs? | `lifestyle.cards[].image` |
| 39 | One more photograph for the story band? | `story.image` |
| 40 | A large line illustration to sit behind the product? | `assets.muse` |
| 41 | An SVG for the drifting motif, if the built-in set is not right? | `assets.motif` |

Paths are resolved relative to the brand file, then to the template root. Anything
missing is generated, and the build prints a list of what it stood in for.

### What each real image needs to be

The background motifs stay as generated SVG. The foreground is where real
pictures belong, and each slot has a shape it has to fit.

| Slot | Wants | Why |
|------|-------|-----|
| Product cut-outs | **Transparent PNG**, about 1400px tall, product centred with clear margin | The page rotates them, scales them and casts a real `drop-shadow`. A photo with a background reads as a white box, which is the one mistake that breaks the look. |
| Lifestyle cards (3) | 1200 × 1500, portrait | Fills a rounded card, cropped to cover. A landscape source loses about half its frame. |
| Story panel | 1600 × 2000, portrait | Full-height panel revealed by a clip-path wipe. |
| Illustration | Transparent PNG, ~1200px wide | Sits behind the product at low opacity. |

`node tools/art.js brands/<brand>.json --ingest <folder>` normalises whatever you
have into those shapes: it trims the dead space around a cut-out, crops and
resizes photographs, converts to the right format, and refuses anything that
will not sit right rather than writing it and letting you find out later.

### If the images are to be generated rather than supplied

| # | Question | Writes to |
|---|----------|-----------|
| 42 | What does the photography feel like? One sentence on film stock, light and time of day. | `art.style` |
| 43 | What should product shots stand on? A seamless studio backdrop, a real surface, something else? | `art.background` |
| 44 | Anything that must never appear? | `art.negative` |
| 45 | Any slot where you already know the exact shot you want? | `range.products[].prompt`, `lifestyle.cards[].prompt`, `story.prompt` |

Everything else is written for you. `node tools/art.js brands/<brand>.json --plan`
turns the answers above plus the brand's palette, category, product names and card
copy into one prompt per slot, and prints the credit cost before anything is spent.

## F. Pacing and switches

Not questions to ask, but the knobs worth knowing about once the answers are in.

| Setting | Default | What it does |
|---------|---------|--------------|
| `<section>.enabled` | `true` | Set `false` on `hero`, `intro`, `lifestyle`, `transition`, `range`, `ingredients`, `steps`, `story`, `marquee`, `faq` or `find` to drop that section and its markup entirely. |
| `<scene>.scrollHeight` | `300vh`–`400vh` | How long a pinned scene holds. `400vh` is four screens of scrolling for one screen of content. Lower for a faster page, raise for a slower one. |
| `loader.enabled` | `true` | The opening full-screen wordmark. |
| `loader.duration` | `2.0` | Seconds for the whole loader sequence. Keep it between 1.5 and 2.5. |
| `theme.grain` | `true` | The fine paper grain over the whole page. |
| `theme.useLocalFonts` | `true` | Use the self-hosted fonts in `vendor/fonts/` when they exist. Set `false` to force the `theme.fontsUrl` stylesheet instead. |
| `marquee.repeat` | `6` | How many times the marquee phrase repeats. Raise it if the phrase is short enough to run out mid-scroll. |
| `range.products[].labelColor` | derived | The type colour on a generated package label. Defaults to the product colour, darkened. |
| `range.products[].labelBg` | `cream` | The label band colour on a generated package. |
| `brand.fictional` | `false` | When `true`, `brand.disclosure` is printed in the footer. When `false` it never is, whatever the disclosure field says. |

---

## Turning answers into a site

```bash
cp brands/_template.json brands/mybrand.json   # fill in from the answers above
node build.js brands/mybrand.json              # → dist/mybrand/
node tools/serve.js dist/mybrand 4173          # look at it
```
