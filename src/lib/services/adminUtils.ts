import type { Tables } from '../database.types';
import { supabase } from '../supabase';

export type AdminProfile = Tables<'profiles'>;

export function assertSupabase() {
  if (!supabase) throw new Error("Supabase n'est pas configure.");
  return supabase;
}

export async function getCurrentAdminProfile(): Promise<AdminProfile> {
  const client = assertSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw new Error(userError.message);
  if (!userData.user) throw new Error('Utilisateur non connecte.');

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const profile = data as AdminProfile | null;
  if (!profile?.agency_id) throw new Error('Profil agence introuvable.');
  if (profile.role !== 'admin') throw new Error('Action reservee aux administrateurs.');
  return profile;
}

export function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function formatAddress(property: Pick<Tables<'properties'>, 'street' | 'house_number' | 'postal_code' | 'locality'> | null | undefined) {
  if (!property) return 'Bien non renseigne';
  const street = [property.street, property.house_number].filter(Boolean).join(' ');
  return [street, property.postal_code, property.locality].filter(Boolean).join(', ') || 'Adresse non renseignee';
}
