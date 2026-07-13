import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildPipelineRuntime,
  getPipelineDataState,
  getPipelineStageTransition,
  isSupportedPipelineStage,
  pipelineUiError,
  resolvePipelineDeal,
  togglePipelineDealSelection,
} from '../../src/lib/pipelineRuntime';
import type { DealFull } from '../../src/lib/services/dealsService';
import type { PipelineStageRow } from '../../src/lib/services/pipelineStagesService';

const rootDir = process.cwd();

function stage(
  id: string,
  name: string,
  position: number,
  flags: { isWon?: boolean; isLost?: boolean } = {},
): PipelineStageRow {
  return {
    id,
    agency_id: 'agency-a',
    color: '#123456',
    created_at: '2026-07-13T08:00:00.000Z',
    is_default: true,
    is_lost: Boolean(flags.isLost),
    is_won: Boolean(flags.isWon),
    name,
    position,
  };
}

function fullDeal(overrides: Partial<DealFull> = {}): DealFull {
  const defaultStage = stage('stage-new', 'Nouveau', 1);
  return {
    agency_id: 'agency-a',
    closed_at: null,
    contact_id: 'contact-a',
    created_at: '2026-07-13T08:00:00.000Z',
    estimated_commission: 12500,
    expected_close_date: null,
    id: 'deal-a',
    is_lost: false,
    is_won: false,
    lost_reason: null,
    notes: null,
    owner_id: 'profile-a',
    property_id: 'property-a',
    reference: 'DEAL-001',
    stage_id: defaultStage.id,
    title: 'Mandat Bruxelles',
    updated_at: '2026-07-13T08:00:00.000Z',
    property: {
      address_key: 'Rue de la Loi 1',
      bathroom_count: 1,
      bedroom_count: 2,
      country: 'Belgique',
      created_at: '2026-07-13T08:00:00.000Z',
      house_number: '1',
      id: 'property-a',
      land_area: null,
      latitude: null,
      living_area: 90,
      locality: 'Bruxelles',
      longitude: null,
      postal_code: '1000',
      property_subtype: 'APARTMENT',
      property_type: 'APARTMENT',
      province: 'Bruxelles',
      region: 'Bruxelles',
      street: 'Rue de la Loi',
      updated_at: '2026-07-13T08:00:00.000Z',
    },
    currentListing: null,
    contact: {
      agency_id: 'agency-a',
      created_at: '2026-07-13T08:00:00.000Z',
      created_by: 'profile-a',
      email: 'vendeur@example.test',
      full_name: 'Vendeur Reel',
      id: 'contact-a',
      last_interaction_at: null,
      notes: null,
      owner_id: 'profile-a',
      phone: '+320000000',
      reference: 'CTC-001',
      roles: ['vendeur'],
      source: 'manuel',
      updated_at: '2026-07-13T08:00:00.000Z',
    },
    owner: {
      agency_id: 'agency-a',
      avatar_url: null,
      created_at: '2026-07-13T08:00:00.000Z',
      email: 'agent@example.test',
      full_name: 'Agent Reel',
      id: 'profile-a',
      ipi_number: null,
      is_active: true,
      notification_preferences: {},
      phone: null,
      role: 'agent',
      updated_at: '2026-07-13T08:00:00.000Z',
    },
    stage: defaultStage,
    activities: [{
      actor_id: 'profile-a',
      agency_id: 'agency-a',
      contact_id: 'contact-a',
      created_at: '2026-07-13T09:00:00.000Z',
      deal_id: 'deal-a',
      id: 'activity-a',
      payload: null,
      property_id: 'property-a',
      type: 'deal_created',
      actor: { id: 'profile-a', full_name: 'Agent Reel', email: 'agent@example.test' },
    }],
    tasks: [{
      agency_id: 'agency-a',
      completed_at: null,
      contact_id: 'contact-a',
      created_at: '2026-07-13T08:00:00.000Z',
      deal_id: 'deal-a',
      description: null,
      due_date: '2026-07-14T09:00:00.000Z',
      id: 'task-a',
      is_completed: false,
      owner_id: 'profile-a',
      priority: 'high',
      property_id: 'property-a',
      title: 'Relancer le vendeur',
      updated_at: '2026-07-13T08:00:00.000Z',
    }],
    notesList: [],
    ...overrides,
  };
}

test('Supabase deals hydrate true property, contact, profile, activity, and task ids', () => {
  const stages = [stage('stage-new', 'Nouveau', 1), stage('stage-contact', 'Contact', 2)];
  const runtime = buildPipelineRuntime([fullDeal()], stages, { 'property-a': { score: 82 } } as never);

  expect(runtime.deals).toHaveLength(1);
  expect(runtime.deals[0]).toMatchObject({ id: 'deal-a', stageId: 'stage-new', propertyId: 'property-a', contactId: 'contact-a', ownerId: 'profile-a' });
  expect(runtime.propertiesById.get('property-a')).toMatchObject({ id: 'property-a', city: 'Bruxelles', score: 82 });
  expect(runtime.contactsById.get('contact-a')?.name).toBe('Vendeur Reel');
  expect(runtime.agentsById.get('profile-a')?.name).toBe('Agent Reel');
  expect(runtime.tasksByDealId.get('deal-a')?.[0].id).toBe('task-a');
  expect(runtime.deals[0].activities[0]).toMatchObject({ id: 'activity-a', agentName: 'Agent Reel' });
});

