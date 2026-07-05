import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const dealsServiceSource = readFileSync(path.join(process.cwd(), 'src/lib/services/dealsService.ts'), 'utf8');
const notesServiceSource = readFileSync(path.join(process.cwd(), 'src/lib/services/notesService.ts'), 'utf8');

test('Pipeline hydration batches deal activities, tasks, and notes', () => {
  expect(dealsServiceSource).toContain('async getActivitiesForDeals(dealIds: string[])');
  expect(dealsServiceSource).toContain('async getOpenTasksForDeals(dealIds: string[])');
  expect(notesServiceSource).toContain('async getNotesForDeals(dealIds: string[])');
  expect(dealsServiceSource).toContain(".in('deal_id', ids)");
  expect(notesServiceSource).toContain(".in('deal_id', validDealIds)");
  expect(dealsServiceSource).toContain('const [activitiesByDeal, tasksByDeal, notesByDeal] = await Promise.all([');
});
