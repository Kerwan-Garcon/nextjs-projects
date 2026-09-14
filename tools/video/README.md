# Recording the videos

Two films, both produced by driving the real application rather than by
editing footage: a **product walkthrough** and a **promotional reel**.

Nothing in either is staged. The walkthrough signs in, reads a problem, posts a
counterargument and runs the four-agent pipeline against the seeded database;
the agent findings on screen were computed while the camera was rolling. The
reel is a page composed from the product's own design tokens and its own
screenshots — there is no stock footage and no generated imagery in it, because
the product's first rule is that nothing on screen should be prettier than it is
true.

## Prerequisites

```bash
pnpm db:reset && pnpm db:seed          # a known-good dataset
pnpm --filter @saveus/web build
pnpm --filter @saveus/web exec next start --port 3100
```

Post-production needs an ffmpeg with `libx264` and `libass`. Playwright bundles
one, but it is built with nearly everything disabled, so point `FFMPEG` at a
full build.

## Walkthrough

```bash
node tools/video/demo.mjs
FFMPEG=/path/to/ffmpeg tools/video/postprod.sh \
  tools/video/out/demo-raw.webm \
  tools/video/out/save-us-demo.mp4 \
  tools/video/out/demo.ass
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

## Reel

```bash
node tools/video/shots.mjs             # stills, from the running app
node tools/video/preview.mjs           # one PNG per scene, to review before recording
node tools/video/reel.mjs
FFMPEG=/path/to/ffmpeg tools/video/postprod.sh \
  tools/video/out/reel-raw.webm \
  tools/video/out/save-us-reel.mp4
```

`reel.html` is the film. Scene order and duration live in the `SCENES` array at
the bottom of it; everything else is CSS. Editing the copy means editing that
file and re-recording — which takes about ninety seconds and is the reason it is
built this way rather than in an editor.

## Environment

| Variable                     | Purpose                                                                  |
| ---------------------------- | ------------------------------------------------------------------------ |
| `DEMO_BASE`                  | Where the app is running. Default `http://127.0.0.1:3100`.                |
| `PLAYWRIGHT_CHROMIUM_PATH`   | Override the browser binary when Playwright's own resolution is wrong.    |
| `FFMPEG`                     | Full ffmpeg build for `postprod.sh`.                                      |

Output lands in `tools/video/out/`, which is not tracked.
