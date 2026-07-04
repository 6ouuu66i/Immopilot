import { chromium } from '@playwright/test';

const baseUrl = 'http://127.0.0.1:3000/';
const shotDir = 'C:/IMMOPILOT/.tmp';
const now = '2026-07-03T09:00:00.000Z';

const photos = [
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=640&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=640&q=80',
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=640&q=80',
];

const contacts = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    agency_id: 'agency-1',
    created_by: 'agent-1',
    owner_id: 'agent-1',
    reference: 'CTC-001',
    full_name: 'Marie Lambert',
    email: 'marie.lambert@example.com',
    phone: '+32 472 18 44 11',
    roles: ['vendeur', 'proprietaire'],
    notes: 'Prefere un appel le matin.',
    source: 'Immoweb',
    last_interaction_at: now,
    created_at: now,
    updated_at: now,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    agency_id: 'agency-1',
    created_by: 'agent-1',
    owner_id: 'agent-1',
    reference: 'CTC-002',
    full_name: 'Thomas Vermeulen',
    email: 'thomas.vermeulen@example.com',
    phone: '+32 486 22 19 08',
    roles: ['prospect'],
    notes: 'Recherche estimation rapide.',
    source: 'Zimmo',
    last_interaction_at: now,
    created_at: '2026-07-02T09:00:00.000Z',
    updated_at: now,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    agency_id: 'agency-1',
    created_by: 'agent-1',
    owner_id: 'agent-1',
    reference: 'CTC-003',
    full_name: 'Nadia Simon',
    email: 'nadia.simon@example.com',
    phone: '+32 495 11 73 42',
    roles: ['acheteur', 'investisseur'],
    notes: null,
    source: 'Referral',
    last_interaction_at: null,
    created_at: '2026-07-01T09:00:00.000Z',
    updated_at: now,
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    agency_id: 'agency-1',
    created_by: 'agent-1',
    owner_id: 'agent-1',
    reference: 'CTC-004',
    full_name: 'Julien Renard',
    email: 'julien.renard@example.com',
    phone: '+32 477 90 14 20',
    roles: ['vendeur'],
    notes: 'Mandat potentiel apres estimation.',
    source: '2ememain',
    last_interaction_at: now,
    created_at: '2026-06-30T09:00:00.000Z',
    updated_at: now,
  },
];

function propertyLink(index, contactId, city, title, price) {
  const propertyId = `property-${index}`;
  return {
    id: `contact-property-${index}`,
    contact_id: contactId,
    property_id: propertyId,
    relationship: index % 2 === 0 ? 'owner' : 'interested',
    created_at: now,
    property: {
      id: propertyId,
      agency_id: 'agency-1',
      property_type: 'Maison',
      property_subtype: index % 2 === 0 ? 'Maison 3 facades' : 'Appartement',
      country: 'BE',
      region: 'Bruxelles',
      province: 'Bruxelles',
      locality: city,
      postcode: '1180',
      street: 'Avenue Brugmann',
      house_number: String(80 + index),
      address_key: `avenue-brugmann-${index}`,
      latitude: null,
      longitude: null,
      bedroom_count: 3,
      bathroom_count: 2,
      living_area: 162,
      land_area: 280,
      created_at: now,
      updated_at: now,
    },
    currentListing: {
      id: `listing-${index}`,
      agency_id: 'agency-1',
      property_id: propertyId,
      source: 'Immoweb',
      external_id: `immo-${index}`,
      url: 'https://example.com/listing',
      title_fr: title,
      title_nl: null,
      description_fr: 'Bien lie au contact.',
      description_nl: null,
      price,
      old_price: price + 30000,
      photo_urls: [photos[index % photos.length]],
      is_fsbo: true,
      seller_type: 'private',
      status: 'active',
      ai_score: 86 - index,
      ai_gross_yield: 4.4,
      published_at: '2026-04-22T10:00:00.000Z',
      first_seen_at: '2026-04-22T10:00:00.000Z',
      last_seen_at: now,
      created_at: now,
      updated_at: now,
    },
    address: `Avenue Brugmann ${80 + index}`,
    city,
    currentPrice: price,
    photos: [photos[index % photos.length]],
  };
}

