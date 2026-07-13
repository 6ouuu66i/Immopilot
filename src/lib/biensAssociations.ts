import type { Activity } from '../types';
import type { DealFull } from './services/dealsService';
import type {
  PropertyContactLink,
  SupabaseContact,
} from './services/contactsService';
import type {
  ListingSignal,
  SignalsByProperty,
} from './services/listingSignalsService';

export type BiensAssociationState = 'loading' | 'ready' | 'error';
export type BiensContactFilter = 'Tous' | 'Sans contact' | 'Avec contact';
export type BiensPipelineFilter = 'Tous' | 'En pipeline' | 'Hors pipeline';

export interface BiensPropertyAssociation {
  propertyId: string;
  contacts: SupabaseContact[];
  primaryContact: SupabaseContact | null;
  deals: DealFull[];
  relevantDeal: DealFull | null;
  activeDeal: DealFull | null;
  signals: ListingSignal[];
  hasContact: boolean;
  inPipeline: boolean;
}

export type BiensAssociationIndex = Map<string, BiensPropertyAssociation>;

export interface BuildBiensAssociationIndexInput {
  propertyIds: string[];
  contacts: SupabaseContact[];
  contactLinks: PropertyContactLink[];
  deals: DealFull[];
  signalsByProperty: SignalsByProperty;
}

export interface BiensAssociationCounts {
  withContact: number;
  withoutContact: number;
  inPipeline: number;
  outsidePipeline: number;
}

export interface BiensAssociationPropertyIdFilter {
  includePropertyIds?: string[];
  excludePropertyIds?: string[];
}

export type BiensActivityDataState = 'loading' | 'error' | 'empty' | 'ready';

export interface BiensActivityTimeline {
  activities: Activity[];
  state: BiensActivityDataState;
  usingCachedData: boolean;
}

interface SupabasePropertyReference {
  supabasePropertyId?: string;
}

const CONTACT_RELATIONSHIP_PRIORITY: Record<string, number> = {
  owner: 0,
  interested: 1,
  tenant: 2,
  former_owner: 3,
};

const SIGNAL_LABELS: Record<string, string> = {
  price_drop: 'Baisse prix',
  below_market: 'Sous marche',
  overpriced: 'Surcote',
  fsbo: 'FSBO',
  competition_shock: 'Nouvelle concurrence',
  republished: 'Republie',
  multi_source: 'Multi-source',
  agency_mandate_aging: 'Mandat 6 mois',
  stale_dom_relative: 'Stagnant vs marche',
  failed_launch: 'Lancement sans traction',
  back_to_market: 'Retour sur le marche',
};

function compareIsoDescending(left: string | null | undefined, right: string | null | undefined) {
  return (right ?? '').localeCompare(left ?? '');
}

function compareDeals(left: DealFull, right: DealFull) {
  const leftActive = left.closed_at === null ? 0 : 1;
  const rightActive = right.closed_at === null ? 0 : 1;
  if (leftActive !== rightActive) return leftActive - rightActive;

  const updated = compareIsoDescending(left.updated_at, right.updated_at);
  if (updated !== 0) return updated;

  const created = compareIsoDescending(left.created_at, right.created_at);
  if (created !== 0) return created;
  return left.id.localeCompare(right.id);
}

function compareContactLinks(left: PropertyContactLink, right: PropertyContactLink) {
  const leftPriority = CONTACT_RELATIONSHIP_PRIORITY[left.relationship] ?? 99;
  const rightPriority = CONTACT_RELATIONSHIP_PRIORITY[right.relationship] ?? 99;
  if (leftPriority !== rightPriority) return leftPriority - rightPriority;

  const created = compareIsoDescending(left.created_at, right.created_at);
  if (created !== 0) return created;
  return left.id.localeCompare(right.id);
}

function activityText(activity: DealFull['activities'][number]): string {
  const payload = activity.payload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const candidate = payload.text ?? payload.message ?? payload.title;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }

  const labels: Record<string, string> = {
    deal_created: 'Deal créé',
    deal_lost: 'Deal perdu',
    deal_reopened: 'Deal rouvert',
    deal_won: 'Deal gagné',
    stage_changed: 'Changement d’étape',
  };
  return labels[activity.type] ?? activity.type;
}

