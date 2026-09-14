import { mkdirSync, writeFileSync, readdirSync, renameSync } from 'node:fs';
import {
  CURSOR,
  FRAME,
  clickOn,
  glide,
  launch,
  moveTo,
  sleep,
  timeline,
  toAss,
  toTop,
} from './lib.mjs';

/**
 * The product walkthrough.
 *
 * Everything on screen is the real application running against the seeded
 * database. Nothing is mocked, staged or sped up: the agent runs you see
 * complete in the time they actually take.
 */

const BASE = process.env.DEMO_BASE ?? 'http://127.0.0.1:3100';
const OUT = new URL('./out/', import.meta.url).pathname;
const { width: W, height: H } = FRAME;
const HANDLE = 'a-devi';

mkdirSync(`${OUT}raw-demo`, { recursive: true });

const browser = await launch();

const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  recordVideo: { dir: `${OUT}raw-demo`, size: { width: W, height: H } },
});
await context.addInitScript(CURSOR);

const started = Date.now();
const tl = timeline(started);
const page = await context.newPage();

try {
  /* ---------------------------------------------------------------- */
  /* 1. The premise                                                    */
  /* ---------------------------------------------------------------- */
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.mouse.move(W / 2, H - 120);
  tl.at('SAVE US — a laboratory for unsolved real-world problems.');
  await sleep(3400);
  await glide(page, 620, 3000);
  tl.at('Not a chatbot and not a feed. Humans and AI agents work the same record.');
  await sleep(3000);
  await glide(page, 700, 3000);
  await sleep(1600);

  /* ---------------------------------------------------------------- */
  /* 2. Sign in                                                        */
  /* ---------------------------------------------------------------- */
  tl.at('Signing in as a seeded researcher. No passwords — an author, not an identity document.');
  await page.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle' });
  await sleep(1600);

  const tile = page
    .locator('button')
    .filter({ has: page.getByText(HANDLE, { exact: true }) })
    .first();
  if (await tile.count()) await clickOn(page, tile, { settle: 600 });

  const handleField = page.locator('#handle');
  if ((await handleField.inputValue()) !== HANDLE) {
    await moveTo(page, handleField);
    await handleField.click();
    await handleField.fill('');
    await handleField.type(HANDLE, { delay: 60 });
  }
  await sleep(500);

  await clickOn(page, page.getByRole('button', { name: /^Sign in$/ }).first(), { settle: 2600 });
  await page.waitForURL(/\/my-work$/, { timeout: 20_000 });
  await sleep(1400);

  /* ---------------------------------------------------------------- */
  /* 3. The board                                                      */
  /* ---------------------------------------------------------------- */
  await page.goto(`${BASE}/problems`, { waitUntil: 'networkidle' });
  await sleep(900);
  tl.at('The home page is the global problem board. 21 open problems, each with a reference.');
  await sleep(3200);
  await glide(page, 780, 3400);
  tl.at('Difficulty, urgency, evidence count, active researchers — all derived, none decorative.');
  await sleep(3300);
  await toTop(page, 900);

  const energy = page.getByRole('button', { name: 'ENERGY', exact: true }).first();
  if (await energy.count()) {
    tl.at('Filter by domain.');
    await clickOn(page, energy, { settle: 2000 });
    await sleep(1600);
  }

  /* ---------------------------------------------------------------- */
  /* 4. A problem, stated properly                                     */
  /* ---------------------------------------------------------------- */
  await page.goto(`${BASE}/problems/reducing-extreme-heat-mortality-in-paris`, {
    waitUntil: 'networkidle',
  });
  await sleep(1000);
  tl.at('The problem page is the most important screen in the product.');
  await sleep(3000);
  await glide(page, 640, 3200);
  tl.at(
    'Every statement carries its epistemic kind. A SOURCE CLAIM and an UNKNOWN never look alike.',
  );
  await sleep(4200);
  await glide(page, 700, 3200);
  tl.at('Quantified consequences, each traceable to a real publication.');
  await sleep(3400);
  await glide(page, 760, 3200);
  tl.at('Constraints and measurable success criteria. A problem nobody can score is not stated.');
  await sleep(3800);
  await glide(page, 820, 3400);
  tl.at('Evidence: WHO, Santé publique France, IPCC. Reliability is graded, not assumed.');
  await sleep(3600);
  await glide(page, 820, 3400);
  await sleep(1400);

  /* ---------------------------------------------------------------- */
  /* 5. A hypothesis is an object you can attack                       */
  /* ---------------------------------------------------------------- */
  const hypothesis = page.locator('a[href^="/hypotheses/"]').first();
  tl.at('Hypotheses are structured objects, not comments.');
  await clickOn(page, hypothesis, { settle: 2400 });
  // A walkthrough that quietly stays on the previous page is worse than one
  // that fails, so every navigation is asserted.
  await page.waitForURL(/\/hypotheses\//, { timeout: 20_000 });
  await page.waitForLoadState('networkidle');
  const hypothesisUrl = page.url();
  await sleep(2200);

  await glide(page, 620, 3000);
  tl.at('Claim, mechanism, required assumptions, unknowns, risks — stated by the author up front.');
  await sleep(4000);
  await glide(page, 700, 3200);
  tl.at('Supporting evidence and contradicting evidence sit side by side. Neither is hidden.');
  await sleep(4000);
  await glide(page, 700, 3200);
  tl.at('Typed contributions. Attacking the idea is what earns standing.');
  await sleep(3600);

  /* ---------------------------------------------------------------- */
  /* 6. Contribute                                                     */
  /* ---------------------------------------------------------------- */
  const counter = page.getByRole('button', { name: 'Counterargument' }).first();
  await counter.waitFor({ state: 'visible', timeout: 15_000 });
  if (await counter.count()) {
    tl.at('Posting a counterargument.');
    await clickOn(page, counter, { settle: 700 });
    const field = page.getByPlaceholder('Which assumption fails');
    await moveTo(page, field);
    await field.click();
    await field.type(
      'The first assumption carries no source of its own and is doing all the work. If it fails only in this geography the expected impact collapses without the mechanism being wrong anywhere else.',
      { delay: 11 },
    );
    await sleep(900);
    tl.at('It is scored on six signals, and the reputation change is shown rather than hidden.');
    const post = page.getByRole('button', { name: 'Post contribution' }).first();
    await clickOn(page, post, { settle: 3200 });
    await sleep(2600);
  }

  /* ---------------------------------------------------------------- */
  /* 7. The agent pipeline, running for real                           */
  /* ---------------------------------------------------------------- */
  await page.goto(hypothesisUrl, { waitUntil: 'networkidle' });
  const actions = page.locator('section', { has: page.getByText('AI research actions') });
  await actions.waitFor({ state: 'visible', timeout: 20_000 });
  await actions.scrollIntoViewIfNeeded();
  await sleep(900);
  tl.at('AI is offered as contextual actions on the object in front of you — not one Ask AI box.');
  await sleep(3600);

  const review = actions.getByRole('button', { name: /Full research review/ }).first();
  tl.at('RESEARCHER → SKEPTIC → ENGINEER → SYNTHESIZER. Four narrow agents, in sequence.');
  await clickOn(page, review, { settle: 600 });

  const done = await page
    .locator('div', { has: page.getByText('Session complete', { exact: false }) })
    .first()
    .waitFor({ timeout: 90_000 })
    .then(() => true)
    .catch(() => false);

  if (done) {
    await sleep(1400);
    tl.at('This ran just now. The result is a brief that states what it does not know.');
    await sleep(3400);
    await glide(page, 560, 2800);
    await sleep(2600);
    tl.at('Every run shows its agent, its provider and model, its sources and its reasoning.');
    const researcherRun = page.getByRole('button', { name: /Researcher/ }).first();
    if (await researcherRun.count()) await clickOn(page, researcherRun, { settle: 2000 });
    await sleep(3600);
    await glide(page, 620, 3000);
    await sleep(2800);
  } else {
    throw new Error('the research action did not complete - refusing to ship a video of it failing');
  }

  /* ---------------------------------------------------------------- */
  /* 8. Where problems come from                                       */
  /* ---------------------------------------------------------------- */
  await page.goto(`${BASE}/research`, { waitUntil: 'networkidle' });
  await sleep(1000);
  tl.at('Research operations: every agent run, and the intake that proposes new problems.');
  await sleep(3200);
  await glide(page, 900, 3400);
  tl.at('Eleven narrow agents. Each declares the tools it may use and what it may write.');
  await sleep(3800);
  await glide(page, 1100, 3600);
  tl.at(
    'A scheduled pipeline reads WHO, UNEP, the EEA, Nature, The Lancet and Europe PMC every day.',
  );
  await sleep(4000);
  await glide(page, 800, 3200);
  tl.at('It queues a candidate with its failing checks attached. It cannot publish anything.');
  await sleep(3800);
  await glide(page, 900, 3400);
  tl.at('60 documents fetched, 1 queued. That is the filter working, and it shows what it refused.');
  await sleep(4200);

  /* ---------------------------------------------------------------- */
  /* 9. A human writes the problem                                     */
  /* ---------------------------------------------------------------- */
  await toTop(page, 900);
  await glide(page, 1900, 2600);
  const approve = page.getByRole('button', { name: 'Approve for editing' }).first();
  if (await approve.count()) {
    tl.at('A named curator approves — which unlocks an editor, and nothing else.');
    await clickOn(page, approve, { settle: 3000 });
  }
  const write = page.getByRole('link', { name: /Write the problem statement/i }).first();
  if (await write.count()) {
    await clickOn(page, write, { settle: 2600 });
    await page.waitForLoadState('networkidle');
    tl.at('The statement is written by a person. The checklist then runs again on the server.');
    await sleep(3800);
    await glide(page, 700, 3200);
    await sleep(3000);
  }

  /* ---------------------------------------------------------------- */
  /* 10. Standing                                                      */
  /* ---------------------------------------------------------------- */
  await page.goto(`${BASE}/leaderboard`, { waitUntil: 'networkidle' });
  await sleep(900);
  tl.at('Research reputation, per domain. Volume is damped; nobody validates their own work.');
  await sleep(3800);
  await glide(page, 700, 3200);
  await sleep(2600);

  await page.goto(`${BASE}/research/method`, { waitUntil: 'networkidle' });
  await sleep(900);
  tl.at('And the labelling itself is documented, in the product, for anyone to check.');
  await sleep(3600);
  await glide(page, 700, 3200);
  await sleep(3400);
} finally {
  const totalMs = Date.now() - started;
  await context.close();
  await browser.close();

  const file = readdirSync(`${OUT}raw-demo`).find((f) => f.endsWith('.webm'));
  if (file) renameSync(`${OUT}raw-demo/${file}`, `${OUT}demo-raw.webm`);
  writeFileSync(`${OUT}demo.beats.json`, JSON.stringify({ totalMs, beats: tl.beats }, null, 2));
  writeFileSync(`${OUT}demo.ass`, toAss(tl.beats, totalMs, { offsetMs: -150 }));
  console.log(`\nrecorded ${(totalMs / 1000).toFixed(1)}s, ${tl.beats.length} captions`);
}
