import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const source = readFileSync(path.join(process.cwd(), 'src/lib/supabaseProperties.ts'), 'utf8');
const signupGatingMigration = readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260713204325_enforce_invitation_only_access.sql'),
  'utf8',
);

test('Biens list fetch is projected, paginated, and routed through the RLS-aware canonical view', () => {
  expect(source.includes(".select('*, properties(*)')")).toBe(false);
  expect(source).toContain("const ACTIVE_PROPERTIES_CANONICAL_VIEW = 'active_properties_canonical'");
  expect(signupGatingMigration).toContain('ALTER VIEW public.active_properties_canonical SET (security_invoker = true)');
  expect(signupGatingMigration).toContain('REVOKE SELECT ON public.active_properties_canonical_mat FROM PUBLIC, anon, authenticated');
  expect(source).toContain('export async function fetchSupabasePropertiesPage');
  expect(source).toContain(".from(ACTIVE_PROPERTIES_CANONICAL_VIEW)");
  expect(source).toContain('.range(from, to)');
  expect(source).not.toContain('raw_data,\n  is_fsbo');
  expect(source).toContain('export async function fetchPropertyDetail');
});
