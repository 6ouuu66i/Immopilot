import { expect, test } from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const migrationsDir = path.join(rootDir, 'supabase', 'migrations');
const archiveDir = path.join(rootDir, 'supabase', 'migrations_archive');
const migrationHashesPath = path.join(rootDir, 'tests', 'fixtures', 'migration-hashes.json');
const migrationNamePattern = /^(\d{14})_[a-z0-9_]+\.sql$/;
const forbiddenArchivedMigrations = new Set([
  '20260710103000_matview_expose_is_under_option.sql',
  '20260710150000_matview_photos_and_reason_accents.sql',
  '20260711031621_expose_all_property_photos.sql',
]);

async function sqlFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sqlFiles(absolutePath);
    return entry.isFile() && entry.name.endsWith('.sql') ? [absolutePath] : [];
  }));
  return files.flat();
}

test('active migrations use unique strictly ordered timestamp versions', async () => {
  const names = (await fs.readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();
  const invalidNames = names.filter((name) => !migrationNamePattern.test(name));
  const versions = names.map((name) => migrationNamePattern.exec(name)?.[1] ?? '');

  expect(invalidNames).toEqual([]);
  expect(new Set(versions).size).toBe(versions.length);
  expect(versions).toEqual([...versions].sort());
  versions.slice(1).forEach((version, index) => {
    expect(version > versions[index], `${names[index]} must precede ${names[index + 1]}`).toBe(true);
  });
});

test('archived and known dangerous migrations never return to the active directory', async () => {
  const activeNames = new Set((await fs.readdir(migrationsDir)).filter((name) => name.endsWith('.sql')));
  const archivedNames = (await sqlFiles(archiveDir)).map((file) => path.basename(file));

  expect(archivedNames.filter((name) => activeNames.has(name))).toEqual([]);
  expect([...forbiddenArchivedMigrations].filter((name) => activeNames.has(name))).toEqual([]);
  expect([...activeNames].filter((name) => /(?:archive|obsolete|replaced)/i.test(name))).toEqual([]);
});

test('historical active migrations match the reviewed SHA-256 reference manifest', async () => {
  const activeNames = (await fs.readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();
  const migrationHashes = JSON.parse(await fs.readFile(migrationHashesPath, 'utf8')) as Record<string, string>;
  const referenceNames = Object.keys(migrationHashes).sort();

  expect(activeNames).toEqual(referenceNames);
  await Promise.all(activeNames.map(async (name) => {
    const contents = await fs.readFile(path.join(migrationsDir, name), 'utf8');
    const canonicalContents = contents.replace(/\r\n/g, '\n');
    const actualHash = crypto.createHash('sha256').update(canonicalContents).digest('hex');
    expect(actualHash, `${name} changed after its reference hash was recorded`).toBe(migrationHashes[name]);
  }));
});
