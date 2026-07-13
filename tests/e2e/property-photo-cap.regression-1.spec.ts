import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const activeMigrationsDir = path.join(rootDir, 'supabase/migrations');
const canonicalPhotoMigration = '20260711031705_expose_all_property_photos.sql';
const canonicalMatviewStatement = 'CREATE MATERIALIZED VIEW public.active_properties_canonical_mat';
const completePhotoProjection = 'l.photo_urls AS photo_urls';
const cappedPhotoProjection = /l\.photo_urls\s*\[\s*1\s*:\s*6\s*\]\s+AS\s+photo_urls/i;

// Regression: ISSUE-BIENS-PHOTO-CAP-001 — the canonical matview truncated photo_urls to six entries
// Found by /investigate on 2026-07-11
test('canonical property media exposes the complete source photo array', async () => {
  const migration = await fs.readFile(path.join(activeMigrationsDir, canonicalPhotoMigration), 'utf8');

  expect(migration).toContain(completePhotoProjection);
  expect(migration).not.toMatch(cappedPhotoProjection);
});

test('active canonical matview migrations never restore the six-photo cap', async () => {
  const migrationNames = (await fs.readdir(activeMigrationsDir))
    .filter((name) => name.endsWith('.sql') && name >= canonicalPhotoMigration)
    .sort();
  const migrations = await Promise.all(
    migrationNames.map(async (name) => ({
      name,
      sql: await fs.readFile(path.join(activeMigrationsDir, name), 'utf8'),
    })),
  );
  const matviewRecreations = migrations.filter(({ sql }) => sql.includes(canonicalMatviewStatement));

  expect(matviewRecreations.map(({ name }) => name)).toContain(canonicalPhotoMigration);
  for (const { name, sql } of matviewRecreations) {
    expect(sql, `${name} must expose the complete photo array`).toContain(completePhotoProjection);
    expect(sql, `${name} must not restore the historical photo cap`).not.toMatch(cappedPhotoProjection);
  }
});
