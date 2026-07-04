import type { Json } from '../database.types';
import { supabase } from '../supabase';

export type ListingSignalType =
  | 'fsbo'
  | 'price_drop'
  | 'republished'
  | 'below_market'
  | 'multi_source'
  | 'agency_mandate_aging'
  | 'overpriced'
  | 'stale_dom_relative'
  | 'failed_launch'
  | 'competition_shock'
  | 'back_to_market'
  | (string & {});

export interface ListingSignal {
  id: string;
  property_id: string;
  listing_id: string;
  signal_type: ListingSignalType;
  metadata: Json;
  detected_at: string;
  is_active: boolean;
}

export type SignalsByProperty = Record<string, ListingSignal[]>;

interface SupabaseError {
  message: string;
}

interface ListingSignalsQueryResult {
  data: ListingSignal[] | null;
  error: SupabaseError | null;
}

type ListingSignalsOrderQuery = PromiseLike<ListingSignalsQueryResult>;

interface ListingSignalsEqQuery {
  order(column: 'detected_at', options: { ascending: boolean }): ListingSignalsOrderQuery;
}

interface ListingSignalsInQuery {
  eq(column: 'is_active', value: true): ListingSignalsEqQuery;
}

interface ListingSignalsSelectQuery {
  in(column: 'property_id', values: string[]): ListingSignalsInQuery;
}

interface ListingSignalsTableQuery {
  select(columns: string): ListingSignalsSelectQuery;
}

function assertSupabase() {
  if (!supabase) throw new Error("Supabase n'est pas configure.");
  return supabase;
}

function uniquePropertyIds(propertyIds: string[]) {
  return Array.from(new Set(propertyIds.filter(Boolean)));
}

export const listingSignalsService = {
  async listByPropertyIds(propertyIds: string[]): Promise<SignalsByProperty> {
    const ids = uniquePropertyIds(propertyIds);
    if (ids.length === 0) return {};

    const client = assertSupabase();
    const signalsQuery = client.from('listing_signals' as never) as unknown as ListingSignalsTableQuery;
    const { data, error } = await signalsQuery
      .select('id, property_id, listing_id, signal_type, metadata, detected_at, is_active')
      .in('property_id', ids)
      .eq('is_active', true)
      .order('detected_at', { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? []).reduce<SignalsByProperty>((acc, signal) => {
      const current = acc[signal.property_id] ?? [];
      current.push(signal);
      acc[signal.property_id] = current;
      return acc;
    }, {});
  },
};
