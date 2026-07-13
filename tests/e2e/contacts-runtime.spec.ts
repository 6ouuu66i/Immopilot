import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  getContactsDataState,
  mapContactActivities,
  removeContactFromList,
  replaceContactInList,
  upsertContactList,
} from '../../src/lib/contactRuntime';
import { queryKeys } from '../../src/lib/queryKeys';
import type { ContactActivity, SupabaseContact } from '../../src/lib/services/contactsService';

const rootDir = process.cwd();

function contact(id: string, agencyId = 'agency-a', createdAt = '2026-07-13T10:00:00.000Z'): SupabaseContact {
  return {
    id,
    agency_id: agencyId,
    created_at: createdAt,
    created_by: 'user-a',
    email: `${id}@example.test`,
    full_name: id,
    last_interaction_at: null,
    notes: null,
    owner_id: 'user-a',
    phone: null,
    reference: `CTC-${id}`,
    roles: ['prospect'],
    source: null,
    updated_at: createdAt,
  };
}

function activity(
  id: string,
  contactId: string,
  agencyId = 'agency-a',
  createdAt = '2026-07-13T10:00:00.000Z',
): ContactActivity {
  return {
    id,
    actor_id: 'user-a',
    agency_id: agencyId,
    contact_id: contactId,
    created_at: createdAt,
    deal_id: null,
    payload: { message: `Activite ${id}` },
    property_id: null,
    type: 'contact_updated',
    actor: { id: 'user-a', full_name: 'Agent A', email: 'agent@example.test' },
  };
}

test('Contacts distinguishes loading, network error, empty data, and loaded Supabase data', () => {
  const loaded = [contact('contact-a')];

  expect(getContactsDataState([], true, null)).toBe('loading');
  expect(getContactsDataState([], false, 'reseau indisponible')).toBe('error');
  expect(getContactsDataState([], false, null)).toBe('empty');
  expect(getContactsDataState(loaded, false, null)).toBe('ready');
  expect(getContactsDataState(loaded, false, 'donnees obsoletes')).toBe('error');
});

test('contact cache updates are deterministic and never duplicate or overwrite another agency record', () => {
  const agencyA = contact('contact-a', 'agency-a', '2026-07-12T10:00:00.000Z');
  const agencyB = contact('contact-b', 'agency-b', '2026-07-11T10:00:00.000Z');
  const created = contact('contact-c', 'agency-a', '2026-07-13T10:00:00.000Z');
  const updated = { ...agencyA, full_name: 'Contact A modifie', updated_at: '2026-07-13T11:00:00.000Z' };

  const afterCreate = upsertContactList([agencyA, agencyB], created);
  expect(afterCreate.map(({ id }) => id)).toEqual(['contact-c', 'contact-a', 'contact-b']);
  expect(upsertContactList(afterCreate, created).filter(({ id }) => id === created.id)).toHaveLength(1);

  const afterUpdate = replaceContactInList(afterCreate, updated);
  expect(afterUpdate.find(({ id }) => id === agencyA.id)?.full_name).toBe('Contact A modifie');
  expect(afterUpdate.find(({ id }) => id === agencyB.id)).toEqual(agencyB);
  expect(replaceContactInList(afterUpdate, contact('contact-foreign', 'agency-b'))).toEqual(afterUpdate);

  expect(removeContactFromList(afterUpdate, agencyA.id).map(({ id }) => id)).toEqual(['contact-c', 'contact-b']);
});

test('contact activities use true contact and agency ids, ignore duplicates, and keep newest first', () => {
  const newest = activity('activity-new', 'contact-a', 'agency-a', '2026-07-13T12:00:00.000Z');
  const oldest = activity('activity-old', 'contact-a', 'agency-a', '2026-07-12T12:00:00.000Z');
  const duplicate = { ...oldest };
  const wrongContact = activity('activity-other-contact', 'contact-b', 'agency-a');
  const wrongAgency = activity('activity-other-agency', 'contact-a', 'agency-b');

  const mapped = mapContactActivities(
    [oldest, wrongContact, newest, duplicate, wrongAgency],
    'contact-a',
    'agency-a',
  );

  expect(mapped.map(({ id }) => id)).toEqual(['activity-new', 'activity-old']);
  expect(mapped[0]).toMatchObject({
    text: 'Activite activity-new',
    agentName: 'Agent A',
    entityType: 'contact',
    entityId: 'contact-a',
  });
});

test('contact query caches are isolated per user and normalize batched activity ids', () => {
  expect(queryKeys.contacts('user-a', '  Alice ')).toEqual(['contacts', 'user-a', 'Alice']);
  expect(queryKeys.contacts('user-a')).not.toEqual(queryKeys.contacts('user-b'));
  expect(queryKeys.contactActivities('user-a', ['contact-b', 'contact-a', 'contact-b'])).toEqual([
    'contact-activities',
    'user-a',
    ['contact-a', 'contact-b'],
  ]);
});

test('Contacts runtime has no mock store fallback and batches Supabase activities behind agency RLS', async () => {
  const [mainSource, pageSource, hookSource, serviceSource, rlsSource] = await Promise.all([
    fs.readFile(path.join(rootDir, 'src/main.tsx'), 'utf8'),
    fs.readFile(path.join(rootDir, 'src/pages/Contacts.tsx'), 'utf8'),
    fs.readFile(path.join(rootDir, 'src/lib/useContacts.ts'), 'utf8'),
    fs.readFile(path.join(rootDir, 'src/lib/services/contactsService.ts'), 'utf8'),
    fs.readFile(path.join(rootDir, 'supabase/migrations/20260629182636_create_crm_remaining_schema_rls.sql'), 'utf8'),
  ]);

  expect(pageSource).not.toContain("from '../lib/store'");
  expect(pageSource).not.toContain('getContactActivities');
  expect(mainSource).toContain('<Contacts />');
  expect(mainSource).not.toContain('<Contacts store={store} />');
  expect(hookSource).toContain('useQuery({');
  expect(hookSource).toContain('useMutation({');
  expect(hookSource).toContain('invalidateQueries({ queryKey: rootQueryKey })');
  expect(serviceSource).toContain(".from('activities')");
  expect(serviceSource).toContain(".in('contact_id', ids)");
  expect(rlsSource).toContain('"Agency users see agency activities"');
  expect(rlsSource).toContain('agency_id = public.current_agency_id()');
});
