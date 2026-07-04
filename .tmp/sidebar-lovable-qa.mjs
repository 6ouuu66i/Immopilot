import { chromium } from '@playwright/test';

const baseUrl = 'http://127.0.0.1:3000/#dashboard';
const outDir = 'C:/IMMOPILOT/.tmp';

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

async function collectMetrics(page) {
  return page.evaluate(() => {
    const sidebar = document.querySelector('.lv-lovable-sidebar');
    const active = document.querySelector('.lv-lovable-sidebar .ip-sidebar-link.is-active');
    const brand = document.querySelector('.lv-lovable-sidebar .ip-sidebar-brand');
    const navLinks = Array.from(document.querySelectorAll('.lv-lovable-sidebar .ip-sidebar-link')).map(link => link.textContent?.trim());
    return {
      sidebarWidth: sidebar ? getComputedStyle(sidebar).width : null,
      sidebarBg: sidebar ? getComputedStyle(sidebar).backgroundColor : null,
      brandRadius: brand ? getComputedStyle(brand).borderRadius : null,
      activeText: active?.textContent?.trim() ?? null,
      activeBg: active ? getComputedStyle(active).backgroundColor : null,
      activeColor: active ? getComputedStyle(active).color : null,
      railBg: active ? getComputedStyle(active.querySelector('.ip-sidebar-active-rail')).backgroundColor : null,
      navLinks,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
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
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.lv-lovable-sidebar .ip-sidebar-link.is-active');
  await page.screenshot({ path: `${outDir}/sidebar-lovable-open.png`, fullPage: true });
  const open = await collectMetrics(page);

  await page.locator('.lv-lovable-sidebar .ip-icon-button').first().click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${outDir}/sidebar-lovable-collapsed.png`, fullPage: true });
  const collapsed = await collectMetrics(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${outDir}/sidebar-lovable-mobile.png`, fullPage: true });
  const mobile = await collectMetrics(page);

  await browser.close();

  console.log(JSON.stringify({
    open,
    collapsed,
    mobile,
    consoleErrors,
    screenshots: [
      `${outDir}/sidebar-lovable-open.png`,
      `${outDir}/sidebar-lovable-collapsed.png`,
      `${outDir}/sidebar-lovable-mobile.png`,
    ],
  }, null, 2));

  if (consoleErrors.length > 0) process.exitCode = 1;
  if (open.overflowX || collapsed.overflowX || mobile.overflowX) process.exitCode = 1;
  if (open.sidebarWidth !== '268px') process.exitCode = 1;
  if (collapsed.sidebarWidth !== '72px') process.exitCode = 1;
  if (!open.navLinks.some(link => link?.includes('Biens'))) process.exitCode = 1;
  if (!open.navLinks.some(link => link?.includes('Contacts'))) process.exitCode = 1;
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
