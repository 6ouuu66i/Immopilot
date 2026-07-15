import { supabase } from '../supabase';

export interface PropertySearchHit {
  listing_id: string;
  property_id: string | null;
  title_fr: string | null;
  locality: string | null;
  postal_code: string | null;
  price: number | null;
  primary_photo_url: string | null;
  seller_score: number | null;
  seller_segment: 'particulier' | 'agence';
}

function assertSupabase() {
  if (!supabase) throw new Error("Supabase n'est pas configure.");
  return supabase;
}

export async function searchActiveProperties(searchTerm: string, resultLimit = 6): Promise<PropertySearchHit[]> {
  const term = searchTerm.replace(/\s+/g, ' ').trim();
  if (term.length < 2) return [];

  const client = assertSupabase();
  const { data, error } = await client.rpc('search_active_properties', {
    search_term: term,
    result_limit: resultLimit,
  });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    if (row.seller_segment !== 'particulier' && row.seller_segment !== 'agence') {
      throw new Error('Reponse de recherche invalide.');
    }
    return { ...row, seller_segment: row.seller_segment } as PropertySearchHit;
  });
}
