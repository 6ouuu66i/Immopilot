import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, 'src');
const productionExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const ignoredDirectories = new Set([
  '__tests__',
  'archive',
  'archives',
  'dist',
  'legacy',
  'node_modules',
  'test',
  'tests',
]);

interface ForbiddenPattern {
  label: string;
  pattern: RegExp;
}

const forbiddenProductionPatterns: ForbiddenPattern[] = [
  { label: 'classe ImmoPilotStore', pattern: /\bImmoPilotStore\b/ },
  { label: 'instanciation ImmoPilotStore', pattern: /\bnew\s+ImmoPilotStore\s*\(/ },
  { label: 'import legacy lib/store', pattern: /['"][^'"]*lib\/store(?:\.[cm]?[jt]sx?)?['"]/ },
  { label: 'agents CRM mock', pattern: /\bMOCK_AGENTS\b/ },
  { label: 'contacts CRM mock', pattern: /\bMOCK_CONTACTS\b/ },
  {
    label: 'prop store transportée vers une page métier',
    pattern: /<(?:Biens|Contacts|Pipeline)\b[^>]*\bstore\s*=/,
  },
  {
    label: 'générateur de tableaux CRM mock',
    pattern: /\b(?:generateProperties|generateInitial(?:Deals|Signals|Tasks|Transfers|Notifications|Commissions|AuditLogs))\b/,
  },
];

async function productionSourceFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return ignoredDirectories.has(entry.name) ? [] : productionSourceFiles(absolutePath);
    }
    if (!entry.isFile() || !productionExtensions.has(path.extname(entry.name))) return [];
    if (/\.(?:spec|test)\.[cm]?[jt]sx?$/.test(entry.name)) return [];
    return [absolutePath];
  }));
  return files.flat();
}

test('production code cannot reintroduce the legacy ImmoPilotStore or its CRM seed arrays', async () => {
  const files = await productionSourceFiles(sourceDir);
  const violations: string[] = [];

  await Promise.all(files.map(async (file) => {
    const source = await fs.readFile(file, 'utf8');
    forbiddenProductionPatterns.forEach(({ label, pattern }) => {
      if (pattern.test(source)) violations.push(`${path.relative(rootDir, file)}: ${label}`);
    });
  }));

  expect(violations, violations.join('\n')).toEqual([]);
  await expect(fs.access(path.join(sourceDir, 'lib', 'store.ts'))).rejects.toThrow();
});

test('business pages cannot receive a runtime store prop', async () => {
  const businessPages = ['Biens.tsx', 'Contacts.tsx', 'Pipeline.tsx'];
  const violations: string[] = [];

  await Promise.all(businessPages.map(async (name) => {
    const file = path.join(sourceDir, 'pages', name);
    const source = await fs.readFile(file, 'utf8');
    if (/\bstore\s*=\s*\{\s*store\s*\}/.test(source)) violations.push(`${name}: JSX store prop`);
    if (/^\s*store\??\s*:/m.test(source)) violations.push(`${name}: typed store prop`);
  }));

  expect(violations, violations.join('\n')).toEqual([]);
});
