# Pre-Alpha cutover schema proof

This temporary workflow proves whether the current Pre-Alpha `public` schema can be dumped without data, restored into a disposable Supabase stack, and compared structurally. It does **not** create a baseline migration and does not mutate the remote database.

## Protected setup

1. In GitHub, create an environment named exactly `cutover-schema-readonly`.
2. Add required reviewers so a human must approve every job that accesses the environment.
3. In that environment only, add a secret named exactly `CUTOVER_DATABASE_URL` containing a dedicated database connection URL whose role has read-only privileges.
4. Do not paste the URL into an issue, task, commit, workflow input, or chat.

The workflow is manual-only (`workflow_dispatch`), uses `default_transaction_read_only=on`, and has `contents: read` repository permission. The artifact is private and retained for one day.

## Run and interpret

Dispatch **Cutover schema proof** from the Actions tab and approve the protected environment when GitHub requests it. The job creates:

- the real schema-only `public` dump and its SHA-256;
- remote and disposable-local structural fingerprints;
- a classified structural diff;
- a source and catalog inventory for `scrape_runs` dependencies;
- an explicit inventory of managed objects outside the dump scope;
- sanitized operational logs and security reports.

Download the artifact only to `.tmp/migration-cutover/github-artifact-<run-id>/`. Do not commit it. Before using any result, confirm that every security report says `safe: true`.

The proof is acceptable only when restoration succeeds, `blockingCount` is zero, and `hard_dependency_count` / `hardDependencyCount` are zero. Extension-managed and technical metadata differences remain documented but are not schema blockers. Any other difference, a restore failure, or a hard `scrape_runs` dependency stops cutover analysis.

This workflow deliberately does not run `db push`, `db pull`, migration repair/squash/up, a linked reset, or any remote write. It must be removed after the cutover decision.
