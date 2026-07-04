import { chromium } from '@playwright/test';

const baseUrl = 'http://127.0.0.1:3000/';
const shotDir = 'C:/IMMOPILOT/.tmp';

const stages = [
  { id: 'stage-1', agency_id: 'agency-1', name: 'Nouveau', color: '#1E5A3A', position: 1, is_won: false, is_lost: false, created_at: '2026-07-01T08:00:00.000Z', updated_at: '2026-07-01T08:00:00.000Z' },
  { id: 'stage-2', agency_id: 'agency-1', name: 'Qualifie', color: '#53705F', position: 2, is_won: false, is_lost: false, created_at: '2026-07-01T08:00:00.000Z', updated_at: '2026-07-01T08:00:00.000Z' },
  { id: 'stage-3', agency_id: 'agency-1', name: 'Contact', color: '#8A6D1F', position: 3, is_won: false, is_lost: false, created_at: '2026-07-01T08:00:00.000Z', updated_at: '2026-07-01T08:00:00.000Z' },
  { id: 'stage-4', agency_id: 'agency-1', name: 'Visite', color: '#4A6E89', position: 4, is_won: false, is_lost: false, created_at: '2026-07-01T08:00:00.000Z', updated_at: '2026-07-01T08:00:00.000Z' },
  { id: 'stage-5', agency_id: 'agency-1', name: 'Proposition', color: '#8A6D1F', position: 5, is_won: false, is_lost: false, created_at: '2026-07-01T08:00:00.000Z', updated_at: '2026-07-01T08:00:00.000Z' },
  { id: 'stage-6', agency_id: 'agency-1', name: 'Mandat signe', color: '#1E5A3A', position: 6, is_won: false, is_lost: false, created_at: '2026-07-01T08:00:00.000Z', updated_at: '2026-07-01T08:00:00.000Z' },
  { id: 'stage-7', agency_id: 'agency-1', name: 'Bien vendu', color: '#1E5A3A', position: 7, is_won: true, is_lost: false, created_at: '2026-07-01T08:00:00.000Z', updated_at: '2026-07-01T08:00:00.000Z' },
  { id: 'stage-8', agency_id: 'agency-1', name: 'Perdu', color: '#B3402E', position: 8, is_won: false, is_lost: true, created_at: '2026-07-01T08:00:00.000Z', updated_at: '2026-07-01T08:00:00.000Z' },
];

const photos = [
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=640&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=640&q=80',
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=640&q=80',
  'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=640&q=80',
];

