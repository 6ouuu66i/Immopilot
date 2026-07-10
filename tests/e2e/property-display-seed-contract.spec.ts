import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();

test('synthetic property dossier values use a bounded display seed', async () => {
  const biensSource = await fs.readFile(path.join(rootDir, 'src/pages/Biens.tsx'), 'utf8');
  const functionStart = biensSource.indexOf('function propertyDisplaySeed');
  const functionEnd = biensSource.indexOf('\n}', functionStart);
  const functionSource = biensSource.slice(functionStart, functionEnd);

  expect(functionSource).toContain('Math.abs(Math.trunc(value)) % 97');
  expect(functionSource).toContain('Math.abs(hash) % 97');
  expect(functionSource).not.toContain('return Math.abs(hash) + 1');
});
