import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const consoleMessages = [];
page.on('console', (msg) => { if (['error', 'warning'].includes(msg.type())) consoleMessages.push(`${msg.type()}: ${msg.text()}`); });
page.on('pageerror', (err) => consoleMessages.push(`pageerror: ${err.message}`));
await page.goto('http://127.0.0.1:3000/#biens', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
const emailInput = page.locator('input[type="email"], input[name="email"], input[autocomplete="email"]').first();
if (await emailInput.count()) {
  await emailInput.fill('soussiii21@gmail.com');
  await page.locator('input[type="password"], input[name="password"], input[autocomplete="current-password"]').first().fill('sarahtutu');
  await page.locator('button[type="submit"], button:has-text("Connexion"), button:has-text("Se connecter"), button:has-text("Login")').first().click();
  await page.waitForTimeout(3000);
  await page.goto('http://127.0.0.1:3000/#biens', { waitUntil: 'domcontentloaded' });
}
await page.waitForSelector('article', { timeout: 20000 });
await page.waitForTimeout(2500);

async function countBadges() {
  const labels = ['Sous marche', 'FSBO', 'Baisse prix', 'Republie', 'Multi-source', 'Mandat 6 mois'];
  const counts = {};
  for (const label of labels) counts[label] = await page.locator(`span:has-text("${label}")`).count();
  return { cards: await page.locator('article').count(), counts };
}

const initial = await countBadges();
const buttonTexts = await page.locator('button').evaluateAll((buttons) => buttons.map((button) => button.textContent?.trim()).filter(Boolean));

const particuliers = page.locator('button:has-text("Particuliers"), button:has-text("FSBO")').first();
let particuliersResult = null;
if (await particuliers.count()) {
  await particuliers.click();
  await page.waitForTimeout(1800);
  particuliersResult = await countBadges();
}

const agences = page.locator('button:has-text("Agence"), button:has-text("Agences")').first();
let agencesResult = null;
if (await agences.count()) {
  await agences.click();
  await page.waitForTimeout(1800);
  agencesResult = await countBadges();
}

console.log(JSON.stringify({ initial, particuliersResult, agencesResult, buttonTexts: buttonTexts.slice(0, 80), consoleMessages }, null, 2));
await browser.close();
