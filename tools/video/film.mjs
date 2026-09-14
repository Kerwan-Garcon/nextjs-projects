import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { FRAME, launch } from './lib.mjs';

/**
 * Record the film.
 *
 * The page cuts itself to `audio/out/vo.json`, so this only has to press play
 * and wait. Recording the animation rather than assembling it in an editor
 * means the timing in the file is the timing on screen, and an edit to the
 * narration re-cuts the picture without anybody touching a timeline.
 */

const DIR = new URL('.', import.meta.url).pathname;
const OUT = join(DIR, 'out');
const { width: W, height: H } = FRAME;

for (const required of ['shots/board.png', 'audio/out/vo.json']) {
  if (!existsSync(join(DIR, required))) {
    throw new Error(
      `tools/video/${required} is missing - run shots.mjs and audio/tts.py first`,
    );
  }
}

mkdirSync(join(OUT, 'raw-film'), { recursive: true });

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json',
};

const server = createServer(async (req, res) => {
  const path = join(DIR, decodeURIComponent((req.url ?? '/').split('?')[0]));
  const body = await readFile(path).catch(() => null);
  if (!body) return void res.writeHead(404).end('not found');
  res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
  res.end(body);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

const browser = await launch();
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  recordVideo: { dir: join(OUT, 'raw-film'), size: { width: W, height: H } },
});
// Recording starts when the page opens, but the film cannot start until the
// page has loaded and settled. That gap is dead footage at the head of the
// file, and leaving it there puts the picture behind the narration by however
// long the load took. It is measured here and trimmed in post.
const openedAt = Date.now();
const page = await context.newPage();

try {
  await page.goto(`http://127.0.0.1:${server.address().port}/film.html`, {
    waitUntil: 'networkidle',
  });
  await page.waitForFunction(() => window.__filmReady === true, null, { timeout: 20_000 });

  const failure = await page.evaluate(() => window.__filmError ?? null);
  if (failure) throw new Error(failure);

  const total = await page.evaluate(() => window.__filmTotal);
  console.log(`cutting ${(total / 1000).toFixed(1)}s of picture to the narration`);

  // Let the first frame settle so the cold open does not start mid-reflow.
  await page.waitForTimeout(700);

  const leadMs = Date.now() - openedAt;
  writeFileSync(join(OUT, 'film.timing.json'), JSON.stringify({ leadMs, totalMs: total }, null, 2));
  console.log(`  ${leadMs}ms of lead-in to trim`);

  await page.evaluate(() => window.__playFilm());
  await page.waitForFunction(() => window.__filmDone === true, null, { timeout: total + 30_000 });
  await page.waitForTimeout(900);
} finally {
  await context.close();
  await browser.close();
  server.close();

  const file = readdirSync(join(OUT, 'raw-film')).find((f) => f.endsWith('.webm'));
  if (file) renameSync(join(OUT, 'raw-film', file), join(OUT, 'film-raw.webm'));
  console.log('recorded');
}
