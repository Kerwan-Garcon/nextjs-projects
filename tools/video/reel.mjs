import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { extname, join } from 'node:path';
import { FRAME, launch } from './lib.mjs';

/**
 * Record the promotional reel.
 *
 * The reel is a real page, animated in the browser, composed from the product's
 * own tokens and its own screenshots. Recording it rather than assembling it in
 * an editor means the timing in the file is the timing on screen.
 */

const DIR = new URL('.', import.meta.url).pathname;
const OUT = join(DIR, 'out');
const { width: W, height: H } = FRAME;

mkdirSync(join(OUT, 'raw-reel'), { recursive: true });

// The reel is composed from real screenshots. Without them it would record a
// page full of broken images, which is exactly the kind of thing that ships.
for (const still of ['board.png', 'hypothesis.png']) {
  if (!existsSync(join(DIR, 'shots', still))) {
    throw new Error(`tools/video/shots/${still} is missing - run \`node tools/video/shots.mjs\` first`);
  }
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.css': 'text/css',
};

const server = createServer(async (req, res) => {
  const path = join(DIR, decodeURIComponent((req.url ?? '/').split('?')[0]));
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

const browser = await launch();
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  recordVideo: { dir: join(OUT, 'raw-reel'), size: { width: W, height: H } },
});
const page = await context.newPage();

try {
  await page.goto(`http://127.0.0.1:${port}/reel.html`, { waitUntil: 'networkidle' });
  // Let fonts settle before the first frame, or scene one types into a reflow.
  await page.waitForTimeout(900);

  const total = await page.evaluate(() => window.__reelTotal);
  console.log(`playing ${(total / 1000).toFixed(1)}s of reel`);

  await page.evaluate(() => window.__playReel());
  await page.waitForFunction(() => window.__reelDone === true, null, { timeout: total + 30_000 });
  // Hold the end card for a beat rather than cutting on the last frame.
  await page.waitForTimeout(1200);
} finally {
  await context.close();
  await browser.close();
  server.close();

  const file = readdirSync(join(OUT, 'raw-reel')).find((f) => f.endsWith('.webm'));
  if (file) renameSync(join(OUT, 'raw-reel', file), join(OUT, 'reel-raw.webm'));
  console.log('done');
}
