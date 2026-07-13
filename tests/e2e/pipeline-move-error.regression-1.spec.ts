import { expect, test } from '@playwright/test';
import {
  applyOptimisticDealPatch,
  DealMutationLock,
  executeOptimisticMutation,
  replaceDealInList,
  restoreDealInList,
} from '../../src/lib/pipelineRuntime';
import type { DealFull } from '../../src/lib/services/dealsService';
import type { PipelineStageRow } from '../../src/lib/services/pipelineStagesService';

const stageA = { id: 'stage-a', name: 'Nouveau' } as PipelineStageRow;
const stageB = { id: 'stage-b', name: 'Contact' } as PipelineStageRow;

function deal(stage: PipelineStageRow = stageA): DealFull {
  return {
    id: 'deal-a',
    stage_id: stage.id,
    stage,
    updated_at: '2026-07-13T10:00:00.000Z',
  } as DealFull;
}

test('successful deal move is optimistic, commits the Supabase result, and invalidates once', async () => {
  const original = deal();
  const serverResult = deal(stageB);
  let cached = [original];
  let optimisticStageId: string | null = null;
  let invalidations = 0;

  await executeOptimisticMutation({
    snapshot: () => cached,
    apply: () => {
      cached = cached.map((item) => applyOptimisticDealPatch(item, { stage_id: stageB.id }, [stageA, stageB]));
    },
    mutate: async () => {
      optimisticStageId = cached[0].stage?.id ?? null;
      return serverResult;
    },
    commit: (updated) => { cached = replaceDealInList(cached, updated); },
    rollback: (snapshot) => { cached = snapshot; },
    invalidate: async () => { invalidations += 1; },
  });

  expect(optimisticStageId).toBe(stageB.id);
  expect(cached[0]).toBe(serverResult);
  expect(invalidations).toBe(1);
});

test('failed deal move rolls the optimistic stage back and does not invalidate', async () => {
  const original = deal();
  let cached = [original];
  let invalidations = 0;

  await expect(executeOptimisticMutation({
    snapshot: () => cached,
    apply: () => {
      cached = cached.map((item) => applyOptimisticDealPatch(item, { stage_id: stageB.id }, [stageA, stageB]));
    },
    mutate: async () => { throw new Error('RLS denied update'); },
    commit: (updated: DealFull) => { cached = replaceDealInList(cached, updated); },
    rollback: (snapshot) => { cached = snapshot; },
    invalidate: async () => { invalidations += 1; },
  })).rejects.toThrow('RLS denied update');

  expect(cached).toEqual([original]);
  expect(invalidations).toBe(0);
});

test('a refresh failure after a confirmed mutation keeps the committed server result', async () => {
  const original = deal();
  const serverResult = deal(stageB);
  let cached = [original];

  await expect(executeOptimisticMutation({
    snapshot: () => cached,
    apply: () => { cached = [applyOptimisticDealPatch(original, { stage_id: stageB.id }, [stageA, stageB])]; },
    mutate: async () => serverResult,
    commit: (updated) => { cached = replaceDealInList(cached, updated); },
    rollback: (snapshot) => { cached = snapshot; },
    invalidate: async () => { throw new Error('refresh failed'); },
  })).rejects.toThrow('refresh failed');

  expect(cached[0]).toBe(serverResult);
});

test('a second concurrent mutation for the same deal is rejected', async () => {
  let releaseFirst!: () => void;
  const firstOperation = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const lock = new DealMutationLock();
  const first = lock.run('deal-a', () => firstOperation);

  await expect(lock.run('deal-a', async () => undefined)).rejects.toThrow('deja en cours');
  await expect(lock.run('deal-b', async () => 'other deal')).resolves.toBe('other deal');

  releaseFirst();
  await first;
});

test('rolling back one deal preserves a concurrent success on another deal', () => {
  const originalA = deal();
  const originalB = { ...deal(stageB), id: 'deal-b' };
  const committedA = { ...originalA, title: 'Concurrent success' };
  const optimisticB = { ...originalB, title: 'Optimistic change' };

  const restored = restoreDealInList([committedA, optimisticB], { deal: originalB, index: 1 });

  expect(restored).toEqual([committedA, originalB]);
});