const fullContacts = contacts.map((contact, index) => ({
  ...contact,
  properties: index === 2 ? [] : [propertyLink(index + 1, contact.id, ['Uccle', 'Ixelles', 'Lasne', 'Namur'][index], ['Maison familiale a Uccle', 'Appartement lumineux a Ixelles', 'Villa calme a Lasne', 'Maison a renover a Namur'][index], [420000, 365000, 790000, 295000][index])],
  deals: index === 2 ? [] : [{
    id: `deal-${index + 1}`,
    agency_id: 'agency-1',
    owner_id: 'agent-1',
    property_id: `property-${index + 1}`,
    contact_id: contact.id,
    stage_id: 'stage-1',
    title: `Dossier ${contact.reference}`,
    reference: `DEAL-${String(index + 1).padStart(3, '0')}`,
    estimated_commission: [12600, 10950, 23700, 8850][index],
    expected_close_date: '2026-09-15',
    closed_at: null,
    is_won: false,
    is_lost: false,
    lost_reason: null,
    notes: 'Suivi actif.',
    created_at: now,
    updated_at: now,
  }],
  notesList: [],
}));

const tasks = contacts.flatMap((contact, index) => ([
  {
    id: `task-${index + 1}`,
    agency_id: 'agency-1',
    owner_id: 'agent-1',
    title: index === 0 ? 'Relancer apres estimation' : 'Planifier appel vendeur',
    description: null,
    due_date: '2026-07-03T10:00:00.000Z',
    priority: index === 0 ? 'haute' : 'moyenne',
    deal_id: fullContacts[index].deals[0]?.id ?? null,
    property_id: fullContacts[index].properties[0]?.property_id ?? null,
    contact_id: contact.id,
    is_completed: false,
    completed_at: null,
    created_at: now,
    updated_at: now,
    relations: { deal: null, contact, property: null, listing: null },
  },
]));

const authMock = `
const user = { id: 'agent-1', email: 'lea@immopilot.local' };
const profile = { id: 'agent-1', agency_id: 'agency-1', email: 'lea@immopilot.local', full_name: 'Lea Dubois', role: 'admin', avatar_url: '', is_active: true };
const agency = { id: 'agency-1', name: 'ImmoPilot Bruxelles' };
export function AuthProvider({ children }) { return children; }
export function useAuth() {
  return { user, profile, agency, isLoading: false, isAuthenticated: true, signIn: async () => {}, signOut: async () => {}, signUp: async () => {}, refreshProfile: async () => {} };
}
`;

const contactsMock = `
const contacts = ${JSON.stringify(contacts)};
const fullContacts = ${JSON.stringify(fullContacts)};
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
    createContact: async (input) => ({ ...contacts[0], ...input, id: '55555555-5555-4555-8555-555555555555', reference: 'CTC-005', full_name: input.full_name }),
    updateContact: async () => contacts[0],
    deleteContact: async () => {},
  };
}
export function useContact(contactId) {
  return { contact: fullContacts.find((contact) => contact.id === contactId) || null, isLoading: false, error: null, refresh: async () => {} };
}
`;

const tasksMock = `
const tasks = ${JSON.stringify(tasks)};
export function taskToView(task) {
  const due = task.due_date ? new Date(task.due_date) : null;
  return { id: task.id, title: task.title, date: due ? due.toISOString().slice(0, 10) : '', time: due ? due.toTimeString().slice(0, 5) : '09:00', priority: task.priority === 'haute' ? 'haute' : 'moyenne', done: task.is_completed, agentId: task.owner_id, propertyId: null, dealId: task.deal_id, contactId: task.contact_id, place: 'Uccle' };
}
export function taskLinkLabel() { return 'Contact lie'; }
export function useTasks() { return { tasks, isLoading: false, error: null, refresh: async () => {}, createTask: async (input) => ({ ...tasks[0], ...input, id: 'task-new' }), updateTask: async () => tasks[0], completeTask: async () => tasks[0], uncompleteTask: async () => tasks[0], toggleTask: async () => tasks[0], deleteTask: async () => {} }; }
export function useTasksFor(params = {}) {
  const scoped = tasks.filter((task) => !params.contactId || task.contact_id === params.contactId);
  return { openTasks: scoped.filter((task) => !task.is_completed), completedTasks: scoped.filter((task) => task.is_completed), tasks: scoped, isLoading: false, error: null, refresh: async () => {}, createTask: async (input) => ({ ...scoped[0], ...input, id: 'task-new' }), updateTask: async () => scoped[0], completeTask: async () => scoped[0], uncompleteTask: async () => scoped[0], toggleTask: async () => scoped[0], deleteTask: async () => {} };
}
`;

