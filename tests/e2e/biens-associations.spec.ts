import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildBiensActivityTimeline,
  buildBiensAssociationIndex,
  buildBiensAssociationPropertyIdFilter,
  countBiensAssociations,
  filterPropertiesByAssociations,
  getBiensPropertyAssociation,
  type BiensAssociationState,
} from '../../src/lib/biensAssociations';
import type { SupabaseContact, PropertyContactLink } from '../../src/lib/services/contactsService';
import type { DealActivity, DealFull } from '../../src/lib/services/dealsService';
import type { ListingSignal, SignalsByProperty } from '../../src/lib/services/listingSignalsService';

const rootDir = process.cwd();

interface PropertyReference {
  id: string;
  supabasePropertyId?: string;
  legacyStore?: { getPropertyContact: () => never };
}

function contact(id: string, updatedAt = '2026-07-01T10:00:00.000Z'): SupabaseContact {
  return {
    id,
    agency_id: 'agency-1',
    created_at: '2026-07-01T09:00:00.000Z',
    created_by: 'user-1',
    email: `${id}@example.test`,
    full_name: `Contact ${id}`,
    last_interaction_at: null,
    notes: null,
    owner_id: 'user-1',
    phone: null,
    reference: `CTC-${id}`,
    roles: ['prospect'],
    source: 'test',
    updated_at: updatedAt,
  };
}

function link(
  id: string,
  contactId: string,
  propertyId = 'property-real',
  relationship = 'interested',
  createdAt = '2026-07-01T10:00:00.000Z',
): PropertyContactLink {
  return {
    id,
    contact_id: contactId,
    property_id: propertyId,
    relationship,
    created_at: createdAt,
  };
}

function deal({
  id,
  propertyId = 'property-real',
  contactRow = null,
  closedAt = null,
  updatedAt = '2026-07-01T10:00:00.000Z',
}: {
  id: string;
  propertyId?: string;
  contactRow?: SupabaseContact | null;
  closedAt?: string | null;
  updatedAt?: string;
}): DealFull {
  return {
    id,
    agency_id: 'agency-1',
    closed_at: closedAt,
    contact_id: contactRow?.id ?? null,
    created_at: '2026-07-01T09:00:00.000Z',
    estimated_commission: null,
    expected_close_date: null,
    is_lost: Boolean(closedAt),
    is_won: false,
    lost_reason: null,
    notes: null,
    owner_id: 'user-1',
    property_id: propertyId,
    reference: `DEAL-${id}`,
    stage_id: 'stage-1',
    title: id,
    updated_at: updatedAt,
    property: null,
    currentListing: null,
    contact: contactRow,
    owner: null,
    stage: {
      id: 'stage-1',
      agency_id: 'agency-1',
      color: null,
      created_at: '2026-07-01T09:00:00.000Z',
      is_default: false,
      is_lost: false,
      is_won: false,
      name: 'À contacter',
      position: 1,
    },
    activities: [],
    tasks: [],
    notesList: [],
  };
}

function signal(propertyId = 'property-real'): ListingSignal {
  return {
    id: 'signal-1',
    property_id: propertyId,
    listing_id: 'listing-1',
    signal_type: 'price_drop',
    metadata: {},
    detected_at: '2026-07-01T10:00:00.000Z',
    is_active: true,
  };
}

function activity({
  id,
  dealId = 'active',
  propertyId = 'property-real',
  agencyId = 'agency-1',
  createdAt = '2026-07-01T10:00:00.000Z',
  actorName = 'Agent Réel',
  payload = null,
}: {
  id: string;
  dealId?: string;
  propertyId?: string;
  agencyId?: string;
  createdAt?: string;
  actorName?: string | null;
  payload?: DealActivity['payload'];
}): DealActivity {
  return {
    id,
    actor_id: actorName ? 'profile-real' : null,
    agency_id: agencyId,
    contact_id: null,
    created_at: createdAt,
    deal_id: dealId,
    payload,
    property_id: propertyId,
    type: 'stage_changed',
    actor: actorName ? { id: 'profile-real', full_name: actorName, email: 'agent@example.test' } : null,
  };
}

function buildIndex({
  propertyIds = ['property-real'],
  contacts = [],
  contactLinks = [],
  deals = [],
  signalsByProperty = {},
}: {
  propertyIds?: string[];
  contacts?: SupabaseContact[];
  contactLinks?: PropertyContactLink[];
  deals?: DealFull[];
  signalsByProperty?: SignalsByProperty;
} = {}) {
  return buildBiensAssociationIndex({ propertyIds, contacts, contactLinks, deals, signalsByProperty });
}

