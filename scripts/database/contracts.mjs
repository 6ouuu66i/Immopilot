import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';
import { criticalSuites, readDatabaseInventory } from './inventory.mjs';

const rootDir = process.env.DB_CI_CONTRACT_ROOT || process.cwd();
const workflowPath = path.join(rootDir, '.github', 'workflows', 'database.yml');
const runCiPath = path.join(rootDir, 'scripts', 'database', 'run-ci.sh');
const runPgtapPath = path.join(rootDir, 'scripts', 'database', 'run-pgtap.sh');
const stopPath = path.join(rootDir, 'scripts', 'database', 'stop-local.sh');
const guardPath = path.join(rootDir, 'scripts', 'database', 'guard-local-only.mjs');
const configPath = path.join(rootDir, 'supabase', 'config.toml');
const docsPath = path.join(rootDir, 'docs', 'testing.md');
const packagePath = path.join(rootDir, 'package.json');
const lockPath = path.join(rootDir, 'package-lock.json');
const concurrencyPath = path.join(rootDir, 'supabase', 'tests', 'f009_f010_advisory_lock_concurrency.sh');
const securityHardeningMigrationName = '20260715231055_restrict_internal_security_definer_functions.sql';
const expectedCliVersion = '2.109.1';
const hostedDomain = ['supabase', 'co'].join('.');
const forbiddenProjectHash = '4dc7093ed200cef9d48db489231fbe8be3577f3dcc71366c1fbc6c46c758a7ba';

const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
}
function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function includesCommand(source, parts) {
  return new RegExp(`\\b${parts.join('\\s+')}\\b`, 'i').test(source);
}
async function read(filePath) {
  return fs.readFile(filePath, 'utf8');
}

const [workflowSource, runCi, runPgtap, stopScript, guardSource, configSource, docsSource, packageSource, lockSource, concurrencySource] = await Promise.all([
  read(workflowPath),
  read(runCiPath),
  read(runPgtapPath),
  read(stopPath),
  read(guardPath),
  read(configPath),
  read(docsPath),
  read(packagePath),
  read(lockPath),
  read(concurrencyPath),
]);
const workflow = parse(workflowSource);
const packageJson = JSON.parse(packageSource);
const packageLock = JSON.parse(lockSource);
const inventory = await readDatabaseInventory(rootDir);
const databaseJob = workflow?.jobs?.['postgres-contracts'];
const workflowSteps = databaseJob?.steps || [];
const cacheRemovalStep = workflowSteps.find((step) => step.name === 'Remove repository-linked Supabase cache');
const cacheRemovalIndex = workflowSteps.indexOf(cacheRemovalStep);
const guardIndex = workflowSteps.findIndex((step) => step.name === 'Reject remote Supabase state');
const pushBranches = workflow?.on?.push?.branches || [];
const pullRequestBranches = workflow?.on?.pull_request?.branches || [];

check(workflow?.name === 'Database CI', 'The dedicated database workflow must exist and have the expected name.');
check(Boolean(databaseJob), 'The blocking postgres-contracts job is missing.');
check(databaseJob?.['runs-on'] === 'ubuntu-latest', 'The database job must use a Linux Docker runner.');
check(databaseJob?.['timeout-minutes'] === 40, 'The database job must have an explicit 40 minute timeout.');
check(!('continue-on-error' in (databaseJob || {})), 'The database job must not be optional.');
check(!('if' in (databaseJob || {})), 'The database job must not be conditionally disabled.');
check(pushBranches.includes('skeleton-review') && pushBranches.includes('master'), 'Database push triggers must cover skeleton-review and master.');
check(pullRequestBranches.includes('skeleton-review') && pullRequestBranches.includes('master'), 'Database pull request triggers must cover skeleton-review and master.');
check(workflowSteps.some((step) => step.run === 'npm ci'), 'The workflow must install the lockfile exactly with npm ci.');
check(cacheRemovalIndex >= 0 && guardIndex > cacheRemovalIndex, 'Tracked linked Supabase cache must be removed before the local-only guard runs.');
for (const fileName of ['project-ref', 'linked-project.json', 'pooler-url']) {
  check(cacheRemovalStep?.run?.includes(`supabase/.temp/${fileName}`), `The workflow must remove tracked linked cache file ${fileName}.`);
}
check(workflowSteps.some((step) => step.run === 'npm run ci:database'), 'The workflow must execute the complete database CI entry point.');
check(workflowSteps.some((step) => step.if === 'always()' && step.run === 'npm run test:db:stop'), 'The workflow must always stop the disposable stack.');
check(!workflowSource.includes('secrets.'), 'The database workflow must not reference GitHub secrets.');
check(!/(?:supabase[^\n]*@latest|version:\s*latest)/i.test(workflowSource), 'The database workflow must not install a latest CLI version.');
check(!workflowSource.includes('continue-on-error'), 'The database workflow must not contain continue-on-error.');

