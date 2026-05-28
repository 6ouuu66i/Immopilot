import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { Dashboard } from './pages/Dashboard';
import { Biens } from './pages/Biens';
import { Pipeline } from './pages/Pipeline';

import biensHtml from './pages/biens.html?raw';
import inboxHtml from './pages/inbox.html?raw';
import contactsHtml from './pages/contacts.html?raw';
import testsHtml from './pages/tests.html?raw';
import agendaHtml from './pages/agenda.html?raw';
import commissionsHtml from './pages/commissions.html?raw';
import adminHtml from './pages/admin.html?raw';
import settingsHtml from './pages/settings.html?raw';
import notificationsHtml from './pages/notifications.html?raw';

type RouteKey =
  | 'dashboard'
  | 'biens'
  | 'inbox'
  | 'pipeline'
  | 'contacts'
  | 'tests'
  | 'agenda'
  | 'commissions'
  | 'admin'
  | 'settings'
  | 'notifications';

const DEFAULT_ROUTE: RouteKey = 'dashboard';

const legacyRoutes: Partial<Record<RouteKey, string>> = {
  inbox: inboxHtml,
  contacts: contactsHtml,
  tests: testsHtml,
  agenda: agendaHtml,
  commissions: commissionsHtml,
  admin: adminHtml,
  settings: settingsHtml,
  notifications: notificationsHtml,
};

function getRouteFromHash(): RouteKey {
  const rawHash = window.location.hash.replace(/^#/, '') || DEFAULT_ROUTE;
  const routeName = rawHash.split('?')[0] as RouteKey;
  if (routeName === 'dashboard' || routeName === 'biens' || routeName === 'pipeline' || legacyRoutes[routeName]) return routeName;
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
  html: string;
  route: RouteKey;
}

function LegacyPage({ html, route }: LegacyPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = html;
    executeScripts(container);
  }, [html, route]);

  return <div ref={containerRef} className="ip-legacy-content" />;
}

function App() {
  const [route, setRoute] = useState<RouteKey>(() => getRouteFromHash());
  const [, forceRefresh] = useState(0);

  useEffect(() => {
    (window as Window & { ImmoPilotStore?: typeof store }).ImmoPilotStore = store;
    (window as Window & { renderInteractiveMap?: typeof renderInteractiveMap }).renderInteractiveMap = renderInteractiveMap;
    (window as Window & { gmpHasValidKey?: typeof hasValidKey }).gmpHasValidKey = hasValidKey;
    (window as Window & { syncSidebarProfile?: () => void }).syncSidebarProfile = () => forceRefresh((value) => value + 1);

    const syncRoute = () => {
      const nextRoute = getRouteFromHash();
      if (!window.location.hash) {
        window.location.hash = `#${nextRoute}`;
      }
      setRoute(nextRoute);
    };

    const refresh = () => forceRefresh((value) => value + 1);

    syncRoute();
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('ip-state-changed', refresh);
    window.addEventListener('ip-agent-changed', refresh);
    window.addEventListener('ip-log-added', refresh);

    return () => {
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('ip-state-changed', refresh);
      window.removeEventListener('ip-agent-changed', refresh);
      window.removeEventListener('ip-log-added', refresh);
    };
  }, []);

  const legacyHtml = useMemo(() => legacyRoutes[route], [route]);

  return (
    <AppShell activeRoute={route} store={store}>
      {route === 'dashboard' ? (
        <Dashboard store={store} />
      ) : route === 'biens' ? (
        <Biens store={store} />
      ) : route === 'pipeline' ? (
        <Pipeline store={store} />
      ) : legacyHtml ? (
        <LegacyPage html={legacyHtml} route={route} />
      ) : (
        <Dashboard store={store} />
      )}
    </AppShell>
  );
}

const rootElement = document.getElementById('app');

if (!rootElement) {
  throw new Error('Missing #app root element.');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
