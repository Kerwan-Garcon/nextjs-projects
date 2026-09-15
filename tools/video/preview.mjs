import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { FRAME, launch } from './lib.mjs';

/**
 * One still per scene of a film, so it can be reviewed before it is recorded.
 * Entrances are frozen at their end state and counters are jumped to their
 * final value: this is for checking composition and copy, not motion.
 *
 *   node tools/video/preview.mjs [cut]     # cut defaults to "film"
 */
const DIR = new URL('.', import.meta.url).pathname;
const CUT = process.argv[2] ?? 'film';
const PREVIEW = join(DIR, 'preview', CUT);
mkdirSync(PREVIEW, { recursive: true });

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};
const server = createServer(async (req, res) => {
  const path = join(DIR, decodeURIComponent((req.url ?? '/').split('?')[0]));
  const body = await readFile(path).catch(() => null);
  if (!body) return void res.writeHead(404).end('not found');
  res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
  res.end(body);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));

const browser = await launch();
const page = await browser.newPage({ viewport: { ...FRAME } });
await page.goto(`http://127.0.0.1:${server.address().port}/${CUT}.html`, {
  waitUntil: 'networkidle',
});
await page.waitForFunction(() => window.__filmReady === true, null, { timeout: 20_000 });

const ids = await page.evaluate(() =>
  [...document.querySelectorAll('.scene')].map((el) => el.dataset.line),
);

for (const [index, id] of ids.entries()) {
  await page.evaluate((line) => {
    document.querySelectorAll('.scene').forEach((s) => s.classList.remove('on'));
    const el = document.querySelector(`.scene[data-line="${line}"]`);
    el.classList.add('on');
    el.querySelectorAll('.rise, .w').forEach((n) => { n.style.transition = 'none'; });
    el.querySelectorAll('[data-count]').forEach((n) => { n.textContent = n.dataset.count; });
    document.getElementById('wm').classList.toggle('hide', line === 'sign');
    document.getElementById('br').classList.toggle('hide', line === 'sign');
  }, id);
  await page.waitForTimeout(420);
  await page.screenshot({
    path: join(PREVIEW, `${String(index + 1).padStart(2, '0')}-${id}.png`),
  });
}

await browser.close();
server.close();
console.log(`previewed ${ids.length} scenes -> tools/video/preview/${CUT}/`);
