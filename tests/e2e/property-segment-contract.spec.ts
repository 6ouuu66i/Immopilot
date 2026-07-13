import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();

test('Biens segments share one component and filter server-side before pagination', async () => {
  const mainSource = await fs.readFile(path.join(rootDir, 'src/main.tsx'), 'utf8');
  const biensSource = await fs.readFile(path.join(rootDir, 'src/pages/Biens.tsx'), 'utf8');
  const dataSource = await fs.readFile(path.join(rootDir, 'src/lib/supabaseProperties.ts'), 'utf8');
  const queryKeysSource = await fs.readFile(path.join(rootDir, 'src/lib/queryKeys.ts'), 'utf8');

  expect(mainSource).toContain('<Biens key="particulier" segment="particulier" />');
  expect(mainSource).toContain('<Biens key="agence" segment="agence" />');
  expect(biensSource).not.toContain('store: Store');
  expect(biensSource).toContain('segment: PropertySellerSegment');
  expect(dataSource.indexOf("query.eq('seller_segment', options.segment)")).toBeLessThan(
    dataSource.indexOf('.range(from, to)'),
  );
  expect(queryKeysSource).toContain('segment: PropertySellerSegment');
  expect(queryKeysSource).toContain("userId ?? 'anonymous',\n      segment,");
});

test('canonical segmentation gives PRIVATE priority and excludes unsupported professional types', async () => {
  const migrationSource = await fs.readFile(
    path.join(rootDir, 'supabase/migrations/20260711160348_prefer_segment_matching_canonical_listing.sql'),
    'utf8',
  );

  expect(migrationSource).toContain("BOOL_OR(active_listing.customer_type = 'PRIVATE')");
  expect(migrationSource).toContain("THEN 'particulier'");
  expect(migrationSource).toContain("THEN 'agence'");
  expect(migrationSource).toContain('seller_segments.seller_segment IS NOT NULL');
  expect(migrationSource).toContain("seller_segments.seller_segment = 'particulier'");
  expect(migrationSource).toContain("l.customer_type = 'PRIVATE'");
});
