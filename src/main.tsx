import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/lora/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/archivo/500.css';
import '@fontsource/archivo/600.css';
import '@fontsource/archivo/700.css';
import './index.css';
import './styles/la-cote-overrides.css';
import { renderInteractiveMap, hasValidKey } from './lib/maps';
import { AppShell } from './components/AppShell';
import { PostHogErrorBoundary } from './components/PostHogErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoadingBar } from './components/ui/LoadingBar';
import { AuthProvider, useAuth } from './lib/auth';
import { initPostHog } from './lib/posthog';
import { appQueryClient } from './lib/queryClient';
import { captureAndStripInviteToken } from './lib/inviteToken';
import { isInvitationResumeRequest } from './lib/invitationSignUp';

type RouteKey =
  | 'dashboard'
  | 'biens'
  | 'biens-agence'
  | 'pipeline'
  | 'contacts'
  | 'agenda'
  | 'transfers'
  | 'commissions'
  | 'admin'
  | 'settings'
  | 'notifications'
  | 'score-test'
  | 'invite'
  | 'reset-password'
  | 'login';

const DEFAULT_ROUTE: RouteKey = 'dashboard';

const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const Biens = lazy(() => import('./pages/Biens').then((module) => ({ default: module.Biens })));
const Pipeline = lazy(() => import('./pages/Pipeline').then((module) => ({ default: module.Pipeline })));
const Agenda = lazy(() => import('./pages/Agenda').then((module) => ({ default: module.Agenda })));
const Contacts = lazy(() => import('./pages/Contacts').then((module) => ({ default: module.Contacts })));
const Notifications = lazy(() => import('./pages/Notifications').then((module) => ({ default: module.Notifications })));
const Transfers = lazy(() => import('./pages/Transfers').then((module) => ({ default: module.Transfers })));
const Commissions = lazy(() => import('./pages/Commissions').then((module) => ({ default: module.Commissions })));
const Settings = lazy(() => import('./pages/Settings').then((module) => ({ default: module.Settings })));
const Admin = lazy(() => import('./pages/Admin').then((module) => ({ default: module.Admin })));
const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })));
const ScoreTest = lazy(() => import('./pages/ScoreTest').then((module) => ({ default: module.ScoreTest })));
const InviteAccept = lazy(() => import('./pages/InviteAccept').then((module) => ({ default: module.InviteAccept })));
const PasswordReset = lazy(() => import('./pages/PasswordReset').then((module) => ({ default: module.PasswordReset })));

const legacyRouteLoaders: Partial<Record<RouteKey, () => Promise<{ default: string }>>> = {};

function getRouteFromHash(): RouteKey {
  if (window.location.pathname === '/login') return 'login';
  // Supabase's browser confirmation flow owns the fragment for session tokens. The
  // non-sensitive query marker keeps this route recoverable until Auth consumes it.
  if (isInvitationResumeRequest()) return 'invite';
  const rawHash = window.location.hash.replace(/^#/, '') || DEFAULT_ROUTE;
  const routeName = rawHash.split('?')[0] as RouteKey;
  if (routeName === 'login' || routeName === 'dashboard' || routeName === 'biens' || routeName === 'biens-agence' || routeName === 'pipeline' || routeName === 'agenda' || routeName === 'contacts' || routeName === 'transfers' || routeName === 'commissions' || routeName === 'notifications' || routeName === 'settings' || routeName === 'admin' || routeName === 'score-test' || routeName === 'invite' || routeName === 'reset-password' || legacyRouteLoaders[routeName]) return routeName;
  return DEFAULT_ROUTE;
}

function executeScripts(container: HTMLElement) {
  const scripts = container.querySelectorAll('script');
  for (const oldScript of Array.from(scripts)) {
    const newScript = document.createElement('script');
    for (const attr of Array.from(oldScript.attributes)) {
      newScript.setAttribute(attr.name, attr.value);
    }
    newScript.textContent = oldScript.textContent;
    oldScript.parentNode?.replaceChild(newScript, oldScript);
  }
}

interface LegacyPageProps {
  route: RouteKey;
}

function LegacyPage({ route }: LegacyPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);

    legacyRouteLoaders[route]?.().then((module) => {
      if (!cancelled) setHtml(module.default);
    });

    return () => {
      cancelled = true;
    };
  }, [route]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!html) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = html;
    executeScripts(container);
  }, [html, route]);

  return <div ref={containerRef} className="ip-legacy-content" />;
}