check(packageJson.devDependencies?.supabase === expectedCliVersion, 'Supabase CLI must be pinned exactly in package.json.');
check(packageLock.packages?.['node_modules/supabase']?.version === expectedCliVersion, 'Supabase CLI must be pinned exactly in package-lock.json.');
check(packageJson.scripts?.['test:ci']?.includes('test:db:contracts'), 'Static database contracts must run in the existing deterministic suite.');
check(packageJson.scripts?.['ci:database'] === 'npm run test:db:contracts && npm run test:db:ci', 'ci:database must gate dynamic tests on static contracts.');

check(runCi.includes(`expected_cli_version="${expectedCliVersion}"`), 'The runtime must verify the pinned CLI version.');
check(runCi.includes('db reset --local --no-seed'), 'The runtime must rebuild the local database from zero migrations without seeds.');
check(runCi.includes('supabase_migrations.schema_migrations'), 'The runtime must verify applied migration history.');
check(runCi.includes('trap cleanup EXIT'), 'The runtime must install an EXIT cleanup trap.');
check(runCi.includes('f009_f010_advisory_lock_concurrency.sh'), 'The real two-connection concurrency test must run.');
check(runPgtap.includes('test db --local'), 'The pgTAP runner must explicitly target the local database.');
check(runPgtap.includes("-name '*.test.sql'"), 'The pgTAP runner must discover every SQL suite.');
check(stopScript.includes('stop --no-backup --project-id immopilot-ci'), 'Cleanup must delete only the disposable local project volumes.');
check(stopScript.includes('[[ ! -x "$supabase_bin" ]]'), 'Cleanup must remain safe when dependency installation failed before the CLI was available.');
check(concurrencySource.includes('pg_advisory_xact_lock') && concurrencySource.includes('sync_daily_pipeline') && concurrencySource.includes('skipped|cron|0'), 'The concurrency test must use two real sessions and verify the ledger result.');

check(inventory.migrationCount === 58, `Expected 58 migrations, found ${inventory.migrationCount}.`);
check(inventory.suiteCount === 8, `Expected 8 pgTAP suites, found ${inventory.suiteCount}.`);
check(inventory.assertionCount === 200, `Expected 200 planned assertions, found ${inventory.assertionCount}.`);
for (const suiteName of criticalSuites) check(inventory.suiteNames.includes(suiteName), `Critical suite missing: ${suiteName}`);

const migrationSources = new Map(await Promise.all(inventory.migrationNames.map(async (name) => [
  name,
  await read(path.join(rootDir, 'supabase', 'migrations', name)),
])));
const hardeningMigration = migrationSources.get(securityHardeningMigrationName) || '';
for (const signature of [
  'public.generate_reference(uuid, text)',
  'public.set_contact_reference()',
  'public.set_deal_reference()',
  'public.rls_auto_enable()',
]) {
  const escapedSignature = signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\ /g, '\\s*');
  check(
    new RegExp(`revoke\\s+execute\\s+on\\s+function\\s+${escapedSignature}[\\s\\S]*?from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated\\s*,\\s*service_role`, 'i').test(hardeningMigration),
    `${signature} must explicitly revoke EXECUTE from PUBLIC and every application role.`,
  );
}
check(/alter\s+function\s+public\.set_contact_reference\(\)\s+security\s+definer/i.test(hardeningMigration), 'The contact trigger wrapper must run as its unchanged owner.');
check(/alter\s+function\s+public\.set_deal_reference\(\)\s+security\s+definer/i.test(hardeningMigration), 'The deal trigger wrapper must run as its unchanged owner.');
check(/revoke\s+insert\s*,\s*update\s*,\s*delete\s*,\s*truncate[\s\S]*?on\s+table\s+public\.reference_counters[\s\S]*?from\s+anon\s*,\s*authenticated\s*,\s*service_role/i.test(hardeningMigration), 'Reference-counter mutation grants must be revoked from every application role.');
check(!/\bgrant\s+execute\b/i.test(hardeningMigration), 'Internal definer functions must not receive a new direct EXECUTE grant.');