export function buildBiensActivityTimeline(
  association: BiensPropertyAssociation | undefined,
  associationState: BiensAssociationState,
  limit = 5,
): BiensActivityTimeline {
  const seen = new Set<string>();
  const activities = (association?.deals ?? [])
    .flatMap((deal) => deal.activities.map((activity) => ({ activity, deal })))
    .filter(({ activity, deal }) => (
      deal.property_id === association?.propertyId
      && activity.property_id === association.propertyId
      && activity.deal_id === deal.id
      && activity.agency_id === deal.agency_id
    ))
    .sort((left, right) => right.activity.created_at.localeCompare(left.activity.created_at))
    .filter(({ activity }) => {
      if (seen.has(activity.id)) return false;
      seen.add(activity.id);
      return true;
    })
    .slice(0, Math.max(0, limit))
    .map(({ activity }) => ({
      id: activity.id,
      type: activity.type,
      text: activityText(activity),
      date: activity.created_at.slice(0, 10),
      agentId: activity.actor_id ?? '',
      agentName: activity.actor?.full_name ?? activity.actor?.email ?? 'Auteur indisponible',
      entityType: 'property' as const,
      entityId: activity.property_id ?? undefined,
    }));

  if (activities.length > 0) {
    return {
      activities,
      state: 'ready',
      usingCachedData: associationState !== 'ready',
    };
  }

  return {
    activities,
    state: associationState === 'loading'
      ? 'loading'
      : associationState === 'error'
        ? 'error'
        : 'empty',
    usingCachedData: false,
  };
}

export function listingSignalLabel(signal: ListingSignal): string {
  return SIGNAL_LABELS[signal.signal_type] ?? 'Signal';
}

export function listingSignalMeta(signal: ListingSignal): string {
  const date = new Date(signal.detected_at);
  if (Number.isNaN(date.getTime())) return 'Signal actif';
  return `Detecte le ${date.toLocaleDateString('fr-BE')}`;
}

export function buildBiensAssociationIndex({
  propertyIds,
  contacts,
  contactLinks,
  deals,
  signalsByProperty,
}: BuildBiensAssociationIndexInput): BiensAssociationIndex {
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  const linksByProperty = new Map<string, PropertyContactLink[]>();
  const dealsByProperty = new Map<string, DealFull[]>();

  for (const link of contactLinks) {
    const current = linksByProperty.get(link.property_id) ?? [];
    current.push(link);
    linksByProperty.set(link.property_id, current);
  }

  for (const deal of deals) {
    const current = dealsByProperty.get(deal.property_id) ?? [];
    current.push(deal);
    dealsByProperty.set(deal.property_id, current);
  }

  const allPropertyIds = new Set([
    ...propertyIds.filter(Boolean),
    ...linksByProperty.keys(),
    ...dealsByProperty.keys(),
    ...Object.keys(signalsByProperty),
  ]);
  const index: BiensAssociationIndex = new Map();

  for (const propertyId of allPropertyIds) {
    const propertyDeals = [...(dealsByProperty.get(propertyId) ?? [])].sort(compareDeals);
    const relevantDeal = propertyDeals[0] ?? null;
    const activeDeal = propertyDeals.find((deal) => deal.closed_at === null) ?? null;
    const propertyLinks = [...(linksByProperty.get(propertyId) ?? [])].sort(compareContactLinks);
    const linkedContacts = propertyLinks
      .map((link) => contactById.get(link.contact_id))
      .filter((contact): contact is SupabaseContact => Boolean(contact));
    const dealContacts = propertyDeals
      .map((deal) => deal.contact ?? (deal.contact_id ? contactById.get(deal.contact_id) : null))
      .filter((contact): contact is SupabaseContact => Boolean(contact));
    const uniqueContacts = new Map<string, SupabaseContact>();

    for (const contact of [...linkedContacts, ...dealContacts]) {
      if (!uniqueContacts.has(contact.id)) uniqueContacts.set(contact.id, contact);
    }

    const relevantDealContact = relevantDeal?.contact
      ?? (relevantDeal?.contact_id ? contactById.get(relevantDeal.contact_id) : null)
      ?? null;
    const primaryContact = relevantDealContact ?? linkedContacts[0] ?? dealContacts[0] ?? null;
    const propertyContacts = Array.from(uniqueContacts.values());

    index.set(propertyId, {
      propertyId,
      contacts: propertyContacts,
      primaryContact,
      deals: propertyDeals,
      relevantDeal,
      activeDeal,
      signals: signalsByProperty[propertyId] ?? [],
      hasContact: propertyContacts.length > 0,
      inPipeline: Boolean(activeDeal),
    });
  }

  return index;
}

