import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const source = readFileSync(path.join(process.cwd(), 'src/lib/auth.tsx'), 'utf8');

test('auth listener no longer forces the route loader for token refresh or same-user session confirmations', () => {
  expect(source).toContain("if (event === 'INITIAL_SESSION') return;");
  expect(source).toContain("const sameUserSession = Boolean(previousUserId && nextUserId && previousUserId === nextUserId);");
  expect(source).toContain("const shouldShowLoader = !hasInitializedSessionRef.current");
  expect(source).toContain("|| event === 'SIGNED_OUT'");
  expect(source).toContain("|| (event === 'SIGNED_IN' && !sameUserSession);");
  expect(source).toContain('if (shouldShowLoader) {');
  expect(source).toContain("void applySession(session, { prefetch: event === 'SIGNED_IN' && !sameUserSession })");
  expect(source).not.toContain("const subscription = supabase?.auth.onAuthStateChange((event, session) => {\n      setIsLoading(true);");
});
