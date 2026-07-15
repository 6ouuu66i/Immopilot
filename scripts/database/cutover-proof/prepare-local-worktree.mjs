import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const [root, destination] = process.argv.slice(2)
if (!root || !destination) throw new Error('usage: prepare-local-worktree.mjs <root> <migration-destination>')
const migrations = path.join(root, 'supabase', 'migrations')
const files = (await import('node:fs/promises')).readdir(migrations).then((items) => items.filter((item) => item.endsWith('.sql')))
const migrationFiles = await files
if (migrationFiles.length !== 57) throw new Error(`Expected 57 historical migrations, found ${migrationFiles.length}.`)
await rm(destination, { recursive: true, force: true })
await mkdir(path.dirname(destination), { recursive: true })
await rename(migrations, destination)
await mkdir(migrations)

const temp = path.join(root, 'supabase', '.temp')
for (const name of ['project-ref', 'pooler-url', 'linked-project']) await rm(path.join(temp, name), { force: true })

const configPath = path.join(root, 'supabase', 'config.toml')
let config = await readFile(configPath, 'utf8')
if (!/\[db\.seed\][\s\S]*?\benabled\s*=\s*false(?=\s*(?:#.*)?$)/m.test(config)) {
  throw new Error('Disposable proof requires [db.seed] enabled = false.')
}
for (const section of ['storage', 'realtime']) {
  const expression = new RegExp(`(\\[${section}\\][\\s\\S]*?\\benabled\\s*=\\s*)false(?=\\s*(?:#.*)?$)`, 'm')
  if (!expression.test(config)) throw new Error(`Expected ${section} to be explicitly disabled in config.toml.`)
  config = config.replace(expression, '$1true')
}
await writeFile(configPath, config)
await stat(destination)
console.log('Prepared an unlinked disposable Supabase worktree with 57 historical migrations isolated.')
