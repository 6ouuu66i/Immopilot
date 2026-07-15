import { writeFile } from 'node:fs/promises'
const [output] = process.argv.slice(2)
if (!output) throw new Error('usage: write-out-of-dump-inventory.mjs <output>')
const objects = [
  ['Auth schema and users', false, true, 'managed integration and auth configuration'],
  ['Storage schema', false, true, 'managed integration'],
  ['Storage buckets and objects data', false, false, 'manual configuration/data migration'],
  ['Storage policies', false, false, 'manual policy inventory'],
  ['Auth triggers', false, true, 'manual trigger inventory'],
  ['Auth before-user hook', false, false, 'manual project configuration'],
  ['Realtime publication', 'partially fingerprinted', true, 'managed integration verification'],
  ['Cron extension and jobs', false, true, 'managed extension plus manual job inventory'],
  ['Vault secrets', false, false, 'excluded; secrets must be recreated manually'],
  ['SMTP, site URL, redirects, providers, CAPTCHA', false, false, 'manual project configuration'],
].map(([object, includedInDump, disposableLocal, handling]) => ({ object, includedInDump, disposableLocal, handling }))
await writeFile(output, `${JSON.stringify({ scope: 'public schema-only dump', objects }, null, 2)}\n`, { mode: 0o600 })
