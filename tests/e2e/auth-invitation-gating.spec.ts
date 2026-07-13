import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { invitationSignUpMetadata, INVITATION_ONLY_MESSAGE, normalizeInvitationToken } from '../../src/lib/invitationSignUp';

const root = process.cwd();
const migrationName = '20260713204325_enforce_invitation_only_access.sql';

async function source(relativePath: string): Promise<string> {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

async function sourceFiles(relativeDirectory: string): Promise<string[]> {
  const directory = path.join(root, relativeDirectory);
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return sourceFiles(relativePath);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [relativePath.replaceAll('\\', '/')] : [];
  }));
  return nested.flat();
}

test('F-006 has no standalone public signup or register route', async () => {
  const main = await source('src/main.tsx');
  expect(main).not.toMatch(/routeName === ['"](?:signup|register)['"]/);
  expect(main).not.toMatch(/route === ['"](?:signup|register)['"]/);
});

test('F-006 keeps password login available', async () => {
  const [main, auth] = await Promise.all([source('src/main.tsx'), source('src/lib/auth.tsx')]);
  expect(main).toContain("route === 'login'");
  expect(auth).toContain('supabase.auth.signInWithPassword({ email, password })');
});

test('F-006 keeps password recovery available without account enumeration copy', async () => {
  const [main, auth, page] = await Promise.all([
    source('src/main.tsx'),
    source('src/lib/auth.tsx'),
    source('src/pages/PasswordReset.tsx'),
  ]);
  expect(main).toContain("route === 'reset-password'");
  expect(auth).toContain('supabase.auth.resetPasswordForEmail(email, { redirectTo })');
  expect(page).toContain('Si un compte correspond à cette adresse');
  expect(page).toContain('submissionRef.current');
});

test('F-006 only builds signup metadata from a valid invitation token', () => {
  const token = 'a'.repeat(64);
  expect(invitationSignUpMetadata(` ${token.toUpperCase()} `)).toEqual({ invitation_token: token });
  expect(() => normalizeInvitationToken('not-an-invitation')).toThrow(INVITATION_ONLY_MESSAGE);
});

test('F-006 signup hook requires a pending unexpired invitation', async () => {
  const migration = await source(`supabase/migrations/${migrationName}`);
  expect(migration).toContain("invitation.status = 'pending'");
  expect(migration).toContain('invitation.expires_at > now()');
  expect(migration).toContain("v_token !~ '^[0-9a-f]{64}$'");
});

test('F-006 rejects expired revoked and already-used invitations generically', async () => {
  const migration = await source(`supabase/migrations/${migrationName}`);
  expect(migration).toContain('ImmoPilot est actuellement accessible sur invitation.');
  expect(migration).not.toMatch(/RETURN jsonb_build_object\([^;]*(?:expired|cancelled|accepted)/is);
});

test('F-006 binds signup and acceptance to the invitation email', async () => {
  const [migration, acceptMigration] = await Promise.all([
    source(`supabase/migrations/${migrationName}`),
    source('supabase/migrations/20260712050248_create_accept_invitation_function.sql'),
  ]);
  expect(migration).toContain('lower(trim(invitation.email)) = v_email');
  expect(acceptMigration).toContain('lower(trim(v_invitation.email)) <> lower(trim(v_caller_email))');
});

test('F-006 rejects an authenticated user already attached to any agency', async () => {
  const acceptMigration = await source('supabase/migrations/20260712050248_create_accept_invitation_function.sql');
  expect(acceptMigration).toContain('IF v_profile.agency_id IS NOT NULL THEN');
  expect(acceptMigration).toContain("ERRCODE = 'IPV07'");
});

test('F-006 preserves single-use and concurrent invitation acceptance guards', async () => {
  const acceptMigration = await source('supabase/migrations/20260712050248_create_accept_invitation_function.sql');
  expect(acceptMigration).toContain('FOR UPDATE;');
  expect(acceptMigration).toContain("v_invitation.status <> 'pending'");
  expect(acceptMigration).toContain("AND status = 'pending'");
});

test('F-006 derives role and agency only from the locked database invitation', async () => {
  const acceptMigration = await source('supabase/migrations/20260712050248_create_accept_invitation_function.sql');
  expect(acceptMigration).toContain('agency_id = v_invitation.agency_id');
  expect(acceptMigration).toContain('role = v_invitation.role');
  expect(acceptMigration).not.toContain('raw_user_meta_data');
});

test('F-006 exposes no direct agency or membership creation policy', async () => {
  const [baseRls, migration] = await Promise.all([
    source('supabase/migrations/20260629182636_create_crm_remaining_schema_rls.sql'),
    source(`supabase/migrations/${migrationName}`),
  ]);
  expect(baseRls).not.toMatch(/ON public\.agencies FOR INSERT TO authenticated/i);
  expect(baseRls).not.toMatch(/ON public\.profiles FOR INSERT TO authenticated/i);
  expect(migration).not.toMatch(/ON public\.(?:agencies|profiles) FOR INSERT TO authenticated/i);
});

test('F-006 preserves the F-001 role and agency guards', async () => {
  const guard = await source('supabase/migrations/20260712040044_guard_profile_privileged_columns.sql');
  expect(guard).toContain("profiles.role can only be changed by an agency admin");
  expect(guard).toContain("profiles.agency_id cannot be changed through the API");
});

test('F-006 requires an active agency membership for every shared market table', async () => {
  const migration = await source(`supabase/migrations/${migrationName}`);
  for (const table of [
    'properties', 'listings', 'price_history', 'listing_signals',
    'listing_scores', 'listing_score_history', 'listing_outcomes',
  ]) {
    expect(migration, `${table} must be membership-gated`).toMatch(
      new RegExp(`ON public\\.${table}[\\s\\S]*?USING \\(public\\.current_agency_id\\(\\) IS NOT NULL\\)`, 'i'),
    );
  }
  expect(migration).toContain('AND is_active = true');
  expect(migration).toContain('AND agency_id IS NOT NULL');
});

test('F-006 closes materialized-view and dashboard RPC bypasses', async () => {
  const [migration, propertiesSource] = await Promise.all([
    source(`supabase/migrations/${migrationName}`),
    source('src/lib/supabaseProperties.ts'),
  ]);
  expect(migration).toContain('REVOKE SELECT ON public.active_properties_canonical_mat FROM PUBLIC, anon, authenticated');
  expect(migration).toContain('REVOKE SELECT ON public.market_reference FROM PUBLIC, anon, authenticated');
  expect(migration).toContain('ALTER FUNCTION public.get_dashboard_snapshot(integer) SECURITY INVOKER');
  expect(propertiesSource).toContain("const ACTIVE_PROPERTIES_CANONICAL_VIEW = 'active_properties_canonical'");
});

test('F-006 keeps invitation and recovery secrets out of analytics and persistent storage', async () => {
  const [redaction, inviteToken, invitePage] = await Promise.all([
    source('src/lib/postHogRedaction.ts'),
    source('src/lib/inviteToken.ts'),
    source('src/pages/InviteAccept.tsx'),
  ]);
  expect(redaction).toContain('access_token|refresh_token|token_hash|code');
  expect(inviteToken).not.toMatch(/(?:localStorage|sessionStorage)\.(?:setItem|getItem)/);
  expect(invitePage).not.toMatch(/console\.(?:log|info|warn|error)/);
});

test('F-006 architecture has no unguarded signup or incomplete-account fallback', async () => {
  const [auth, invitePage, protectedRoute, migration] = await Promise.all([
    source('src/lib/auth.tsx'),
    source('src/pages/InviteAccept.tsx'),
    source('src/components/ProtectedRoute.tsx'),
    source(`supabase/migrations/${migrationName}`),
  ]);
  expect(auth).toContain('options: { data: invitationSignUpMetadata(invitationToken) }');
  expect(auth).not.toContain('signUp: (email: string, password: string)');
  const signupSources = await Promise.all((await sourceFiles('src')).map(async (relativePath) => ({
    contents: await source(relativePath),
    relativePath,
  })));
  const signupConsumers = signupSources
    .filter(({ contents }) => contents.includes('.auth.signUp('))
    .map(({ relativePath }) => relativePath);
  expect(signupConsumers).toEqual(['src/lib/auth.tsx']);
  expect(invitePage).toContain('signUpWithInvitation(email.trim(), password, token)');
  expect(invitePage).toContain('authSubmissionRef.current');
  expect(protectedRoute).toContain('!profile.agency_id || !agency');
  expect(migration).toContain('CREATE OR REPLACE FUNCTION public.hook_require_invitation(event jsonb)');
  expect(migration).toContain('TO supabase_auth_admin');
});
