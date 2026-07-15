# Pre-Alpha cutover schema proof

This temporary workflow proves whether the current Pre-Alpha `public` schema can be dumped without data, restored into a disposable Supabase stack, and compared structurally. It does **not** create a baseline migration and does not mutate the remote database.

## Protected setup

1. In GitHub, create an environment named exactly `cutover-schema-readonly`.
2. Add required reviewers when the repository plan supports them. On plans where this option is unavailable, keep the secret scoped only to this dedicated environment and dispatch the workflow manually.
3. In that environment only, add a secret named exactly `CUTOVER_DATABASE_URL` containing a dedicated database connection URL whose role has read-only privileges and its own `default_transaction_read_only=on` setting.
4. Do not paste the URL into an issue, task, commit, workflow input, or chat.

The workflow is manual-only (`workflow_dispatch`) and has `contents: read` repository permission. The remote schema is extracted directly by the official PostgreSQL 17 `pg_dump` binary, without `SET ROLE`, `--role`, Supabase linking, or an administrator credential. It keeps ACLs, omits ownership statements for portable restoration, and inventories owners separately in the fingerprint. Before extraction, the workflow verifies `PGOPTIONS`, both read-only settings, login/session identity, role attributes, memberships, privileged `SET ROLE` paths, object ownership, direct write grants, sequence mutation rights, and callable `SECURITY DEFINER` write paths. Artifacts are private and retained for one day.

## Run and interpret

Dispatch **Cutover schema proof** from the Actions tab and approve the protected environment when GitHub requests it. The job creates:

- the real schema-only `public` dump and its SHA-256;
- remote and disposable-local structural fingerprints;
- effective privilege matrices for `anon`, `authenticated`, and `service_role`, embedded in both fingerprints;
- a classified structural diff;
- a source and catalog inventory for `scrape_runs` dependencies;
- an explicit inventory of managed objects outside the dump scope;
- sanitized operational logs and security reports.

Download the artifact only to `.tmp/migration-cutover/github-artifact-<run-id>/`. Do not commit it. Before using any result, confirm that every security report says `safe: true`.

The proof is acceptable only when restoration succeeds, `blockingCount` is zero, `privilegeParity` is true, and `hard_dependency_count` / `hardDependencyCount` are zero. Extension-managed and technical metadata differences remain documented but are not schema blockers. ACL, default-privilege, RLS, or effective-role differences are always blocking. Any other difference, a restore failure, or a hard `scrape_runs` dependency stops cutover analysis.

If the dump security scan fails, the SQL file and checksum are deleted before upload. A separate one-day artifact named `cutover-schema-security-report-<run-id>` contains only rule names, counts, and affected object names; it never contains the matched values.

This workflow deliberately does not run `db push`, `db pull`, migration repair/squash/up, a linked reset, or any remote write. It must be removed after the cutover decision.
