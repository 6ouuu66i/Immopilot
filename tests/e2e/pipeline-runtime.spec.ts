import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildPipelineRuntime,
  getPipelineDataState,
  isSupportedPipelineStage,
  pipelineUiError,
} from '../../src/lib/pipelineRuntime';
import type { DealFull } from '../../src/lib/services/dealsService';
import type { PipelineStageRow } from '../../src/lib/services/pipelineStagesService';

const rootDir = process.cwd();

function stage(id: string, name: string, position: number): PipelineStageRow {
  return {
    id,
    agency_id: 'agency-a',
    color: '#123456',
    created_at: '2026-07-13T08:00:00.000Z',
    is_default: true,
    is_lost: false,
    is_won: false,
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

test('Pipeline distinguishes loading, error, empty, and ready data states', () => {
  const stages = [stage('stage-new', 'Nouveau', 1)];
  const deals = [fullDeal()];

  expect(getPipelineDataState([], [], true, null)).toBe('loading');
  expect(getPipelineDataState([], stages, false, 'network error')).toBe('error');
  expect(getPipelineDataState([], stages, false, null)).toBe('empty');
  expect(getPipelineDataState(deals, stages, false, null)).toBe('ready');
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
  const [sources, serviceSource] = await Promise.all([
    Promise.all(files.map((file) => fs.readFile(path.join(rootDir, file), 'utf8'))),
    fs.readFile(path.join(rootDir, 'src/lib/services/dealsService.ts'), 'utf8'),
  ]);

  for (const source of sources) {
    expect(source).not.toContain('lib/store');
    expect(source).not.toContain('store.');
  }
  expect(serviceSource).toContain(".in('id', propertyIds)");
  expect(serviceSource).toContain(".in('deal_id', ids)");
  expect(serviceSource).toContain('const [activitiesByDeal, tasksByDeal, notesByDeal] = await Promise.all([');
});

test('the app transports ImmoPilotStore only to Biens after Pipeline detachment', async () => {
  const [mainSource, contactsSource] = await Promise.all([
    fs.readFile(path.join(rootDir, 'src/main.tsx'), 'utf8'),
    fs.readFile(path.join(rootDir, 'src/pages/Contacts.tsx'), 'utf8'),
  ]);
  const transportedStoreProps: string[] = Array.from(
    mainSource.matchAll(/<[^>]+store=\{store\}[^>]*>/g),
    (match) => match[0],
  );

  expect(transportedStoreProps).toHaveLength(2);
  expect(transportedStoreProps.every((usage) => usage.startsWith('<Biens '))).toBe(true);
  expect(mainSource).toContain('<Pipeline />');
  expect(mainSource).not.toContain('<Pipeline store={store} />');
  expect(contactsSource).not.toContain('lib/store');
});
