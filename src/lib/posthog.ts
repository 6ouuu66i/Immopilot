import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST;

export const posthogEnvironment = import.meta.env.MODE;
export const posthogRelease = import.meta.env.VITE_APP_VERSION ?? 'dev';

export function initPostHog() {
  if (!POSTHOG_KEY) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: false,
    capture_pageview: true,
    capture_pageleave: false,
    disable_session_recording: true,
    enable_heatmaps: false,
    capture_performance: false,
    capture_dead_clicks: false,
    rageclick: false,
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    },
    loaded: (client) => {
      client.register({
        environment: posthogEnvironment,
        app_version: posthogRelease,
      });
    },
  });
}

export function captureReactError(error: unknown, componentStack?: string | null) {
  if (!POSTHOG_KEY) return;

  posthog.captureException(error, {
    environment: posthogEnvironment,
    app_version: posthogRelease,
    component_stack: componentStack ?? undefined,
    source: 'react_error_boundary',
  });
}

export { posthog };