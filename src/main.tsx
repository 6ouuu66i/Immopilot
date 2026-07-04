import React, { Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/lora/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import './index.css';
import { store } from './lib/store';
import { renderInteractiveMap, hasValidKey } from './lib/maps';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './lib/auth';

type RouteKey =
  | 'dashboard'
  | 'biens'
  | 'pipeline'
  | 'contacts'
  | 'agenda'
  | 'transfers'
  | 'commissions'
  | 'admin'
  | 'settings'
  | 'notifications'
  | 'score-test'
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

function getRouteFromHash(): RouteKey {
  if (window.location.pathname === '/login') return 'login';
  const rawHash = window.location.hash.replace(/^#/, '') || DEFAULT_ROUTE;
  const routeName = rawHash.split('?')[0] as RouteKey;
  if (routeName === 'login' || routeName === 'dashboard' || routeName === 'biens' || routeName === 'pipeline' || routeName === 'agenda' || routeName === 'contacts' || routeName === 'transfers' || routeName === 'commissions' || routeName === 'notifications' || routeName === 'settings' || routeName === 'admin' || routeName === 'score-test') return routeName;
  return DEFAULT_ROUTE;
}

function PageLoading() {
  return (
    <div
      style={{
        minHeight: '100%',
        display: 'grid',
        placeItems: 'center',
        background: '#F7F6F3',
        color: '#6B6B6B',
        fontFamily: 'var(--notion-sans)',
        fontSize: 13,
      }}
    >
      Chargement...
    </div>
  );
}

function App() {
  const [route, setRoute] = useState<RouteKey>(() => getRouteFromHash());

  useEffect(() => {
    (window as Window & { ImmoPilotStore?: typeof store }).ImmoPilotStore = store;
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

  if (route === 'login') {
    return (
      <Suspense fallback={<PageLoading />}>
        <Login />
      </Suspense>
    );
  }

  return (
    <ProtectedRoute>
      <AppShell activeRoute={route} store={store}>
        <Suspense fallback={<PageLoading />}>
          {route === 'dashboard' ? (
            <Dashboard store={store} />
          ) : route === 'score-test' ? (
            <ScoreTest />
          ) : route === 'biens' ? (
            <Biens store={store} />
          ) : route === 'pipeline' ? (
            <Pipeline store={store} />
          ) : route === 'agenda' ? (
            <Agenda store={store} />
          ) : route === 'contacts' ? (
            <Contacts store={store} />
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
          ) : (
            <Dashboard store={store} />
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

createRoot(rootElement).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);
