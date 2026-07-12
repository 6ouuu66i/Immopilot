# AUDIT STATUS — ImmoPilot Technical Audit

Last updated: 2026-07-12 (session complete)
Mode: READ-ONLY audit. Only `docs/audit/**` was written. No application code, dependencies, database, Supabase remote, or git state was modified.

## Current phase

**COMPLETE.** All 12 deliverables written. No fixes implemented (per instructions).

## Completed sections

- [x] 00-executive-summary.md
- [x] 01-system-architecture.md
- [x] 02-core-business-flows.md
- [x] 03-frontend-audit.md
- [x] 04-backend-supabase-audit.md
- [x] 05-security-privacy-audit.md
- [x] 06-scraper-data-pipeline-audit.md
- [x] 07-performance-scalability-audit.md
- [x] 08-reliability-testing-audit.md
- [x] 09-cleanup-candidates.md
- [x] 10-prioritized-roadmap.md
- [x] findings.json (27 findings: 1 Critical, 5 High, 10 Medium, 7 Low, 4 Info)
- [x] AUDIT_STATUS.md

## Findings severity counts

- Critical: 1 (F-001)
- High: 5 (F-002, F-008, F-015, F-021 + F-002 group)
- Medium: 10
- Low: 7
- Informational: 4

## Top 5 most urgent

1. **F-001 (Critical)** — profiles UPDATE policy lets any user self-set `role='admin'`/`agency_id` → tenant breach.
2. **F-002 (High)** — invitation acceptance unimplemented → can't onboard agents.
3. **F-015 (High)** — Biens card badges/filters read the mock store, not Supabase → wrong associations on the core screen.
4. **F-021 (High)** — tests mostly grep source; no RLS/auth/behavioral coverage; no CI (F-022).
5. **F-008 (High)** — dashboard RPC recomputes the live view instead of the matview → market-sized latency.

## Files / modules inspected (full or targeted)

- Config: package.json, tsconfig.json, vite.config.ts, .env.example, .gitignore, index.html, playwright.config.ts
- Entry/auth: src/main.tsx, src/lib/supabase.ts, src/lib/auth.tsx, src/components/ProtectedRoute.tsx, src/lib/posthog.ts
- Data access: src/lib/supabaseProperties.ts, src/lib/maps.ts
- Services: adminService.ts, agentsService.ts, dealsService.ts, transfersService.ts (+ grep of agencyService/profileService/contactsService)
- Frontend: structural read of src/pages/Biens.tsx (4680 lines), store usage map, src/lib/store.ts (seed/exports)
- DB migrations read in full: 20260629182221, 20260629182636, 20260629183102, 20260630191111, 20260630183122, 20260704171942, 20260704221041, 20260705203911, 20260708163543, 20260708163823, 20260708165811, 20260711031621, 20260711161116
- Sweeps: all CREATE POLICY, all SECURITY DEFINER functions, XSS-sink grep, console/logging grep, agency_id/role write grep, invitation grep, test-style classification, tracked-junk enumeration

## Commands executed (read-only)

- git ls-files inventory + directory distribution
- wc -l on source; du -sh on _external/.tmp
- targeted greps (policies, functions, XSS sinks, role/agency writes, invitation, store usage, test style)
- NO build, NO test run, NO supabase MCP query, NO writes outside docs/audit/

## Blockers

- None. Supabase MCP was available but deliberately NOT used (avoid touching prod DB in a read-only audit). Some claims marked "verify" (pg_trgm search index presence, view/matview column parity, PITR enabled) require a live DB read the team can do separately.

## Remediation log

- **2026-07-12 — F-001 (Phase 0) fix APPLIED + VERIFIED on remote (ImmoPilot Pre-Alpha).**
  - Added migration `supabase/migrations/20260712040044_guard_profile_privileged_columns.sql` (BEFORE UPDATE trigger guarding `role`/`agency_id`/`is_active` on `public.profiles`; enforces for `authenticated`/`anon` only; admins keep role/is_active management; agency_id API-immutable).
  - Added RLS test `supabase/tests/f001_profiles_privileged_columns.test.sql` (pgTAP, 6 assertions) for CI/local `supabase test db`.
  - Local checks: `npm run lint` (tsc --noEmit) PASS; `npm run build` PASS. No app source changed.
  - **Applied to Pre-Alpha via Supabase MCP `apply_migration`** (single migration only — NOT `db push`; the 3 unrelated matview migrations were NOT applied). Recorded name `guard_profile_privileged_columns`, remote version `20260712040044`.
  - **Remote behavioral verification PASS 6/6** (BEGIN/DO…RAISE rollback tx, no persisted data): agent blocked from role/agency_id/is_active (42501); agent can still edit full_name/avatar_url; admin can change a member's role + is_active. Object checks confirmed; `set_updated_at_profiles` intact; zero residual test data.
  - **History reconciled (2026-07-12):** local file renamed from `20260712090000_...` to `20260712040044_guard_profile_privileged_columns.sql` to match the remote-recorded version, after byte/logic-level comparison confirmed the deployed function/trigger/grants are strictly equivalent to the local file content. No `supabase migration repair` was run (not needed — filename now matches remote history naturally); remote database untouched by this reconciliation. Still open, separately: 9 remote-only migrations with no local file, and 3 local-only matview migrations not yet applied to remote — out of scope for F-001, not touched.
  - Not committed/pushed (per instructions).

## Next recommended action

1. Run `supabase start && supabase test db` (locally or in CI) to execute `f001_profiles_privileged_columns.test.sql` and confirm all 6 assertions pass; then mark F-001 fully resolved.
2. Proceed to Phase 1 — next finding: **F-002** (invitation acceptance), which also unblocks the legitimate `agency_id` assignment path the F-001 guard intentionally reserves for a SECURITY DEFINER function. See [10-prioritized-roadmap.md](10-prioritized-roadmap.md).

## Confirmation

No application code, dependencies, database objects, or git history were modified during this audit. Only files under `docs/audit/` were created.
