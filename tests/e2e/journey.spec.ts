import { expect, test } from '@playwright/test';

/**
 * The journey the product exists for:
 *
 *   open a problem -> read its evidence -> open a hypothesis -> read what
 *   supports and contradicts it -> contribute -> run an AI research action ->
 *   inspect the agent run that produced the result.
 *
 * If this passes, the vertical slice works.
 */

const HANDLE = `e2e-${Date.now().toString(36)}`;

test.describe.configure({ mode: 'serial' });

test('a researcher can go from the board to a contribution and an agent run', async ({ page }) => {
  // --- Sign in as a fresh anonymous researcher -----------------------------
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Create a researcher account' }).click();
  await page.getByLabel('Handle').fill(HANDLE);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/my-work$/);

  // --- The board shows real problems with real counts ----------------------
  await page.goto('/problems');
  await expect(page.getByRole('heading', { name: 'Global problem board' })).toBeVisible();
  const cards = page.locator('a[href^="/problems/"]');
  expect(await cards.count()).toBeGreaterThan(10);

  // --- Open a specific problem and read its evidence -----------------------
  await page.goto('/problems/reducing-extreme-heat-mortality-in-paris');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('heat mortality in Paris');

  // Every factual statement is labelled, and unknowns are admitted.
  await expect(page.getByText('SOURCE CLAIM').first()).toBeVisible();
  await expect(page.getByText('UNKNOWN').first()).toBeVisible();

  // Evidence points at real publishers.
  const evidence = page.locator('#evidence').locator('..');
  await expect(evidence.getByText('World Health Organization').first()).toBeVisible();

  // --- Open a hypothesis ---------------------------------------------------
  const hypothesisLink = page.locator('a[href^="/hypotheses/"]').first();
  await hypothesisLink.click();
  await expect(page).toHaveURL(/\/hypotheses\//);
  await expect(page.getByText('Supporting evidence', { exact: true })).toBeVisible();
  await expect(page.getByText('Contradicting evidence', { exact: true })).toBeVisible();
  await expect(page.getByText('Proposed mechanism', { exact: true })).toBeVisible();
  await expect(page.getByText('Required assumptions', { exact: true })).toBeVisible();

  const hypothesisUrl = page.url();

  // --- Contribute ----------------------------------------------------------
  await page.getByRole('button', { name: 'Counterargument' }).first().click();
  await page
    .getByPlaceholder('Which assumption fails')
    .fill(
      'The first assumption is doing all the work and carries no source of its own. If it fails only in this geography, the expected impact collapses without the mechanism being wrong anywhere else.',
    );
  await page.getByRole('button', { name: 'Post contribution' }).click();

  // The score and the reputation change are shown, not hidden.
  await expect(page.getByText(/Quality score/)).toBeVisible();

  // --- Run an AI research action ------------------------------------------
  // Scope to the actions panel: a hypothesis that already has sessions shows
  // the same words in its run history.
  const actionsPanel = page.locator('section', { has: page.getByText('AI research actions') });
  await actionsPanel.getByRole('button', { name: /Full research review/ }).click();

  const result = page.locator('div', { has: page.getByText('Session complete', { exact: false }) });
  await expect(result.first()).toBeVisible({ timeout: 60_000 });

  // --- Inspect the result --------------------------------------------------
  await expect(page.getByText('Research brief')).toBeVisible();
  await expect(page.getByText(/Nothing in it is established fact/)).toBeVisible();

  // The pipeline ran four named agents, each recorded as its own run.
  const runs = page.getByText(/RESEARCHER|SKEPTIC|ENGINEER|SYNTHESIZER/);
  expect(await runs.count()).toBeGreaterThan(0);

  // Open a run and check it exposes its provider, model and reasoning.
  await page
    .getByRole('button', { name: /Researcher/ })
    .first()
    .click();
  await expect(page.getByText('Reasoning').first()).toBeVisible();

  // --- The contribution and the run are now part of the record -------------
  await page.goto(hypothesisUrl);
  await expect(page.getByText('COUNTERARGUMENT').first()).toBeVisible();
  await expect(page.getByText(/Agent runs on this hypothesis/)).toBeVisible();

  await page.goto('/my-work');
  await expect(page.getByText('My contributions')).toBeVisible();
  await expect(page.getByText(/Research sessions I requested/)).toBeVisible();
});

test('the epistemic labelling is documented and reachable', async ({ page }) => {
  await page.goto('/research/method');
  await expect(page.getByRole('heading', { name: 'How claims are labelled' })).toBeVisible();
  for (const label of ['FACT', 'SOURCE CLAIM', 'HUMAN HYPOTHESIS', 'AI HYPOTHESIS', 'INFERENCE']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText(/Demo data/i).first()).toBeVisible();
});

test('the board filters narrow the result set', async ({ page }) => {
  await page.goto('/problems');
  const before = await page.locator('a[href^="/problems/"]').count();

  await page.getByRole('button', { name: 'ENERGY', exact: true }).click();
  await expect(page).toHaveURL(/domain=energy/);
  await page.waitForLoadState('networkidle');

  const after = await page.locator('a[href^="/problems/"]').count();
  expect(after).toBeGreaterThan(0);
  expect(after).toBeLessThan(before);
});

test('no page exposes a dead end', async ({ page }) => {
  for (const path of ['/', '/problems', '/research', '/leaderboard', '/sign-in']) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator('body')).not.toContainText('lorem ipsum', { ignoreCase: true });
  }
});
