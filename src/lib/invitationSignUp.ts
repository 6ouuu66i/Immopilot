export const INVITATION_ONLY_MESSAGE = 'ImmoPilot est actuellement accessible sur invitation.';
export const INVITATION_RESUME_QUERY_PARAM = 'invite_resume';

const INVITATION_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

export function normalizeInvitationToken(token: string): string {
  const normalized = token.trim().toLowerCase();
  if (!INVITATION_TOKEN_PATTERN.test(normalized)) {
    throw new Error(INVITATION_ONLY_MESSAGE);
  }
  return normalized;
}

export function invitationSignUpMetadata(token: string): { invitation_token: string } {
  return { invitation_token: normalizeInvitationToken(token) };
}

export function invitationConfirmationRedirectUrl(
  location: Pick<Location, 'origin' | 'pathname'> = window.location,
): string {
  const redirectUrl = new URL(location.pathname, location.origin);
  redirectUrl.searchParams.set(INVITATION_RESUME_QUERY_PARAM, '1');
  return redirectUrl.toString();
}

export function isInvitationResumeRequest(search = window.location.search): boolean {
  return new URLSearchParams(search).get(INVITATION_RESUME_QUERY_PARAM) === '1';
}
