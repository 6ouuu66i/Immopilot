import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const scanner = fileURLToPath(new URL('./scan-dump.mjs', import.meta.url))
const sanitizer = fileURLToPath(new URL('./sanitize-output.mjs', import.meta.url))
const comparator = fileURLToPath(new URL('./compare-fingerprints.mjs', import.meta.url))
async function scan(content) {
  const dir = await mkdtemp(path.join(tmpdir(), 'cutover-scan-'))
  const input = path.join(dir, 'input.sql'), report = path.join(dir, 'report.json')
  await writeFile(input, content)
  const result = spawnSync(process.execPath, [scanner, input, report], { encoding: 'utf8' })
  return { result, report: await readFile(report, 'utf8') }
}

test('accepts schema DDL with DML inside a function body', async () => {
  const { result } = await scan("CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $$ BEGIN INSERT INTO t VALUES (1); END $$;")
  assert.equal(result.status, 0)
})
test('rejects top-level data and does not repeat personal data', async () => {
  const email = 'proof-person@example.invalid'
  const { result, report } = await scan(`INSERT INTO contacts(email) VALUES ('${email}');`)
  assert.notEqual(result.status, 0); assert.doesNotMatch(report, new RegExp(email))
})
test('rejects credentials without copying them to the report', async () => {
  const credential = 'postgresql://reader:very-secret@db.example.invalid/postgres'
  const { result, report } = await scan(`-- ${credential}`)
  assert.notEqual(result.status, 0); assert.doesNotMatch(report, /very-secret/)
})

test('rejects privileged role switches in a dump', async () => {
  for (const statement of ['SET ROLE postgres;', 'SET SESSION AUTHORIZATION "postgres";']) {
    const { result, report } = await scan(statement)
    assert.notEqual(result.status, 0)
    assert.match(report, /privileged-role-switch/)
  }
})

test('sanitizes every connection identity emitted by operational tooling', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'cutover-sanitize-'))
  const input = path.join(dir, 'dry-run.txt'), output = path.join(dir, 'sanitized.txt')
  const projectRef = 'abcdefghijklmnopqrst'
  await writeFile(input, `export PGHOST="db.${projectRef}.supabase.co"\nexport PGUSER="reader.${projectRef}"\nexport PGPASSWORD="secret-value"\nexport PGDATABASE="postgres"\n`)
  const result = spawnSync(process.execPath, [sanitizer, input, output], { encoding: 'utf8' })
  const sanitized = await readFile(output, 'utf8')
  assert.equal(result.status, 0)
  assert.doesNotMatch(sanitized, new RegExp(projectRef))
  assert.doesNotMatch(sanitized, /secret-value|reader\./)
})

test('treats ACL-only drift as a blocking privilege difference', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'cutover-compare-'))
  const remotePath = path.join(dir, 'remote.json'), localPath = path.join(dir, 'local.json'), output = path.join(dir, 'diff.json')
  const base = { key: 'public.protected_table', kind: 'r', owner: 'postgres', acl: ['anon=r/postgres'] }
  await writeFile(remotePath, JSON.stringify({ relations: [base] }))
  await writeFile(localPath, JSON.stringify({ relations: [{ ...base, owner: 'local_owner', acl: [] }] }))
  const result = spawnSync(process.execPath, [comparator, remotePath, localPath, output], { encoding: 'utf8' })
  const report = JSON.parse(await readFile(output, 'utf8'))
  assert.notEqual(result.status, 0)
  assert.equal(report.privilegeParity, false)
  assert.equal(report.differences[0].classification, 'blocking-privilege-difference')
})
