import fs from 'node:fs/promises';
import path from 'node:path';
import { parseDocument } from 'yaml';

const rootDir = process.cwd();
const workflowsDir = path.join(rootDir, '.github', 'workflows');
const workflowNames = (await fs.readdir(workflowsDir))
  .filter((name) => /\.ya?ml$/i.test(name))
  .sort();

if (workflowNames.length === 0) {
  throw new Error('No GitHub Actions workflow found in .github/workflows.');
}

const failures = [];
for (const name of workflowNames) {
  const source = await fs.readFile(path.join(workflowsDir, name), 'utf8');
  const document = parseDocument(source, { uniqueKeys: true });
  const parsed = document.toJS();

  document.errors.forEach((error) => failures.push(`${name}: ${error.message}`));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    failures.push(`${name}: workflow root must be a YAML mapping`);
    continue;
  }
  if (!parsed.on || typeof parsed.on !== 'object') failures.push(`${name}: missing trigger mapping`);
  if (!parsed.jobs || typeof parsed.jobs !== 'object') failures.push(`${name}: missing jobs mapping`);
}

if (failures.length > 0) {
  throw new Error(`Invalid GitHub Actions workflow:\n${failures.join('\n')}`);
}

console.log(`Validated ${workflowNames.length} GitHub Actions workflow(s): ${workflowNames.join(', ')}`);
