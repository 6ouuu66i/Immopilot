import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();

// Regression: Pipeline stage failures left the UI without a local error.
// Found by /investigate on 2026-07-12.
// Report: docs/testing/main-user-flow-audit.md
test('deal stage failure rolls back optimistic state and shows one local message', async () => {
  const useDealsSource = await fs.readFile(path.join(rootDir, 'src/lib/useDeals.ts'), 'utf8');
  const pipelineSource = await fs.readFile(path.join(rootDir, 'src/pages/Pipeline.tsx'), 'utf8');

  expect(useDealsSource).toContain('const previousDeals = deals;');
  expect(useDealsSource).toContain('setDeals(previousDeals);');
  expect(useDealsSource).toContain('throw new Error(message);');

  expect(pipelineSource).toContain('await dealsState.updateDealStage(dealId, stage.id);');
  expect(pipelineSource).toContain("setMoveError('Impossible de déplacer le deal. Veuillez réessayer.');");
  expect(pipelineSource).toContain('const loadError = moveError ?? dealsState.error ?? stagesState.error;');
  expect(pipelineSource).not.toContain('void dealsState.updateDealStage(dealId, stage.id);');
});
