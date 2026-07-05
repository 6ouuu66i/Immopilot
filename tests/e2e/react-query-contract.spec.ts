import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const queryClientSourcePath = path.join(process.cwd(), 'src/lib/queryClient.ts');
const queryKeysSourcePath = path.join(process.cwd(), 'src/lib/queryKeys.ts');
const listingScoresHookSource = path.join(process.cwd(), 'src/lib/useListingScores.ts');
const listingSignalsHookSource = path.join(process.cwd(), 'src/lib/useListingSignals.ts');

test('React Query global client disables refetch on focus with a 5 minute stale window', () => {
  const source = readFileSync(queryClientSourcePath, 'utf8');

  expect(source).toContain('refetchOnWindowFocus: false');
  expect(source).toContain('staleTime: 5 * 60 * 1000');
  expect(source).toContain('gcTime: 30 * 60 * 1000');
});

test('property id query keys are sorted and deduplicated before caching', async () => {
  const queryKeysModule = await import('../../src/lib/queryKeys');
  const left = queryKeysModule.createPropertyIdsKey(['b', 'a', 'a', '']);
  const right = queryKeysModule.createPropertyIdsKey(['a', 'b']);

  expect(left).toEqual(['a', 'b']);
  expect(right).toEqual(['a', 'b']);
});

test('listing score and signal hooks share the same normalized property id key helper', () => {
  const scoresSource = readFileSync(listingScoresHookSource, 'utf8');
  const signalsSource = readFileSync(listingSignalsHookSource, 'utf8');

  expect(scoresSource).toContain("from './queryKeys'");
  expect(scoresSource).toContain('createPropertyIdsKey(propertyIds)');
  expect(signalsSource).toContain("from './queryKeys'");
  expect(signalsSource).toContain('createPropertyIdsKey(propertyIds)');
});
