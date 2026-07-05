import type { Property } from '../types';
import type { Json, Tables } from './database.types';
import { supabase } from './supabase';

type ListingRow = Tables<'listings'>;
type PropertyRow = Tables<'properties'>;
type ListingWithProperty = ListingRow & { properties: PropertyRow | null };

export interface PropertyDetail extends Property {
  rawData: Json | null;
  sourceUrl: string | null;
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

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LISTINGS_FETCH_PAGE_SIZE = 1000;

export const LISTINGS_LIST_SELECT = `
  id,
  property_id,
  source,
  source_id,
  url,
  status,
  price,
  old_price,
  title_fr,
  title_nl,
  photo_urls,
  is_fsbo,
  first_seen_at,
  last_seen_at,
  published_at,
  ai_badges,
  ai_summary,
  ai_gross_yield,
  properties (
    id,
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
    land_area
  )
`.replace(/\s+/g, ' ').trim();

export const LISTINGS_DETAIL_SELECT = '*, properties(*)';

function numericIdFromText(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
  }
  return Math.abs(hash) + 100000;
}

function daysSince(dateValue: string | null): number {
  if (!dateValue) return 0;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.ceil((Date.now() - date.getTime()) / MS_PER_DAY));
}

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source.toLowerCase()] ?? source;
}

function typeLabel(property: PropertyRow | null): string {
  const rawType = property?.property_subtype ?? property?.property_type;
  return rawType ? TYPE_LABELS[rawType] ?? rawType.replaceAll('_', ' ').toLowerCase() : 'Bien';
}

function addressLabel(property: PropertyRow | null): string {
  if (!property) return '';
  return [property.street, property.house_number].filter(Boolean).join(' ').trim();
}

function propertyTitle(listing: ListingRow, property: PropertyRow | null): string {
  const explicitTitle = listing.title_fr ?? listing.title_nl;
  if (explicitTitle?.trim()) return explicitTitle.trim();

  const address = addressLabel(property);
  if (address) return address;

  return `${typeLabel(property)} ${property?.locality ?? ''}`.trim();
}

function propertyTag(listing: ListingRow, publishedDays: number): Property['tag'] {
  if (listing.is_fsbo) return 'FSBO';
  if (listing.old_price && listing.price && listing.old_price > listing.price) return 'Baisse de prix';
  if (publishedDays <= 7) return 'Nouveau';
  return listing.ai_badges?.[0] ?? 'Nouveau';
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

function mapListingToProperty(
  row: ListingWithProperty,
  options: { includeFullMedia: boolean; includeRawData: boolean },
): PropertyDetail {
  const publishedDays = daysSince(row.published_at ?? row.first_seen_at);
  const source = sourceLabel(row.source);
  const location = row.properties?.locality ?? row.properties?.province ?? 'Belgique';
  const livingArea = row.properties?.living_area ?? row.properties?.land_area ?? 0;
  const photos = row.photo_urls ?? [];

  return {
    id: numericIdFromText(row.id),
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

export async function fetchSupabaseProperties(): Promise<Property[]> {
  if (!supabase) return [];

  const rows: ListingWithProperty[] = [];

  for (let from = 0; ; from += LISTINGS_FETCH_PAGE_SIZE) {
    const to = from + LISTINGS_FETCH_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('listings')
      .select(LISTINGS_LIST_SELECT)
      .eq('status', 'active')
      .order('last_seen_at', { ascending: false })
      .order('first_seen_at', { ascending: false })
      .range(from, to)
      .returns<ListingWithProperty[]>();

    if (error) {
      throw new Error(error.message);
    }

    const pageRows = data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < LISTINGS_FETCH_PAGE_SIZE) break;
  }

  return rows.map((row) => mapListingToProperty(row, { includeFullMedia: false, includeRawData: false }));
}

export async function fetchPropertyDetail(listingId: string): Promise<PropertyDetail | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('listings')
    .select(LISTINGS_DETAIL_SELECT)
    .eq('id', listingId)
    .returns<ListingWithProperty[]>()
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapListingToProperty(data, { includeFullMedia: true, includeRawData: true }) : null;
}

export function uniqueSupabaseProperties(properties: Property[]): Property[] {
  const seen = new Set<string>();

  return properties.filter((property) => {
    if (!property.supabasePropertyId) return false;
    if (seen.has(property.supabasePropertyId)) return false;
    // Keep the first active listing encountered for each canonical property_id.
    // fetchSupabaseProperties() orders rows by last_seen_at desc, then first_seen_at desc,
    // so the retained card is the freshest active listing for that property.
    seen.add(property.supabasePropertyId);
    return true;
  });
}
