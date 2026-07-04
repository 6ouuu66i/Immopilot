import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
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
await page.waitForTimeout(3000);
const bodyText = await page.locator('body').innerText();
const cards = await page.locator('article').count();
const paginationTextMatches = bodyText.match(/Page\s+\d+\s+sur\s+\d+|\d+\s*\/\s*\d+|\d+\s+biens?|\d+\s+r[ée]sultats?/gi) ?? [];
const nextButtons = await page.locator('button').evaluateAll((buttons) => buttons.map((button) => ({ text: button.textContent?.trim() ?? '', disabled: button.disabled, aria: button.getAttribute('aria-label') })).filter((b) => b.text || b.aria));
console.log(JSON.stringify({ url: page.url(), cards, paginationTextMatches: paginationTextMatches.slice(0, 20), nextButtons: nextButtons.slice(-12), bodyExcerpt: bodyText.slice(0, 2500) }, null, 2));
await browser.close();
