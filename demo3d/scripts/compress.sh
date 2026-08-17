#!/usr/bin/env bash
#
# Web-ready GLBs.
#
#   1. resize   cap every texture at 2048² — engines happily emit 4096²
#   2. webp     quality 85; PNG albedo/ORM maps are the single biggest win
#   3. meshopt  quantise + compress the vertex and index buffers
#
# Deliberately NOT running `simplify` / `weld`: the differing triangle counts
# are the entire point of the comparison, and meshopt preserves them exactly.
#
#   usage: scripts/compress.sh [src_dir] [out_dir]

set -euo pipefail
cd "$(dirname "$0")/.."

GT="node_modules/.bin/gltf-transform"
SRC="${1:-assets/raw}"
OUT="${2:-assets/glb}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$OUT"

printf '%-18s %10s %10s %8s\n' "FILE" "BEFORE" "AFTER" "RATIO"
printf '%s\n' "────────────────────────────────────────────────────"

total_before=0
total_after=0

for src in "$SRC"/*.glb; do
  name="$(basename "$src")"

  "$GT" resize "$src"            "$TMP/a-$name" --width 2048 --height 2048 >/dev/null 2>&1
  "$GT" webp   "$TMP/a-$name"    "$TMP/b-$name" --quality 85                >/dev/null 2>&1
  "$GT" meshopt "$TMP/b-$name"   "$OUT/$name"                               >/dev/null 2>&1

  before=$(stat -c%s "$src")
  after=$(stat -c%s "$OUT/$name")
  total_before=$((total_before + before))
  total_after=$((total_after + after))

  printf '%-18s %9.1fM %9.1fM %7.1fx\n' "$name" \
    "$(echo "$before/1048576" | bc -l)" \
    "$(echo "$after/1048576"  | bc -l)" \
    "$(echo "$before/$after"  | bc -l)"
done

printf '%s\n' "────────────────────────────────────────────────────"
printf '%-18s %9.1fM %9.1fM %7.1fx\n' "TOTAL" \
  "$(echo "$total_before/1048576" | bc -l)" \
  "$(echo "$total_after/1048576"  | bc -l)" \
  "$(echo "$total_before/$total_after" | bc -l)"
