import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const isAuthenticatedRun = process.env.E2E_AUTH_RUN === 'true';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI
    ? [
        ['line'],
        ['html', { open: 'never', outputFolder: 'playwright-report' }],
      ]
    : 'list',
  outputDir: 'test-results',
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000',
    trace: isAuthenticatedRun ? 'off' : 'retain-on-failure',
    screenshot: isAuthenticatedRun ? 'off' : 'only-on-failure',
    video: 'off',
  },
  webServer: {
    command: 'npm run dev',
    url: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000',
    reuseExistingServer: !isCI,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