function deal(index, stageIndex, overrides = {}) {
  const price = overrides.price ?? (420000 + index * 35000);
  const id = `deal-${index}`;
  const propertyId = `property-${index}`;
  const contactId = `contact-${index}`;
  const ownerId = 'agent-1';
  const stage = stages[stageIndex];
  const now = '2026-07-03T09:00:00.000Z';
  return {
    id,
    agency_id: 'agency-1',
    owner_id: ownerId,
    property_id: propertyId,
    contact_id: contactId,
    stage_id: stage.id,
    title: overrides.title ?? `Dossier vendeur ${index}`,
    reference: `DEAL-${String(index).padStart(3, '0')}`,
    estimated_commission: Math.round(price * 0.03),
    expected_close_date: '2026-09-15',
    closed_at: null,
    is_won: false,
    lost_reason: null,
    created_at: now,
    updated_at: now,
    property: {
      id: propertyId,
      agency_id: 'agency-1',
      property_type: overrides.type ?? 'Maison',
      property_subtype: overrides.subtype ?? 'Maison 3 facades',
      country: 'BE',
      region: 'Bruxelles',
      province: 'Bruxelles',
      locality: overrides.city ?? 'Uccle',
      postcode: '1180',
      street: overrides.street ?? 'Avenue Brugmann',
      house_number: String(120 + index),
      latitude: null,
      longitude: null,
      bedroom_count: overrides.bedrooms ?? 3,
      bathroom_count: 2,
      living_area: overrides.surface ?? 164,
      land_area: overrides.land ?? 280,
      created_at: now,
      updated_at: now,
    },
    currentListing: {
      id: `listing-${index}`,
      agency_id: 'agency-1',
      property_id: propertyId,
      source: overrides.source ?? 'Immoweb',
      external_id: `immo-${index}`,
      url: 'https://example.com/listing',
      title_fr: overrides.title ?? `Maison familiale ${index}`,
      title_nl: null,
      description_fr: 'Bien suivi dans le pipeline avec baisse de prix et vendeur particulier.',
      description_nl: null,
      price,
      old_price: price + 35000,
      photo_urls: [photos[index % photos.length]],
      is_fsbo: overrides.fsbo ?? true,
      seller_type: 'private',
      ai_score: overrides.score ?? 82,
      ai_gross_yield: 4.7,
      published_at: '2026-04-22T10:00:00.000Z',
      first_seen_at: '2026-04-22T10:00:00.000Z',
      last_seen_at: '2026-07-03T08:00:00.000Z',
      created_at: now,
      updated_at: now,
    },
    contact: {
      id: contactId,
      agency_id: 'agency-1',
      reference: `CTC-${String(index).padStart(3, '0')}`,
      full_name: overrides.contact ?? ['Marie Lambert', 'Thomas Vermeulen', 'Nadia Simon', 'Julien Renard'][index % 4],
      email: `vendeur${index}@example.com`,
      phone: `+32 4${index}2 18 44 ${String(10 + index).padStart(2, '0')}`,
      roles: ['vendeur'],
      notes: 'Contact prioritaire, prefere un appel le matin.',
      created_at: now,
      updated_at: now,
    },
    owner: {
      id: ownerId,
      agency_id: 'agency-1',
      email: 'lea@immopilot.local',
      full_name: 'Lea Dubois',
      role: 'admin',
      avatar_url: '',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    stage,
    activities: [
      { id: `activity-${index}`, agency_id: 'agency-1', actor_id: ownerId, type: 'stage_changed', deal_id: id, property_id: propertyId, contact_id: contactId, payload: {}, created_at: now },
    ],
    tasks: [
      { id: `task-${index}`, agency_id: 'agency-1', owner_id: ownerId, title: overrides.task ?? 'Relancer le proprietaire', description: null, due_date: '2026-07-03T10:00:00.000Z', priority: 'haute', deal_id: id, property_id: propertyId, contact_id: contactId, is_completed: false, completed_at: null, created_at: now, updated_at: now },
      { id: `task-${index}-2`, agency_id: 'agency-1', owner_id: ownerId, title: 'Preparer estimation', description: null, due_date: '2026-07-05T14:00:00.000Z', priority: 'moyenne', deal_id: id, property_id: propertyId, contact_id: contactId, is_completed: false, completed_at: null, created_at: now, updated_at: now },
    ],
    notes: 'Angle mandat exclusif a tester.',
    notesList: [],
  };
}

const deals = [
  deal(1, 0, { title: 'Maison familiale a Uccle', city: 'Uccle', price: 420000, score: 91 }),
  deal(2, 1, { title: 'Appartement lumineux a Ixelles', city: 'Ixelles', price: 365000, type: 'Appartement', subtype: 'Appartement', score: 84 }),
  deal(3, 2, { title: 'Villa calme a Lasne', city: 'Lasne', price: 790000, score: 78 }),
  deal(4, 3, { title: 'Maison a renover a Namur', city: 'Namur', price: 295000, score: 73 }),
  deal(5, 4, { title: 'Penthouse compact a Etterbeek', city: 'Etterbeek', price: 515000, type: 'Appartement', subtype: 'Penthouse', score: 81 }),
  deal(6, 5, { title: 'Maison bel-etage a Woluwe', city: 'Woluwe', price: 645000, score: 88 }),
];

const authMock = `
const user = { id: 'agent-1', email: 'lea@immopilot.local' };
const profile = { id: 'agent-1', agency_id: 'agency-1', email: 'lea@immopilot.local', full_name: 'Lea Dubois', role: 'admin', avatar_url: '', is_active: true };
const agency = { id: 'agency-1', name: 'ImmoPilot Bruxelles' };
export function AuthProvider({ children }) { return children; }
export function useAuth() {
  return { user, profile, agency, isLoading: false, isAuthenticated: true, signIn: async () => {}, signOut: async () => {}, signUp: async () => {}, refreshProfile: async () => {} };
}
`;

const dealsMock = `
const deals = ${JSON.stringify(deals)};
function withPatch(dealId, patch) {
  const item = deals.find((deal) => deal.id === dealId) || deals[0];
  return { ...item, ...patch, updated_at: new Date().toISOString() };
}
export function useDeals() {
  return {
    deals,
    isLoading: false,
    error: null,
    filters: {},
    setFilters: () => {},
    refresh: async () => {},
    createDeal: async () => deals[0],
    updateDeal: async (dealId, patch) => withPatch(dealId, patch),
    updateDealStage: async (dealId, newStageId) => {
      const nextStage = ${JSON.stringify(stages)}.find((stage) => stage.id === newStageId) || deals[0].stage;
      return withPatch(dealId, { stage_id: newStageId, stage: nextStage });
    },
    closeDeal: async (dealId, input) => withPatch(dealId, { closed_at: new Date().toISOString(), is_won: input?.is_won ?? false }),
    reopenDeal: async (dealId) => withPatch(dealId, { closed_at: null, is_won: false }),
    deleteDeal: async () => {},
  };
}
export function useDeal(value) {
  return { deal: deals.find((deal) => deal.id === value || deal.reference === value) || null, isLoading: false, error: null, refresh: async () => {} };
}
`;

const stagesMock = `
const stages = ${JSON.stringify(stages)};
export function usePipelineStages() {
  return { stages, isLoading: false, error: null, refresh: async () => {}, getStageById: (id) => stages.find((stage) => stage.id === id) || null };
}
`;

const tasksMock = `
const tasks = ${JSON.stringify(deals.flatMap((item) => item.tasks))};
export function taskToView(task) {
  const due = task.due_date ? new Date(task.due_date) : null;
  return { id: task.id, title: task.title, date: due ? due.toISOString().slice(0, 10) : '', time: due ? due.toTimeString().slice(0, 5) : '09:00', priority: task.priority === 'haute' ? 'haute' : 'moyenne', done: task.is_completed, agentId: task.owner_id, propertyId: null, dealId: task.deal_id, contactId: task.contact_id, place: 'Uccle' };
}
export function taskLinkLabel() { return 'Deal lie'; }
export function useTasks() { return { tasks, isLoading: false, error: null, refresh: async () => {}, createTask: async (input) => ({ ...tasks[0], ...input }), updateTask: async () => tasks[0], completeTask: async () => tasks[0], uncompleteTask: async () => tasks[0], toggleTask: async () => tasks[0], deleteTask: async () => {} }; }
export function useTasksFor(params = {}) {
  const scoped = tasks.filter((task) => !params.dealId || task.deal_id === params.dealId);
  return { openTasks: scoped.filter((task) => !task.is_completed), completedTasks: scoped.filter((task) => task.is_completed), tasks: scoped, isLoading: false, error: null, refresh: async () => {}, createTask: async (input) => ({ ...scoped[0], ...input, id: 'task-new' }), updateTask: async () => scoped[0], completeTask: async () => scoped[0], uncompleteTask: async () => scoped[0], toggleTask: async () => scoped[0], deleteTask: async () => {} };
}
`;

const notesMock = `
const notes = [{ id: 'note-1', agency_id: 'agency-1', author_id: 'agent-1', property_id: null, deal_id: 'deal-1', contact_id: null, content: 'Vendeur ouvert a une estimation argumentee.', created_at: '2026-07-03T08:45:00.000Z', updated_at: '2026-07-03T08:45:00.000Z', author: { id: 'agent-1', full_name: 'Lea Dubois', email: 'lea@immopilot.local', role: 'admin' } }];
export function useNotes() {
  return { notes, isLoading: false, error: null, createNote: async () => {}, updateNote: async () => {}, deleteNote: async () => {}, canEditNote: () => true };
}
`;

const commissionsMock = `
export function useMyCommissions() { return { commissions: [], isLoading: false, error: null, refresh: async () => {} }; }
export function useAgencyCommissions() { return { commissions: [], isLoading: false, error: null, refresh: async () => {}, createCommission: async () => ({}), updateCommission: async () => ({}), updateStatus: async () => ({}), markAsPaid: async () => ({}), deleteCommission: async () => {} }; }
export function useCommission() { return { commission: null, isLoading: false, error: null, refresh: async () => {} }; }
`;

const transfersMock = `
export function useMyTransfers() { return { transfers: [], pendingReceived: [], pendingSent: [], history: [], isLoading: false, error: null, refresh: async () => {}, requestTransfer: async () => ({}), acceptTransfer: async () => ({}), refuseTransfer: async () => ({}), cancelTransfer: async () => ({}) }; }
export function useTransfer() { return { transfer: null, isLoading: false, error: null, refresh: async () => {} }; }
`;

const notificationsMock = `
export function useNotifications() { return { notifications: [], unreadCount: 0, isLoading: false, error: null, refresh: async () => {}, markAsRead: async () => {}, markAllAsRead: async () => {}, deleteNotification: async () => {} }; }
`;

async function attachRoutes(page) {
  const routes = [
    ['**/src/lib/auth.tsx*', authMock],
    ['**/src/lib/useDeals.ts*', dealsMock],
    ['**/src/lib/usePipelineStages.ts*', stagesMock],
    ['**/src/lib/useTasks.ts*', tasksMock],
    ['**/src/lib/useNotes.ts*', notesMock],
    ['**/src/lib/useCommissions.ts*', commissionsMock],
    ['**/src/lib/useTransfers.ts*', transfersMock],
    ['**/src/lib/useNotifications.ts*', notificationsMock],
  ];
  for (const [pattern, body] of routes) {
    await page.route(pattern, (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body }));
  }
}

