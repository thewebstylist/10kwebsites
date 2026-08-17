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

VID_A=$SRC/butterfly-bw.mp4                                              # hero: single continuous take
VID_B=$SRC/hf_20260817_072322_13e8a1f5-9f48-4f66-b93b-2289899abbd6.mp4   # project 01: steady
VID_C=$SRC/hf_20260817_072319_f13204ff-d49c-4a45-88a1-f5506d26ed12.mp4   # closer: cuts are fine, it only loops

img () {  # src, name, width
  $FF -y -loglevel error -i "$1" -vf "scale=$3:-2" -q:v 3 "$OUT/$2.jpg"
}

# Source names are opaque Higgsfield exports, so each line records what the
# picture actually is, verified against a labelled contact sheet. Three of the
# uploads are screenshots of the site itself and are deliberately not built.
echo "images (1600px, used full-width):"
img "$SRC/hf_20260817_065257_f9202791-2503-4583-ba9a-b4e296509708.png" gown          1600  # full-length figure, black gown
img "$SRC/hf_20260817_071749_a5f6096e-9d60-4aea-9416-2669fff0e9ce.png" mohawk        1600  # orange monarchs, dark ground
img "$SRC/hf_20260817_071925_9c03506f-876c-425c-adc0-50280dc81476.png" koi-man       1600  # underwater, long hair, mono
img "$SRC/hf_20260817_071345_e98348de-236a-4ac3-93fa-4587e44ab9bb.png" afro          1600  # orange/blue, white ground
img "$SRC/hf_20260817_071845_0bcf8ca0-fb1b-4482-9328-22613baf7c29.png" koi-blonde-a  1600  # underwater, pale hair, mono

echo "images (800px, cards and previews):"
img "$SRC/hf_20260817_065247_f3cedc21-a0b9-4749-85fe-1da825e0321d.png" smoke          800  # head dissolving into smoke
img "$SRC/hf_20260817_065248_40d1bfda-6ff9-455e-acc6-15fb3f813bbd.png" butterfly-a    800  # butterflies on face, white collar
img "$SRC/hf_20260817_065525_6b7407ff-afee-4721-b873-84a32d861893.png" butterfly-b    800  # butterflies on face, turtleneck
img "$SRC/hf_20260817_065535_04d2f7e9-6129-420c-8c80-ea065fc12f67.png" albino         800  # pale hair, butterflies
img "$SRC/hf_20260817_071850_edae0579-3e57-4106-badb-b0a642da5240.png" koi-blonde-b   800  # underwater, pale hair, mono
img "$SRC/hf_20260817_072026_0e6d2cf6-b44e-4416-b1c3-86ae03378a03.png" koi-red-a      800  # underwater, red hair, colour
img "$SRC/hf_20260817_072028_15340aa5-4205-4e9a-87d9-89c5c41c2c77.png" koi-red-b      800  # underwater, red hair, colour

# not built (screenshots of the site, not content):
#   hf_20260817_071217_..., hf_20260817_071315_..., image-1786950514318.png

echo "video:"
# hero is scroll-scrubbed, so it needs a dense keyframe interval: -g 6 puts a
# keyframe every quarter second at 24fps, which seeks cleanly without the size
# blow-up of all-intra
$FF -y -loglevel error -i "$VID_A" -an -c:v libx264 -preset slow \
    -crf 23 -g 6 -pix_fmt yuv420p -movflags +faststart "$OUT/hero.mp4"
# project media just loops, so a normal GOP is fine and much smaller
$FF -y -loglevel error -i "$VID_B" -an -vf "scale=1280:-2" -c:v libx264 -preset slow \
    -crf 26 -pix_fmt yuv420p -movflags +faststart "$OUT/project-01.mp4"
# posters must match their clip or the first paint flashes the wrong image
$FF -y -loglevel error -ss 0.2 -i "$VID_A" -frames:v 1 -vf "scale=1280:-2" -q:v 3 "$OUT/hero-poster.jpg"
$FF -y -loglevel error -ss 0.2 -i "$VID_B" -frames:v 1 -vf "scale=1280:-2" -q:v 3 "$OUT/project-01-poster.jpg"

# the closer autoplays and loops, so it never seeks and needs no dense GOP
$FF -y -loglevel error -i "$VID_C" -an -vf "scale=1280:-2" -c:v libx264 -preset slow \
    -crf 26 -pix_fmt yuv420p -movflags +faststart "$OUT/cinematic.mp4"
$FF -y -loglevel error -ss 0.2 -i "$VID_C" -frames:v 1 -vf "scale=1280:-2" -q:v 3 "$OUT/cinematic-poster.jpg"

printf "  %-22s %s\n" hero.mp4 "$(du -h "$OUT/hero.mp4" | cut -f1)"
printf "  %-22s %s\n" project-01.mp4 "$(du -h "$OUT/project-01.mp4" | cut -f1)"
echo
echo "total shipped assets: $(du -sh "$OUT" | cut -f1)"