const properties: PropertyReference[] = [
  { id: 'mock-1', supabasePropertyId: 'property-real' },
  { id: 'mock-2', supabasePropertyId: 'property-other' },
];

test('1. bien sans contact ni deal', () => {
  const association = getBiensPropertyAssociation(buildIndex(), 'property-real');
  expect(association?.hasContact).toBe(false);
  expect(association?.inPipeline).toBe(false);
  expect(association?.primaryContact).toBeNull();
});

test('2. bien avec contact Supabase via contact_properties', () => {
  const owner = contact('owner');
  const association = getBiensPropertyAssociation(buildIndex({ contacts: [owner], contactLinks: [link('link-1', owner.id)] }), 'property-real');
  expect(association?.hasContact).toBe(true);
  expect(association?.primaryContact?.id).toBe(owner.id);
});

test('3. bien avec deal Supabase actif', () => {
  const activeDeal = deal({ id: 'active' });
  const association = getBiensPropertyAssociation(buildIndex({ deals: [activeDeal] }), 'property-real');
  expect(association?.activeDeal?.id).toBe(activeDeal.id);
  expect(association?.inPipeline).toBe(true);
});

test('4. bien avec contact, deal et signaux Supabase', () => {
  const linked = contact('linked');
  const dealContact = contact('deal-contact');
  const activeDeal = deal({ id: 'active', contactRow: dealContact });
  const liveSignal = signal();
  const association = getBiensPropertyAssociation(buildIndex({
    contacts: [linked, dealContact],
    contactLinks: [link('link-1', linked.id)],
    deals: [activeDeal],
    signalsByProperty: { 'property-real': [liveSignal] },
  }), 'property-real');
  expect(association?.primaryContact?.id).toBe(dealContact.id);
  expect(association?.activeDeal?.id).toBe(activeDeal.id);
  expect(association?.signals).toEqual([liveSignal]);
});

test('5. le faux ID mock ne remplace jamais le property_id Supabase', () => {
  const owner = contact('owner');
  const index = buildIndex({ contacts: [owner], contactLinks: [link('link-1', owner.id)] });
  expect(getBiensPropertyAssociation(index, 'mock-1')).toBeUndefined();
  expect(filterPropertiesByAssociations(properties, index, 'Avec contact', 'Tous', 'ready')).toEqual([properties[0]]);
});

test('6. un contact et un deal appartenant à un autre bien ne contaminent pas le bien courant', () => {
  const otherContact = contact('other');
  const index = buildIndex({
    propertyIds: ['property-real', 'property-other'],
    contacts: [otherContact],
    contactLinks: [link('link-other', otherContact.id, 'property-other')],
    deals: [deal({ id: 'other-deal', propertyId: 'property-other', contactRow: otherContact })],
  });
  expect(getBiensPropertyAssociation(index, 'property-real')?.hasContact).toBe(false);
  expect(getBiensPropertyAssociation(index, 'property-real')?.inPipeline).toBe(false);
});

test('7. plusieurs contacts utilisent une règle déterministe: owner puis lien le plus récent', () => {
  const interested = contact('interested');
  const owner = contact('owner');
  const links = [
    link('new-interested', interested.id, 'property-real', 'interested', '2026-07-03T10:00:00.000Z'),
    link('old-owner', owner.id, 'property-real', 'owner', '2026-07-01T10:00:00.000Z'),
  ];
  const first = getBiensPropertyAssociation(buildIndex({ contacts: [interested, owner], contactLinks: links }), 'property-real');
  const second = getBiensPropertyAssociation(buildIndex({ contacts: [owner, interested], contactLinks: [...links].reverse() }), 'property-real');
  expect(first?.primaryContact?.id).toBe(owner.id);
  expect(second?.primaryContact?.id).toBe(owner.id);
});

test('8. plusieurs deals fermés choisissent le plus récemment mis à jour', () => {
  const older = deal({ id: 'closed-old', closedAt: '2026-07-02T10:00:00.000Z', updatedAt: '2026-07-02T10:00:00.000Z' });
  const newer = deal({ id: 'closed-new', closedAt: '2026-07-03T10:00:00.000Z', updatedAt: '2026-07-03T10:00:00.000Z' });
  const association = getBiensPropertyAssociation(buildIndex({ deals: [older, newer] }), 'property-real');
  expect(association?.relevantDeal?.id).toBe(newer.id);
  expect(association?.activeDeal).toBeNull();
});

