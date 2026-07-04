import type { Property } from '../types';
import type { Tables } from './database.types';
import { supabase } from './supabase';

type ListingRow = Tables<'listings'>;
type PropertyRow = Tables<'properties'>;
type ListingWithProperty = ListingRow & { properties: PropertyRow | null };

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

function numericIdFromText(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
  }
  return Math.abs(hash) + 100000;
}

function clampScore(score: number | null, listing: ListingRow): number {
  if (typeof score === 'number' && Number.isFinite(score)) {
    return Math.max(0, Math.min(99, Math.round(score)));
  }

  if (listing.is_fsbo) return 82;
  if (listing.old_price && listing.price && listing.old_price > listing.price) return 76;
  if (listing.is_new_build) return 54;
  return 68;
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

function mapListingToProperty(row: ListingWithProperty): Property {
  const publishedDays = daysSince(row.published_at ?? row.first_seen_at);
  const source = sourceLabel(row.source);
  const location = row.properties?.locality ?? row.properties?.province ?? 'Belgique';
  const livingArea = row.properties?.living_area ?? row.properties?.land_area ?? 0;

  return {
    id: numericIdFromText(row.id),
    supabasePropertyId: row.properties?.id ?? row.property_id ?? undefined,
    title: propertyTitle(row, row.properties),
    propertyType: typeLabel(row.properties),
    city: location,
    price: row.price ?? 0,
    photos: row.photo_urls ?? [],
    tag: propertyTag(row, publishedDays),
    score: clampScore(row.ai_score, row),
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
    description: row.description_fr ?? row.description_nl ?? row.ai_summary ?? '',
    priceHistory: priceHistory(row),
    status: row.status === 'active' ? 'disponible' : 'archivé',
  };
}

export async function fetchSupabaseProperties(): Promise<Property[]> {
  if (!supabase) return [];

  const rows: ListingWithProperty[] = [];

  for (let from = 0; ; from += LISTINGS_FETCH_PAGE_SIZE) {
    const to = from + LISTINGS_FETCH_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('listings')
      .select('*, properties(*)')
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

  return rows.map(mapListingToProperty);
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