function PageLoading() {
  return (
    <div className="ip-page-loading">
      <LoadingBar />
    </div>
  );
}

function App() {
  const [route, setRoute] = useState<RouteKey>(() => getRouteFromHash());
  const { isPasswordRecovery } = useAuth();

  useEffect(() => {
    (window as Window & { renderInteractiveMap?: typeof renderInteractiveMap }).renderInteractiveMap = renderInteractiveMap;
    (window as Window & { gmpHasValidKey?: typeof hasValidKey }).gmpHasValidKey = hasValidKey;
    (window as Window & { syncSidebarProfile?: () => void }).syncSidebarProfile = () => {
      window.dispatchEvent(new CustomEvent('ip-agent-changed'));
    };

    const syncRoute = () => {
      const nextRoute = getRouteFromHash();
      if (!window.location.hash) {
        window.location.hash = `#${nextRoute}`;
      }
      setRoute(nextRoute);
    };

    syncRoute();
    window.addEventListener('hashchange', syncRoute);

    return () => {
      window.removeEventListener('hashchange', syncRoute);
    };
  }, []);

  const isLegacyRoute = Boolean(legacyRouteLoaders[route]);

  if (route === 'login') {
    return (
      <Suspense fallback={<PageLoading />}>
        <Login />
      </Suspense>
    );
  }

  // F-002: rendered outside ProtectedRoute -- an invitee may not be authenticated yet.
  // InviteAccept handles both the unauthenticated (sign in/up) and authenticated
  // (accept) states itself.
  if (route === 'invite') {
    return (
      <Suspense fallback={<PageLoading />}>
        <InviteAccept />
      </Suspense>
    );
  }

  if (route === 'reset-password' || isPasswordRecovery) {
    return (
      <Suspense fallback={<PageLoading />}>
        <PasswordReset />
      </Suspense>
    );
  }

  return (
    <ProtectedRoute>
      <AppShell activeRoute={route}>
        <Suspense fallback={<PageLoading />}>
          {route === 'dashboard' ? (
            <Dashboard />
          ) : route === 'score-test' ? (
            <ScoreTest />
          ) : route === 'biens' ? (
            <Biens key="particulier" segment="particulier" />
          ) : route === 'biens-agence' ? (
            <Biens key="agence" segment="agence" />
          ) : route === 'pipeline' ? (
            <Pipeline />
          ) : route === 'agenda' ? (
            <Agenda />
          ) : route === 'contacts' ? (
            <Contacts />
          ) : route === 'transfers' ? (
            <Transfers />
          ) : route === 'commissions' ? (
            <Commissions />
          ) : route === 'notifications' ? (
            <Notifications />
          ) : route === 'settings' ? (
            <Settings />
          ) : route === 'admin' ? (
            <Admin />
          ) : isLegacyRoute ? (
            <LegacyPage route={route} />
          ) : (
            <Dashboard />
          )}
        </Suspense>
      </AppShell>
    </ProtectedRoute>
  );
}

const rootElement = document.getElementById('app');

if (!rootElement) {
  throw new Error('Missing #app root element.');
}

// F-002: must run before initPostHog() so the raw invitation token is stripped from
// window.location (and captured only in memory) before PostHog's automatic initial
// pageview capture fires. See src/lib/inviteToken.ts and src/lib/posthog.ts.
captureAndStripInviteToken();

initPostHog();

createRoot(rootElement).render(
  <React.StrictMode>
    <PostHogErrorBoundary>
      <QueryClientProvider client={appQueryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </PostHogErrorBoundary>
  </React.StrictMode>,
);
