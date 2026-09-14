import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { FRAME, launch } from './lib.mjs';

/** One still per scene, so the reel can be reviewed before it is recorded. */
const DIR = new URL('.', import.meta.url).pathname;
mkdirSync(join(DIR, 'preview'), { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const path = join(DIR, decodeURIComponent((req.url ?? '/').split('?')[0]));
  // Read first: writing the header before the read means a miss cannot answer 404.
  const body = await readFile(path).catch(() => null);
  if (!body) return void res.writeHead(404).end('not found');
  res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
  res.end(body);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));

const browser = await launch();
const page = await browser.newPage({ viewport: { ...FRAME } });
await page.goto(`http://127.0.0.1:${server.address().port}/reel.html`, { waitUntil: 'networkidle' });

for (let i = 1; i <= 10; i += 1) {
  await page.evaluate((n) => {
    document.querySelectorAll('.scene').forEach((s) => s.classList.remove('on'));
    const el = document.getElementById('s' + n);
    el.querySelectorAll('.up, .pan img').forEach((node) => { node.style.animation = 'none'; });
    el.classList.add('on');
    document.getElementById('wm').classList.toggle('hidden', n === 10);
    if (n === 7) document.querySelectorAll('#s7 .seg').forEach((s) => { s.style.width = s.dataset.w + '%'; });
    if (n === 1) { document.getElementById('t1').textContent = 'AI might destroy us.'; document.getElementById('t2').textContent = "Let's make it save us first."; }
  }, i);
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(DIR, 'preview', `s${String(i).padStart(2, '0')}.png`) });
}
await browser.close();
server.close();
console.log('previewed 10 scenes');
