import { writeFile } from 'node:fs/promises'
const [status, output] = process.argv.slice(2)
if (!status || !output) throw new Error('usage: write-restore-failure.mjs <status> <output>')
await writeFile(output, `${JSON.stringify({ verdict: 'restore_failed', restoreExitStatus: Number(status), blocking: true }, null, 2)}\n`, { mode: 0o600 })
