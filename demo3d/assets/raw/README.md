# Drop the raw engine GLBs here

Uncompressed output straight from each image-to-3D engine, before
`scripts/compress.sh` turns it into the web-ready meshes in `../glb/`.

Filenames must match exactly — `src/characters.js` and the build both key off
them:

| file | engine | source image |
|---|---|---|
| `01-kage.glb` | Tripo H3.1 | `../img/01-kage-src.png` |
| `02-tetsu.glb` | Hunyuan3D v3 | `../img/02-tetsu-src.png` |
| `03-kin.glb` | Meshy | `../img/03-kin-src.png` |

Once they are in place:

```bash
cd demo3d && npm run all && npm run verify
```

or just push — `.github/workflows/preview.yml` runs the same pipeline and
deploys `dist/` to GitHub Pages. When this folder holds no `.glb`, the
workflow falls back to whatever is already committed in `../glb/`, so the
preview always deploys.

## Size limits, in the order they will bite you

- **GitHub web UI upload: 25 MB per file.** A 800k-face PBR mesh will exceed
  this. Use GitHub Desktop or `git push` instead.
- **git push: 100 MB per file.** Fine for anything these engines emit.
- Above that, compress locally first and commit `../glb/` instead — the
  compressed meshes are roughly 8x smaller.

These masters are heavy and only needed to re-run compression, so there is no
harm in leaving them out of the repo. The compressed `../glb/` files are what
the site actually loads.
