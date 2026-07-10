import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Property } from '../types';
import { normalizePropertyListFilters, queryKeys } from './queryKeys';
import type { Json, Tables } from './database.types';
import { sentenceCaseIfShouty, titleCaseIfShouty } from './formatText';
import { supabase } from './supabase';

type ListingRow = Tables<'listings'>;
type PropertyRow = Tables<'properties'>;
type ListingWithProperty = ListingRow & { properties: PropertyRow | null };

interface ActivePropertyCanonicalRow {
  ai_badges: string[] | null;
  ai_gross_yield: number | null;
  ai_summary: string | null;
  bathroom_count: number | null;
  bedroom_count: number | null;
  canonical_property_id: string | null;
  days_online: number;
  first_seen_at: string;
  has_price_drop: boolean;
  has_republished_signal: boolean;
  house_number: string | null;
  is_fsbo: boolean | null;
  is_under_option: boolean | null;
  land_area: number | null;
  last_seen_at: string;
  listing_id: string;
  living_area: number | null;
  locality: string | null;
  old_price: number | null;
  photo_urls: string[] | null;
  postal_code: string | null;
  price: number | null;
  primary_photo_url: string | null;
  property_id: string | null;
  property_subtype: string | null;
  property_type: string | null;
  province: string | null;
  published_at: string | null;
  seller_score: number | null;
  source: string;
  status: string;
  street: string | null;
  surface_value: number | null;
  title_fr: string | null;
  title_nl: string | null;
  url: string | null;
}

export interface PropertyDetail extends Property {
  rawData: Json | null;
  sourceUrl: string | null;
}

export interface SupabasePropertyListFilters {
  ageMinDays?: number | null;
  favoritePropertyIds?: string[];
  fsboOnly?: boolean;
  ignoredPropertyIds?: string[];
  maxPrice?: number | null;
  minBedrooms?: number | null;
  minPrice?: number | null;
  minScore?: number | null;
  minSurface?: number | null;
  postalCode?: string | null;
  propertyTypeLabel?: string | null;
  searchText?: string | null;
  sellerFilter?: 'Tous' | 'Particulier' | 'Agence' | 'Notaire';
  signalFilter?: string | null;
  source?: string | null;
  city?: string | null;
}

export interface FetchSupabasePropertiesPageOptions {
  filters?: SupabasePropertyListFilters;
  page: number;
  pageSize: number;
  sort?: 'recent' | 'price_asc' | 'price_desc' | 'score';
}

export interface FetchSupabasePropertiesPageResult {
  properties: Property[];
  totalCount: number;
}

interface UseSupabasePropertiesQueryOptions {
  enabled?: boolean;
  userId?: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  immoweb: 'Immoweb',
  zimmo: 'Zimmo',
  immovlan: 'Immovlan',
  biddit: 'Biddit',
  '2ememain': '2ememain',
  immoffice: 'Immoffice',
};

const TYPE_LABELS: Record<string, string> = {
  APARTMENT: 'Appartement',
  APARTMENT_GROUP: 'Projet appartements',
  HOUSE: 'Maison',
  HOUSE_GROUP: 'Projet maisons',
  LAND: 'Terrain',
  BUILDING_LAND: 'Terrain a batir',
};

const PROPERTY_TYPE_FILTERS = Object.entries(TYPE_LABELS).reduce<Record<string, string[]>>((acc, [rawType, label]) => {
  acc[label] = [...(acc[label] ?? []), rawType];
  return acc;
}, {});

const ACTIVE_PROPERTIES_CANONICAL_VIEW = 'active_properties_canonical_mat';

export const ACTIVE_PROPERTIES_CANONICAL_SELECT = `
  listing_id,
  property_id,
  source,
  url,
  status,
  price,
  old_price,
  is_fsbo,
  is_under_option,
  first_seen_at,
  last_seen_at,
  published_at,
  ai_badges,
  ai_summary,
  ai_gross_yield,
  title_fr,
  title_nl,
  seller_score,
  has_price_drop,
  has_republished_signal,
  days_online,
  photo_urls,
  primary_photo_url,
  canonical_property_id,
  street,
  house_number,
  postal_code,
  locality,
  province,
  property_type,
  property_subtype,
  bedroom_count,
  bathroom_count,
  living_area,
  land_area,
  surface_value
`.replace(/\s+/g, ' ').trim();

export const LISTINGS_DETAIL_SELECT = '*, properties(*)';

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source.toLowerCase()] ?? source;
}

