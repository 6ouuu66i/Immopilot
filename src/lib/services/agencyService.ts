import type { Tables, TablesUpdate } from '../database.types';
import { supabase } from '../supabase';

export type AgencyRow = Tables<'agencies'>;
type ProfileRow = Tables<'profiles'>;

export interface UpdateAgencyPatch {
  name?: string;
  ipi_number?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logo_url?: string | null;
}

function getClient() {
  if (!supabase) throw new Error("Supabase n'est pas configure.");
  return supabase;
}

function normalizeNullable(value: string | null | undefined) {
  if (value === undefined) return undefined;
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

async function getCurrentProfile(): Promise<ProfileRow> {
  const client = getClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw new Error(userError.message);
  if (!userData.user) throw new Error('Utilisateur non connecte.');

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const profile = data as ProfileRow | null;
  if (!profile?.agency_id) throw new Error('Profil agence introuvable.');
  return profile;
}

function assertAdmin(profile: ProfileRow) {
  if (profile.role !== 'admin') throw new Error('Action reservee aux administrateurs.');
}

export const agencyService = {
  async getMyAgency(): Promise<AgencyRow> {
    const client = getClient();
    const profile = await getCurrentProfile();
    const { data, error } = await client
      .from('agencies')
      .select('*')
      .eq('id', profile.agency_id as string)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Agence introuvable.');
    return data as AgencyRow;
  },

  async updateAgency(patch: UpdateAgencyPatch): Promise<AgencyRow> {
    const client = getClient();
    const profile = await getCurrentProfile();
    assertAdmin(profile);

    const nextPatch: TablesUpdate<'agencies'> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.name !== undefined) nextPatch.name = patch.name.trim();
    if (patch.ipi_number !== undefined) nextPatch.ipi_number = normalizeNullable(patch.ipi_number);
    if (patch.address !== undefined) nextPatch.address = normalizeNullable(patch.address);
    if (patch.city !== undefined) nextPatch.city = normalizeNullable(patch.city);
    if (patch.postal_code !== undefined) nextPatch.postal_code = normalizeNullable(patch.postal_code);
    if (patch.phone !== undefined) nextPatch.phone = normalizeNullable(patch.phone);
    if (patch.email !== undefined) nextPatch.email = normalizeNullable(patch.email);
    if (patch.website !== undefined) nextPatch.website = normalizeNullable(patch.website);
    if (patch.logo_url !== undefined) nextPatch.logo_url = normalizeNullable(patch.logo_url);

    if (nextPatch.name !== undefined && nextPatch.name.length === 0) {
      throw new Error("Le nom de l'agence est obligatoire.");
    }

    const { data, error } = await client
      .from('agencies')
      .update(nextPatch as never)
      .eq('id', profile.agency_id as string)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as AgencyRow;
  },

  async uploadAgencyLogo(file: File): Promise<AgencyRow> {
    const client = getClient();
    const profile = await getCurrentProfile();
    assertAdmin(profile);
    const agencyId = profile.agency_id as string;
    const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `${agencyId}/logo-${Date.now()}.${extension}`;

    const { error: uploadError } = await client.storage
      .from('agency-logos')
      .upload(path, file, { cacheControl: '3600', upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    const { data } = client.storage.from('agency-logos').getPublicUrl(path);
    return this.updateAgency({ logo_url: data.publicUrl });
  },
};
