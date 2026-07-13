export const INVITATION_ONLY_MESSAGE = 'ImmoPilot est actuellement accessible sur invitation.';

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
