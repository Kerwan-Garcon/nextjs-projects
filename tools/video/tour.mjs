import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CURSOR, FRAME, clickOn, glide, glideTo, launch, moveTo, sleep } from './lib.mjs';

/**
 * The narrated tour.
 *
 * The third kind of recording here, and the one that answers "what does it
 * actually do": not a composed page like the films, and not a silent captioned
 * walkthrough like the demo, but the real application driven by a real cursor
 * with the narration cut over it.
 *
 * It follows the same rule as the films - the voice is recorded first and the
 * picture is cut to it - which here means the schedule is the boss. Each beat
 * of `audio/script.tour.json` owns a slice of wall-clock time; its action gets
 * that slice and no more, and every scroll is sized from the time actually
 * remaining rather than from a constant. That is what keeps a page turn from
 * pushing the whole tour behind the voice.
 *
 *   node tools/video/tour.mjs
 *
 * Nothing on screen is staged. The problems, the hypothesis, the evidence and
 * the lesson are whatever the seeded database holds, and if a click misses or a
 * page does not arrive the take fails rather than carrying on confidently over
 * a screen where nothing happened.
 */

const BASE = process.env.DEMO_BASE ?? 'http://127.0.0.1:3100';
const DIR = new URL('.', import.meta.url).pathname;
const OUT = join(DIR, 'out');
const RAW = join(OUT, 'raw-tour');
const { width: W, height: H } = FRAME;

/** How far behind the voice the picture may fall before the take is a lie. */
const MAX_DRIFT_MS = 1400;

const timing = JSON.parse(readFileSync(join(DIR, 'audio/out/tour/vo.json'), 'utf8'));

/**
 * One action per narrated line, in order.
 *
 * `left()` is the milliseconds remaining in this beat. Actions size themselves
 * from it so that an overrun earlier in the tour is absorbed by the next
 * scroll instead of accumulating into the end card.
 */
const BEATS = {
  async board(page, left) {
    await glide(page, 560, Math.max(600, left() * 0.75));
  },

  async problem(page, left) {
    await clickOn(page, page.locator('a[href^="/problems/"]').first(), { settle: 380 });
    await page.waitForURL(/\/problems\/[a-z0-9-]+$/, { timeout: 15_000 });
    // Why it matters, the constraints, and the criteria you would measure - the
    // three things that separate a problem from a topic.
    await glideTo(page, '#success-criteria', Math.max(900, left() * 0.8));
  },

  async hypothesis(page, left) {
    await clickOn(page, page.locator('a[href^="/hypotheses/"]').first(), { settle: 380 });
    await page.waitForURL(/\/hypotheses\//, { timeout: 15_000 });
    await glideTo(page, '#structure', Math.max(700, left() * 0.35));
    await glide(page, 620, Math.max(600, left() * 0.8));
  },

  async evidence(page, left) {
    await glideTo(page, '#evidence', Math.max(900, left() * 0.85));
  },

  async learn(page, left) {
    await clickOn(page, page.getByRole('link', { name: 'Learn', exact: true }), { settle: 380 });
    await page.waitForURL(/\/learn$/, { timeout: 15_000 });
    await glide(page, 260, Math.max(500, left() * 0.6));
  },

  async index(page, left) {
    await glide(page, 200, Math.max(400, left() * 0.45));
    await clickOn(page, page.locator('a[href^="/learn/"]').first(), { settle: 300 });
    await page.waitForURL(/\/learn\/[a-z-]+$/, { timeout: 15_000 });
  },

  async lesson(page) {
    // Named rather than indexed: this is the lesson that teaches the epistemic
    // layer, which is precisely what the next line of narration claims.
    await clickOn(page, page.getByRole('link', { name: /Six kinds of statement/ }), {
      settle: 260,
    });
    await page.waitForURL(/\/learn\/[a-z-]+\/six-kinds-of-statement$/, { timeout: 15_000 });
  },

  async notation(page, left) {
    // Down through the typed statements: a source claim with its publication,
    // an inference with its derivation, an admitted unknown. Anchored to the
    // first of them rather than to a scroll distance, because a distance that
    // happens to work today runs straight past them when the copy changes -
    // which is what the first take did, over a line claiming they were there.
    const statements = page.locator('div[style*="border-left"]');
    await glideTo(page, statements.first(), Math.max(700, left() * 0.42), 250);
    await glide(page, 300, Math.max(700, left() * 0.75));
  },

  async check(page, left) {
    await glideTo(page, page.getByText('Check yourself'), Math.max(500, left() * 0.3));
    // Deliberately the first option, which on this question is the wrong one:
    // the line being spoken is that a wrong answer costs nothing, and the film
    // should show that rather than assert it.
    await clickOn(page, page.locator('li > button').first(), { settle: 420 });
    await sleep(Math.max(0, Math.min(left() * 0.6, 900)));
  },

  async noxp(page, left) {
    await glideTo(page, page.getByText('No score is recorded'), Math.max(700, left() * 0.75), 520);
  },

  async endproblem(page, left) {
    await glideTo(page, page.getByText('Open problems'), Math.max(900, left() * 0.62), 260);
    await moveTo(page, page.locator('a[href^="/problems/"]').first()).catch(() => {});
  },

  async sign(page) {
    await page.evaluate(() => {
      const card = document.createElement('div');
      card.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:2147483640',
        'display:flex',
        'flex-direction:column',
        'align-items:center',
        'justify-content:center',
        'background:#07090b',
        'opacity:0',
        'transition:opacity .5s ease',
        'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
      ].join(';');
      card.innerHTML = `
        <div style="font-size:78px;letter-spacing:.36em;text-indent:.36em;
                    font-weight:500;color:#e4eaf0">SAVE US</div>
        <div style="width:150px;height:1px;background:#28323d;margin:38px 0"></div>
        <div style="font-size:19px;letter-spacing:.14em;color:#8b98a7">
          /learn &mdash; free, and it needs no account
        </div>`;
      document.documentElement.appendChild(card);
      requestAnimationFrame(() => {
        card.style.opacity = '1';
      });
    });
  },
};