const notesMock = `
const notes = [{ id: 'note-1', agency_id: 'agency-1', author_id: 'agent-1', property_id: null, deal_id: null, contact_id: '11111111-1111-4111-8111-111111111111', content: 'Contact chaud, proposer une estimation comparative.', created_at: '2026-07-03T08:45:00.000Z', updated_at: '2026-07-03T08:45:00.000Z', author: { id: 'agent-1', full_name: 'Lea Dubois', email: 'lea@immopilot.local', role: 'admin' } }];
export function useNotes() {
  return { notes, isLoading: false, error: null, createNote: async () => {}, updateNote: async () => {}, deleteNote: async () => {}, canEditNote: () => true };
}
`;

const notificationsMock = `
export function useNotifications() { return { notifications: [], unreadCount: 0, isLoading: false, error: null, refresh: async () => {}, markAsRead: async () => {}, markAllAsRead: async () => {}, deleteNotification: async () => {} }; }
`;

async function attachRoutes(page) {
  const routes = [
    ['**/src/lib/auth.tsx*', authMock],
    ['**/src/lib/useContacts.ts*', contactsMock],
    ['**/src/lib/useTasks.ts*', tasksMock],
    ['**/src/lib/useNotes.ts*', notesMock],
    ['**/src/lib/useNotifications.ts*', notificationsMock],
  ];
  for (const [pattern, body] of routes) {
    await page.route(pattern, (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body }));
  }
}

async function inspect(page) {
  return page.evaluate(() => {
    const title = document.querySelector('.lv-contacts .lv-title');
    const root = document.querySelector('.lv-contacts');
    const shell = document.querySelector('.contacts-table-shell');
    const panel = document.querySelector('.contact-panel');
    return {
      titleText: title?.textContent?.trim() ?? null,
      titleFont: title ? getComputedStyle(title).fontFamily : null,
      rootBg: root ? getComputedStyle(root).backgroundColor : null,
      shellRadius: shell ? getComputedStyle(shell).borderRadius : null,
      panelOpen: Boolean(panel),
      rows: document.querySelectorAll('.contacts-table tbody tr').length,
      modalOpen: Boolean(document.querySelector('.contact-modal')),
      hasOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    };
  });
}

async function waitForImages(page) {
  await page.waitForFunction(() => {
    const images = Array.from(document.querySelectorAll('.lv-contacts img'));
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
  await page.goto(`${baseUrl}#contacts`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.lv-contacts .contacts-table tbody tr', { timeout: 15000 });
  await page.waitForSelector('.contact-panel', { timeout: 15000 });
  await waitForImages(page);
  await page.screenshot({ path: `${shotDir}/contacts-lovable-table-panel.png`, fullPage: true });
  const tablePanel = await inspect(page);

  await page.click('.add-contact-link');
  await page.waitForSelector('.contact-modal', { timeout: 10000 });
  await page.screenshot({ path: `${shotDir}/contacts-lovable-modal.png`, fullPage: true });
  const modal = await inspect(page);

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
  mobile.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[mobile] ${msg.text()}`);
  });
  mobile.on('pageerror', (error) => errors.push(`[mobile] ${error.message}`));
  await attachRoutes(mobile);
  await mobile.goto(`${baseUrl}#contacts`, { waitUntil: 'networkidle' });
  await mobile.waitForSelector('.lv-contacts .contacts-table tbody tr', { timeout: 15000 });
  await mobile.waitForSelector('.contact-panel', { timeout: 15000 });
  await waitForImages(mobile);
  await mobile.screenshot({ path: `${shotDir}/contacts-lovable-mobile.png`, fullPage: true });
  const mobileMetrics = await inspect(mobile);

  await browser.close();
  console.log(JSON.stringify({ tablePanel, modal, mobile: mobileMetrics, errors }, null, 2));
  if (errors.length > 0) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
