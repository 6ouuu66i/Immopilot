import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import YAML from 'yaml'

const root = path.resolve(new URL('../../..', import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (m) => m.slice(1)))
const workflowPath = process.env.CUTOVER_PROOF_WORKFLOW_PATH || path.join(root, '.github/workflows/cutover-schema-proof.yml')
const workflowText = await readFile(workflowPath, 'utf8')
const workflow = YAML.parse(workflowText)
const scriptDirectory = path.join(root, 'scripts/database/cutover-proof')
const operationalFiles = (await readdir(scriptDirectory)).filter((name) => name !== 'contracts.mjs' && !name.endsWith('.test.mjs'))
const operationalText = (await Promise.all(operationalFiles.map((name) => readFile(path.join(scriptDirectory, name), 'utf8')))).join('\n')
const combined = `${workflowText}\n${operationalText}`
const errors = []
const requireMatch = (condition, message) => { if (!condition) errors.push(message) }
const on = workflow.on ?? workflow.true
requireMatch(workflow.name === 'Cutover schema proof', 'workflow name must be exact')
requireMatch(on && typeof on === 'object' && Object.keys(on).length === 1 && 'workflow_dispatch' in on, 'only workflow_dispatch is allowed')
requireMatch(workflow.permissions?.contents === 'read' && Object.keys(workflow.permissions).length === 1, 'permissions must be contents: read only')
const job = workflow.jobs?.['schema-proof']
requireMatch(job?.environment === 'cutover-schema-readonly', 'protected environment name must be exact')
requireMatch(job?.['runs-on'] === 'ubuntu-latest', 'runner must be ubuntu-latest')
requireMatch(job?.['timeout-minutes'] === 45, 'timeout must be 45 minutes')
requireMatch(workflowText.includes('secrets.CUTOVER_DATABASE_URL'), 'secret name must be CUTOVER_DATABASE_URL')
requireMatch(workflowText.includes('retention-days: 1'), 'artifact retention must be one day')
requireMatch(combined.includes('postgres:17'), 'PostgreSQL 17 container is required')
requireMatch(combined.includes('default_transaction_read_only=on'), 'read-only session proof is required')
requireMatch(combined.includes('--schema-only') && combined.includes('--schema=public'), 'public schema-only dump is required')
requireMatch(combined.includes('artifact_safe=true'), 'artifact upload must be gated by security scans')
for (const [name, pattern] of Object.entries({
  'remote database mutation': /supabase\s+db\s+(?:push|pull|reset)\b|supabase\s+migration\s+(?:repair|squash|up)\b/i,
  'linked operation': /--linked\b/i,
  'debug output': /--debug\b|set\s+-x\b/i,
  'automatic trigger': /^\s*(?:push|pull_request|schedule):/m,
  'secret echo': /echo[^\n]*\$(?:\{)?(?:CUTOVER_DATABASE_URL|DATABASE_URL)/i,
  'error masking': /\|\|\s*(?:true|:)/,
})) requireMatch(!pattern.test(combined), `${name} is forbidden`)
requireMatch(!/[a-z]{20}\.supabase\.(?:co|net)/i.test(combined), 'project reference must not be hardcoded')
if (errors.length) {
  console.error(`Cutover proof contract failed (${errors.length} rule(s)).`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}
console.log('Cutover proof workflow contracts are valid.')