function typeLabel(property: { property_subtype: string | null; property_type: string | null } | null): string {
  const rawType = property?.property_subtype ?? property?.property_type;
  return rawType ? TYPE_LABELS[rawType] ?? rawType.replaceAll('_', ' ').toLowerCase() : 'Bien';
}

function addressLabel(property: { street: string | null; house_number: string | null } | null): string {
  if (!property) return '';
  return [property.street, property.house_number].filter(Boolean).join(' ').trim();
}

function propertyTitle(
  listing: { title_fr: string | null; title_nl: string | null },
  property: { street: string | null; house_number: string | null; locality: string | null; property_subtype: string | null; property_type: string | null } | null,
): string {
  const explicitTitle = listing.title_fr ?? listing.title_nl;
  if (explicitTitle?.trim()) return sentenceCaseIfShouty(explicitTitle.trim());

  const address = addressLabel(property);
  if (address) return address;

  return `${typeLabel(property)} ${property?.locality ?? ''}`.trim();
}

function propertyTagFromCanonical(row: ActivePropertyCanonicalRow): Property['tag'] {
  if (row.is_fsbo) return 'FSBO';
  if (row.has_price_drop) return 'Baisse de prix';
  if (row.has_republished_signal) return 'Republié';
  if (row.days_online <= 7) return 'Nouveau';
  // Pas de badge par défaut : « Nouveau » sur un bien de 500 jours était un mensonge.
  return row.ai_badges?.[0] ?? '';
}

function propertyTag(listing: ListingRow, publishedDays: number): Property['tag'] {
  if (listing.is_fsbo) return 'FSBO';
  if (listing.old_price && listing.price && listing.old_price > listing.price) return 'Baisse de prix';
  if (publishedDays <= 7) return 'Nouveau';
  return listing.ai_badges?.[0] ?? '';
}

function priceHistory(listing: ListingRow): Property['priceHistory'] {
  const currentDate = (listing.last_seen_at ?? listing.first_seen_at).slice(0, 10);
  if (listing.old_price && listing.price && listing.old_price !== listing.price) {
    const oldDate = (listing.published_at ?? listing.first_seen_at).slice(0, 10);
    return [
      { date: oldDate, price: listing.old_price },
      { date: currentDate, price: listing.price },
    ];
  }

  return [{ date: currentDate, price: listing.price ?? 0 }];
}

function mapCanonicalPropertyRow(row: ActivePropertyCanonicalRow): Property {
  const source = sourceLabel(row.source);
  const location = titleCaseIfShouty(row.locality ?? row.province ?? 'Belgique');
  const stablePropertyId = row.property_id ?? row.canonical_property_id ?? row.listing_id;

  return {
    id: stablePropertyId,
    supabasePropertyId: row.property_id ?? row.canonical_property_id ?? undefined,
    supabaseListingId: row.listing_id,
    title: propertyTitle(row, row),
    propertyType: typeLabel(row),
    city: location,
    price: row.price ?? 0,
    // Le carrousel des cartes a besoin de plusieurs photos ; la matview en
    // expose jusqu'à 6, repli sur la photo principale seule.
    photos: row.photo_urls?.length ? row.photo_urls : row.primary_photo_url ? [row.primary_photo_url] : [],
    tag: propertyTagFromCanonical(row),
    score: row.seller_score ?? 0,
    peb: 'N/A',
    surface: row.surface_value ?? row.living_area ?? row.land_area ?? 0,
    bedrooms: row.bedroom_count ?? 0,
    bathrooms: row.bathroom_count ?? 0,
    source,
    reserved: row.status !== 'active',
    underOption: Boolean(row.is_under_option),
    ownerId: null,
    fsbo: Boolean(row.is_fsbo),
    publishedDays: row.days_online,
    floodZone: 'Sûre',
    notes: row.ai_summary ? [row.ai_summary] : [],
    yieldEstimate: row.ai_gross_yield ? `${Number(row.ai_gross_yield).toFixed(1)}%` : 'N/A',
    description: row.ai_summary ?? '',
    priceHistory: [{
      date: (row.last_seen_at ?? row.first_seen_at).slice(0, 10),
      price: row.price ?? 0,
    }],
    status: row.status === 'active' ? 'disponible' : 'archivé',
  };
}

