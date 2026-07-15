import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const scanner = fileURLToPath(new URL('./scan-dump.mjs', import.meta.url))
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
