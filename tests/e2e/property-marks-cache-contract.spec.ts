import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const source = readFileSync(path.join(process.cwd(), 'src/lib/usePropertyMarks.ts'), 'utf8');

test('property marks mutations invalidate related React Query caches after success', () => {
  expect(source).toContain('const invalidateRelatedQueries = useCallback(async () => {');
  expect(source).toContain('queryClient.invalidateQueries({ queryKey })');
  expect(source).toContain("queryClient.invalidateQueries({ queryKey: queryKeys.supabaseProperties(user?.id) })");
  expect(source).toContain("query.queryKey[0] === 'supabase-properties-page'");
  expect(source).toContain('await favoriteMutation.mutateAsync(propertyId);');
  expect(source).toContain('await ignoredMutation.mutateAsync(propertyId);');
  expect(source).toContain('await invalidateRelatedQueries();');
});