function normalizeSql(value) {
  return value.toLowerCase().replaceAll('"', '').replace(/\s+/g, ' ').trim();
}
for (const [migrationName, source] of migrationSources) {
  if (migrationName < securityHardeningMigrationName) continue;
  const functionStarts = [...source.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([a-z_][a-z0-9_]*(?:\s*\.\s*[a-z_][a-z0-9_]*)?)\s*\(/gi)];
  const aclStatements = [...source.matchAll(/(?:revoke|grant)\s+execute\s+on\s+function[\s\S]*?;/gi)].map((match) => normalizeSql(match[0]));
  functionStarts.forEach((match, index) => {
    const bodyEnd = functionStarts[index + 1]?.index ?? source.length;
    const functionBlock = source.slice(match.index, bodyEnd);
    if (!/\bsecurity\s+definer\b/i.test(functionBlock)) return;

    const functionName = normalizeSql(match[1]).replace(/\s*\.\s*/g, '.');
    const decisions = aclStatements.filter((statement) => statement.includes(functionName));
    check(decisions.some((statement) => statement.startsWith('revoke ') && /\bfrom\s+[^;]*\bpublic\b/.test(statement)), `${migrationName}: ${functionName} must explicitly revoke PUBLIC EXECUTE.`);
    for (const role of ['anon', 'authenticated', 'service_role']) {
      check(decisions.some((statement) => new RegExp(`\\b(?:from|to)\\s+[^;]*\\b${role}\\b`).test(statement)), `${migrationName}: ${functionName} needs an explicit EXECUTE decision for ${role}.`);
    }
  });
}

check(/project_id\s*=\s*"immopilot-ci"/.test(configSource), 'Supabase project_id must be local and non-sensitive.');
check(/major_version\s*=\s*17/.test(configSource), 'Local PostgreSQL must use major version 17.');
check(/\[db\.seed\][\s\S]*?enabled\s*=\s*false/.test(configSource), 'Local database seeding must be disabled.');
check(/\[auth\][\s\S]*?enabled\s*=\s*true/.test(configSource), 'Local Auth must remain available for auth schema tests.');

const protectedRuntime = [workflowSource, runCi, runPgtap, stopScript, configSource];
for (const source of protectedRuntime) {
  check(!source.toLowerCase().includes(hostedDomain), 'Protected database CI files must not contain a hosted Supabase URL.');
  check(!source.split(/[^a-z0-9]+/i).some((token) => sha256(token) === forbiddenProjectHash), 'Protected database CI files must not contain the forbidden project reference.');
  check(!includesCommand(source, ['supabase', 'link']), 'Protected database CI files must not link a hosted project.');
  check(!includesCommand(source, ['supabase', 'db', 'push']), 'Protected database CI files must not push a hosted database.');
  check(!includesCommand(source, ['supabase', 'functions', 'deploy']), 'Protected database CI files must not deploy functions.');
  check(!/\bsupabase\s+migration\s+up\b[^\n]*--linked\b/i.test(source), 'Protected database CI files must not migrate a linked project.');
  check(!source.includes('|| true'), 'Protected database CI files must not mask failures with a forced success.');
}
check(guardSource.includes('SUPABASE_ACCESS_TOKEN') && guardSource.includes('SUPABASE_DB_URL'), 'The guard must reject remote credentials while allowing a loopback database URL.');
check(guardSource.includes(forbiddenProjectHash), 'The guard must recognize the forbidden project reference without storing it in clear text.');

for (const command of ['npm run test:ci', 'npm run typecheck', 'npm run lint', 'npm run build', 'npm run ci:validate', 'npm run test:db:contracts', 'npm run ci:database']) {
  check(docsSource.includes(`\`${command}\``), `Testing documentation is missing ${command}.`);
}
check(docsSource.includes(expectedCliVersion) && docsSource.includes('58 migrations') && docsSource.includes('8 suites') && docsSource.includes('200 assertions'), 'Testing documentation must match the pinned version and current database inventory.');

if (failures.length > 0) {
  throw new Error(`Database CI contract failures:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
}

console.log(`Database CI contracts passed: ${inventory.migrationCount} migrations, ${inventory.suiteCount} suites, ${inventory.assertionCount} assertions, CLI ${expectedCliVersion}.`);
