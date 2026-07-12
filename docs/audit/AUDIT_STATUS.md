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
  - Committed in isolated commit `5a6bd86` ("chore(db): reconcile F-001 migration history").

- **2026-07-12 — F-002 (Phase 1) fix APPLIED + VERIFIED on remote (ImmoPilot Pre-Alpha).**
  - Added migration `supabase/migrations/20260712050000_create_accept_invitation_function.sql` (`public.accept_invitation(p_token text)`, `SECURITY DEFINER`, `SET search_path=public`, `EXECUTE` revoked from `PUBLIC`/`anon`, granted to `authenticated` only).
  - Enforces: `auth.uid()` check, token format validation, invitation locked `FOR UPDATE` (must be `pending`, unexpired), strict `lower(trim(email))` match, profile locked `FOR UPDATE` (must have `agency_id IS NULL`, rejects even same-agency re-acceptance), atomic `agency_id`/`role` assignment + invitation `accepted`/`accepted_at`, `ROW_COUNT` integrity checks. Expired invitations rejected without mutation (no status write before raise). Returns `void`; never logs/returns the token.
  - Frontend: `#invite` route (outside `ProtectedRoute`), self-contained `InviteAccept.tsx` page (in-place sign-in/up + accept, no token storage), `src/lib/inviteToken.ts` (in-memory-only token capture, stripped from URL before `initPostHog()`), `src/lib/postHogRedaction.ts` (extracted pure redaction logic, wired into PostHog `sanitize_properties`), `agentsService.acceptInvitation()` (SQLSTATE → static French message mapping, never echoes raw token/server text).
  - Added pgTAP test `supabase/tests/f002_accept_invitation.test.sql` (9 assertions, scenarios 1-6/8) for CI/local `supabase test db`; added and **ran** `tests/e2e/invite-token-analytics-redaction.spec.ts` (8/8 PASS, scenario 9 + ordering/storage/no-token-leak checks).
  - Local checks: `npm run lint` PASS; `npm run build` PASS (new `InviteAccept` chunk code-split correctly); full Playwright suite 26/27 PASS (sole failure is the pre-existing, unrelated `seller-score-regression.spec.ts`, missing `E2E_EMAIL`/`E2E_PASSWORD` in this environment, file untouched).
  - **Applied to Pre-Alpha via Supabase MCP `apply_migration`** (single migration only — NOT `db push`; zero matview migrations applied, confirmed via `supabase_migrations.schema_migrations` count check). Recorded name `create_accept_invitation_function`, remote version `20260712050248` (local file timestamp `20260712050000` — same minor divergence pattern as F-001, not yet reconciled).
  - **Object/permission verification (read-only, all PASS):** function exists; `SECURITY DEFINER=true`; `search_path=public`; `authenticated` has `EXECUTE`, `anon`/`PUBLIC` do not; F-001 guard function + trigger still present and active (2 triggers total on `profiles`).
  - **Remote behavioral verification PASS 14/14** (single `DO`-block, forced `RAISE EXCEPTION` to roll back, zero persisted data): happy path (correct `agency_id`/`role`/`status`/`accepted_at`); mismatched email, expired, already-used (sequential reuse), unknown token, malformed token, already-in-agency — all rejected with the expected distinct error code; F-001 guard confirmed still blocking a direct `role`/`agency_id` self-change immediately after acceptance (`42501`). Zero residual `f002-*` test rows in any table afterward.
  - **Known, honestly-disclosed limitation:** true concurrent-session acceptance was not empirically tested (not expressible via a single DO block or sequential MCP calls); the guarantee rests on `SELECT ... FOR UPDATE`, verified by code review only. Sequential reuse of the same token WAS tested and correctly rejected.
  - Committed in isolated commit (see hash below); Contacts.tsx/useContacts.ts (modified by a separate, concurrent agent session) explicitly excluded via pathspec.

## Next recommended action

Both Phase 0 (F-001) and the primary Phase 1 blocker (F-002) are now applied and verified on Pre-Alpha. Remaining Phase 1 items per [10-prioritized-roadmap.md](10-prioritized-roadmap.md): **F-015** (Biens card associations reading the mock store instead of Supabase), **F-003** (transfer_requests UPDATE policy agency-scoping), **F-009/F-010** (pipeline observability/freshness), **F-021/F-022** (real test coverage + CI). Separately unresolved: local/remote migration-file timestamp divergence for F-002 (same reconciliation procedure as done for F-001, not yet run), 9 remote-only migrations with no local file, 3 local-only matview migrations not yet applied to remote, and the invitation flow's deferred 'expired' auto-transition.

## Confirmation

No application code, dependencies, database objects, or git history were modified during this audit. Only files under `docs/audit/` were created.
