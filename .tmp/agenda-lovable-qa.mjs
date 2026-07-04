import { chromium } from '@playwright/test';

const baseUrl = process.env.QA_BASE_URL ?? 'http://127.0.0.1:3000/#agenda';
const outDir = 'C:/IMMOPILOT/.tmp';

function toLocalIso(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function addDaysIso(baseIso, days) {
  const date = new Date(`${baseIso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toLocalIso(date);
}

const today = toLocalIso(new Date());

function due(offset, time) {
  return `${addDaysIso(today, offset)}T${time}:00.000Z`;
}

const tasks = [
  {
    id: 'task-1',
    agency_id: 'agency-1',
    owner_id: 'user-1',
    title: 'Rappeler le proprietaire Avenue Louise',
    description: 'Verifier la motivation apres baisse de prix.',
    due_date: due(-1, '09:30'),
    priority: 'haute',
    deal_id: 'deal-1',
    property_id: null,
    contact_id: null,
    is_completed: false,
    completed_at: null,
    created_at: due(-4, '10:00'),
    updated_at: due(-1, '09:10'),
    relations: {
      deal: { id: 'deal-1', reference: 'OPP-1042', title: 'Avenue Louise 128' },
      contact: null,
      property: null,
      listing: null,
    },
  },
  {
    id: 'task-2',
    agency_id: 'agency-1',
    owner_id: 'user-1',
    title: 'Envoyer estimation Waterloo',
    description: 'Ajouter comparables recents.',
    due_date: due(0, '11:00'),
    priority: 'moyenne',
    deal_id: null,
    property_id: 'prop-1',
    contact_id: null,
    is_completed: false,
    completed_at: null,
    created_at: due(-2, '15:00'),
    updated_at: due(0, '08:30'),
    relations: {
      deal: null,
      contact: null,
      property: { id: 'prop-1', street: 'Rue de la Station', house_number: '18', locality: 'Waterloo', postal_code: '1410' },
      listing: { property_id: 'prop-1', title_fr: 'Maison 3 facades avec jardin', title_nl: null, source: 'Immoweb' },
    },
  },
  {
    id: 'task-3',
    agency_id: 'agency-1',
    owner_id: 'user-1',
    title: 'Qualifier contact famille Peeters',
    description: null,
    due_date: due(2, '14:15'),
    priority: 'basse',
    deal_id: null,
    property_id: null,
    contact_id: 'contact-1',
    is_completed: false,
    completed_at: null,
    created_at: due(-1, '16:00'),
    updated_at: due(-1, '16:00'),
    relations: {
      deal: null,
      contact: { id: 'contact-1', reference: 'CTC-204', full_name: 'Claire Peeters' },
      property: null,
      listing: null,
    },
  },
  {
    id: 'task-4',
    agency_id: 'agency-1',
    owner_id: 'user-1',
    title: 'Classer mandat signe',
    description: null,
    due_date: due(0, '08:20'),
    priority: 'moyenne',
    deal_id: 'deal-2',
    property_id: null,
    contact_id: null,
    is_completed: true,
    completed_at: due(0, '09:05'),
    created_at: due(-3, '12:00'),
    updated_at: due(0, '09:05'),
    relations: {
      deal: { id: 'deal-2', reference: 'OPP-1037', title: 'Chaussee de Wavre 44' },
      contact: null,
      property: null,
      listing: null,
    },
  },
];

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

const mockTasks = `
let tasks = ${JSON.stringify(tasks)};

export function taskLinkLabel(task) {
  if (task.relations?.deal) return \`Deal \${task.relations.deal.reference ?? task.relations.deal.title ?? ''}\`.trim();
  if (task.relations?.contact) return \`Contact \${task.relations.contact.reference ?? task.relations.contact.full_name}\`;
  if (task.relations?.listing) return \`Bien \${task.relations.listing.title_fr ?? task.relations.listing.source}\`;
  if (task.relations?.property) return \`Bien \${[task.relations.property.street, task.relations.property.house_number, task.relations.property.locality].filter(Boolean).join(' ')}\`.trim();
  if (task.deal_id) return 'Deal lie';
  if (task.contact_id) return 'Contact lie';
  if (task.property_id) return 'Bien lie';
  return 'Aucun objet lie';
}

function patchTask(task, patch) {
  return {
    ...task,
    ...patch,
    completed_at: patch.is_completed === true ? new Date().toISOString() : patch.is_completed === false ? null : task.completed_at,
    updated_at: new Date().toISOString(),
  };
}

export function useTasks() {
  return {
    tasks,
    isLoading: false,
    error: null,
    refresh: async () => {},
    createTask: async (input) => {
      const task = {
        id: \`task-\${Date.now()}\`,
        agency_id: 'agency-1',
        owner_id: 'user-1',
        title: input.title,
        description: input.description ?? null,
        due_date: input.due_date ?? null,
        priority: input.priority ?? 'moyenne',
        deal_id: input.deal_id ?? null,
        property_id: input.property_id ?? null,
        contact_id: input.contact_id ?? null,
        is_completed: false,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        relations: { deal: null, contact: null, property: null, listing: null },
      };
      tasks = [task, ...tasks];
      return task;
    },
    updateTask: async (taskId, patch) => {
      let updated = null;
      tasks = tasks.map((task) => {
        if (task.id !== taskId) return task;
        updated = patchTask(task, patch);
        return updated;
      });
      return updated;
    },
    completeTask: async (taskId) => {
      const task = tasks.find((item) => item.id === taskId);
      if (!task) return null;
      const updated = patchTask(task, { is_completed: true });
      tasks = tasks.map((item) => item.id === taskId ? updated : item);
      return updated;
    },
    uncompleteTask: async (taskId) => {
      const task = tasks.find((item) => item.id === taskId);
      if (!task) return null;
      const updated = patchTask(task, { is_completed: false });
      tasks = tasks.map((item) => item.id === taskId ? updated : item);
      return updated;
    },
    toggleTask: async (taskId) => {
      const task = tasks.find((item) => item.id === taskId);
      if (!task) return null;
      const updated = patchTask(task, { is_completed: !task.is_completed });
      tasks = tasks.map((item) => item.id === taskId ? updated : item);
      return updated;
    },
    deleteTask: async (taskId) => {
      tasks = tasks.filter((item) => item.id !== taskId);
    },
  };
}
`;

const mockDeals = `
const deals = [
  { id: 'deal-1', reference: 'OPP-1042', title: 'Avenue Louise 128', property: { locality: 'Ixelles' } },
  { id: 'deal-2', reference: 'OPP-1037', title: 'Chaussee de Wavre 44', property: { locality: 'Etterbeek' } },
];
export function useDeals() {
  return {
    deals,
    isLoading: false,
    error: null,
    filters: {},
    setFilters: () => {},
    refresh: async () => {},
    createDeal: async () => deals[0],
    updateDeal: async () => deals[0],
    updateDealStage: async () => deals[0],
    closeDeal: async () => deals[0],
    reopenDeal: async () => deals[0],
    deleteDeal: async () => {},
  };
}
export function useDeal() {
  return { deal: deals[0], isLoading: false, error: null, refresh: async () => {} };
}
`;

const mockContacts = `
const contacts = [
  {
    id: 'contact-1',
    agency_id: 'agency-1',
    created_at: new Date().toISOString(),
    created_by: 'user-1',
    email: 'claire.peeters@example.test',
    full_name: 'Claire Peeters',
    last_interaction_at: null,
    notes: null,
    owner_id: 'user-1',
    phone: '+32 470 12 34 56',
    reference: 'CTC-204',
    roles: ['proprietaire'],
    source: 'Immoweb',
    updated_at: new Date().toISOString(),
  },
];
export function useContacts() {
  return {
    contacts,
    isLoading: false,
    error: null,
    search: '',
    roleFilters: [],
    setSearch: () => {},
    setRoleFilters: () => {},
    toggleRoleFilter: () => {},
    refresh: async () => {},
    createContact: async () => contacts[0],
    updateContact: async () => contacts[0],
    deleteContact: async () => {},
  };
}
export function useContact() {
  return { contact: contacts[0], isLoading: false, error: null, refresh: async () => {} };
}
`;

const mockProperties = `
export async function fetchSupabaseProperties() {
  return [
    { supabasePropertyId: 'prop-1', title: 'Maison 3 facades', city: 'Waterloo' },
    { supabasePropertyId: 'prop-2', title: 'Appartement lumineux', city: 'Ixelles' },
  ];
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
  await page.route('**/src/lib/useTasks.ts*', route => route.fulfill({ contentType: 'application/javascript', body: mockTasks }));
  await page.route('**/src/lib/useDeals.ts*', route => route.fulfill({ contentType: 'application/javascript', body: mockDeals }));
  await page.route('**/src/lib/useContacts.ts*', route => route.fulfill({ contentType: 'application/javascript', body: mockContacts }));
  await page.route('**/src/lib/supabaseProperties.ts*', route => route.fulfill({ contentType: 'application/javascript', body: mockProperties }));
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
  page.on('pageerror', error => {
    consoleErrors.push(error.message);
  });

  await installMocks(page);
  await page.addInitScript(() => {
    localStorage.setItem('ip_sidebar_collapsed', 'false');
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.lv-agenda .agenda-task-row');
  await page.screenshot({ path: `${outDir}/agenda-lovable-main.png`, fullPage: true });

  const desktopMetrics = await page.evaluate(() => {
    const root = document.querySelector('.lv-agenda');
    const title = document.querySelector('.lv-agenda .lv-title');
    const taskPanel = document.querySelector('.lv-agenda .agenda-task-panel');
    const createCard = document.querySelector('.lv-agenda .agenda-create-card');
    return {
      title: title?.textContent ?? null,
      titleFont: title ? getComputedStyle(title).fontFamily : null,
      background: root ? getComputedStyle(root).backgroundColor : null,
      taskPanelRadius: taskPanel ? getComputedStyle(taskPanel).borderRadius : null,
      createGridColumns: createCard ? getComputedStyle(createCard).gridTemplateColumns : null,
      kpiCount: document.querySelectorAll('.lv-agenda .agenda-kpi').length,
      taskRows: document.querySelectorAll('.lv-agenda .agenda-task-row').length,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

  await page.locator('.agenda-create-card button:not(.agenda-create-main)').click();
  await page.waitForSelector('.lv-agenda .contact-modal');
  await page.screenshot({ path: `${outDir}/agenda-lovable-modal.png`, fullPage: true });

  const modalMetrics = await page.evaluate(() => {
    const modal = document.querySelector('.lv-agenda .contact-modal');
    return {
      modalOpen: Boolean(modal),
      modalRadius: modal ? getComputedStyle(modal).borderRadius : null,
      modalTitle: document.querySelector('.lv-agenda .contact-modal .section-head strong')?.textContent ?? null,
    };
  });

  await page.locator('.lv-agenda .section-head button').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${outDir}/agenda-lovable-mobile.png`, fullPage: true });

  const mobileMetrics = await page.evaluate(() => ({
    width: window.innerWidth,
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    layoutColumns: getComputedStyle(document.querySelector('.lv-agenda .agenda-layout')).gridTemplateColumns,
    kpiColumns: getComputedStyle(document.querySelector('.lv-agenda .agenda-kpis')).gridTemplateColumns,
  }));

  await browser.close();

  console.log(JSON.stringify({
    desktopMetrics,
    modalMetrics,
    mobileMetrics,
    consoleErrors,
    screenshots: [
      `${outDir}/agenda-lovable-main.png`,
      `${outDir}/agenda-lovable-modal.png`,
      `${outDir}/agenda-lovable-mobile.png`,
    ],
  }, null, 2));

  if (consoleErrors.length > 0) process.exitCode = 1;
  if (desktopMetrics.overflowX || mobileMetrics.overflowX) process.exitCode = 1;
  if (desktopMetrics.kpiCount !== 4 || desktopMetrics.taskRows < 1) process.exitCode = 1;
  if (!modalMetrics.modalOpen) process.exitCode = 1;
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