test('a real empty stage stays empty without borrowing deals from another status', () => {
  const stages = [stage('stage-new', 'Nouveau', 1), stage('stage-contact', 'Contact', 2)];
  const runtime = buildPipelineRuntime([fullDeal()], stages, {});

  expect(runtime.deals.filter((deal) => deal.stageId === 'stage-new')).toHaveLength(1);
  expect(runtime.deals.filter((deal) => deal.stageId === 'stage-contact')).toEqual([]);
});

test('deal deep links resolve references to UUID selection and toggle the selected card', () => {
  const runtime = buildPipelineRuntime([fullDeal()], [stage('stage-new', 'Nouveau', 1)], {});

  expect(resolvePipelineDeal(runtime, 'DEAL-001')?.id).toBe('deal-a');
  expect(togglePipelineDealSelection(runtime, 'DEAL-001', 'deal-a')).toBeNull();
  expect(togglePipelineDealSelection(runtime, null, 'deal-a')).toBe('deal-a');
});

test('a shared property is hydrated from the active deal before newer closed history', () => {
  const stages = [stage('stage-new', 'Nouveau', 1), stage('stage-won', 'Vendu', 2, { isWon: true })];
  const active = fullDeal({ id: 'deal-active', owner_id: 'owner-active', updated_at: '2026-07-12T08:00:00.000Z' });
  const closed = fullDeal({
    id: 'deal-closed',
    owner_id: 'owner-closed',
    stage_id: 'stage-won',
    stage: stages[1],
    closed_at: '2026-07-13T08:00:00.000Z',
    is_won: true,
    updated_at: '2026-07-13T08:00:00.000Z',
  });
  const runtime = buildPipelineRuntime([active, closed], stages, {});

  expect(runtime.propertiesById.get('property-a')).toMatchObject({ ownerId: 'owner-active', reserved: false });
});

test('Pipeline distinguishes loading, error, empty, and ready data states', () => {
  const stages = [stage('stage-new', 'Nouveau', 1)];
  const deals = [fullDeal()];

  expect(getPipelineDataState([], [], true, null)).toBe('loading');
  expect(getPipelineDataState([], stages, false, 'network error')).toBe('error');
  expect(getPipelineDataState([], stages, false, null)).toBe('empty');
  expect(getPipelineDataState(deals, stages, false, null)).toBe('ready');
  expect(getPipelineDataState(deals, stages, true, 'refetch failed')).toBe('ready');
});

test('terminal stages close active deals and closed deals must be reopened explicitly', () => {
  const activeStage = stage('stage-new', 'Nouveau', 1);
  const wonStage = stage('stage-won', 'Vendu personnalise', 2, { isWon: true });
  const lostStage = stage('stage-lost', 'Archive personnalisee', 3, { isLost: true });
  const runtime = buildPipelineRuntime([fullDeal({ stage_id: activeStage.id, stage: activeStage })], [activeStage, wonStage, lostStage], {});
  const activeDeal = runtime.deals[0];
  const [activeStageView, wonStageView, lostStageView] = runtime.stages;

  expect(getPipelineStageTransition(activeDeal, wonStageView)).toEqual({ type: 'close', outcome: 'won' });
  expect(getPipelineStageTransition(activeDeal, lostStageView)).toEqual({ type: 'close', outcome: 'lost' });
  expect(getPipelineStageTransition(activeDeal, activeStageView)).toEqual({ type: 'blocked', reason: 'same-stage' });
  expect(getPipelineStageTransition({ ...activeDeal, closedAt: '2026-07-13T12:00:00.000Z', isWon: true }, activeStageView))
    .toEqual({ type: 'blocked', reason: 'closed' });
  expect(getPipelineStageTransition({ ...activeDeal, closedAt: '2026-07-13T12:00:00.000Z', isWon: true }, lostStageView))
    .toEqual({ type: 'blocked', reason: 'closed' });
});

test('unlinked Supabase contacts and properties remain available as Pipeline link targets', () => {
  const stages = [stage('stage-new', 'Nouveau', 1)];
  const optionDeal = fullDeal({
    id: 'deal-option',
    property_id: 'property-option',
    property: { ...fullDeal().property!, id: 'property-option', address_key: 'Bien sans deal courant' },
  });
  const optionProperty = buildPipelineRuntime([optionDeal], stages, {}).properties[0];
  const unlinkedContact = { ...fullDeal().contact!, id: 'contact-option', full_name: 'Contact sans deal' };
  const runtime = buildPipelineRuntime([fullDeal({ contact: null, contact_id: null })], stages, {}, {
    contacts: [unlinkedContact],
    properties: [optionProperty],
  });

  expect(runtime.contactsById.get('contact-option')?.name).toBe('Contact sans deal');
  expect(runtime.propertiesById.get('property-option')?.title).toBe('Bien sans deal courant');
});

