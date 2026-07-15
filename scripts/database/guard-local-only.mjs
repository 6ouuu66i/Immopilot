import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.env.DB_CI_CONTRACT_ROOT || process.cwd();
const hostedDomain = ['supabase', 'co'].join('.');
const forbiddenProjectHash = '4dc7093ed200cef9d48db489231fbe8be3577f3dcc71366c1fbc6c46c758a7ba';
const alwaysForbiddenVariables = [
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_DB_PASSWORD',
  'SUPABASE_PROJECT_REF',
  'SUPABASE_SERVICE_ROLE_KEY',
];
const localUrlVariables = ['DATABASE_URL', 'SUPABASE_DB_URL', 'SUPABASE_URL', 'VITE_SUPABASE_URL'];
const protectedPaths = [
  '.github/workflows/database.yml',
  'scripts/database',
  'supabase/config.toml',
  'package.json',
];
const forbiddenCommandPatterns = [
  ['supabase', 'link'],
  ['supabase', 'db', 'push'],
  ['supabase', 'functions', 'deploy'],
].map((parts) => new RegExp(`\\b${parts.join('\\s+')}\\b`, 'i'));
const linkedMigrationPattern = /\bsupabase\s+migration\s+up\b[^\n]*--linked\b/i;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isLoopbackUrl(value) {
  try {
    const parsed = new URL(value);
    return ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

async function collectFiles(targetPath) {
  const stat = await fs.stat(targetPath);
  if (stat.isFile()) return [targetPath];
  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => collectFiles(path.join(targetPath, entry.name))));
  return nested.flat();
}

const failures = [];
for (const variableName of alwaysForbiddenVariables) {
  if (process.env[variableName]) failures.push(`${variableName} must not be defined.`);
}
for (const variableName of localUrlVariables) {
  const value = process.env[variableName];
  if (value && !isLoopbackUrl(value)) failures.push(`${variableName} must target a loopback address.`);
}
for (const [variableName, value] of Object.entries(process.env)) {
  if (!value) continue;
  const lowered = value.toLowerCase();
  if (lowered.includes(hostedDomain) || sha256(value) === forbiddenProjectHash) {
    failures.push(`${variableName} contains a forbidden remote Supabase value.`);
  }
}

const linkedStateFiles = ['project-ref', 'linked-project.json', 'pooler-url'];
for (const fileName of linkedStateFiles) {
  const linkedPath = path.join(rootDir, 'supabase', '.temp', fileName);
  try {
    const stat = await fs.stat(linkedPath);
    if (stat.size > 0) failures.push(`Linked Supabase state is present: supabase/.temp/${fileName}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

const files = [];
for (const relativePath of protectedPaths) {
  const absolutePath = path.join(rootDir, relativePath);
  try {
    files.push(...await collectFiles(absolutePath));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
for (const filePath of files) {
  const source = await fs.readFile(filePath, 'utf8');
  const relativePath = path.relative(rootDir, filePath).replaceAll('\\', '/');
  if (source.toLowerCase().includes(hostedDomain)) failures.push(`${relativePath} contains a hosted Supabase URL.`);
  if (sha256(source).includes(forbiddenProjectHash) || source.split(/[^a-z0-9]+/i).some((token) => sha256(token) === forbiddenProjectHash)) {
    failures.push(`${relativePath} contains the forbidden project reference.`);
  }
  if (forbiddenCommandPatterns.some((pattern) => pattern.test(source)) || linkedMigrationPattern.test(source)) {
    failures.push(`${relativePath} contains a forbidden remote Supabase command.`);
  }
}

if (failures.length > 0) {
  throw new Error(`Local-only database guard rejected the environment:\n${failures.join('\n')}`);
}

console.log('Local-only database guard passed: no linked state, remote credential, hosted URL, or remote command detected.');
