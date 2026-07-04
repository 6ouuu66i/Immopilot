import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const consoleMessages = [];
page.on('console', (msg) => {
  if (['error', 'warning'].includes(msg.type())) consoleMessages.push(`${msg.type()}: ${msg.text()}`);
});
page.on('pageerror', (err) => consoleMessages.push(`pageerror: ${err.message}`));

await page.goto('http://127.0.0.1:3000/#biens', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

const emailInput = page.locator('input[type="email"], input[name="email"], input[autocomplete="email"]').first();
if (await emailInput.count()) {
  await emailInput.fill('soussiii21@gmail.com');
  const passwordInput = page.locator('input[type="password"], input[name="password"], input[autocomplete="current-password"]').first();
  await passwordInput.fill('sarahtutu');
  const submit = page.locator('button[type="submit"], button:has-text("Connexion"), button:has-text("Se connecter"), button:has-text("Login")').first();
  await submit.click();
  await page.waitForURL(/#(dashboard|biens)/, { timeout: 15000 }).catch(() => {});
  await page.goto('http://127.0.0.1:3000/#biens', { waitUntil: 'domcontentloaded' });
}

await page.waitForTimeout(5000);
await page.waitForSelector('article', { timeout: 20000 });

const labels = ['Sous marche', 'FSBO', 'Baisse prix', 'Republie', 'Multi-source', 'Mandat 6 mois'];
const counts = {};
for (const label of labels) {
  counts[label] = await page.locator(`span:has-text("${label}")`).count();
}

const cards = await page.locator('article').count();
await page.screenshot({ path: 'tmp-biens-signals-badges.png', fullPage: true });
console.log(JSON.stringify({ url: page.url(), cards, counts, consoleMessages }, null, 2));
await browser.close();
