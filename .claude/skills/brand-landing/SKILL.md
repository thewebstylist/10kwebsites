---
name: brand-landing
description: Build a premium editorial product landing page for any brand by interviewing the user and filling in a brand config. Use when the user wants a landing page, product page, or brand site in the Aurello style — a cinematic scroll page with huge display type, cut-out products, colour blocks and a drifting motif — or asks to retarget the existing template to a new brand, restyle it, or change its colours, products or copy.
---

# Brand landing page

`aurello-template/` in this repo is a finished editorial landing page whose every
word, colour, font, product and image comes from one JSON file. Building a site for
a new brand means interviewing the user, writing one brand file, and running one
command. Never edit `template/index.html` to change brand content — if something
brand-specific is hard-coded there, that is a template bug worth fixing properly.

## Before the first question

Read `aurello-template/README.md` and `aurello-template/docs/BRIEF.md`. The brief is
41 questions grouped as brand, colour and type, products, page copy, and assets, and
each one names the config path its answer writes to. Look at
`aurello-template/brands/aurello.json` to see what fully answered looks like, and
`brands/halden.json` to see how far the design travels.

## The interview

Ask through the clickable-choice question tool, a few at a time, grouped the way the
brief groups them. Put a recommended option first. Never make the user answer 41
questions in a row: get sections A, B and C (brand, colour, products), then propose
draft copy for section D yourself and have them react to it. Writing the first draft
of the copy is your job, not theirs.

Two things to raise early because they shape everything after:

- **Real brand or concept?** A real brand means real copy, real products, and real
  assets if they have them. A concept means you invent everything and the footer
  discloses it.
- **Do they have assets?** Transparent product cut-outs, photographs, a logo, an
  illustration. Every image slot falls back to a generated SVG in the brand's own
  palette, so missing assets never block a build. Ask where the files are, put those
  paths in the brand file whether or not the files exist yet, and let the build
  print what it stood in for.

## Writing the copy

The page lives or dies on its words. No placeholder text, no "Lorem", no generic
SaaS phrasing, no sentence that would fit any brand in the category.

- Wrap one or two words per headline in `*stars*` to drop them into the editorial
  serif. Once per headline, never the whole line.
- Hero lines are two or three words each. They are set at 270px.
- The lifestyle lines alternate shouted display lines with `*serif asides*`.
- FAQ questions are the four things people actually ask before buying, answered
  plainly and without the marketing voice.

## Build, look, iterate

```bash
cd aurello-template
node build.js brands/<brand>.json
node tools/serve.js dist/<brand> 4173
```

Then look at it yourself before showing the user. Screenshot the hero, the range and
the footer at 1440px and at 390px. Check the three things that break first when copy
changes: a product name long enough to wrap, a headline long enough to reach three
lines, and a nav with more than five links.

Check the fallbacks whenever the template itself changed: `prefers-reduced-motion`
must keep all content and drop all motion, and the page must render completely with
GSAP blocked.

## What not to do

- Do not add a framework, a bundler, or a CSS library.
- Do not put brand content in the template or brand-specific CSS in a `<style>` tag.
- Do not use gradients as decoration, stock-image URLs, autoplay video, canvas, or
  horizontal scrolling.
- Do not animate anything but `transform`, `opacity` and `clip-path`.
