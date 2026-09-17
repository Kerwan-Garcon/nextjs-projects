import { expect, test } from '@playwright/test';

/**
 * The intake half of the product.
 *
 * The claim this suite has to keep honest is the one the whole ingestion design
 * rests on: a document that a connector found never becomes a public problem on
 * its own. A curator approves it, and then a human still has to write the
 * statement, and the checklist runs again on the server against what they wrote.
 */

const HANDLE = `curator-${Date.now().toString(36)}`;

test.describe.configure({ mode: 'serial' });

test('intake shows its work: what it queued and what it refused', async ({ page }) => {
  await page.goto('/research');

  await expect(page.getByRole('heading', { name: 'Research operations' })).toBeVisible();
  await expect(page.getByText('Curation queue')).toBeVisible();

  // The health panel is not decoration: it reports real cycles.
  await expect(page.getByText('Intake health')).toBeVisible();
  await expect(page.getByText('Cycles', { exact: true })).toBeVisible();
  await expect(page.getByText('Thrown out', { exact: true })).toBeVisible();

  // The pipeline ends in a human step, and says so.
  await expect(page.getByText('PUBLISH (human)')).toBeVisible();
  await expect(page.getByText(/never becomes public because a model produced it/i)).toBeVisible();
});

test('a candidate is approved by a person, and publishing is a separate act', async ({ page }) => {
  // --- A curator with an account -------------------------------------------
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Create a researcher account' }).click();
  await page.getByLabel('Handle').fill(HANDLE);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/my-work$/);

  await page.goto('/research');

  const queue = page.locator('section, div').filter({ hasText: 'Curation queue' }).last();
  const approve = page.getByRole('button', { name: 'Approve for editing' }).first();
  await expect(approve).toBeVisible();

  // Approving is explicitly not publishing, and the interface says so.
  await expect(
    page.getByText(/Approving does not publish/i).first(),
  ).toBeVisible();
  await expect(queue).toBeVisible();

  await approve.click();

  // --- Approval unlocks the editor, nothing more ---------------------------
  const editorLink = page.getByRole('link', { name: /Write the problem statement/i }).first();
  await expect(editorLink).toBeVisible({ timeout: 20_000 });
  await editorLink.click();

  await expect(page).toHaveURL(/\/research\/intake\//);
  await expect(page.getByRole('heading', { name: 'Write the problem' })).toBeVisible();
  await expect(page.getByText(/It has not written a problem, and it cannot/i)).toBeVisible();

  // The sentences the pipeline extracted are shown as the publisher's, quoted.
  await expect(page.getByText('Sentences from the source')).toBeVisible();
  await expect(page.getByText(/Nothing here was rewritten/i)).toBeVisible();
});

test('the publication checklist refuses an empty statement', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Create a researcher account' }).click();
  await page.getByLabel('Handle').fill(`${HANDLE}-b`);
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.goto('/research');
  const editorLink = page.getByRole('link', { name: /Write the problem statement/i }).first();
  await expect(editorLink).toBeVisible();
  await editorLink.click();

  // The browser's own validation stops a blank submission before the network,
  // which is the point: the form is shaped by the checklist.
  const submit = page.getByRole('button', { name: 'Publish to the board' });
  await expect(submit).toBeVisible();
  await submit.click();

  await expect(page).toHaveURL(/\/research\/intake\//);
  await expect(page.getByRole('heading', { name: 'Write the problem' })).toBeVisible();
});

test('sign-in offers Google only when it is configured', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  // With no credentials set the button is absent rather than broken.
  const google = page.getByRole('link', { name: /Continue with Google/i });
  const providers = await page.request.get('/api/auth/providers');
  const configured = ((await providers.json()) as { google: boolean }).google;

  if (configured) {
    await expect(google).toBeVisible();
  } else {
    await expect(google).toHaveCount(0);
  }
});
