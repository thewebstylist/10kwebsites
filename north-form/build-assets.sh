#!/usr/bin/env bash
# Build web-optimised assets for north-form/assets from the originals in
# reference/assets. Originals stay untouched as the archive; the site ships
# these derivatives.
set -euo pipefail

SP=/tmp/claude-0/-home-user-10kwebsites/b4f50425-225a-5a5d-8cce-cbf22632bca8/scratchpad
FF=$SP/node_modules/ffmpeg-static/ffmpeg
SRC=/home/user/10kwebsites/reference/assets
OUT=/home/user/10kwebsites/north-form/assets
mkdir -p "$OUT"

VID_A=$SRC/hf_20260817_072319_f13204ff-d49c-4a45-88a1-f5506d26ed12.mp4   # hero: wide > close > wide
VID_B=$SRC/hf_20260817_072322_13e8a1f5-9f48-4f66-b93b-2289899abbd6.mp4   # project 01: steady

img () {  # src, name, width
  $FF -y -loglevel error -i "$1" -vf "scale=$3:-2" -q:v 3 "$OUT/$2.jpg"
}

echo "images (1600px hero-class):"
img "$SRC/hf_20260817_065525_6b7407ff-afee-4721-b873-84a32d861893.png" gown          1600  # full length, tall crop
img "$SRC/hf_20260817_071925_9c03506f-876c-425c-adc0-50280dc81476.png" mohawk        1600  # colour pop
img "$SRC/hf_20260817_071850_edae0579-3e57-4106-badb-b0a642da5240.png" koi-man       1600
img "$SRC/hf_20260817_071345_e98348de-236a-4ac3-93fa-4587e44ab9bb.png" afro          1600  # white ground
img "$SRC/hf_20260817_071749_a5f6096e-9d60-4aea-9416-2669fff0e9ce.png" koi-blonde-a  1600  # cinematic bg
for f in "$OUT"/*.jpg; do printf "  %-22s %s\n" "$(basename "$f")" "$(du -h "$f" | cut -f1)"; done

echo "images (800px card-class):"
img "$SRC/hf_20260817_065247_f3cedc21-a0b9-4749-85fe-1da825e0321d.png" smoke          800
img "$SRC/hf_20260817_065248_40d1bfda-6ff9-455e-acc6-15fb3f813bbd.png" butterfly-w    800
img "$SRC/hf_20260817_065257_f9202791-2503-4583-ba9a-b4e296509708.png" butterfly-m    800
img "$SRC/hf_20260817_065535_04d2f7e9-6129-420c-8c80-ea065fc12f67.png" albino         800
img "$SRC/hf_20260817_071217_627d3031-5802-4a75-b830-06f54efd2bcf.png" koi-blonde-b   800
img "$SRC/hf_20260817_071315_b7dada88-c98b-4fb6-a934-cfcc6893aa9d.png" koi-blonde-c   800
img "$SRC/hf_20260817_072026_0e6d2cf6-b44e-4416-b1c3-86ae03378a03.png" koi-red-a      800
img "$SRC/hf_20260817_072028_15340aa5-4205-4e9a-87d9-89c5c41c2c77.png" koi-red-b      800

echo "video:"
# hero is scroll-scrubbed, so it needs a dense keyframe interval: -g 6 puts a
# keyframe every quarter second at 24fps, which seeks cleanly without the size
# blow-up of all-intra
$FF -y -loglevel error -i "$VID_A" -an -vf "scale=1280:-2" -c:v libx264 -preset slow \
    -crf 24 -g 6 -pix_fmt yuv420p -movflags +faststart "$OUT/hero.mp4"
# project media just loops, so a normal GOP is fine and much smaller
$FF -y -loglevel error -i "$VID_B" -an -vf "scale=1280:-2" -c:v libx264 -preset slow \
    -crf 26 -pix_fmt yuv420p -movflags +faststart "$OUT/project-01.mp4"
# posters must match their clip or the first paint flashes the wrong image
$FF -y -loglevel error -ss 0.2 -i "$VID_A" -frames:v 1 -vf "scale=1280:-2" -q:v 3 "$OUT/hero-poster.jpg"
$FF -y -loglevel error -ss 0.2 -i "$VID_B" -frames:v 1 -vf "scale=1280:-2" -q:v 3 "$OUT/project-01-poster.jpg"

printf "  %-22s %s\n" hero.mp4 "$(du -h "$OUT/hero.mp4" | cut -f1)"
printf "  %-22s %s\n" project-01.mp4 "$(du -h "$OUT/project-01.mp4" | cut -f1)"
echo
echo "total shipped assets: $(du -sh "$OUT" | cut -f1)"
