import { readFile, writeFile } from 'node:fs/promises'

const [remotePath, localPath, output] = process.argv.slice(2)
if (!remotePath || !localPath || !output) throw new Error('usage: compare-fingerprints.mjs <remote> <local> <output>')
const remote = JSON.parse(await readFile(remotePath, 'utf8'))
const local = JSON.parse(await readFile(localPath, 'utf8'))
const categories = ['relations','columns','types','sequences','views','constraints','indexes','functions','triggers','policies','extensions','publications','default_acls','role_privileges']
const differences = []

for (const category of categories) {
  const left = new Map(normalize(category, remote[category] ?? []).map((item) => [item.key, item]))
  const right = new Map(normalize(category, local[category] ?? []).map((item) => [item.key, item]))
  for (const key of [...new Set([...left.keys(), ...right.keys()])].sort()) {
    const before = left.get(key), after = right.get(key)
    if (JSON.stringify(before) === JSON.stringify(after)) continue
    let classification = 'blocking-schema-difference'
    if (category === 'extensions' || before?.extension_owner || after?.extension_owner) classification = 'extension-managed'
    else if (key.includes('scrape_runs')) classification = 'scrape-runs'
    else if (category === 'role_privileges' || privilegeOnly(before, after)) classification = 'blocking-privilege-difference'
    else if (category === 'default_acls') classification = 'blocking-default-privilege-difference'
    else if (category === 'policies') classification = 'blocking-rls-policy-difference'
    else if (category === 'views' && populatedOnly(before, after)) classification = 'missing-bootstrap-dml'
    else if (ownerOnly(before, after)) classification = 'expected-local-owner'
    differences.push({ category, key, classification, remote: before ?? null, local: after ?? null })
  }
}
if (remote.meta?.server_version !== local.meta?.server_version) {
  differences.push({ category: 'meta', key: 'server_version', classification: 'technical-metadata', remote: remote.meta?.server_version, local: local.meta?.server_version })
}
const nonBlocking = new Set(['extension-managed','expected-local-owner','technical-metadata'])
const blockingCount = differences.filter((item) => !nonBlocking.has(item.classification)).length
const privilegeDifferenceCount = differences.filter((item) => item.classification.includes('privilege') || item.classification === 'blocking-rls-policy-difference').length
const result = {
  verdict: blockingCount ? 'blocking_differences' : 'restorable_no_blocking_difference',
  blockingCount,
  privilegeParity: privilegeDifferenceCount === 0,
  privilegeDifferenceCount,
  differences,
}
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 })
if (blockingCount) process.exitCode = 5

function normalize(category, items) {
  const normalized = structuredClone(items)
  for (const item of normalized) {
    if (Array.isArray(item.acl)) item.acl.sort()
    if (category === 'columns' && typeof item.default === 'string') {
      item.default = item.default.replaceAll('extensions.', '')
    }
  }
  if (category === 'columns') {
    const byRelation = new Map()
    for (const item of normalized) {
      const relation = item.key.slice(0, item.key.lastIndexOf('.'))
      const group = byRelation.get(relation) ?? []
      group.push(item)
      byRelation.set(relation, group)
    }
    for (const group of byRelation.values()) {
      group.sort((a, b) => a.ordinal - b.ordinal)
      group.forEach((item, index) => { item.ordinal = index + 1 })
    }
  }
  return normalized
}

function ownerOnly(a, b) {
  if (!a || !b) return false
  const strip = (value) => { const copy = structuredClone(value); delete copy.owner; return copy }
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b))
}

function privilegeOnly(a, b) {
  if (!a || !b || (!('acl' in a) && !('acl' in b))) return false
  if (JSON.stringify(a.acl) === JSON.stringify(b.acl)) return false
  const strip = (value) => { const copy = structuredClone(value); delete copy.owner; delete copy.acl; return copy }
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b))
}

function populatedOnly(a, b) {
  if (!a || !b) return false
  const strip = (value) => { const copy = structuredClone(value); delete copy.populated; return copy }
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b))
}
