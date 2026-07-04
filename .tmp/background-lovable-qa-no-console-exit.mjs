import { chromium } from '@playwright/test';

const routes = ['dashboard', 'biens', 'pipeline', 'contacts', 'agenda'];
const expected = 'rgb(250, 250, 249)';

const mockAuth = `
export function AuthProvider({ children }) { return children; }
export function useAuth() {
  return {
    user: { id: 'user-1', email: 'agent@immopilot.local' },
    profile: {
      id: 'user-1',
      agency_id: 'agency-1',
      full_name: 'Sarah Dubois',
      email: 'agent@immopilot.local',
      role: 'admin',
      is_active: true,
      avatar_url: null,
    },
    agency: { id: 'agency-1', name: 'ImmoPilot Studio' },
    isLoading: false,
    isAuthenticated: true,
    signIn: async () => {},
    signOut: async () => {},
    signUp: async () => {},
    refreshProfile: async () => {},
  };
}
`;

const mockNotifications = `
export function useNotifications() {
  return {
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    error: null,
    markAsRead: async () => {},
    markAllAsRead: async () => {},
  };
}
`;

const mockNotificationsService = `
export async function resolveNotificationUrl() { return '#notifications'; }
`;

async function installMocks(page) {
  await page.route('**/src/lib/auth.tsx*', route => route.fulfill({ contentType: 'application/javascript', body: mockAuth }));
  await page.route('**/src/lib/useNotifications.ts*', route => route.fulfill({ contentType: 'application/javascript', body: mockNotifications }));
  await page.route('**/src/lib/services/notificationsService.ts*', route => route.fulfill({ contentType: 'application/javascript', body: mockNotificationsService }));
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const consoleErrors = [];

  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => consoleErrors.push(error.message));

  await installMocks(page);
  await page.addInitScript(() => localStorage.setItem('ip_sidebar_collapsed', 'false'));

  const results = [];
  for (const routeName of routes) {
    await page.goto(`http://127.0.0.1:3000/#${routeName}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.ip-shell');
    await page.waitForTimeout(300);
    if (routeName === 'dashboard') {
      await page.screenshot({ path: 'C:/IMMOPILOT/.tmp/background-lovable-dashboard.png', fullPage: true });
    }

    const metrics = await page.evaluate(() => {
      const bg = selector => {
        const element = selector === 'html'
          ? document.documentElement
          : selector === 'body'
            ? document.body
            : document.querySelector(selector);
        return element ? getComputedStyle(element).backgroundColor : null;
      };

      const edgeSamples = [
        document.elementFromPoint(0, 0),
        document.elementFromPoint(window.innerWidth - 1, 0),
        document.elementFromPoint(window.innerWidth - 1, window.innerHeight - 1),
        document.elementFromPoint(0, window.innerHeight - 1),
      ].map(element => element ? getComputedStyle(element).backgroundColor : null);

      return {
        html: bg('html'),
        body: bg('body'),
        app: bg('#app'),
        shell: bg('.ip-shell'),
        workspace: bg('.ip-workspace'),
        content: bg('#app-content'),
        routeRoot: bg('.lv-page'),
        edgeSamples,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });

    results.push({ route: routeName, ...metrics });
  }

  await browser.close();
  console.log(JSON.stringify({ expected, results, consoleErrors }, null, 2));

  
  for (const result of results) {
    if (result.overflowX) process.exitCode = 1;
    for (const key of ['html', 'body', 'app', 'shell', 'workspace', 'content']) {
      if (result[key] !== expected) process.exitCode = 1;
    }
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