function mapListingToProperty(
  row: ListingWithProperty,
  options: { includeFullMedia: boolean; includeRawData: boolean },
): PropertyDetail {
  const publishedAt = row.published_at ?? row.first_seen_at;
  const publishedDays = publishedAt
    ? Math.max(0, Math.ceil((Date.now() - new Date(publishedAt).getTime()) / (24 * 60 * 60 * 1000)))
    : 0;
  const source = sourceLabel(row.source);
  const location = titleCaseIfShouty(row.properties?.locality ?? row.properties?.province ?? 'Belgique');
  const livingArea = row.properties?.living_area ?? row.properties?.land_area ?? 0;
  const photos = row.photo_urls ?? [];
  const stablePropertyId = row.properties?.id ?? row.property_id ?? row.id;

  return {
    id: stablePropertyId,
    supabasePropertyId: row.properties?.id ?? row.property_id ?? undefined,
    supabaseListingId: row.id,
    title: propertyTitle(row, row.properties),
    propertyType: typeLabel(row.properties),
    city: location,
    price: row.price ?? 0,
    photos: options.includeFullMedia ? photos : photos.slice(0, 1),
    tag: propertyTag(row, publishedDays),
    score: 0,
    peb: 'N/A',
    surface: livingArea,
    bedrooms: row.properties?.bedroom_count ?? 0,
    bathrooms: row.properties?.bathroom_count ?? 0,
    source,
    reserved: row.status !== 'active',
    underOption: Boolean(row.is_under_option),
    ownerId: null,
    fsbo: Boolean(row.is_fsbo),
    publishedDays,
    floodZone: 'Sûre',
    notes: row.ai_summary ? [row.ai_summary] : [],
    yieldEstimate: row.ai_gross_yield ? `${Number(row.ai_gross_yield).toFixed(1)}%` : 'N/A',
    description: options.includeFullMedia
      ? row.description_fr ?? row.description_nl ?? row.ai_summary ?? ''
      : row.ai_summary ?? '',
    priceHistory: priceHistory(row),
    status: row.status === 'active' ? 'disponible' : 'archivé',
    rawData: options.includeRawData ? row.raw_data ?? null : null,
    sourceUrl: row.url ?? null,
  };
}

function escapeForIn(values: string[]): string {
  return `(${values.map((value) => `\"${value}\"`).join(',')})`;
}

function escapePostgrestOrValue(value: string): string {
  return value.trim().replace(/[\\,()]/g, (match) => `\\${match}`);
}

function buildPropertyTypeFilter(label: string): string | null {
  const rawTypes = PROPERTY_TYPE_FILTERS[label];
  if (!rawTypes || rawTypes.length === 0) return null;
  return rawTypes
    .flatMap((rawType) => [`property_subtype.eq.${rawType}`, `property_type.eq.${rawType}`])
    .join(',');
}

function applyListFilters(query: any, filters: SupabasePropertyListFilters = {}) {
  let next = query;

  if (filters.city) next = next.ilike('locality', filters.city);
  if (filters.postalCode) next = next.eq('postal_code', filters.postalCode);
  if (filters.source) next = next.eq('source', filters.source.toLowerCase());
  if (filters.minPrice !== null && filters.minPrice !== undefined) next = next.gte('price', filters.minPrice);
  if (filters.maxPrice !== null && filters.maxPrice !== undefined) next = next.lte('price', filters.maxPrice);
  if (filters.minBedrooms !== null && filters.minBedrooms !== undefined) next = next.gte('bedroom_count', filters.minBedrooms);
  if (filters.minSurface !== null && filters.minSurface !== undefined) next = next.gte('surface_value', filters.minSurface);
  if (filters.minScore !== null && filters.minScore !== undefined) next = next.gte('seller_score', filters.minScore);
  if (filters.ageMinDays !== null && filters.ageMinDays !== undefined) next = next.gte('days_online', filters.ageMinDays);
  if (filters.fsboOnly) next = next.eq('is_fsbo', true);

  if (filters.searchText?.trim()) {
    const term = escapePostgrestOrValue(filters.searchText);
    const pattern = `*${term}*`;
    next = next.or([
      `title_fr.ilike.${pattern}`,
      `locality.ilike.${pattern}`,
      `postal_code.ilike.${pattern}`,
      `street.ilike.${pattern}`,
    ].join(','));
  }

  if (filters.propertyTypeLabel) {
    const propertyTypeFilter = buildPropertyTypeFilter(filters.propertyTypeLabel);
    if (propertyTypeFilter) next = next.or(propertyTypeFilter);
  }

  if (filters.signalFilter === 'FSBO') next = next.eq('is_fsbo', true);
  if (filters.signalFilter === 'Baisse de prix') next = next.eq('has_price_drop', true);
  if (filters.signalFilter === 'Nouveau') next = next.lte('days_online', 7);
  if (filters.signalFilter?.toLowerCase().includes('repub')) next = next.eq('has_republished_signal', true);
  if (filters.signalFilter?.toLowerCase().includes('archiv')) next = next.eq('status', '__never__');

  if (filters.sellerFilter === 'Particulier') next = next.eq('is_fsbo', true);
  if (filters.sellerFilter === 'Notaire') next = next.eq('source', 'biddit');
  if (filters.sellerFilter === 'Agence') next = next.eq('is_fsbo', false).neq('source', 'biddit');

  if (filters.favoritePropertyIds) {
    next = filters.favoritePropertyIds.length > 0
      ? next.in('property_id', filters.favoritePropertyIds)
      : next.eq('property_id', '__never__');
  }

  if (filters.ignoredPropertyIds && filters.ignoredPropertyIds.length > 0) {
    next = next.not('property_id', 'in', escapeForIn(filters.ignoredPropertyIds));
  }

  return next;
}

