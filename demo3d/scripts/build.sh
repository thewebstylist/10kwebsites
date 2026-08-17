#!/usr/bin/env bash
#
# Produce a dist/ folder containing only what the site needs, so it can be
# dragged straight onto a static host.
#
# Left out: assets/raw (pre-compression masters), the full-resolution source
# PNGs, scripts/, node_modules — none of it is fetched by the page.
#
#   usage: scripts/build.sh

set -euo pipefail
cd "$(dirname "$0")/.."

DIST="dist"
rm -rf "$DIST"
mkdir -p "$DIST"/{src,vendor/three,vendor/jsm/{controls,loaders,libs,utils},assets/{glb,img}}

# page
cp index.html styles.css "$DIST/"
cp src/*.js "$DIST/src/"

# three.js — three.core.js must travel with three.module.js, and GLTFLoader
# statically imports both utils modules. Missing any of them is a silent 404
# and a blank page.
cp vendor/three/three.module.js       "$DIST/vendor/three/"
cp vendor/three/three.core.js         "$DIST/vendor/three/"
cp vendor/jsm/controls/OrbitControls.js        "$DIST/vendor/jsm/controls/"
cp vendor/jsm/loaders/GLTFLoader.js            "$DIST/vendor/jsm/loaders/"
cp vendor/jsm/libs/meshopt_decoder.module.js   "$DIST/vendor/jsm/libs/"
cp vendor/jsm/utils/BufferGeometryUtils.js     "$DIST/vendor/jsm/utils/"
cp vendor/jsm/utils/SkeletonUtils.js           "$DIST/vendor/jsm/utils/"

# assets — compressed meshes and downscaled thumbnails only
cp assets/glb/*.glb  "$DIST/assets/glb/"
cp assets/img/*.webp "$DIST/assets/img/"

# every relative url the page references must exist in dist. Paths in
# index.html resolve against the site root; imports inside src/*.js resolve
# against src/ — checking both against the root is how you miss a real 404.
missing=0
check() { # check <base-dir> <ref>
  [ -f "$1/$2" ] || { echo "MISSING: $2  (referenced from ${1#$DIST/}/)"; missing=1; }
}

while read -r ref; do
  [ -n "$ref" ] && check "$DIST" "$ref"
done < <(grep -oE '(src|href)="\./?[^"]+"' "$DIST/index.html" \
  | sed -E 's/.*="\.?\/?//; s/"$//' | grep -vE '^(https?:|data:)' | sort -u)

while read -r ref; do
  [ -n "$ref" ] && check "$DIST/src" "$ref"
done < <(grep -ohE "from '\./[^']+'" "$DIST"/src/*.js \
  | sed -E "s/from '(.*)'/\1/" | sort -u)

# glb/webp urls in the character registry resolve against the site root
while read -r ref; do
  [ -n "$ref" ] && check "$DIST" "$ref"
done < <(grep -ohE "'assets/[^']+'" "$DIST"/src/*.js | tr -d "'" | sort -u)

[ "$missing" -eq 0 ] || { echo "build incomplete"; exit 1; }

echo "dist/ contents"
echo "──────────────────────────────────────────────"
find "$DIST" -type f | sort | while read -r f; do
  printf '%9s  %s\n' "$(du -h "$f" | cut -f1)" "${f#$DIST/}"
done
echo "──────────────────────────────────────────────"
printf 'total %s across %s files\n' \
  "$(du -sh "$DIST" | cut -f1)" "$(find "$DIST" -type f | wc -l)"