async function inspect(page) {
  return page.evaluate(() => {
    const title = document.querySelector('.lv-pipeline .lv-title');
    const root = document.querySelector('.lv-pipeline');
    const firstCard = document.querySelector('.deal-card');
    const panel = document.querySelector('.fiche-panel');
    const listRow = document.querySelector('.list-row');
    return {
      titleText: title?.textContent?.trim() ?? null,
      titleFont: title ? getComputedStyle(title).fontFamily : null,
      rootBg: root ? getComputedStyle(root).backgroundColor : null,
      cardRadius: firstCard ? getComputedStyle(firstCard).borderRadius : null,
      panelOpen: Boolean(panel),
      cards: document.querySelectorAll('.deal-card').length,
      columns: document.querySelectorAll('.column').length,
      rows: document.querySelectorAll('.list-row').length,
      hasOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      listRowGrid: listRow ? getComputedStyle(listRow).gridTemplateColumns : null,
    };
  });
}

async function waitForPipelineImages(page) {
  await page.waitForFunction(() => {
    const images = Array.from(document.querySelectorAll('.lv-pipeline img'));
    if (images.length === 0) return true;
    return images.every((image) => image.complete && image.naturalWidth > 0);
  }, { timeout: 15000 }).catch(() => undefined);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const errors = [];

  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await attachRoutes(page);
  await page.goto(`${baseUrl}#pipeline`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.lv-pipeline .deal-card', { timeout: 15000 });
  await waitForPipelineImages(page);
  await page.screenshot({ path: `${shotDir}/pipeline-lovable-kanban.png`, fullPage: true });
  const kanban = await inspect(page);

  await page.click('.deal-card');
  await page.waitForSelector('.fiche-panel', { timeout: 10000 });
  await waitForPipelineImages(page);
  await page.screenshot({ path: `${shotDir}/pipeline-lovable-panel.png`, fullPage: true });
  const panel = await inspect(page);

  await page.click('.fiche-close');
  await page.waitForSelector('.fiche-panel', { state: 'detached', timeout: 10000 });
  await page.click('button[title="Vue Liste"]');
  await page.waitForSelector('.list-row', { timeout: 10000 });
  await waitForPipelineImages(page);
  await page.screenshot({ path: `${shotDir}/pipeline-lovable-list.png`, fullPage: true });
  const list = await inspect(page);

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
  mobile.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[mobile] ${msg.text()}`);
  });
  mobile.on('pageerror', (error) => errors.push(`[mobile] ${error.message}`));
  await attachRoutes(mobile);
  await mobile.goto(`${baseUrl}#pipeline`, { waitUntil: 'networkidle' });
  await mobile.waitForSelector('.lv-pipeline .deal-card', { timeout: 15000 });
  await waitForPipelineImages(mobile);
  await mobile.screenshot({ path: `${shotDir}/pipeline-lovable-mobile.png`, fullPage: true });
  const mobileMetrics = await inspect(mobile);

  await browser.close();
  console.log(JSON.stringify({ kanban, panel, list, mobile: mobileMetrics, errors }, null, 2));
  if (errors.length > 0) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
