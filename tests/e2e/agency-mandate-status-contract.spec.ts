import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();

test('agency mandate status has three cautious states and an explicit neutral state', async () => {
  const componentSource = await fs.readFile(
    path.join(rootDir, 'src/components/biens/MandateStatusZone.tsx'),
    'utf8',
  );

  expect(componentSource).toContain("monitor: {");
  expect(componentSource).toContain("watchlist_sortie_probable: {");
  expect(componentSource).toContain("activable_sous_verification: {");
  expect(componentSource).toContain("border: '#8A6D1F'");
  expect(componentSource).toContain("border: '#1E5A3A'");
  expect(componentSource).toContain('Aucun signal de mandat');
  expect(componentSource).toContain('Statut potentiellement en évolution, à vérifier avant tout contact.');
  expect(componentSource).toContain('Aucun démarchage automatique n’est suggéré.');
});

test('Biens switches insight and explanation by segment without duplicating page components', async () => {
  const biensSource = await fs.readFile(path.join(rootDir, 'src/pages/Biens.tsx'), 'utf8');
  const scoreSource = await fs.readFile(
    path.join(rootDir, 'src/components/biens/SellerTensionScoreZone.tsx'),
    'utf8',
  );

  expect(biensSource).toContain("if (segment === 'agence') {");
  expect(biensSource).toContain('<MandateStatusZone');
  expect(biensSource).toContain('<MandateContextPanel');
  expect(biensSource).toContain('<SellerTensionScoreZone');
  expect(biensSource).toContain("segment === 'agence' ? 'Statut mandat' : 'Score'");
  expect(scoreSource).toContain('<PropertyInsightZone');
});