test('9. le deal actif est prioritaire sur un deal fermé plus récent', () => {
  const active = deal({ id: 'active', updatedAt: '2026-07-01T10:00:00.000Z' });
  const closed = deal({ id: 'closed', closedAt: '2026-07-04T10:00:00.000Z', updatedAt: '2026-07-04T10:00:00.000Z' });
  const association = getBiensPropertyAssociation(buildIndex({ deals: [closed, active] }), 'property-real');
  expect(association?.relevantDeal?.id).toBe(active.id);
  expect(association?.activeDeal?.id).toBe(active.id);
});

test('10. filtre Sans contact', () => {
  const owner = contact('owner');
  const index = buildIndex({ propertyIds: ['property-real', 'property-other'], contacts: [owner], contactLinks: [link('link-1', owner.id)] });
  expect(filterPropertiesByAssociations(properties, index, 'Sans contact', 'Tous', 'ready')).toEqual([properties[1]]);
  expect(buildBiensAssociationPropertyIdFilter('Sans contact', 'Tous', ['property-real'], [], 'ready').excludePropertyIds).toEqual(['property-real']);
});

test('11. filtre Avec contact', () => {
  const owner = contact('owner');
  const index = buildIndex({ propertyIds: ['property-real', 'property-other'], contacts: [owner], contactLinks: [link('link-1', owner.id)] });
  expect(filterPropertiesByAssociations(properties, index, 'Avec contact', 'Tous', 'ready')).toEqual([properties[0]]);
  expect(buildBiensAssociationPropertyIdFilter('Avec contact', 'Tous', ['property-real'], [], 'ready').includePropertyIds).toEqual(['property-real']);
});

test('12. filtre En pipeline', () => {
  const index = buildIndex({ propertyIds: ['property-real', 'property-other'], deals: [deal({ id: 'active' })] });
  expect(filterPropertiesByAssociations(properties, index, 'Tous', 'En pipeline', 'ready')).toEqual([properties[0]]);
  expect(buildBiensAssociationPropertyIdFilter('Tous', 'En pipeline', [], ['property-real'], 'ready').includePropertyIds).toEqual(['property-real']);
});

test('13. filtre Hors pipeline', () => {
  const index = buildIndex({ propertyIds: ['property-real', 'property-other'], deals: [deal({ id: 'active' })] });
  expect(filterPropertiesByAssociations(properties, index, 'Tous', 'Hors pipeline', 'ready')).toEqual([properties[1]]);
  expect(buildBiensAssociationPropertyIdFilter('Tous', 'Hors pipeline', [], ['property-real'], 'ready').excludePropertyIds).toEqual(['property-real']);
});

test('14. loading reste neutre et ne produit aucun faux compteur', () => {
  const index = buildIndex();
  expect(filterPropertiesByAssociations(properties, index, 'Sans contact', 'Hors pipeline', 'loading')).toBe(properties);
  expect(countBiensAssociations(properties, index, 'loading')).toBeNull();
  expect(buildBiensAssociationPropertyIdFilter('Avec contact', 'En pipeline', [], [], 'loading')).toEqual({});
});

test('15. error reste neutre et ne transforme pas une panne en listes vides', () => {
  const state: BiensAssociationState = 'error';
  const index = buildIndex();
  expect(filterPropertiesByAssociations(properties, index, 'Avec contact', 'En pipeline', state)).toBe(properties);
  expect(countBiensAssociations(properties, index, state)).toBeNull();
  expect(buildBiensAssociationPropertyIdFilter('Sans contact', 'Hors pipeline', [], [], state)).toEqual({});
});

test('16. un refetch après mutation reconstruit immédiatement les associations', () => {
  const owner = contact('owner');
  const before = getBiensPropertyAssociation(buildIndex({ contacts: [owner] }), 'property-real');
  const after = getBiensPropertyAssociation(buildIndex({
    contacts: [owner],
    contactLinks: [link('link-after-mutation', owner.id)],
    deals: [deal({ id: 'deal-after-mutation', contactRow: owner })],
  }), 'property-real');
  expect(before?.hasContact).toBe(false);
  expect(before?.inPipeline).toBe(false);
  expect(after?.hasContact).toBe(true);
  expect(after?.inPipeline).toBe(true);
});

test('17. les helpers n’appellent jamais un store mock transporté par un objet', () => {
  const owner = contact('owner');
  const index = buildIndex({ contacts: [owner], contactLinks: [link('link-1', owner.id)] });
  const propertyWithPoisonedLegacyStore: PropertyReference = {
    id: 'mock-1',
    supabasePropertyId: 'property-real',
    legacyStore: {
      getPropertyContact: () => {
        throw new Error('legacy store called');
      },
    },
  };
  expect(filterPropertiesByAssociations([propertyWithPoisonedLegacyStore], index, 'Avec contact', 'Tous', 'ready')).toEqual([propertyWithPoisonedLegacyStore]);
});

