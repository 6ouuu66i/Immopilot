import { supabase } from '../supabase';
import type { Tables } from '../database.types';

type ProfileRow = Tables<'profiles'>;
type NoteRow = Tables<'notes'>;

export interface NoteAuthor {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
}

export interface NoteWithAuthor extends NoteRow {
  author: NoteAuthor | null;
}

export interface CreateNoteInput {
  content: string;
  propertyId?: string | null;
  dealId?: string | null;
  contactId?: string | null;
}

type RawNoteWithAuthor = NoteRow & {
  author?: NoteAuthor | NoteAuthor[] | null;
};

type NoteInsert = {
  agency_id: string;
  author_id: string;
  content: string;
  property_id: string | null;
  deal_id: string | null;
  contact_id: string | null;
};

type NoteUpdate = {
  content: string;
  updated_at: string;
};

type MutationError = { message: string } | null;
type NotesByDeal = Record<string, NoteWithAuthor[]>;

type InsertNoteQuery = {
  insert(values: NoteInsert): {
    select(columns: string): {
      single(): Promise<{ data: { id: string } | null; error: MutationError }>;
    };
  };
};

type UpdateNoteQuery = {
  update(values: NoteUpdate): {
    eq(column: 'id', value: string): Promise<{ error: MutationError }>;
  };
};

const NOTE_SELECT = `
  id,
  agency_id,
  author_id,
  property_id,
  deal_id,
  contact_id,
  content,
  created_at,
  updated_at,
  author:profiles!notes_author_id_fkey(id, full_name, email, role)
`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSupabaseUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}

function normalizeAuthor(author: RawNoteWithAuthor['author']): NoteAuthor | null {
  if (Array.isArray(author)) return author[0] ?? null;
  return author ?? null;
}

function normalizeNote(row: RawNoteWithAuthor): NoteWithAuthor {
  return {
    ...row,
    author: normalizeAuthor(row.author),
  };
}

function assertSupabase() {
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  return supabase;
}

async function getCurrentProfile(): Promise<ProfileRow> {
  const client = assertSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();

  if (userError) throw new Error(userError.message);
  if (!userData.user) throw new Error('Utilisateur non connecté.');

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  const typedProfile = profile as ProfileRow | null;
  if (!typedProfile?.agency_id) throw new Error('Profil agence introuvable.');

  return typedProfile;
}

async function getNoteById(noteId: string): Promise<NoteWithAuthor> {
  const client = assertSupabase();
  const { data, error } = await client
    .from('notes')
    .select(NOTE_SELECT)
    .eq('id', noteId)
    .single();

  if (error) throw new Error(error.message);
  return normalizeNote(data as unknown as RawNoteWithAuthor);
}

async function getNotesByForeignKey(column: 'property_id' | 'deal_id' | 'contact_id', id: string): Promise<NoteWithAuthor[]> {
  if (!isSupabaseUuid(id)) return [];

  const client = assertSupabase();
  const { data, error } = await client
    .from('notes')
    .select(NOTE_SELECT)
    .eq(column, id)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RawNoteWithAuthor[]).map(normalizeNote);
}

function groupNotesByDeal(rows: RawNoteWithAuthor[]): NotesByDeal {
  return rows.reduce<NotesByDeal>((acc, row) => {
    if (!row.deal_id) return acc;
    const current = acc[row.deal_id] ?? [];
    current.push(normalizeNote(row));
    acc[row.deal_id] = current;
    return acc;
  }, {});
}

export const notesService = {
  getNotesForProperty(propertyId: string): Promise<NoteWithAuthor[]> {
    return getNotesByForeignKey('property_id', propertyId);
  },

  getNotesForDeal(dealId: string): Promise<NoteWithAuthor[]> {
    return getNotesByForeignKey('deal_id', dealId);
  },

  async getNotesForDeals(dealIds: string[]): Promise<NotesByDeal> {
    const validDealIds = Array.from(new Set(dealIds.filter(isSupabaseUuid)));
    if (validDealIds.length === 0) return {};

    const client = assertSupabase();
    const { data, error } = await client
      .from('notes')
      .select(NOTE_SELECT)
      .in('deal_id', validDealIds)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return groupNotesByDeal((data ?? []) as unknown as RawNoteWithAuthor[]);
  },

  getNotesForContact(contactId: string): Promise<NoteWithAuthor[]> {
    return getNotesByForeignKey('contact_id', contactId);
  },

  async createNote({ content, propertyId, dealId, contactId }: CreateNoteInput): Promise<NoteWithAuthor> {
    const trimmed = content.trim();
    if (!trimmed) throw new Error('La note est vide.');

    const validTargets = [propertyId, dealId, contactId].filter(isSupabaseUuid);
    if (validTargets.length !== 1) {
      throw new Error("Cette fiche n'est pas encore synchronisée avec Supabase.");
    }

    const client = assertSupabase();
    const profile = await getCurrentProfile();

    const notesQuery = client.from('notes') as unknown as InsertNoteQuery;
    const { data, error } = await notesQuery
      .insert({
        agency_id: profile.agency_id as string,
        author_id: profile.id,
        content: trimmed,
        property_id: isSupabaseUuid(propertyId) ? propertyId : null,
        deal_id: isSupabaseUuid(dealId) ? dealId : null,
        contact_id: isSupabaseUuid(contactId) ? contactId : null,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);
    return getNoteById((data as { id: string }).id);
  },

  async updateNote(noteId: string, content: string): Promise<NoteWithAuthor> {
    const trimmed = content.trim();
    if (!trimmed) throw new Error('La note est vide.');

    const client = assertSupabase();
    const notesQuery = client.from('notes') as unknown as UpdateNoteQuery;
    const { error } = await notesQuery
      .update({ content: trimmed, updated_at: new Date().toISOString() })
      .eq('id', noteId);

    if (error) throw new Error(error.message);
    return getNoteById(noteId);
  },

  async deleteNote(noteId: string): Promise<void> {
    const client = assertSupabase();
    const { error } = await client
      .from('notes')
      .delete()
      .eq('id', noteId);

    if (error) throw new Error(error.message);
  },
};
