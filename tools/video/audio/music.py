#!/usr/bin/env python3
"""
The score, synthesised from scratch.

Not a licensing dodge - a practical one. The film's timing comes from the
narration, so the narration changes whenever the copy does, and a fixed track
would then be the wrong length. This is written as a function of the running
time, so it is always exactly as long as the film.

The brief it is written to is the product's own: restrained, warm, no drama.
A low drone, a pad moving through i - VI - III - VII in A minor, a pulse that
arrives once the film has started talking, and a pentatonic motif on a
struck-metal voice. Nothing swells, because nothing here is a breakthrough.

    python3 tools/video/audio/music.py [cut]           # cut defaults to "film"
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).parent
CUTS_DIR = HERE / "out"

RATE = 48_000
BPM = 76.0
BEAT = 60.0 / BPM
BAR = BEAT * 4

A = 220.0  # A3, the tonal centre


def note(semitones: float, octave: int = 0) -> float:
    return A * (2 ** (semitones / 12.0)) * (2**octave)


# i - VI - III - VII. Warm, and it never resolves upward, which suits the subject.
PROGRESSION = [
    ("Am", [note(0, -1), note(0), note(3), note(7)]),
    ("F", [note(-4, -1), note(-4), note(0), note(5)]),
    ("C", [note(3, -1), note(3), note(7), note(12)]),
    ("G", [note(-2, -1), note(-2), note(3), note(10)]),
]

# A minor pentatonic: A C D E G.
MOTIF = [note(0, 1), note(3, 1), note(7, 1), note(5, 1), note(3, 1), note(0, 1), note(10), note(3, 1)]


def envelope(length: int, attack: float, release: float, sustain: float = 1.0) -> np.ndarray:
    """Linear attack, flat body, cosine release. Cheap and it does not click."""
    env = np.full(length, sustain, dtype=np.float32)
    a = min(int(attack * RATE), length)
    r = min(int(release * RATE), length - a)
    if a:
        env[:a] *= np.linspace(0.0, 1.0, a, dtype=np.float32)
    if r:
        env[length - r :] *= (np.cos(np.linspace(0, np.pi, r, dtype=np.float32)) + 1) / 2
    return env


def place(track: np.ndarray, signal: np.ndarray, at: float) -> None:
    start = int(at * RATE)
    if start >= len(track):
        return
    end = min(len(track), start + len(signal))
    track[start:end] += signal[: end - start]


def pad(freqs: list[float], duration: float) -> np.ndarray:
    """Slow, breathing chord. Detuned pairs so it moves without vibrato."""
    t = np.arange(int(duration * RATE), dtype=np.float32) / RATE
    out = np.zeros_like(t)
    for index, freq in enumerate(freqs):
        for detune, weight in ((0.0, 1.0), (0.6, 0.55), (-0.5, 0.5)):
            phase = 2 * np.pi * (freq + detune) * t
            out += weight * np.sin(phase) / (index + 1.6)
        # A little second partial keeps it from sounding like a test tone.
        out += 0.12 * np.sin(2 * np.pi * freq * 2 * t) / (index + 2.0)
    drift = 1 + 0.03 * np.sin(2 * np.pi * 0.07 * t)
    return (out * envelope(len(t), 1.6, 2.2) * drift * 0.055).astype(np.float32)


def bell(freq: float, duration: float, gain: float = 1.0) -> np.ndarray:
    """Struck metal: a few inharmonic partials, each decaying at its own rate."""
    t = np.arange(int(duration * RATE), dtype=np.float32) / RATE
    out = np.zeros_like(t)
    for ratio, weight, decay in ((1.0, 1.0, 2.6), (2.01, 0.34, 4.2), (2.99, 0.16, 6.5), (4.2, 0.07, 9.0)):
        out += weight * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-decay * t)
    attack = envelope(len(t), 0.004, 0.05)
    return (out * attack * 0.085 * gain).astype(np.float32)


def pulse(gain: float = 1.0) -> np.ndarray:
    """A soft heartbeat, not a kick drum."""
    duration = 0.26
    t = np.arange(int(duration * RATE), dtype=np.float32) / RATE
    sweep = 92 * np.exp(-14 * t) + 46
    body = np.sin(2 * np.pi * np.cumsum(sweep) / RATE) * np.exp(-11 * t)
    return (body * 0.16 * gain).astype(np.float32)


def sub(duration: float) -> np.ndarray:
    """The floor. Barely audible on a laptop, felt on anything else."""
    t = np.arange(int(duration * RATE), dtype=np.float32) / RATE
    tone = np.sin(2 * np.pi * note(0, -2) * t) + 0.3 * np.sin(2 * np.pi * note(0, -1) * t)
    breath = 1 + 0.12 * np.sin(2 * np.pi * 0.05 * t)
    return (tone * envelope(len(t), 3.0, 4.0) * breath * 0.05).astype(np.float32)


def compose(duration: float, speaks_at: float, lifts_at: float) -> np.ndarray:
    """
    `speaks_at` is when the narration starts - the pulse waits for it, so the
    cold open is only a drone. `lifts_at` is the last act, where the motif
    doubles an octave up.
    """
    total = int((duration + 2.5) * RATE)
    track = np.zeros(total, dtype=np.float32)

    place(track, sub(duration + 1.5), 0.0)

    # Pad: four bars per chord, cycling.
    chord_len = BAR * 4
    position, index = 0.0, 0
    while position < duration:
        _, freqs = PROGRESSION[index % len(PROGRESSION)]
        place(track, pad(freqs, chord_len + 1.4), position)
        position += chord_len
        index += 1

    # Pulse on beats one and three, once the voice is in.
    beat_index = 0
    position = speaks_at
    while position < duration - 1.0:
        if beat_index % 2 == 0:
            ramp = min(1.0, (position - speaks_at) / 6.0)
            place(track, pulse(0.85 * ramp), position)
        position += BEAT
        beat_index += 1

    # Motif: one note every two beats, an octave pair once it lifts.
    position = speaks_at + BAR
    step = 0
    while position < duration - 0.6:
        freq = MOTIF[step % len(MOTIF)]
        near_end = position > lifts_at
        place(track, bell(freq, 2.4, 0.9 if not near_end else 1.0), position)
        if near_end and step % 2 == 0:
            place(track, bell(freq * 2, 1.8, 0.4), position)
        position += BEAT * 2
        step += 1

    # One struck note to open on, and one to close.
    place(track, bell(note(0, 1), 3.2, 1.25), 0.15)
    place(track, bell(note(0), 4.5, 1.1), duration - 1.2)
    place(track, bell(note(7), 4.5, 0.7), duration - 1.05)

    peak = float(np.max(np.abs(track))) or 1.0
    track = track / peak * 0.62

    # Faint stereo width: the pad leans, the low end stays centred.
    delay = int(0.011 * RATE)
    right = np.concatenate([np.zeros(delay, dtype=np.float32), track[:-delay]])
    return np.stack([track, 0.82 * right + 0.18 * track], axis=1)


def main() -> int:
    cut = sys.argv[1] if len(sys.argv) > 1 else "film"
    out = CUTS_DIR / cut
    vo = out / "vo.json"
    if not vo.exists():
        print(f"no narration for cut {cut!r}: run tts.py {cut} first")
        return 1

    timing = json.loads(vo.read_text(encoding="utf-8"))
    duration = timing["totalMs"] / 1000.0

    # The first line is the cold open; the pulse joins on the second.
    speaks_at = timing["lines"][1]["startMs"] / 1000.0
    # Which beat the motif doubles on is a property of the film, so the script
    # names it rather than this file knowing one film's scene ids.
    spec = json.loads((HERE / f"script.{cut}.json").read_text(encoding="utf-8"))
    lifts_at = next(
        (
            line["startMs"] / 1000.0
            for line in timing["lines"]
            if line["id"] == spec.get("liftsAt")
        ),
        duration * 0.75,
    )

    sf.write(out / "music.wav", compose(duration, speaks_at, lifts_at), RATE)
    print(f"  {duration + 2.5:.1f}s of score -> audio/out/{cut}/music.wav")
    print(f"  pulse from {speaks_at:.1f}s, lift from {lifts_at:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
