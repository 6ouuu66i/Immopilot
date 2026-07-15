import { readFile, writeFile } from 'node:fs/promises'
const [remotePath, localPath, output] = process.argv.slice(2)
if (!remotePath || !localPath || !output) throw new Error('usage: write-out-of-dump-inventory.mjs <remote-fingerprint> <local-fingerprint> <output>')
const remote = JSON.parse(await readFile(remotePath, 'utf8')).managed_inventory ?? {}
const local = JSON.parse(await readFile(localPath, 'utf8')).managed_inventory ?? {}
const objects = [
  { object: 'auth', includedInDump: false, remotePresent: remote.auth_schema, disposableLocalPresent: local.auth_schema, handling: 'managed integrations' },
  { object: 'auth.users', includedInDump: false, remotePresent: remote.auth_users_table, disposableLocalPresent: local.auth_users_table, handling: 'managed integrations' },
  { object: 'storage', includedInDump: false, remotePresent: remote.storage_schema, disposableLocalPresent: local.storage_schema, handling: 'managed integrations' },
  { object: 'storage buckets and objects data', includedInDump: false, remotePresent: 'not inspected (data)', disposableLocalPresent: 'not seeded', catalogTableRemote: remote.storage_buckets_table, catalogTableLocal: local.storage_buckets_table, handling: 'bootstrap or manual data migration' },
  { object: 'storage policies', includedInDump: false, remotePresent: (remote.storage_policies ?? []).length > 0, disposableLocalPresent: (local.storage_policies ?? []).length > 0, remoteCatalog: remote.storage_policies ?? [], localCatalog: local.storage_policies ?? [], handling: 'baseline or managed policy configuration' },
  { object: 'auth.users triggers', includedInDump: false, remotePresent: (remote.auth_user_triggers ?? []).length > 0, disposableLocalPresent: (local.auth_user_triggers ?? []).length > 0, remoteCatalog: remote.auth_user_triggers ?? [], localCatalog: local.auth_user_triggers ?? [], handling: 'baseline or managed integration' },
  { object: 'Before User Created Hook', includedInDump: false, remotePresent: 'not observable through DDL catalogs', disposableLocalPresent: false, handling: 'manual Auth configuration' },
  { object: 'Realtime publications', includedInDump: 'public memberships fingerprinted; managed publication excluded by CLI', remotePresent: (remote.realtime_publications ?? []).length > 0, disposableLocalPresent: (local.realtime_publications ?? []).length > 0, remoteCatalog: remote.realtime_publications ?? [], localCatalog: local.realtime_publications ?? [], handling: 'managed integrations' },
  { object: 'cron', includedInDump: false, remotePresent: remote.cron_extension, disposableLocalPresent: local.cron_extension, remoteJobCatalogPresent: remote.cron_jobs_table, localJobCatalogPresent: local.cron_jobs_table, handling: 'managed extension plus manual job inventory' },
  { object: 'Vault', includedInDump: false, remotePresent: remote.vault_extension, disposableLocalPresent: local.vault_extension, remoteSecretCatalogPresent: remote.vault_secrets_table, localSecretCatalogPresent: local.vault_secrets_table, handling: 'managed integration; secrets excluded and recreated manually' },
  { object: 'SMTP, Site URL, redirects, Confirm Email, providers, CAPTCHA', includedInDump: false, remotePresent: 'not observable through DDL catalogs', disposableLocalPresent: 'local defaults only', handling: 'manual Auth configuration' },
]
await writeFile(output, `${JSON.stringify({ scope: 'public schema-only dump', observationsContainNoRowsOrSecretValues: true, objects }, null, 2)}\n`, { mode: 0o600 })
