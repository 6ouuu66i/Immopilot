import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();

test('auth prefetch uses the same centralized query keys as Biens and Dashboard hooks', async () => {
  const authSource = await fs.readFile(path.join(rootDir, 'src/lib/auth.tsx'), 'utf8');
  const queryKeysSource = await fs.readFile(path.join(rootDir, 'src/lib/queryKeys.ts'), 'utf8');
  const propertiesSource = await fs.readFile(path.join(rootDir, 'src/lib/supabaseProperties.ts'), 'utf8');
  const scoresSource = await fs.readFile(path.join(rootDir, 'src/lib/useListingScores.ts'), 'utf8');
  const signalsSource = await fs.readFile(path.join(rootDir, 'src/lib/useListingSignals.ts'), 'utf8');
  const dashboardSource = await fs.readFile(path.join(rootDir, 'src/lib/useDashboardSnapshot.ts'), 'utf8');

  expect(queryKeysSource).toContain('export const queryKeys = {');
  expect(queryKeysSource).toContain('supabasePropertiesPage');
  expect(queryKeysSource).toContain('listingScores');
  expect(queryKeysSource).toContain('listingSignals');
  expect(queryKeysSource).toContain('dashboardSnapshot');

  expect(propertiesSource).toContain('queryKey: queryKeys.supabasePropertiesPage(');
  expect(scoresSource).toContain('queryKey: queryKeys.listingScores(');
  expect(signalsSource).toContain('queryKey: queryKeys.listingSignals(');
  expect(dashboardSource).toContain('queryKey: queryKeys.dashboardSnapshot(');

  expect(authSource).toContain('appQueryClient.prefetchQuery(');
  expect(authSource).toContain('queryKeys.supabasePropertiesPage(');
  expect(authSource).toContain('queryKeys.listingScores(');
  expect(authSource).toContain('queryKeys.listingSignals(');
  expect(authSource).toContain('queryKeys.dashboardSnapshot(');
  expect(authSource).toContain('Promise.race([');
  expect(authSource).toContain('setTimeout(resolve, 2500)');
});
