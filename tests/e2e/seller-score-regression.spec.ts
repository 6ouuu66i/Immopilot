import { expect, test, type Page } from '@playwright/test';

function credentials() {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error('Set E2E_EMAIL and E2E_PASSWORD before running npm test.');
  }

  return { email, password };
}

async function login(page: Page) {
  const { email, password } = credentials();

  await page.goto('/#login');
  await page.getByPlaceholder('agent@agence.be').fill(email);
  await page.getByPlaceholder('Votre mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.locator('a.ip-sidebar-link[href="#biens"]').first()).toBeVisible();
}

test('seller score remains visible on Biens and Pipeline without console errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message);
  });

  await login(page);

  await page.goto('/#biens');
  await expect(page.getByRole('heading', { name: 'Biens Particuliers' })).toBeVisible();
  await expect(page.getByText('535 biens suivis', { exact: true })).toBeVisible();
  await expect(page.locator('[aria-label^="Indice de tension vendeur"]').first()).toBeVisible();

  await page.goto('/#biens-agence');
  await expect(page.getByRole('heading', { name: 'Biens Agence' })).toBeVisible();
  await expect(page.getByText(/7.126 biens suivis/, { exact: true })).toBeVisible();
  await expect(page.locator('[aria-label="Statut du mandat agence"]').first()).toBeVisible();
  await expect(page.locator('[aria-label^="Indice de tension vendeur"]')).toHaveCount(0);

  await page.goto('/#pipeline');
  await expect(page.getByRole('heading', { name: 'Opportunités' })).toBeVisible();
  await expect(page.locator('[aria-label^="Score IA"]').first()).toBeVisible();

  expect(consoleErrors).toEqual([]);
});
