#!/usr/bin/env python3
"""
Narration, synthesised locally with Kokoro-82M.

Local rather than hosted, for one reason that matters here: the film's timing is
derived from the voice, so the voice has to be regenerable. A hosted clip is a
file somebody has to keep; this is a command anybody can re-run, and re-running
it after an edit re-times the film automatically.

Kokoro is Apache-2.0. The weights are fetched once into `model/`, which is not
tracked.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from urllib.request import urlopen

import numpy as np
import soundfile as sf

HERE = Path(__file__).parent
MODEL_DIR = HERE / "model"
OUT_DIR = HERE / "out"

HF = "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main"
# The quantised builds segfault under onnxruntime 1.30; full precision is fine
# and a 45-second narration still synthesises in well under a minute.
MODEL_URL = f"{HF}/onnx/model.onnx"
VOICE_NAMES = [
    "af_heart", "af_bella", "am_michael", "am_fenrir",
    "am_puck", "am_onyx", "bm_george", "bf_emma",
]

SAMPLE_RATE = 24_000
# Kokoro leaves a little room at both ends; trimming makes the gaps in
# script.json mean what they say.
SILENCE_FLOOR = 0.006
LEAD_IN = 0.06


def fetch(url: str, dest: Path) -> None:
    if dest.exists():
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"  fetching {dest.name} ...", flush=True)
    with urlopen(url) as response, dest.open("wb") as handle:
        while chunk := response.read(1 << 20):
            handle.write(chunk)


def ensure_model() -> tuple[Path, Path]:
    model = MODEL_DIR / "kokoro.onnx"
    voices = MODEL_DIR / "voices.npz"
    fetch(MODEL_URL, model)

    if not voices.exists():
        # The published bundle lives on a GitHub release that is not always
        # reachable, so the per-voice tensors are assembled into one instead.
        table = {}
        for name in VOICE_NAMES:
            blob = MODEL_DIR / f"{name}.bin"
            fetch(f"{HF}/voices/{name}.bin", blob)
            table[name] = np.fromfile(blob, dtype=np.float32).reshape(-1, 1, 256)
        np.savez(voices, **table)
        for name in VOICE_NAMES:
            (MODEL_DIR / f"{name}.bin").unlink(missing_ok=True)

    return model, voices


def trim(samples: np.ndarray) -> np.ndarray:
    loud = np.abs(samples) > SILENCE_FLOOR
    if not loud.any():
        return samples
    first, last = int(np.argmax(loud)), len(loud) - int(np.argmax(loud[::-1]))
    pad = int(LEAD_IN * SAMPLE_RATE)
    return samples[max(0, first - pad) : min(len(samples), last + pad)]


def main() -> int:
    from kokoro_onnx import Kokoro

    spec = json.loads((HERE / "script.json").read_text(encoding="utf-8"))
    voice = sys.argv[1] if len(sys.argv) > 1 else spec["voice"]

    model, voices = ensure_model()
    kokoro = Kokoro(str(model), str(voices))
    if voice not in kokoro.get_voices():
        print(f"unknown voice {voice}; have {kokoro.get_voices()}")
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    timeline, track, cursor = [], [], 0.0

    for line in spec["lines"]:
        samples, rate = kokoro.create(
            line["text"], voice=voice, speed=spec.get("speed", 1.0), lang=spec.get("lang", "en-us")
        )
        assert rate == SAMPLE_RATE, f"unexpected sample rate {rate}"
        samples = trim(np.asarray(samples, dtype=np.float32))
        gap = float(line.get("gapAfter", 0.6))

        timeline.append(
            {
                "id": line["id"],
                "text": line["text"],
                "startMs": round(cursor * 1000),
                "speechMs": round(len(samples) / SAMPLE_RATE * 1000),
                "gapMs": round(gap * 1000),
                # What the film should hold this beat for: the line plus its gap.
                "holdMs": round((len(samples) / SAMPLE_RATE + gap) * 1000),
            }
        )
        print(f"  {line['id']:9s} {len(samples) / SAMPLE_RATE:5.2f}s  {line['text'][:58]}", flush=True)

        track.append(samples)
        track.append(np.zeros(int(gap * SAMPLE_RATE), dtype=np.float32))
        cursor += len(samples) / SAMPLE_RATE + gap

    sf.write(OUT_DIR / "vo.wav", np.concatenate(track), SAMPLE_RATE)
    (OUT_DIR / "vo.json").write_text(
        json.dumps({"voice": voice, "totalMs": round(cursor * 1000), "lines": timeline}, indent=2),
        encoding="utf-8",
    )
    print(f"\n  {cursor:.1f}s of narration in {voice} -> voice/out/vo.wav", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
