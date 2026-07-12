import posthog from 'posthog-js';
import { sanitizeCapturedProperties } from './postHogRedaction';

type PostHogProperties = Record<string, string | number | boolean | null | undefined>;

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST;

export const posthogEnvironment = import.meta.env.MODE;
export const posthogRelease = import.meta.env.VITE_APP_VERSION ?? 'dev';

// F-002: redact any invitation token before it reaches PostHog. sanitize_properties (see
// src/lib/postHogRedaction.ts) runs on every captured payload -- autocapture, pageview,
// exceptions, manual events -- before it is queued for sending, including the automatic
// initial pageview fired synchronously inside posthog.init() below, which is the
// earliest possible interception point for that event. src/main.tsx additionally strips
// the token from window.location itself via captureAndStripInviteToken() before
// initPostHog() runs, so $current_url never even contains it; this redaction is a
// second, independent layer in case the token resurfaces in any other captured property.

export function initPostHog() {
  if (!POSTHOG_KEY) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    request_batching: import.meta.env.PROD,
    opt_out_useragent_filter: import.meta.env.DEV,
    autocapture: false,
    capture_pageview: true,
    capture_pageleave: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_surveys_automatic_display: true,
    enable_heatmaps: false,
    capture_performance: false,
    capture_dead_clicks: false,
    rageclick: false,
    advanced_disable_flags: true,
    advanced_disable_feature_flags: true,
    advanced_disable_feature_flags_on_first_load: true,
    advanced_disable_toolbar_metrics: true,
    advanced_enable_surveys: false,
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    },
    sanitize_properties: (properties) => sanitizeCapturedProperties(properties),
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

export function capturePostHogEvent(eventName: string, properties: PostHogProperties = {}) {
  if (!POSTHOG_KEY) return;

  posthog.capture(eventName, {
    ...properties,
    environment: posthogEnvironment,
    app_version: posthogRelease,
  });
}

export { posthog };
