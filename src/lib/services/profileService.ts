import type { User } from '@supabase/supabase-js';
import type { Json, Tables, TablesUpdate } from '../database.types';
import { supabase } from '../supabase';

export interface NotificationPreferences {
  all: boolean;
  transfers: boolean;
  tasks: boolean;
  deals: boolean;
  commissions: boolean;
  mentions: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  all: true,
  transfers: true,
  tasks: true,
  deals: true,
  commissions: true,
  mentions: true,
};

export type ProfileRow = Tables<'profiles'>;

export interface UpdateMyProfilePatch {
  full_name?: string | null;
  phone?: string | null;
  ipi_number?: string | null;
  avatar_url?: string | null;
  notification_preferences?: NotificationPreferences;
}

function getClient() {
  if (!supabase) throw new Error("Supabase n'est pas configure.");
  return supabase;
}

function getSupabaseConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    import.meta.env.VITE_SUPABASE_ANON_KEY
  ) as string | undefined;
  if (!url || !key) throw new Error("Supabase n'est pas configure.");
  return { url, key };
}

function normalizeNullable(value: string | null | undefined) {
  if (value === undefined) return undefined;
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

async function getCurrentUser(): Promise<User> {
  const client = getClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Utilisateur non connecte.');
  return data.user;
}

export function normalizeNotificationPreferences(value: Json | null | undefined): NotificationPreferences {
  const source = typeof value === 'object' && value && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    all: typeof source.all === 'boolean' ? source.all : DEFAULT_NOTIFICATION_PREFERENCES.all,
    transfers: typeof source.transfers === 'boolean' ? source.transfers : DEFAULT_NOTIFICATION_PREFERENCES.transfers,
    tasks: typeof source.tasks === 'boolean' ? source.tasks : DEFAULT_NOTIFICATION_PREFERENCES.tasks,
    deals: typeof source.deals === 'boolean' ? source.deals : DEFAULT_NOTIFICATION_PREFERENCES.deals,
    commissions: typeof source.commissions === 'boolean' ? source.commissions : DEFAULT_NOTIFICATION_PREFERENCES.commissions,
    mentions: typeof source.mentions === 'boolean' ? source.mentions : DEFAULT_NOTIFICATION_PREFERENCES.mentions,
  };
}

export const profileService = {
  async getMyProfile(): Promise<ProfileRow> {
    const client = getClient();
    const user = await getCurrentUser();
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Profil introuvable.');
    return data as ProfileRow;
  },

  async updateMyProfile(patch: UpdateMyProfilePatch): Promise<ProfileRow> {
    const client = getClient();
    const user = await getCurrentUser();
    const nextPatch: TablesUpdate<'profiles'> = {
      updated_at: new Date().toISOString(),
    };

    if (patch.full_name !== undefined) nextPatch.full_name = normalizeNullable(patch.full_name);
    if (patch.phone !== undefined) nextPatch.phone = normalizeNullable(patch.phone);
    if (patch.ipi_number !== undefined) nextPatch.ipi_number = normalizeNullable(patch.ipi_number);
    if (patch.avatar_url !== undefined) nextPatch.avatar_url = normalizeNullable(patch.avatar_url);
    if (patch.notification_preferences !== undefined) nextPatch.notification_preferences = patch.notification_preferences as unknown as Json;

    const { data, error } = await client
      .from('profiles')
      .update(nextPatch as never)
      .eq('id', user.id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as ProfileRow;
  },

  async uploadAvatar(file: File): Promise<ProfileRow> {
    const client = getClient();
    const user = await getCurrentUser();
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${user.id}/avatar-${Date.now()}.${extension}`;

    const { error: uploadError } = await client.storage
      .from('avatars')
      .upload(path, file, { cacheControl: '3600', upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    const { data } = client.storage.from('avatars').getPublicUrl(path);
    return this.updateMyProfile({ avatar_url: data.publicUrl });
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const client = getClient();
    const profile = await this.getMyProfile();
    const { url, key } = getSupabaseConfig();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw new Error(sessionError.message);
    if (!sessionData.session?.access_token) throw new Error('Session active introuvable.');

    const passwordCheck = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: profile.email,
        password: currentPassword,
      }),
    });
    if (!passwordCheck.ok) throw new Error('Mot de passe actuel incorrect.');

    const passwordUpdate = await fetch(`${url}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        apikey: key,
        Authorization: `Bearer ${sessionData.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: newPassword }),
    });
    if (!passwordUpdate.ok) {
      const payload = await passwordUpdate.json().catch(() => null) as { msg?: string; message?: string; error_description?: string } | null;
      throw new Error(payload?.msg ?? payload?.message ?? payload?.error_description ?? 'Changement de mot de passe impossible.');
    }
  },

  async signOutEverywhere(): Promise<void> {
    const client = getClient();
    const { error } = await client.auth.signOut({ scope: 'global' });
    if (error) throw new Error(error.message);
  },
};
