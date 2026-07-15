import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const [root, output] = process.argv.slice(2)
if (!root || !output) throw new Error('usage: inventory-scrape-runs.mjs <root> <output>')
const excluded = new Set(['.git', '.tmp', 'node_modules', 'graphify-out', '_external', 'dist', 'coverage'])
const matches = []
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excluded.has(entry.name)) continue
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) { await walk(full); continue }
    if (!/\.(?:sql|ts|tsx|js|mjs|md|json)$/.test(entry.name)) continue
    const value = await readFile(full, 'utf8')
    const lines = value.split(/\r?\n/).flatMap((line, index) => line.includes('scrape_runs') ? [index + 1] : [])
    if (!lines.length) continue
    const relative = path.relative(root, full).replaceAll('\\', '/')
    let classification = 'potential-hard'
    if (relative.startsWith('supabase/migrations/')) classification = value.includes('to_regclass') ? 'guarded-migration' : 'historical-migration'
    else if (relative.endsWith('database.types.ts')) classification = 'generated-type'
    else if (relative.startsWith('tests/') || relative.includes('.test.') || relative.includes('.spec.')) classification = 'test'
    else if (relative.startsWith('docs/')) classification = 'documentation'
    else if (relative.startsWith('scripts/database/cutover-proof/')) classification = 'proof-tooling'
    else if (relative.startsWith('src/')) classification = 'runtime-hard'
    matches.push({ file: relative, lines, count: lines.length, classification })
  }
}
await walk(root)
matches.sort((a,b) => a.file.localeCompare(b.file))
const hardDependencyCount = matches.filter((item) => item.classification === 'runtime-hard' || item.classification === 'potential-hard').length
await writeFile(output, `${JSON.stringify({ hardDependencyCount, matches }, null, 2)}\n`, { mode: 0o600 })
