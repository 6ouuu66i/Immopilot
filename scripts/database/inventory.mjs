import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const criticalSuites = [
  'f001_profiles_privileged_columns.test.sql',
  'f002_accept_invitation.test.sql',
  'f003_transfer_requests_state_machine.test.sql',
  'f006_signup_gating.test.sql',
  'f008_f014_dashboard.test.sql',
  'f009_f010_pipeline_observability.test.sql',
  'f023_system_health.test.sql',
];

export async function readDatabaseInventory(rootDir = process.cwd()) {
  const migrationsDir = path.join(rootDir, 'supabase', 'migrations');
  const testsDir = path.join(rootDir, 'supabase', 'tests');
  const migrationNames = (await fs.readdir(migrationsDir))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  const suiteNames = (await fs.readdir(testsDir))
    .filter((name) => name.endsWith('.test.sql'))
    .sort();

  if (migrationNames.length === 0) throw new Error('No local migration discovered.');
  if (suiteNames.length === 0) throw new Error('No pgTAP suite discovered.');

  const versions = migrationNames.map((name) => {
    const match = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(name);
    if (!match) throw new Error(`Invalid migration filename: ${name}`);
    return match[1];
  });
  if (new Set(versions).size !== versions.length) {
    throw new Error('Duplicate migration timestamp discovered.');
  }

  for (const criticalSuite of criticalSuites) {
    if (!suiteNames.includes(criticalSuite)) {
      throw new Error(`Critical pgTAP suite is missing: ${criticalSuite}`);
    }
  }

  let assertionCount = 0;
  const suiteAssertions = {};
  for (const suiteName of suiteNames) {
    const source = await fs.readFile(path.join(testsDir, suiteName), 'utf8');
    const plans = [...source.matchAll(/\bplan\s*\(\s*(\d+)\s*\)/gi)];
    if (plans.length !== 1) {
      throw new Error(`${suiteName} must declare exactly one numeric pgTAP plan.`);
    }
    if (!/^\s*begin\s*;/im.test(source) || !/^\s*rollback\s*;/im.test(source)) {
      throw new Error(`${suiteName} must be transactional and finish with rollback.`);
    }
    if (!/\bfinish\s*\(/i.test(source)) {
      throw new Error(`${suiteName} must call pgTAP finish().`);
    }
    const planned = Number.parseInt(plans[0][1], 10);
    assertionCount += planned;
    suiteAssertions[suiteName] = planned;
  }

  return {
    migrationCount: migrationNames.length,
    migrationNames,
    migrationVersions: versions,
    suiteCount: suiteNames.length,
    suiteNames,
    suiteAssertions,
    assertionCount,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inventory = await readDatabaseInventory(process.env.DB_CI_CONTRACT_ROOT || process.cwd());
  process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
}