test('18. les activités Supabase déjà chargées en batch sont filtrées, triées et dédupliquées par bien', () => {
  const active = deal({ id: 'active' });
  active.activities = [
    activity({ id: 'older', createdAt: '2026-07-01T10:00:00.000Z' }),
    activity({ id: 'newer', createdAt: '2026-07-03T10:00:00.000Z', payload: { text: 'Appel vendeur effectué' } }),
    activity({ id: 'newer', createdAt: '2026-07-03T10:00:00.000Z' }),
    activity({ id: 'other-property', propertyId: 'property-other' }),
    activity({ id: 'other-agency', agencyId: 'agency-other' }),
  ];
  const association = getBiensPropertyAssociation(buildIndex({ deals: [active] }), 'property-real');
  const timeline = buildBiensActivityTimeline(association, 'ready', 5);

  expect(timeline).toMatchObject({ state: 'ready', usingCachedData: false });
  expect(timeline.activities.map(({ id }) => id)).toEqual(['newer', 'older']);
  expect(timeline.activities[0]).toMatchObject({
    agentName: 'Agent Réel',
    entityId: 'property-real',
    text: 'Appel vendeur effectué',
  });
});

test('19. loading, error et vide restent trois états distincts pour les activités', () => {
  const association = getBiensPropertyAssociation(buildIndex(), 'property-real');
  expect(buildBiensActivityTimeline(association, 'loading')).toMatchObject({ state: 'loading', activities: [] });
  expect(buildBiensActivityTimeline(association, 'error')).toMatchObject({ state: 'error', activities: [] });
  expect(buildBiensActivityTimeline(association, 'ready')).toMatchObject({ state: 'empty', activities: [] });
});

test('20. un refetch en erreur conserve les dernières activités valides', () => {
  const active = deal({ id: 'active' });
  active.activities = [activity({ id: 'cached' })];
  const association = getBiensPropertyAssociation(buildIndex({ deals: [active] }), 'property-real');
  const timeline = buildBiensActivityTimeline(association, 'error');

  expect(timeline).toMatchObject({ state: 'ready', usingCachedData: true });
  expect(timeline.activities.map(({ id }) => id)).toEqual(['cached']);
});

test('21. un acteur absent reste explicitement indisponible sans fallback mock', () => {
  const active = deal({ id: 'active' });
  active.activities = [activity({ id: 'without-actor', actorName: null })];
  const association = getBiensPropertyAssociation(buildIndex({ deals: [active] }), 'property-real');

  expect(buildBiensActivityTimeline(association, 'ready').activities[0]?.agentName).toBe('Auteur indisponible');
});

test('22. Biens réutilise les batchs Supabase et ne déclenche aucune requête activité par carte', async () => {
  const [biensSource, dealsServiceSource, notesServiceSource, propertiesSource, rlsSource] = await Promise.all([
    fs.readFile(path.join(rootDir, 'src/pages/Biens.tsx'), 'utf8'),
    fs.readFile(path.join(rootDir, 'src/lib/services/dealsService.ts'), 'utf8'),
    fs.readFile(path.join(rootDir, 'src/lib/services/notesService.ts'), 'utf8'),
    fs.readFile(path.join(rootDir, 'src/lib/supabaseProperties.ts'), 'utf8'),
    fs.readFile(path.join(rootDir, 'supabase/migrations/20260629182636_create_crm_remaining_schema_rls.sql'), 'utf8'),
  ]);

  expect(biensSource.match(/useDeals\(/g)).toHaveLength(1);
  expect(biensSource).toContain('buildBiensActivityTimeline(association, associationState, 5)');
  expect(biensSource).not.toContain(".from('activities')");
  expect(biensSource).not.toContain('addNotification');
  expect(biensSource).not.toContain('getCurrentAgent');
  expect(biensSource).toContain('profile?.full_name');
  expect(dealsServiceSource).toContain(".in('deal_id', ids)");
  expect(dealsServiceSource).toContain('actor:profiles!activities_actor_id_fkey');
  expect(notesServiceSource).toContain("getNotesByForeignKey('property_id', propertyId)");
  expect(notesServiceSource).toContain(".from('notes')");
  expect(propertiesSource).toContain("status: row.status === 'active' ? 'disponible' : 'archivé'");
  expect(rlsSource).toContain('"Agency users see agency activities"');
  expect(rlsSource).toContain('"Agency users see agency notes"');
});
