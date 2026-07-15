import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const [input, report, mode] = process.argv.slice(2)
if (!input || !report) throw new Error('usage: scan-dump.mjs <input> <report> [--log]')
const value = await readFile(input, 'utf8')
const findings = []
const add = (rule, pattern) => {
  const matches = [...value.matchAll(pattern)].filter((match) => !match[0].includes('[REDACTED_'))
  if (!matches.length) return
  const objects = [...new Set(matches.map((match) => objectAt(match.index ?? 0)))]
  findings.push({ rule, count: matches.length, objects })
}
const secret = process.env.CUTOVER_DATABASE_URL
if (secret && value.includes(secret)) findings.push({ rule: 'exact-environment-secret', count: value.split(secret).length - 1, objects: [path.basename(input)] })
add('credentialed-database-url', /postgres(?:ql)?:\/\/[^\s'"<>:@]+:[^\s'"<>@]+@/gi)
add('hosted-supabase-url', /https?:\/\/[a-z0-9-]+\.supabase\.(?:co|net)/gi)
add('supabase-project-reference', /\bproject[_ -]?ref\b\s*(?:=|:)\s*['"]?[a-z]{20}\b|(?:db\.)?[a-z]{20}\.(?:supabase\.(?:co|net)|pooler\.supabase\.com)/gi)
add('jwt-or-supabase-key', /\b(?:eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|sb_(?:secret|publishable)_[A-Za-z0-9_-]+)\b/gi)
add('password-literal', /(?:password|passwd|pwd)\s*(?:=|:|\s)\s*['"]?[^\s,'";]+/gi)
add('private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g)
add('personal-email', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)
add('role-or-database-ddl', /^(?:CREATE|ALTER|DROP)\s+(?:ROLE|USER|DATABASE)\b/gim)
add('vault-or-secret-value', /\b(?:vault|secret|token)\b\s*(?:=|:|VALUES?)\s*['"][^'"]+/gi)
add('zimmo-session-value', /\bzimmo_session\b\s*(?:=|:|VALUES?)\s*['"][^'"]+/gi)
add('sensitive-set-parameter', /^\s*SET\s+\S*(?:password|secret|token|session|jwt)\S*\s*(?:=|TO)\s*\S+/gim)

if (mode !== '--log') {
  const topLevel = splitSql(value)
  const dmlCount = topLevel.filter((statement) => /^(?:INSERT|UPDATE|DELETE|COPY)\b/i.test(statement.trim())).length
  if (dmlCount) findings.push({ rule: 'top-level-data-statement', count: dmlCount, objects: [path.basename(input)] })
}
const result = { safe: findings.length === 0, file: path.basename(input), findings }
await writeFile(report, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 })
if (findings.length) process.exitCode = 4

function objectAt(index) {
  const prefix = value.slice(0, index)
  const matches = [...prefix.matchAll(/\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW|MATERIALIZED\s+VIEW|FUNCTION|PROCEDURE|TRIGGER|POLICY|TYPE|DOMAIN|SEQUENCE|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:ONLY\s+)?("?[A-Za-z_][\w$]*"?(?:\."?[A-Za-z_][\w$]*"?)?)/gi)]
  return matches.at(-1)?.[1] ?? path.basename(input)
}

function splitSql(sql) {
  const statements = []
  let start = 0, quote = null, dollar = null, lineComment = false, blockDepth = 0
  for (let i = 0; i < sql.length; i += 1) {
    const pair = sql.slice(i, i + 2)
    if (lineComment) { if (sql[i] === '\n') lineComment = false; continue }
    if (blockDepth) { if (pair === '/*') { blockDepth++; i++ } else if (pair === '*/') { blockDepth--; i++ }; continue }
    if (dollar) { if (sql.startsWith(dollar, i)) { i += dollar.length - 1; dollar = null }; continue }
    if (quote) { if (sql[i] === quote && sql[i + 1] === quote) { i++; continue } if (sql[i] === quote) quote = null; continue }
    if (pair === '--') { lineComment = true; i++; continue }
    if (pair === '/*') { blockDepth = 1; i++; continue }
    if (sql[i] === "'" || sql[i] === '"') { quote = sql[i]; continue }
    if (sql[i] === '$') { const match = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/); if (match) { dollar = match[0]; i += dollar.length - 1; continue } }
    if (sql[i] === ';') { statements.push(sql.slice(start, i)); start = i + 1 }
  }
  if (sql.slice(start).trim()) statements.push(sql.slice(start))
  return statements
}
