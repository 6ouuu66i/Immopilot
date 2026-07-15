import { readFile, writeFile } from 'node:fs/promises'

const [catalogPath, sourcePath, output] = process.argv.slice(2)
if (!catalogPath || !sourcePath || !output) throw new Error('usage: assert-no-hard-dependencies.mjs <catalog> <source> <output>')
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
const source = JSON.parse(await readFile(sourcePath, 'utf8'))
const catalogHard = Number(catalog.hard_dependency_count ?? 0)
const sourceHard = Number(source.hardDependencyCount ?? 0)
const result = {
  verdict: catalogHard + sourceHard === 0 ? 'no-hard-scrape-runs-dependency' : 'hard-scrape-runs-dependency',
  catalogHardDependencyCount: catalogHard,
  sourceHardDependencyCount: sourceHard,
}
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 })
if (catalogHard + sourceHard > 0) process.exitCode = 7
