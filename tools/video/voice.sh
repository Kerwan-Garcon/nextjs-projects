#!/usr/bin/env bash
#
# Narration then score, for one cut.
#
#   pnpm video:voice            # the platform film
#   pnpm video:voice learn      # the courses film
#
# Two commands rather than one because the score is a function of the narration
# it will sit under: it cannot be written until the voice has been cut.
set -euo pipefail

CUT="${1:-film}"
HERE="$(cd "$(dirname "$0")" && pwd)"

python3 "$HERE/audio/tts.py" "$CUT"
python3 "$HERE/audio/music.py" "$CUT"
