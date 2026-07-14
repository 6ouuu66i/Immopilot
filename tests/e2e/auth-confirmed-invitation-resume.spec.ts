import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  invitationConfirmationRedirectUrl,
  isInvitationResumeRequest,
} from '../../src/lib/invitationSignUp';

const root = process.cwd();
const resumeMigration = 'supabase/migrations/20260715120000_resume_confirmed_invitation_signup.sql';
const acceptMigration = 'supabase/migrations/20260712050248_create_accept_invitation_function.sql';

async function source(relativePath: string): Promise<string> {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

test('1. Confirm Email off resumes immediately from the returned session', async () => {
  const auth = await source('src/lib/auth.tsx');
  expect(auth).toContain('requiresEmailConfirmation: data.session === null');
  expect(auth).toContain('emailRedirectTo: invitationConfirmationRedirectUrl()');
});

test('2. Confirm Email on reports the no-session email-confirmation state generically', async () => {
  const [auth, page] = await Promise.all([source('src/lib/auth.tsx'), source('src/pages/InviteAccept.tsx')]);
  expect(auth).toContain('data.session === null');
  expect(page).toContain("setFlow({ kind: 'email-sent' })");
  expect(page).toContain("kind: 'awaiting-confirmation'");
  expect(page).not.toMatch(/(?:user|account).*(?:exists|registered)/i);
});

test('3. the confirmation callback routes to the authenticated server resume', async () => {
  const [main, page] = await Promise.all([source('src/main.tsx'), source('src/pages/InviteAccept.tsx')]);
  const redirect = invitationConfirmationRedirectUrl({ origin: 'http://127.0.0.1:3000', pathname: '/' });
  expect(isInvitationResumeRequest('?invite_resume=1')).toBe(true);
  expect(redirect).toBe('http://127.0.0.1:3000/?invite_resume=1');
  expect(redirect).not.toContain('token');
  expect(main).toContain("if (isInvitationResumeRequest()) return 'invite'");
  expect(page).toContain('agentsService.resumeInvitationSignup()');
});

test('4. full reload recovery uses a server context and no browser token storage', async () => {
  const [migration, tokenHelper] = await Promise.all([source(resumeMigration), source('src/lib/inviteToken.ts')]);
  const triggerFunction = migration.slice(0, migration.indexOf('CREATE FUNCTION public.resume_invitation_signup()'));
  expect(migration).toContain('CREATE TABLE public.invitation_signup_resumptions');
  expect(migration).toContain('user_id uuid PRIMARY KEY REFERENCES auth.users(id)');
  expect(triggerFunction).toContain('NEW.id');
  expect(triggerFunction).toMatch(/VALUES \(\s*NEW\.id,\s*v_invitation_id/);
  expect(triggerFunction).not.toContain('auth.uid()');
  expect(migration).not.toContain('invitation_token text');
  expect(tokenHelper).not.toMatch(/(?:localStorage|sessionStorage)\.(?:setItem|getItem)/);
});

test('5. a request with neither token nor resume marker remains invalid', async () => {
  const page = await source('src/pages/InviteAccept.tsx');
  expect(isInvitationResumeRequest('')).toBe(false);
  expect(page).toContain("if (!token && !isResumeRequest)");
  expect(page).toContain("kind: 'missing-token'");
});

test('6. an expired resume context is deleted and reported as expired', async () => {
  const migration = await source(resumeMigration);
  expect(migration).toContain('LEAST(v_invitation_expires_at, now() + interval \'24 hours\')');
  expect(migration).toMatch(/v_context\.expires_at <= now\(\)[\s\S]*?DELETE FROM public\.invitation_signup_resumptions[\s\S]*?RETURN 'expired'/);
});

test('7. a revoked invitation is rejected by the canonical acceptance function', async () => {
  const [migration, acceptance] = await Promise.all([source(resumeMigration), source(acceptMigration)]);
  expect(acceptance).toContain("IF v_invitation.status <> 'pending' THEN");
  expect(migration).toContain("WHEN SQLSTATE 'IPV03' THEN v_result := 'already_used'");
});

test('8. a consumed invitation has a controlled outcome while a completed refresh is idempotent', async () => {
  const migration = await source(resumeMigration);
  expect(migration).toMatch(/v_context\.accepted_at IS NOT NULL[\s\S]*?RETURN 'already_accepted'/);
  expect(migration).toContain('v_profile.agency_id IS DISTINCT FROM v_invitation.agency_id');
  expect(migration).toContain('v_profile.role IS DISTINCT FROM v_invitation.role');
  expect(migration).toContain('lower(trim(v_caller_email)) IS DISTINCT FROM lower(trim(v_invitation.email))');
  expect(migration).toContain("RETURN 'integrity_error'");
  expect(migration).toContain("WHEN SQLSTATE 'IPV03' THEN v_result := 'already_used'");
});

test('9. invitation acceptance still verifies the authenticated email server-side', async () => {
  const acceptance = await source(acceptMigration);
  expect(acceptance).toContain('lower(trim(v_invitation.email)) <> lower(trim(v_caller_email))');
  expect(acceptance).toContain("ERRCODE = 'IPV05'");
});

test('10. another authenticated user cannot read or resume someone else context', async () => {
  const migration = await source(resumeMigration);
  expect(migration).toContain('WHERE context.user_id = v_user_id');
  expect(migration).toContain('REVOKE ALL ON TABLE public.invitation_signup_resumptions FROM PUBLIC, anon, authenticated');
  expect(migration).not.toMatch(/CREATE POLICY/i);
});

test('11. accept_invitation is called once and subsequent refreshes use accepted_at', async () => {
  const [migration, service] = await Promise.all([source(resumeMigration), source('src/lib/services/agentsService.ts')]);
  expect(migration.match(/PERFORM public\.accept_invitation\(v_token\)/g)).toHaveLength(1);
  expect(migration).toContain('SET accepted_at = now()');
  expect(migration).toContain('IF v_context.accepted_at IS NOT NULL THEN');
  expect(migration).toMatch(/FOR UPDATE[\s\S]*?PERFORM public\.accept_invitation\(v_token\)[\s\S]*?SET accepted_at = now\(\)/);
  expect(service).toContain("status === 'accepted' || status === 'already_accepted'");
});

test('12. auth submission and invitation acceptance both have double-run guards', async () => {
  const page = await source('src/pages/InviteAccept.tsx');
  expect(page).toContain('if (authSubmissionRef.current) return');
  expect(page).toContain('if (hasAttemptedAcceptRef.current) return');
  expect(page).toContain('disabled={isSubmittingAuth}');
});

test('13. callback and invitation secrets are absent from logs analytics and persistent storage', async () => {
  const [page, tokenHelper, redaction] = await Promise.all([
    source('src/pages/InviteAccept.tsx'),
    source('src/lib/inviteToken.ts'),
    source('src/lib/postHogRedaction.ts'),
  ]);
  expect(page).not.toMatch(/console\.(?:log|info|warn|error)/);
  expect(tokenHelper).not.toContain('.setItem(');
  expect(redaction).toContain('access_token|refresh_token|token_hash|code');
});

test('14. success clears the memory token and callback URL before dashboard redirect', async () => {
  const page = await source('src/pages/InviteAccept.tsx');
  expect(page).toContain('clearInvitationCallbackUrl()');
  expect(page).toContain('clearCapturedInviteToken()');
  expect(page).toContain('redirectToDashboard()');
});

test('15. terminal errors clear both client token and resumable server context', async () => {
  const [page, migration] = await Promise.all([source('src/pages/InviteAccept.tsx'), source(resumeMigration)]);
  expect(page).toContain('if (!canRetryWithDifferentAccount) clearCapturedInviteToken()');
  expect(migration).toMatch(/v_result IN \([\s\S]*?'already_used'[\s\S]*?DELETE FROM public\.invitation_signup_resumptions/);
});

test('16. agency and role are assigned only from the locked database invitation', async () => {
  const [migration, acceptance] = await Promise.all([source(resumeMigration), source(acceptMigration)]);
  expect(acceptance).toContain('agency_id = v_invitation.agency_id');
  expect(acceptance).toContain('role = v_invitation.role');
  expect(migration).not.toMatch(/raw_user_meta_data->>'(?:role|agency_id)'/);
});

test('17. the final redirect is exactly the dashboard route without callback parameters', async () => {
  const page = await source('src/pages/InviteAccept.tsx');
  expect(page).toContain('`${window.location.pathname}#dashboard`');
  expect(page).toContain("window.dispatchEvent(new HashChangeEvent('hashchange'))");
});

test('18. password recovery remains wired to its dedicated route and generic copy', async () => {
  const [auth, main, resetPage] = await Promise.all([
    source('src/lib/auth.tsx'),
    source('src/main.tsx'),
    source('src/pages/PasswordReset.tsx'),
  ]);
  expect(auth).toContain('supabase.auth.resetPasswordForEmail(email, { redirectTo })');
  expect(main).toContain("route === 'reset-password'");
  expect(resetPage).toContain('Si un compte correspond à cette adresse');
});
