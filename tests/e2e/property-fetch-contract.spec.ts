import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const source = readFileSync(path.join(process.cwd(), 'src/lib/supabaseProperties.ts'), 'utf8');

test('Biens list fetch no longer selects every listing and property column', () => {
  expect(source.includes(".select('*, properties(*)')")).toBe(false);
  expect(source).toContain('export const LISTINGS_LIST_SELECT');
  expect(source).not.toContain('raw_data,\n  is_fsbo');
  expect(source).toContain('export async function fetchPropertyDetail');
});
