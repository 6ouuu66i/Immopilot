// F-002: capture an invitation token from the URL and strip it immediately, before any
// other code (PostHog init, error reporting, browser history) can observe it.
//
// Design: the token lives ONLY in a module-level in-memory variable for the lifetime of
// the current page load. It is never written to localStorage or sessionStorage. A page
// reload during the accept flow loses the captured token by design (the safer failure
// mode) -- InviteAccept then shows a clear "invalid/missing link" state.
//
// captureAndStripInviteToken() must run before initPostHog() (see src/main.tsx) so the
// hash never contains the raw token when PostHog's automatic initial pageview fires.

let capturedInviteToken: string | null = null;

const INVITE_HASH_PATTERN = /^#invite\?token=([^&]+)/;

export function captureAndStripInviteToken(): void {
  const hash = window.location.hash;
  const match = INVITE_HASH_PATTERN.exec(hash);
  if (!match) return;

  try {
    capturedInviteToken = decodeURIComponent(match[1]);
  } catch {
    capturedInviteToken = null;
  }

  // Strip the token from the visible URL/history right away. Keep the '#invite' route
  // so normal routing still recognizes it.
  const scrubbedUrl = `${window.location.pathname}${window.location.search}#invite`;
  window.history.replaceState(null, '', scrubbedUrl);
}

// Idempotent read: safe to call multiple times (e.g. React StrictMode double-render).
// The token only ever lives in this module-level variable, never in any storage API.
export function getCapturedInviteToken(): string | null {
  return capturedInviteToken;
}

// Explicit clear once the accept flow has terminated (success or unrecoverable failure),
// so the token doesn't linger in memory for the rest of the session.
export function clearCapturedInviteToken(): void {
  capturedInviteToken = null;
}