test('tasks without a due date stay undated instead of becoming overdue at 09:00', () => {
  const base = fullDeal();
  const runtime = buildPipelineRuntime([fullDeal({
    tasks: [{ ...base.tasks[0], due_date: null }],
  })], [base.stage as PipelineStageRow], {});

  expect(runtime.tasksByDealId.get('deal-a')?.[0]).toMatchObject({ date: '', time: '' });
});

test('missing associated objects remain unavailable and never fall back to mocks', () => {
  const missing = fullDeal({ property: null, contact: null, owner: null });
  const runtime = buildPipelineRuntime([missing], [missing.stage as PipelineStageRow], {});

  expect(runtime.dealsById.has('deal-a')).toBe(true);
  expect(runtime.propertiesById.has('property-a')).toBe(false);
  expect(runtime.contactsById.has('contact-a')).toBe(false);
  expect(runtime.agentsById.has('profile-a')).toBe(false);
});

test('only ids from the loaded ordered stage set are accepted', () => {
  const stages = [stage('stage-new', 'Nouveau', 1), stage('stage-contact', 'Contact', 2)];
  expect(isSupportedPipelineStage(stages, 'stage-contact')).toBe(true);
  expect(isSupportedPipelineStage(stages, 'arbitrary-status')).toBe(false);
  expect(buildPipelineRuntime([], stages.reverse(), {}).stages.map(({ id }) => id)).toEqual(['stage-new', 'stage-contact']);
});

test('Pipeline errors are local UI messages, not persistent notification records', () => {
  expect(pipelineUiError('notes', 'timeout')).toBe('Synchronisation notes impossible : timeout');
  expect(pipelineUiError('tasks', 'RLS')).toBe('Synchronisation taches impossible : RLS');
  expect(pipelineUiError('move', 'conflict')).toBe('Deplacement du deal impossible : conflict');
});

test('Pipeline has no runtime or type dependency on ImmoPilotStore and keeps batched services', async () => {
  const files = [
    'src/pages/Pipeline.tsx',
    'src/components/pipeline/KanbanBoard.tsx',
    'src/components/pipeline/PipelineListView.tsx',
    'src/components/pipeline/DealFichePanel.tsx',
  ];
  const [sources, serviceSource, migrationSource] = await Promise.all([
    Promise.all(files.map((file) => fs.readFile(path.join(rootDir, file), 'utf8'))),
    fs.readFile(path.join(rootDir, 'src/lib/services/dealsService.ts'), 'utf8'),
    fs.readFile(path.join(rootDir, 'supabase/migrations/20260629182636_create_crm_remaining_schema_rls.sql'), 'utf8'),
  ]);

  for (const source of sources) {
    expect(source).not.toContain('lib/store');
    expect(source).not.toContain('store.');
  }
  expect(sources[0]).toContain('listPropertiesForPipelineLink');
  expect(sources[0]).toContain('const contactsState = useContacts();');
  expect(sources[1]).toContain('draggable={!isPending && !deal.closedAt && !deal.isWon && !deal.isLost}');
  expect(sources[2]).toContain('draggable={!isPending && !deal.closedAt && !deal.isWon && !deal.isLost}');
  expect(sources[3]).not.toContain('property?.score ?? 70');
  expect(serviceSource).toContain(".in('id', propertyIds)");
  expect(serviceSource).toContain(".in('deal_id', ids)");
  expect(serviceSource).toContain('const [activitiesByDeal, tasksByDeal, notesByDeal] = await Promise.all([');
  expect(serviceSource).not.toContain("logActivity(updated, 'stage_changed'");
  expect(serviceSource).toContain(".eq('stage_id', expectedStageId)");
  expect(serviceSource).toContain(".is('closed_at', null)");
  expect(serviceSource).toContain(".not('closed_at', 'is', null)");
  expect(migrationSource).toContain('CREATE TRIGGER log_deal_stage_change_trigger AFTER UPDATE ON public.deals');
});

test('the app no longer instantiates or transports ImmoPilotStore', async () => {
  const [mainSource, biensSource, contactsSource] = await Promise.all([
    fs.readFile(path.join(rootDir, 'src/main.tsx'), 'utf8'),
    fs.readFile(path.join(rootDir, 'src/pages/Biens.tsx'), 'utf8'),
    fs.readFile(path.join(rootDir, 'src/pages/Contacts.tsx'), 'utf8'),
  ]);

  expect(mainSource).not.toContain('lib/store');
  expect(mainSource).not.toContain('ImmoPilotStore');
  expect(mainSource).not.toContain('store={store}');
  expect(biensSource).not.toContain('lib/store');
  expect(biensSource).not.toContain('store.');
  expect(mainSource).toContain('<Pipeline />');
  expect(mainSource).not.toContain('<Pipeline store={store} />');
  expect(contactsSource).not.toContain('lib/store');
  await expect(fs.access(path.join(rootDir, 'src/lib/store.ts'))).rejects.toThrow();
});
