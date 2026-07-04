import { chromium } from '@playwright/test';

const mockAuth = `
export function AuthProvider({ children }) { return children; }
export function useAuth() {
  return {
    user: { id: 'user-1' },
    profile: { id: 'user-1', agency_id: 'agency-1', full_name: 'Sarah Dubois', role: 'admin', is_active: true },
    agency: { name: 'ImmoPilot Studio' },
    isLoading: false,
    isAuthenticated: true,
    signIn: async () => {},
    signOut: async () => {},
    signUp: async () => {},
    refreshProfile: async () => {},
  };
}
`;

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await page.route('**/src/lib/auth.tsx*', route => route.fulfill({ contentType: 'application/javascript', body: mockAuth }));
  await page.route('**/src/lib/useNotifications.ts*', route => route.fulfill({ contentType: 'application/javascript', body: 'export function useNotifications(){return {notifications:[],unreadCount:0,isLoading:false,error:null,markAsRead:async()=>{},markAllAsRead:async()=>{}}}' }));
  await page.route('**/src/lib/services/notificationsService.ts*', route => route.fulfill({ contentType: 'application/javascript', body: 'export async function resolveNotificationUrl(){return "#notifications"}' }));
  await page.goto('http://127.0.0.1:3000/#biens', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForSelector('.ip-shell', { timeout: 10000 });
  await page.waitForTimeout(1000);
  const result = await page.evaluate(() => {
    const x = window.innerWidth - 1;
    const y = window.innerHeight - 1;
    const chain = [];
    let element = document.elementFromPoint(x, y);
    while (element && element.nodeType === 1 && chain.length < 10) {
      chain.push({
        tag: element.tagName,
        id: element.id,
        className: typeof element.className === 'string' ? element.className : String(element.className),
        bg: getComputedStyle(element).backgroundColor,
      });
      element = element.parentElement;
    }
    return { point: { x, y }, chain };
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
