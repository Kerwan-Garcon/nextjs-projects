#!/usr/bin/env bash
#
# Post-production.
#
# Playwright writes VP8/webm at the recording size. This burns the caption track
# when there is one and encodes H.264 so the file plays anywhere without anybody
# having to be told which codec to use.
#
# It does not upscale. Encoding the 1600x900 recording to 1080p made the file
# two and a half times larger and no sharper, because there was no extra detail
# to carry - the captions are authored against a 1920x1080 PlayRes and libass
# scales them to whatever frame it is given.
#
#   tools/video/postprod.sh out/demo-raw.webm out/save-us-demo.mp4 out/demo.ass
#
# Needs an ffmpeg with libx264 and libass. Playwright ships one, but it is built
# with almost everything disabled, so point FFMPEG at a full build.
set -euo pipefail

FF="${FFMPEG:-$(command -v ffmpeg || true)}"
if [ -z "$FF" ]; then
  echo "no ffmpeg found. Install one, or set FFMPEG=/path/to/ffmpeg." >&2
  exit 1
fi

IN="$1"; OUT="$2"; SUBS="${3:-}"
# Optional fourth argument: seconds of dead lead-in to drop from the head.
TRIM="${4:-0}"

FILTER="format=yuv420p"
if [ -n "$SUBS" ]; then
  FILTER="subtitles=${SUBS}:fontsdir=/usr/share/fonts,format=yuv420p"
fi

"$FF" -y -loglevel error -ss "$TRIM" -i "$IN" \
  -vf "$FILTER" \
  -r 30 -c:v libx264 -preset veryslow -crf 24 -profile:v high -level 4.0 \
  -movflags +faststart -pix_fmt yuv420p \
  "$OUT"

echo "wrote $OUT"
