import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();

// Regression: ISSUE-BIENS-MEDIA-001 — single-photo cards looked like broken carousels
// Found by /qa on 2026-07-11
test('property cards distinguish single photos and keep two wide columns beside the mini fiche', async () => {
  const cardSource = await fs.readFile(path.join(rootDir, 'src/components/biens/PropertyCard.tsx'), 'utf8');
  const cssSource = await fs.readFile(path.join(rootDir, 'src/index.css'), 'utf8');

  expect(cardSource).toContain('{photos.length > 1 && (');
  expect(cardSource).toContain("photos.length === 1 ? '1 photo'");
  expect(cardSource).toContain("aria-label={photos.length === 1 ? 'Une seule photo disponible'");
  expect(cssSource).toContain('.lv-biens.has-panel .lv-biens-grid {');
  expect(cssSource).toContain('grid-template-columns: repeat(2, minmax(0, 1fr)) !important;');
  expect(cssSource).toContain('.lv-biens.has-panel .lv-biens-grid .lv-property-card.is-selected {');
});
