#!/usr/bin/env bash
#
# Mix the narration over the score and mux it onto the picture.
#
#   tools/video/mix.sh out/film-raw.webm out/save-us-film.mp4
#
# The score is ducked by the voice with a real sidechain compressor rather than
# a static level, so it breathes in the gaps between lines instead of sitting
# flat underneath them. Output is normalised to -16 LUFS, which is what the
# social platforms target - a film that is quieter than everything around it
# reads as amateur before anybody has heard a word.
set -euo pipefail

FF="${FFMPEG:-$(command -v ffmpeg || true)}"
[ -z "$FF" ] && { echo "no ffmpeg found; set FFMPEG=/path/to/ffmpeg" >&2; exit 1; }

HERE="$(cd "$(dirname "$0")" && pwd)"
VIDEO="$1"; OUT="$2"
VO="$HERE/audio/out/vo.wav"
MUSIC="$HERE/audio/out/music.wav"

for f in "$VO" "$MUSIC"; do
  [ -f "$f" ] || { echo "missing $f - run tools/video/audio/tts.py and music.py first" >&2; exit 1; }
done

"$FF" -y -loglevel error \
  -i "$VIDEO" -i "$VO" -i "$MUSIC" \
  -filter_complex "
    [1:a]aresample=48000,aformat=channel_layouts=stereo,
         highpass=f=85,
         volume=1.9,
         asplit=2[vo][key];
    [2:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.62[bed];
    [bed][key]sidechaincompress=threshold=0.05:ratio=7:attack=12:release=420:makeup=1[ducked];
    [vo][ducked]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[mixed];
    [mixed]afade=t=in:st=0:d=0.5,
           afade=t=out:st=$(python3 -c "
import json,sys
d=json.load(open('$HERE/audio/out/vo.json'))
print(round(d['totalMs']/1000 + 0.9, 2))
"):d=1.4,
           loudnorm=I=-16:TP=-1.5:LRA=11[out]
  " \
  -map 0:v -map "[out]" \
  -c:v copy -c:a aac -b:a 192k -ar 48000 \
  -movflags +faststart -shortest \
  "$OUT"

echo "wrote $OUT"
