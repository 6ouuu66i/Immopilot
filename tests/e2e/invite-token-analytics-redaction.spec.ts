import { expect, test } from '@playwright/test';

// F-002 scenario 9: the invitation token must never reach PostHog in $current_url,
// pageviews, exceptions, or event properties. These are pure-function tests against the
// exact sanitize_properties implementation wired into posthog.init() via
// src/lib/postHogRedaction.ts -- not a live PostHog capture, but a direct proof that the
// redaction logic used at the earliest interception point correctly strips the token
// pattern.

const SAMPLE_TOKEN = '1111111111111111111111111111111111111111111111111111111111111a';

test('redactInviteTokens strips a token from a $current_url-shaped string', async () => {
  const { redactInviteTokens } = await import('../../src/lib/postHogRedaction');
  const url = `https://app.immopilot.example/#invite?token=${SAMPLE_TOKEN}`;
  const redacted = redactInviteTokens(url);
  expect(redacted).not.toContain(SAMPLE_TOKEN);
  expect(redacted).toBe('https://app.immopilot.example/#invite?token=[redacted]');
});

test('redactInviteTokens strips a token appearing after an & separator', async () => {
  const { redactInviteTokens } = await import('../../src/lib/postHogRedaction');
  const url = `https://app.immopilot.example/?foo=bar&token=${SAMPLE_TOKEN}`;
  expect(redactInviteTokens(url)).not.toContain(SAMPLE_TOKEN);
});

test('redactInviteTokens leaves ordinary strings untouched', async () => {
  const { redactInviteTokens } = await import('../../src/lib/postHogRedaction');
  const value = 'https://app.immopilot.example/#dashboard';
  expect(redactInviteTokens(value)).toBe(value);
});

test('redactInviteTokens strips Supabase recovery parameters', async () => {
  const { redactInviteTokens } = await import('../../src/lib/postHogRedaction');
  const value = 'https://app.immopilot.example/#access_token=access-secret&refresh_token=refresh-secret&type=recovery&token_hash=hash-secret&code=exchange-secret';
  const redacted = redactInviteTokens(value);

  expect(redacted).not.toContain('access-secret');
  expect(redacted).not.toContain('refresh-secret');
  expect(redacted).not.toContain('hash-secret');
  expect(redacted).not.toContain('exchange-secret');
  expect(redacted.match(/\[redacted\]/g)).toHaveLength(4);
});

test('sanitizeCapturedProperties redacts $current_url and other string properties, leaves non-strings alone', async () => {
  const { sanitizeCapturedProperties } = await import('../../src/lib/postHogRedaction');
  const properties = {
    $current_url: `https://app.immopilot.example/#invite?token=${SAMPLE_TOKEN}`,
    $pathname: '/',
    distinct_id: 'abc-123',
    some_count: 42,
    some_flag: true,
    some_null: null,
  };

  const sanitized = sanitizeCapturedProperties(properties);

  expect(JSON.stringify(sanitized)).not.toContain(SAMPLE_TOKEN);
  expect(sanitized.$current_url).toBe('https://app.immopilot.example/#invite?token=[redacted]');
  expect(sanitized.distinct_id).toBe('abc-123');
  expect(sanitized.some_count).toBe(42);
  expect(sanitized.some_flag).toBe(true);
  expect(sanitized.some_null).toBeNull();
});

test('sanitizeCapturedProperties redacts a token surfacing in a nested-looking string property (e.g. an exception message)', async () => {
  const { sanitizeCapturedProperties } = await import('../../src/lib/postHogRedaction');
  const properties = {
    $exception_message: `Failed to fetch https://app.immopilot.example/#invite?token=${SAMPLE_TOKEN}`,
  };
  const sanitized = sanitizeCapturedProperties(properties);
  expect(sanitized.$exception_message).not.toContain(SAMPLE_TOKEN);
});

test('main.tsx captures and strips the invite token before initPostHog() is called', async () => {
  const { readFileSync } = await import('node:fs');
  const path = await import('node:path');
  const source = readFileSync(path.join(process.cwd(), 'src/main.tsx'), 'utf8');

  const captureCallIndex = source.indexOf('captureAndStripInviteToken();');
  const initCallIndex = source.indexOf('initPostHog();');

  expect(captureCallIndex).toBeGreaterThan(-1);
  expect(initCallIndex).toBeGreaterThan(-1);
  expect(captureCallIndex).toBeLessThan(initCallIndex);
});

test('inviteToken module never calls the localStorage/sessionStorage APIs', async () => {
  const { readFileSync } = await import('node:fs');
  const path = await import('node:path');
  const source = readFileSync(path.join(process.cwd(), 'src/lib/inviteToken.ts'), 'utf8');

  // Checks for actual storage-write/read call patterns, not the API names appearing in
  // prose comments explaining that storage is deliberately NOT used.
  expect(source).not.toContain('.setItem(');
  expect(source).not.toContain('.getItem(');
  expect(source).not.toContain('window.localStorage');
  expect(source).not.toContain('window.sessionStorage');
});

test('agentsService.acceptInvitation never interpolates the raw token into a thrown error message', async () => {
  const { readFileSync } = await import('node:fs');
  const path = await import('node:path');
  const source = readFileSync(path.join(process.cwd(), 'src/lib/services/agentsService.ts'), 'utf8');

  const acceptInvitationStart = source.indexOf('async acceptInvitation(');
  expect(acceptInvitationStart).toBeGreaterThan(-1);
  const acceptInvitationBody = source.slice(acceptInvitationStart, source.indexOf('\n  },', acceptInvitationStart));

  // The function body must never build a template string or concatenation containing
  // the token/trimmedToken variables together with error/message text.
  expect(acceptInvitationBody).not.toMatch(/`[^`]*\$\{trimmedToken\}[^`]*`/);
  expect(acceptInvitationBody).not.toMatch(/`[^`]*\$\{token\}[^`]*`/);
});
