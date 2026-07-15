import { test, expect } from '@playwright/test'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const root = process.cwd()
const contract = path.join(root, 'scripts/database/cutover-proof/contracts.mjs')
const workflow = path.join(root, '.github/workflows/cutover-schema-proof.yml')

test('temporary cutover proof satisfies the non-mutation contract', () => {
  expect(() => execFileSync(process.execPath, [contract], { cwd: root })).not.toThrow()
})

test('contract rejects a remote write without leaking its environment secret', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cutover-contract-'))
  const malicious = path.join(dir, 'workflow.yml')
  writeFileSync(malicious, `${readFileSync(workflow, 'utf8')}\n# supabase db push\n`)
  const secret = 'postgresql://reader:must-not-leak@example.invalid/postgres'
  const result = spawnSync(process.execPath, [contract], {
    cwd: root, encoding: 'utf8', env: { ...process.env, CUTOVER_PROOF_WORKFLOW_PATH: malicious, CUTOVER_DATABASE_URL: secret },
  })
  expect(result.status).not.toBe(0)
  expect(`${result.stdout}${result.stderr}`).not.toContain(secret)
})

test('workflow contains neither a hosted project reference nor a literal credential', () => {
  const source = readFileSync(workflow, 'utf8')
  expect(source).not.toMatch(/[a-z]{20}\.supabase\.(?:co|net)/i)
  expect(source).not.toMatch(/postgres(?:ql)?:\/\/[^\s]+:[^\s]+@/i)
})

test('privilege drift and sensitive dump failures are fail-closed', () => {
  const comparator = readFileSync(path.join(root, 'scripts/database/cutover-proof/compare-fingerprints.mjs'), 'utf8')
  const runner = readFileSync(path.join(root, 'scripts/database/cutover-proof/run-proof.sh'), 'utf8')
  expect(comparator).toContain('blocking-privilege-difference')
  expect(comparator).toContain('privilegeParity')
  expect(runner).toContain('security_report_only=true')
  expect(runner).toContain('rm -f -- "$artifact_dir/public-schema-current.sql"')
})