mkdirSync(RAW, { recursive: true });

const browser = await launch();
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  recordVideo: { dir: RAW, size: { width: W, height: H } },
});
await context.addInitScript(CURSOR);

// Recording starts when the page opens, but the tour cannot start until the
// first screen has loaded. That gap is dead footage at the head of the file and
// is trimmed in post against the number measured here.
const openedAt = Date.now();
const page = await context.newPage();
let drift = 0;

try {
  await page.goto(`${BASE}/problems`, { waitUntil: 'networkidle' });
  await page.mouse.move(W / 2, H - 140);
  await sleep(900);

  const leadMs = Date.now() - openedAt;
  writeFileSync(
    join(OUT, 'tour.timing.json'),
    JSON.stringify({ leadMs, totalMs: timing.totalMs }, null, 2),
  );
  console.log(`cutting ${(timing.totalMs / 1000).toFixed(1)}s of picture to the narration`);
  console.log(`  ${leadMs}ms of lead-in to trim\n`);

  const startedAt = Date.now();
  let dueAt = 0;

  for (const line of timing.lines) {
    const action = BEATS[line.id];
    if (!action) throw new Error(`no action for narrated line "${line.id}"`);

    const beatStart = Date.now() - startedAt;
    dueAt += line.holdMs;
    const left = () => dueAt - (Date.now() - startedAt);

    await action(page, left);

    const over = -left();
    drift = Math.max(drift, over);
    console.log(
      `  ${(beatStart / 1000).toFixed(1).padStart(5)}s  ${line.id.padEnd(11)}` +
        `${over > 0 ? `over by ${(over / 1000).toFixed(2)}s` : `${(-over / 1000).toFixed(2)}s spare`}`,
    );

    const remaining = left();
    if (remaining > 0) await sleep(remaining);
  }

  await sleep(1000);

  if (drift > MAX_DRIFT_MS) {
    throw new Error(
      `the picture fell ${(drift / 1000).toFixed(2)}s behind the narration ` +
        `(limit ${MAX_DRIFT_MS / 1000}s). Shorten a beat's action or lengthen its line.`,
    );
  }
} finally {
  await context.close();
  await browser.close();

  const file = readdirSync(RAW).find((f) => f.endsWith('.webm'));
  if (file) renameSync(join(RAW, file), join(OUT, 'tour-raw.webm'));
  console.log(`\nrecorded -> out/tour-raw.webm  (worst drift ${(drift / 1000).toFixed(2)}s)`);
}
