# Black Onyx Financial Group, Inc. · redesign

- `site/` is the deploy folder: `index.html` + `assets/`. Zip the CONTENTS of `site/` to deploy.
- `DESIGN-PACKAGE.md` holds every design decision and the verbatim copy.
- `render/` re-renders the original onyx-and-gold footage and stills:
  `NODE_PATH=$(npm root -g) node render/render.js <outdir> 1920 1080 hero 180`
  then encode with the scrub recipe (`-g 8 -keyint_min 8`), see the 10k-websites skill.

Preview the full scroll video with a local server: `cd site && python3 -m http.server`.
Double-clicking `index.html` shows the designed still hero instead (browsers block the video fetch on file://).
