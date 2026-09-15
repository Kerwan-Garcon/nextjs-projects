# Recording the videos

Four, all produced by driving the real application rather than by editing
footage: a **product walkthrough**, a **narrated tour**, and two **narrated
films** — one on the platform, one on the courses.

Nothing in any of them is staged. The walkthrough signs in, reads a problem,
posts a counterargument and runs the four-agent pipeline against the seeded
database; the agent findings on screen were computed while the camera was
rolling. The films are pages composed from the product's own design tokens and
its own screenshots — there is no stock footage and no generated imagery in
them, because the product's first rule is that nothing on screen should be
prettier than it is true.

## Prerequisites

```bash
pnpm db:reset && pnpm db:seed          # a known-good dataset
pnpm --filter @saveus/web build
pnpm --filter @saveus/web exec next start --port 3100
```

Post-production needs an ffmpeg with `libx264`, `libass` and `aac`. Playwright
bundles one, but it is built with nearly everything disabled, so point `FFMPEG`
at a full build.

## Walkthrough — 3:48, captioned, silent

```bash
pnpm video:demo
FFMPEG=... tools/video/postprod.sh \
  tools/video/out/demo-raw.webm tools/video/out/save-us-demo.mp4 tools/video/out/demo.ass
```

Captions are not written by hand against a stopwatch. The script records a beat
each time it narrates something, and the ASS track is generated from when those
beats actually fired — so re-recording on a slower machine re-times the captions
with it.

The walkthrough asserts its own navigation. A click that misses, or an agent run
that does not complete, fails the recording rather than producing a confident
video of a page where nothing happened. That is not hypothetical: the first two
takes did exactly that, because driving the mouse by coordinate does not wait
for hydration and does not notice the sticky header sitting over the button.

## Tour — 0:55, narrated, scored, and it is the real app

The one that answers "what does it actually do". Not a composed page: the
application, driven by a real cursor, with the narration cut over it. It opens
a problem, opens a hypothesis, reads the evidence both ways, then goes into the
courses — opens a course, opens a lesson, and answers a question wrong on
purpose so the explanation is on screen while the voice says a wrong answer
costs nothing.

```bash
pnpm video:voice tour
pnpm video:tour
FFMPEG=... tools/video/postprod.sh \
  tools/video/out/tour-raw.webm tools/video/out/tour-silent.mp4 "" "$LEAD"
FFMPEG=... tools/video/mix.sh \
  tools/video/out/tour-silent.mp4 tools/video/out/save-us-tour.mp4 tour
```

The schedule is the boss here too. Each beat of `audio/script.tour.json` owns a
slice of wall-clock time; its action is handed a `left()` telling it how much of
that slice is left, and every scroll sizes itself from that rather than from a
constant — so a page turn that takes longer than usual is absorbed by the next
scroll instead of pushing the whole tour behind the voice. The take prints its
spare time per beat and fails outright if the picture ever falls more than 1.4 s
behind.

Beats are anchored to what they are talking about, not to a scroll distance. The
first take glided a fixed 980 px through a lesson and sailed straight past the
three typed statements while the narration was describing them; it now scrolls
to the first statement and drifts across the others. A distance that happens to
frame the right thing today is a caption that lies after the next copy edit.

## Films — narrated, scored

Two of them, out of one pipeline. A **cut** is a page (`<cut>.html`) and a
narration (`audio/script.<cut>.json`). Everything else — the stage in
`stage.css`, the projector in `stage.js`, the recorder, the mix — is shared,
which is what keeps two films looking like one product rather than two.

| Cut     | Length | What it is                                                        |
| ------- | ------ | ----------------------------------------------------------------- |
| `film`  | 0:53   | The platform: the board, the epistemic layer, the agents, intake. |
| `learn` | 0:52   | The courses: what they are, and what they deliberately do not do. |

(`tour` is a cut too — it shares the voice and the score, but its picture is the
live application rather than a page, so it has `tour.mjs` instead of an HTML
file and is documented above.)

```bash
pnpm video:shots                       # stills, from the running app
pnpm video:voice learn                 # narration, then the score
pnpm video:preview learn               # one PNG per scene, to review the cut
pnpm video:film learn
FFMPEG=... tools/video/postprod.sh \
  tools/video/out/learn-raw.webm tools/video/out/learn-silent.mp4 "" "$LEAD"
FFMPEG=... tools/video/mix.sh \
  tools/video/out/learn-silent.mp4 tools/video/out/save-us-learn.mp4 learn
```

`$LEAD` is `leadMs` from `tools/video/out/<cut>.timing.json`, in seconds. Drop
the cut from every command to get `film`, which is what they default to.

The courses film renders a statement the way the product renders one, in the
same colours — including an UNKNOWN, held on screen for its own beat. Leaving
the admitted gaps out of a promotional film would be the first step towards
exactly the thing the product exists to avoid.

**The voice is cut first and the picture follows it.** `audio/tts.py`
synthesises each line of `audio/script.<cut>.json` with Kokoro-82M, trims the
silence Kokoro leaves at the ends, and writes `out/<cut>/vo.json` — every line
with the duration it actually came out at. The page fetches that file, working
out which cut it is from its own filename, and holds each scene for its line.
Editing a sentence and re-running the voice re-cuts the film; nobody touches a
timeline.

Three things that are easy to get wrong and are handled here:

- **The schedule is absolute.** `setTimeout` only promises "no sooner than", and
  the DOM work between scenes costs a few milliseconds more, so eleven chained
  `await sleep(hold)` calls finish seconds late — which plays as the voice
  running ahead of the picture.
- **The lead-in is measured and trimmed.** Recording starts when the page opens,
  but the film cannot start until it has loaded, and that dead footage would put
  the picture behind the narration by however long the load took.
- **The outgoing scene is captured by value.** An arrow function closing over the
  loop variable fires half a second later against whatever it points at by then,
  which is the scene that just came up — a film where the first shot never leaves
  and nothing after it stays longer than half a second.

### The voice

Kokoro-82M, Apache-2.0, run locally. The weights (~330 MB) are fetched once into
`audio/model/`, which is not tracked. The quantised builds segfault under
onnxruntime 1.30; the full-precision model is used instead and still synthesises
a minute of speech in well under a minute.

Local rather than hosted for a reason that matters here: the film's timing is
derived from the voice, so the voice has to be regenerable. Swap it with
`python3 tools/video/audio/tts.py film am_fenrir` — the film re-times itself on
the next take.

### The score

`audio/music.py` synthesises it from scratch, as a function of the running time,
so it is always exactly as long as the film it is under. A low drone, a pad through
i–VI–III–VII in A minor, a pulse that waits for the narration to start, and a
pentatonic motif on a struck-metal voice. `mix.sh` ducks it under the voice with
a real sidechain compressor rather than a static level, and normalises the result
to −16 LUFS, which is what the social platforms target.

## Environment

| Variable                   | Purpose                                                               |
| -------------------------- | --------------------------------------------------------------------- |
| `DEMO_BASE`                | Where the app is running. Default `http://127.0.0.1:3100`.             |
| `PLAYWRIGHT_CHROMIUM_PATH` | Override the browser binary when Playwright's own resolution is wrong. |
| `FFMPEG`                   | Full ffmpeg build for `postprod.sh` and `mix.sh`.                      |

Output lands in `tools/video/out/`, which is not tracked. Both films encode at
the recording size rather than upscaling: pushing the 1600x900 capture to 1080p
made the file two and a half times larger and no sharper, because there was no
extra detail to carry.
