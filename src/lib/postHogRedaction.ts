// F-002: pure token-redaction logic, deliberately kept in its own module with no
// `import.meta.env` access and no `posthog-js` import, so it can be unit-tested (see
// tests/e2e/invite-token-analytics-redaction.spec.ts) without pulling in Vite-only
// globals that don't exist under Playwright's Node-context test runner.
//
// The invitation link carries a 64-hex-char bearer token as '#invite?token=<token>'
// (see src/lib/inviteToken.ts / agentsService.createInvitation). Matches '?token=' or
// '&token=' followed by 16+ hex characters anywhere in a string -- deliberately broader
// than the exact 64-char format so any related/partial value is also caught.
const INVITE_TOKEN_PATTERN = /([?&]token=)[0-9a-f]{16,}/gi;

export function redactInviteTokens(value: string): string {
  return value.replace(INVITE_TOKEN_PATTERN, '$1[redacted]');
}

export function sanitizeCapturedProperties<T extends Record<string, unknown>>(properties: T): T {
  const sanitized = { ...properties };
  for (const key of Object.keys(sanitized)) {
    const value = sanitized[key];
    if (typeof value === 'string') {
      (sanitized as Record<string, unknown>)[key] = redactInviteTokens(value);
    }
  }
  return sanitized;
}
