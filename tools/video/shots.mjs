import { launch } from './lib.mjs';
import { mkdirSync } from 'node:fs';

/** Stills for the reel. Real pages, real data, no retouching. */
const BASE = process.env.DEMO_BASE ?? 'http://127.0.0.1:3100';
const OUT = new URL('./shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await launch();
const page = await browser.newPage({
  viewport: { width: 1000, height: 1000 },
  deviceScaleFactor: 2,
});

async function shot(path, name) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: true });
  console.log(`${name}  ${path}`);
}

await shot('/problems', 'board');

// Whichever hypothesis the seed produced first; the reel only pans over it.
await page.goto(`${BASE}/problems/reducing-extreme-heat-mortality-in-paris`, {
  waitUntil: 'networkidle',
});
const href = await page.locator('a[href^="/hypotheses/"]').first().getAttribute('href');
await shot(href, 'hypothesis');

await shot('/research', 'research');

// The courses. The lesson chosen is the one that teaches the epistemic layer,
// so the shot shows the notation the film is about to claim it is written in.
await shot('/learn', 'learn-index');
await shot('/learn/what-counts-as-a-problem', 'learn-course');
await shot('/learn/what-counts-as-a-problem/six-kinds-of-statement', 'learn-lesson');

await browser.close();
