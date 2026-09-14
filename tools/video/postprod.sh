#!/usr/bin/env bash
#
# Post-production.
#
# Playwright writes VP8/webm at the recording size. This upscales to 1080p,
# burns the caption track when there is one, and encodes H.264 so the file
# plays anywhere without anybody having to be told which codec to use.
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

FILTER="scale=1920:1080:flags=lanczos,format=yuv420p"
if [ -n "$SUBS" ]; then
  FILTER="scale=1920:1080:flags=lanczos,subtitles=${SUBS}:fontsdir=/usr/share/fonts,format=yuv420p"
fi

"$FF" -y -loglevel error -i "$IN" \
  -vf "$FILTER" \
  -r 30 -c:v libx264 -preset slow -crf 21 -profile:v high -level 4.1 \
  -movflags +faststart -pix_fmt yuv420p \
  "$OUT"

echo "wrote $OUT"
