import { expect, test } from '@playwright/test';

/**
 * The on-ramp.
 *
 * What this suite has to keep honest is that the courses are genuinely open -
 * readable end to end with no account - and that they are written in the same
 * notation as the rest of the product rather than being prose with a quiz
 * bolted on: a claim carries its kind and a link to the publication it came
 * from, and finishing a lesson earns no reputation.
 */

const HANDLE = `learner-${Date.now().toString(36)}`;

test.describe.configure({ mode: 'serial' });

test('a visitor with no account can read a lesson end to end', async ({ page }) => {
  await page.goto('/learn');

  await expect(page.getByRole('heading', { name: 'Learn', exact: true })).toBeVisible();
  await expect(page.getByText('How to work here')).toBeVisible();
  await expect(page.getByText('The systems themselves')).toBeVisible();
  await expect(page.getByText(/Nothing here earns reputation/i)).toBeVisible();

  await page.getByRole('link', { name: /What counts as a problem/ }).first().click();
  await expect(page).toHaveURL(/\/learn\/what-counts-as-a-problem$/);
  await expect(page.getByText('What you can do afterwards')).toBeVisible();

  await page.getByRole('link', { name: /^Start ·/ }).click();
  await expect(page).toHaveURL(/\/learn\/what-counts-as-a-problem\/[a-z-]+$/);

  // The lesson is written in the epistemic layer, not around it.
  await expect(page.locator('text=SOURCE CLAIM').first()).toBeVisible();

  // And a citation is a link to the publisher, as everywhere else.
  const citation = page.locator('a[target="_blank"][rel*="noreferrer"]').first();
  await expect(citation).toBeVisible();
  await expect(citation).toHaveAttribute('href', /^https?:\/\//);

  // Without an account the check still works; only the record of it needs one.
  await expect(page.getByText(/Sign in.*to keep track of what you have read/i)).toBeVisible();
});

test('answering a question explains the answer rather than scoring it', async ({ page }) => {
  await page.goto('/learn/reading-evidence/saying-unknown');

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Check yourself')).toBeVisible();

  const firstQuestion = page.locator('div.border.border-line.bg-panel').filter({
    has: page.locator('button'),
  }).first();
  await firstQuestion.locator('button').first().click();

  await expect(firstQuestion.getByText('Why ·')).toBeVisible();
  await expect(page.getByText(/No score is recorded and no reputation is awarded/i)).toBeVisible();

  // The lesson ends by pointing at real, open problems.
  await expect(page.getByText('Where to put this')).toBeVisible();
  const problem = page.locator('a[href^="/problems/"]').first();
  await expect(problem).toBeVisible();
});

test('progress is recorded for a signed-in reader and earns no reputation', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Create a researcher account' }).click();
  await page.getByLabel('Handle').fill(HANDLE);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/my-work$/);

  const reputationBefore = await page
    .locator('div')
    .filter({ hasText: /^Reputation/ })
    .first()
    .innerText();

  await page.goto('/learn/reading-evidence/saying-unknown');

  // Answer every question, then mark it read.
  const questions = page.locator('div.border.border-line.bg-panel').filter({
    has: page.locator('button'),
  });
  const count = await questions.count();
  for (let index = 0; index < count; index += 1) {
    const buttons = questions.nth(index).locator('button');
    if ((await buttons.count()) > 0) await buttons.first().click();
  }

  const markRead = page.getByRole('button', { name: 'Mark as read' });
  await expect(markRead).toBeEnabled();
  await markRead.click();
  await expect(page.getByText('Marked as read')).toBeVisible();

  await page.goto('/my-work');
  await expect(page.getByText('Courses', { exact: true })).toBeVisible();
  await expect(page.getByText(/1\/\d+ lessons/)).toBeVisible();
  await expect(page.getByText(/Reading is not counted as reputation/i)).toBeVisible();

  const reputationAfter = await page
    .locator('div')
    .filter({ hasText: /^Reputation/ })
    .first()
    .innerText();
  expect(reputationAfter).toBe(reputationBefore);
});
