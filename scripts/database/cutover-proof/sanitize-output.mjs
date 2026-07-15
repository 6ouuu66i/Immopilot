import { readFile, writeFile } from 'node:fs/promises'

const [input, output] = process.argv.slice(2)
if (!input || !output) throw new Error('usage: sanitize-output.mjs <input> <output>')

let value = await readFile(input, 'utf8')
const secret = process.env.CUTOVER_DATABASE_URL
if (secret) value = value.split(secret).join('[REDACTED_DATABASE_URL]')

const rules = [
  [/postgres(?:ql)?:\/\/[^\s'"<>]+/gi, '[REDACTED_DATABASE_URL]'],
  [/https?:\/\/[a-z0-9-]+\.supabase\.(?:co|net)(?:\/[^\s'"<>]*)?/gi, '[REDACTED_SUPABASE_URL]'],
  [/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/g, '[REDACTED_JWT]'],
  [/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+\b/gi, '[REDACTED_SUPABASE_KEY]'],
  [/(?:password|passwd|pwd)(\s*(?:=|:|\s)\s*)[^\s,;]+/gi, '$1[REDACTED_PASSWORD]'],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]'],
]
for (const [pattern, replacement] of rules) value = value.replace(pattern, replacement)
await writeFile(output, value, { mode: 0o600 })
console.log(`Sanitized output written (${Buffer.byteLength(value)} bytes).`)