function applySort(query: any, sort: FetchSupabasePropertiesPageOptions['sort'] = 'recent') {
  if (sort === 'price_asc') return query.order('price', { ascending: true, nullsFirst: false }).order('last_seen_at', { ascending: false });
  if (sort === 'price_desc') return query.order('price', { ascending: false, nullsFirst: false }).order('last_seen_at', { ascending: false });
  if (sort === 'score') return query.order('seller_score', { ascending: false, nullsFirst: false }).order('last_seen_at', { ascending: false });
  return query.order('last_seen_at', { ascending: false }).order('first_seen_at', { ascending: false });
}

export async function fetchSupabasePropertiesPage(
  options: FetchSupabasePropertiesPageOptions,
): Promise<FetchSupabasePropertiesPageResult> {
  if (!supabase) return { properties: [], totalCount: 0 };

  const from = Math.max(0, (options.page - 1) * options.pageSize);
  const to = from + options.pageSize - 1;

  let query = supabase
    .from(ACTIVE_PROPERTIES_CANONICAL_VIEW)
    .select(ACTIVE_PROPERTIES_CANONICAL_SELECT, { count: 'estimated' });

  query = applyListFilters(query, options.filters);
  query = applySort(query, options.sort);

  const { data, error, count } = await query
    .range(from, to)
    .returns<ActivePropertyCanonicalRow[]>();

  if (error) throw new Error(error.message);

  return {
    properties: (data ?? []).map(mapCanonicalPropertyRow),
    totalCount: count ?? 0,
  };
}

export async function searchPropertiesForLink(term: string, limit = 20): Promise<Property[]> {
  if (!supabase) return [];
  const searchText = term.trim();
  if (searchText.length < 2) return [];

  let query = supabase
    .from(ACTIVE_PROPERTIES_CANONICAL_VIEW)
    .select(ACTIVE_PROPERTIES_CANONICAL_SELECT);

  query = applyListFilters(query, { searchText });

  const { data, error } = await query
    .order('last_seen_at', { ascending: false })
    .order('first_seen_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 50)))
    .returns<ActivePropertyCanonicalRow[]>();

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapCanonicalPropertyRow);
}

export async function fetchPropertyDetail(listingId: string): Promise<PropertyDetail | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('listings')
    .select(LISTINGS_DETAIL_SELECT)
    .eq('id', listingId)
    .returns<ListingWithProperty[]>()
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data ? mapListingToProperty(data, { includeFullMedia: true, includeRawData: true }) : null;
}

export function uniqueSupabaseProperties(properties: Property[]): Property[] {
  const seen = new Set<string>();

  return properties.filter((property) => {
    if (!property.supabasePropertyId) return false;
    if (seen.has(property.supabasePropertyId)) return false;
    seen.add(property.supabasePropertyId);
    return true;
  });
}

export function useSupabasePropertiesPageQuery(
  options: FetchSupabasePropertiesPageOptions & UseSupabasePropertiesQueryOptions,
) {
  const normalizedFilters = normalizePropertyListFilters(options.filters);

  return useQuery({
    queryKey: queryKeys.supabasePropertiesPage(
      options.userId,
      options.page,
      options.pageSize,
      options.sort ?? 'recent',
      normalizedFilters,
    ),
    queryFn: () => fetchSupabasePropertiesPage(options),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}
