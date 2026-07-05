import type { Tables } from '../database.types';
import { supabase } from '../supabase';
import { formatAddress } from './adminUtils';

type ListingRow = Tables<'listings'>;
type PropertyRow = Tables<'properties'>;
type ListingWithProperty = ListingRow & { properties: PropertyRow | null };

export interface DashboardOpportunity {
  addedAt: string;
  id: string;
  photo: string | null;
  price: number | null;
  propertyId: string | null;
  score: number;
  signal: string;
  source: string;
  surface: number | null;
  subtitle: string;
  title: string;
}

function titleFor(row: ListingWithProperty) {
  return row.title_fr?.trim()
    || row.title_nl?.trim()
    || formatAddress(row.properties)
    || 'Bien sans titre';
}

function signalFor(row: ListingWithProperty) {
  if (row.ai_badges?.[0]) return row.ai_badges[0];
  if (row.old_price && row.price && row.old_price > row.price) return 'Baisse de prix';
  if (row.is_fsbo) return 'FSBO';
  return 'Prospection';
}

export async function listDashboardOpportunities(limit = 8): Promise<DashboardOpportunity[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('listings')
    .select('*, properties(*)')
    .eq('status', 'active')
    .order('first_seen_at', { ascending: false })
    .limit(limit)
    .returns<ListingWithProperty[]>();

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    addedAt: row.first_seen_at,
    id: row.id,
    photo: row.photo_urls?.[0] ?? null,
    price: row.price,
    propertyId: row.property_id,
    score: 0,
    signal: signalFor(row),
    source: row.source,
    surface: row.properties?.living_area ?? row.properties?.land_area ?? null,
    subtitle: row.properties?.locality ?? row.properties?.province ?? 'Belgique',
    title: titleFor(row),
  }));
}
