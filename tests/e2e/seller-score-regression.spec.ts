import { expect, test, type Page } from '@playwright/test';

type SellerSegment = 'particulier' | 'agence';

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

function waitForCanonicalPropertyTotal(page: Page, segment: SellerSegment): Promise<number> {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'GET'
      && url.pathname.endsWith('/rest/v1/active_properties_canonical_mat')
      && url.searchParams.get('seller_segment') === `eq.${segment}`;
  }).then((response) => {
    const contentRange = response.headers()['content-range'];
    const total = contentRange ? Number(contentRange.split('/').at(-1)) : Number.NaN;
    expect(total, `missing exact count for ${segment} canonical properties`).toBeGreaterThanOrEqual(0);
    return total;
  });
}

async function expectDisplayedPropertyTotal(page: Page, expectedTotal: number) {
  const counter = page.getByText(/^\d[\d.\s]* biens suivis$/, { exact: true });
  await expect(counter).toBeVisible();
  const displayedTotal = Number((await counter.innerText()).replace(/\D/g, ''));
  expect(displayedTotal).toBe(expectedTotal);
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

  const particulierTotal = waitForCanonicalPropertyTotal(page, 'particulier');
  await page.goto('/#biens');
  await expect(page.getByRole('heading', { name: 'Biens Particuliers' })).toBeVisible();
  await expectDisplayedPropertyTotal(page, await particulierTotal);
  await expect(page.locator('[aria-label^="Indice de tension vendeur"]').first()).toBeVisible();

  const agenceTotal = waitForCanonicalPropertyTotal(page, 'agence');
  await page.goto('/#biens-agence');
  await expect(page.getByRole('heading', { name: 'Biens Agence' })).toBeVisible();
  await expectDisplayedPropertyTotal(page, await agenceTotal);
  await expect(page.locator('[aria-label="Statut du mandat agence"]').first()).toBeVisible();
  await expect(page.locator('[aria-label^="Indice de tension vendeur"]')).toHaveCount(0);

  await page.goto('/#pipeline');
  await expect(page.getByRole('heading', { name: 'Opportunités' })).toBeVisible();
  await expect(page.locator('[aria-label^="Score IA"]').first()).toBeVisible();

  expect(consoleErrors).toEqual([]);
});