export function getBiensPropertyAssociation(
  index: BiensAssociationIndex,
  propertyId: string | undefined,
): BiensPropertyAssociation | undefined {
  return propertyId ? index.get(propertyId) : undefined;
}

export function filterPropertiesByAssociations<T extends SupabasePropertyReference>(
  properties: T[],
  index: BiensAssociationIndex,
  contactFilter: BiensContactFilter,
  pipelineFilter: BiensPipelineFilter,
  state: BiensAssociationState,
): T[] {
  if (state !== 'ready') return properties;

  return properties.filter((property) => {
    const association = getBiensPropertyAssociation(index, property.supabasePropertyId);
    const hasContact = association?.hasContact ?? false;
    const inPipeline = association?.inPipeline ?? false;

    if (contactFilter === 'Sans contact' && hasContact) return false;
    if (contactFilter === 'Avec contact' && !hasContact) return false;
    if (pipelineFilter === 'En pipeline' && !inPipeline) return false;
    if (pipelineFilter === 'Hors pipeline' && inPipeline) return false;
    return true;
  });
}

export function countBiensAssociations<T extends SupabasePropertyReference>(
  properties: T[],
  index: BiensAssociationIndex,
  state: BiensAssociationState,
): BiensAssociationCounts | null {
  if (state !== 'ready') return null;

  return properties.reduce<BiensAssociationCounts>((counts, property) => {
    const association = getBiensPropertyAssociation(index, property.supabasePropertyId);
    if (association?.hasContact) counts.withContact += 1;
    else counts.withoutContact += 1;
    if (association?.inPipeline) counts.inPipeline += 1;
    else counts.outsidePipeline += 1;
    return counts;
  }, { withContact: 0, withoutContact: 0, inPipeline: 0, outsidePipeline: 0 });
}

export function buildBiensAssociationPropertyIdFilter(
  contactFilter: BiensContactFilter,
  pipelineFilter: BiensPipelineFilter,
  contactPropertyIds: Iterable<string>,
  pipelinePropertyIds: Iterable<string>,
  state: BiensAssociationState,
): BiensAssociationPropertyIdFilter {
  if (state !== 'ready') return {};

  const contactIds = new Set(contactPropertyIds);
  const pipelineIds = new Set(pipelinePropertyIds);
  const includeSets: Set<string>[] = [];
  const excluded = new Set<string>();

  if (contactFilter === 'Avec contact') includeSets.push(contactIds);
  if (pipelineFilter === 'En pipeline') includeSets.push(pipelineIds);
  if (contactFilter === 'Sans contact') contactIds.forEach((id) => excluded.add(id));
  if (pipelineFilter === 'Hors pipeline') pipelineIds.forEach((id) => excluded.add(id));

  let included: Set<string> | undefined;
  for (const values of includeSets) {
    included = included === undefined
      ? new Set(values)
      : new Set(Array.from(included).filter((id) => values.has(id)));
  }

  if (included) excluded.forEach((id) => included?.delete(id));

  return {
    includePropertyIds: included ? Array.from(included).sort() : undefined,
    excludePropertyIds: excluded.size > 0 ? Array.from(excluded).sort() : undefined,
  };
}
