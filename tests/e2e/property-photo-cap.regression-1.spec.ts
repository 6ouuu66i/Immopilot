import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();

// Regression: ISSUE-BIENS-PHOTO-CAP-001 — the canonical matview truncated photo_urls to six entries
// Found by /investigate on 2026-07-11
test('canonical property media exposes the complete source photo array', async () => {
  const migration = await fs.readFile(
    path.join(rootDir, 'supabase/migrations/20260711031621_expose_all_property_photos.sql'),
    'utf8',
  );

  expect(migration).toContain('l.photo_urls AS photo_urls');
  expect(migration).not.toContain('l.photo_urls[1:6] AS photo_urls');
});
