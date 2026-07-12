# 05 — Security & Privacy Audit (Area D)

Method: defensive static inspection only. No exploitation, no live data access. Because the app is a client-only SPA, **Postgres RLS is the entire authorization layer** — a single permissive policy is a full breach.

## 5.1 Headline: Critical tenant-isolation / privilege-escalation hole

> **Remediation status (2026-07-12): FIXED — applied and verified on ImmoPilot Pre-Alpha.** Migration [`20260712040044_guard_profile_privileged_columns.sql`](../../supabase/migrations/20260712040044_guard_profile_privileged_columns.sql) adds a `BEFORE UPDATE` trigger blocking self-mutation of `role`/`is_active` (admin-only) and `agency_id` (privileged-only) for end-user API roles. Applied to the remote via Supabase MCP `apply_migration` (single migration; recorded name `guard_profile_privileged_columns`, version `20260712040044`, matching the local filename). Remote behavioral verification passed 6/6 (agent blocked from role/agency_id/is_active with SQLSTATE 42501; agent can still edit full_name/avatar_url; admin can manage a member's role/is_active) in a rolled-back transaction with no persisted data. `tsc --noEmit` and `vite build` also pass. RLS test [`f001_profiles_privileged_columns.test.sql`](../../supabase/tests/f001_profiles_privileged_columns.test.sql) retained for CI.

### F-001 (Critical, High confidence) — self-service admin + agency switch
[20260629182636…:379-380](../../supabase/migrations/20260629182636_create_crm_remaining_schema_rls.sql):
```sql
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());
```
- No `WITH CHECK` → Postgres reuses `USING` as the check, so the **only** constraint on the new row is `id = auth.uid()`.
- `authenticated` holds default column-level `UPDATE` on `profiles`; there is **no BEFORE UPDATE trigger** guarding `role`/`agency_id` (only `set_updated_at_profiles`).
- Therefore any signed-in agent can:
  - `update({ role: 'admin' })` → become admin of their agency (manage invitations, agency settings, audit logs, delete contacts/deals, manage commissions);
  - `update({ agency_id: '<other-agency-uuid>' })` → join another tenant and read/write its CRM data via `current_agency_id()`.
- **Fix:** trigger rejecting `role`/`agency_id` self-changes (allow only via `is_admin()` / a controlled `accept_invitation`), or `REVOKE UPDATE(role, agency_id, is_active) … FROM authenticated`. Add an RLS regression test. **Phase 0.**

## 5.2 Other authorization findings

- **F-003 (Medium)** — `transfer_requests` UPDATE policy `USING (from_agent_id = auth.uid() OR is_admin())` has **no `agency_id` scoping** and no `WITH CHECK`. App-layer `transfersService` enforces same-agency, but RLS shouldn’t depend on that. Add `agency_id = current_agency_id()`. **Phase 1.**
- **Positive:** contacts/deals/tasks/notes/commissions/activities/audit_logs/pipeline_stages/contact_properties/agency_invitations are all correctly scoped by `current_agency_id()` (+ `is_admin()`/`owner_id`/`author_id` where appropriate). Admin-only mutations (delete contact/deal, manage commissions/stages/invitations, insert audit logs) require `is_admin()`. Storage policies scope by folder to `auth.uid()`/`current_agency_id()`.
- **Global-read tables** (`properties/listings/price_history/listing_signals/listing_scores/listing_score_history/listing_outcomes`) use `USING (true)` for all authenticated — **intentional shared market**. Acceptable, but document it: any authenticated user sees all prospecting data, scores, and signals for every listing (no per-agency market carve-out). This is fine for the product model but should be a conscious, written decision, since it means a churned/rogue account retains full market visibility until deactivated.

## 5.3 Authentication & onboarding

> **Remediation status (2026-07-12): FIXED — applied and verified on ImmoPilot Pre-Alpha.** Migration [`20260712050248_create_accept_invitation_function.sql`](../../supabase/migrations/20260712050248_create_accept_invitation_function.sql) adds `public.accept_invitation(p_token text)` (`SECURITY DEFINER`, `SET search_path = public`, `EXECUTE` revoked from `PUBLIC`/`anon`, granted to `authenticated` only). Enforces: caller authenticated (`auth.uid()`), strict `lower(trim(...))` email match against the invitation, invitation locked `FOR UPDATE` and must be `pending` and unexpired, profile locked `FOR UPDATE` and must have `agency_id IS NULL` (rejects even same-agency re-acceptance), atomic assignment of `agency_id`/`role` followed by `status='accepted'`/`accepted_at`, with `ROW_COUNT` checks on both updates. Never mutates an expired invitation's status (no update-then-raise). Never returns or logs the token. Frontend: `#invite` route + self-contained `InviteAccept` page (handles both unauthenticated sign-in/up and authenticated acceptance in place, no token storage — see [03](03-frontend-audit.md)); `agentsService.acceptInvitation()` maps SQLSTATEs to static French messages, never echoing raw server text. PostHog token redaction added (`sanitize_properties` + early URL strip before `initPostHog()`). Applied to Pre-Alpha via Supabase MCP `apply_migration` (single migration only). Remote-recorded name `create_accept_invitation_function`, version `20260712050248`, matching the local filename after reconciliation on 2026-07-12 (function body, `SECURITY DEFINER`, `search_path`, and grants confirmed byte/logic-equivalent to the local file before renaming). Live behavioral verification: 14/14 checks passed in a rolled-back transaction (happy path with correct `agency_id`/`role`/`status`/`accepted_at`; email mismatch, expired, reused, unknown, malformed-token, and already-in-agency all correctly rejected with distinct error codes; F-001 guard confirmed still blocking direct `role`/`agency_id` self-changes after acceptance). Zero residual test data. Manually re-verified end-to-end through the real UI by the user. **Known limitation:** true concurrent-session acceptance of the same token was not empirically tested (not expressible via a single DO block or sequential MCP calls); the safety guarantee rests on the `SELECT ... FOR UPDATE` row lock in the function, verified by code review, not by execution. A sequential reuse of the same token was tested and correctly rejected.
>
> Original finding (superseded by the fix above, kept for record):

- **F-002 (High)** — invitation acceptance is not implemented (no `#invite` route, no `accept_invitation` RPC, RLS blocks the invitee from reading the invitation). New users authenticate but land with `agency_id = NULL` and cannot join. See [02](02-core-business-flows.md) flow 15. **Phase 1.**
- **F-006 (Low)** — public `signUp` is open and unthrottled; `handle_new_user` mints a profile for every account. Combined with F-001 this is a self-serve foothold. Gate signup behind invites or enable Supabase captcha/rate-limits for beta. **Phase 1.**
- Invitation **token** design itself is sound: `encode(gen_random_bytes(32),'hex')` (256-bit, unpredictable), `UNIQUE`, 7-day expiry, `status` lifecycle. The weakness is the missing accept path, not the token.
- `is_active` deactivation is enforced client-side (`ProtectedRoute`) and referenced in services (`getCurrentProfile` throws if inactive), but a deactivated user’s **RLS still permits reads** (policies don’t check `is_active`). A deactivated-but-not-signed-out session can still query until token expiry. Consider adding `is_active` to sensitive policies or forcing signout server-side. (Low; note.)

## 5.4 Injection / unsafe rendering

- **XSS via scraped strings:** checked `src/lib/maps.ts` — all `innerHTML` writes are **static** template strings (splash/loading/error/SVG). Scraped `fullAddress`/`city` flow only into the Geocoder query and marker `title` **property** (not HTML). **No XSS there.**
- **Dead HTML-injection bridge:** `main.tsx` `LegacyPage`/`executeScripts` sets `innerHTML` and re-runs `<script>` tags, but `legacyRouteLoaders` is empty → unreachable. Latent sink; remove (**F-004**).
- No other `dangerouslySetInnerHTML`/`eval`/`document.write` in `src` (grep clean).
- **PostgREST filter building (F-027, Low):** property/deal search escape user text (`escapePostgrestOrValue`, `cleanSearch`), but `.or()`/`.in()` strings are assembled by concatenation across services (ids are trusted UUIDs today). Centralize + validate to prevent a future user-controlled value from corrupting a filter. SQL injection proper is not possible via PostgREST parameterization, but malformed `or` strings can mis-filter.

## 5.5 Secrets & configuration

- Client holds only the Supabase **publishable/anon** key (correct) and an optional Google Maps key. **No service-role key in client code** (grep for `service_role` only hits a migration GRANT). Good.
- `.env*` is git-ignored (`!.env.example` allowed). `.env.example` contains empty placeholders only.
- **F-005 (Low):** `supabase/.temp/*` (7 files) is tracked despite being in `.gitignore` (committed before the rule). `pooler-url` contains no credential pattern (verified), but the linked project ref/host is exposed. `git rm --cached` in a normal session.
- `vite.config.ts` injects `process.env.GOOGLE_MAPS_PLATFORM_KEY` at build time — fine for a public Maps key (should be domain-restricted in Google Cloud).

## 5.6 Logging & analytics privacy

- Only 2 `console.*` in `src` — no sensitive logging. PostHog: `autocapture:false`, `disable_session_recording:true`, heatmaps/dead-clicks off, exceptions on — privacy-conscious. **F-007 (Info):** `capture_pageview:true` with hash routing could capture a future `#invite?token=` URL; scrub tokens when F-002 ships.
- Contacts store **PII** (full_name/email/phone) and `audit_logs` store `ip_address` (INET) — no retention/erasure policy in-repo. GDPR is directly relevant (Belgian users). Add data-retention + subject-access/erasure tooling before paid launch (Phase 3).

## 5.7 IDOR / object references

- Object ids are UUIDs; access is mediated by RLS on every table, so guessing an id does not grant access (except the F-001/F-003 policy gaps). No predictable integer ids in CRM tables (`deals`/`contacts` also have human-readable `reference`s generated by trigger, but reads are still RLS-scoped).

## 5.8 Security scorecard

| Area | State |
|---|---|
| Tenant isolation (CRM) | Correct **except** F-001 (critical) + F-003 (medium) |
| Auth/session | Solid primitives; onboarding broken (F-002); open signup (F-006) |
| Secrets | Clean (no service-role client-side); minor F-005 |
| XSS/injection | Clean live paths; dead bridge F-004; hardening F-027 |
| Privacy/GDPR | No retention/erasure story yet (Phase 3) |
| Storage | Correct policies |

## 5.9 Immediate (Phase 0/1) security actions

1. **F-001** — block `profiles` self-update of `role`/`agency_id` (Phase 0).
2. **F-002** — implement `accept_invitation` + `#invite` route (Phase 1).
3. **F-003** — agency-scope the transfer UPDATE policy (Phase 1).
4. **F-006** — gate/throttle signup for beta (Phase 1).
5. Add RLS regression tests proving cross-agency denial and self-update restriction (F-021, Phase 1).
