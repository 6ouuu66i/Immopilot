import { supabase } from '../supabase';

export interface PropertyMarks {
  favorites: string[];
  ignored: string[];
}

type MarkType = 'favorite' | 'ignored';
interface UserPropertyMarkInsert {
  user_id: string;
  property_id: string;
  mark_type: MarkType;
}

interface SupabaseMutationResult {
  error: { message: string } | null;
}

type UpsertMarks = (
  values: UserPropertyMarkInsert[],
  options: { onConflict: string },
) => PromiseLike<SupabaseMutationResult>;

function assertSupabase() {
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  return supabase;
}

async function getCurrentUserId(): Promise<string> {
  const client = assertSupabase();
  const { data, error } = await client.auth.getUser();

  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Utilisateur non connecté.');

  return data.user.id;
}

async function hasMark(userId: string, propertyId: string, markType: MarkType): Promise<boolean> {
  const client = assertSupabase();
  const { data, error } = await client
    .from('user_property_marks')
    .select('id')
    .eq('user_id', userId)
    .eq('property_id', propertyId)
    .eq('mark_type', markType)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return Boolean(data);
}

async function setMark(propertyId: string, markType: MarkType): Promise<boolean> {
  const client = assertSupabase();
  const userId = await getCurrentUserId();
  const exists = await hasMark(userId, propertyId, markType);

  if (exists) {
    const { error } = await client
      .from('user_property_marks')
      .delete()
      .eq('user_id', userId)
      .eq('property_id', propertyId)
      .eq('mark_type', markType);

    if (error) throw new Error(error.message);
    return false;
  }

  const marksQuery = client.from('user_property_marks');
  const upsertMarks = marksQuery.upsert.bind(marksQuery) as unknown as UpsertMarks;
  const { error } = await upsertMarks(
    [{
      user_id: userId,
      property_id: propertyId,
      mark_type: markType,
    }],
    { onConflict: 'user_id,property_id,mark_type' },
  );

  if (error) throw new Error(error.message);
  return true;
}

export const propertyMarksService = {
  async getMarks(userId: string): Promise<PropertyMarks> {
    const client = assertSupabase();
    const { data, error } = await client
      .from('user_property_marks')
      .select('property_id, mark_type')
      .eq('user_id', userId);

    if (error) throw new Error(error.message);

    return (data ?? []).reduce<PropertyMarks>(
      (acc, mark) => {
        if (mark.mark_type === 'favorite') acc.favorites.push(mark.property_id);
        if (mark.mark_type === 'ignored') acc.ignored.push(mark.property_id);
        return acc;
      },
      { favorites: [], ignored: [] },
    );
  },

  async toggleFavorite(propertyId: string): Promise<boolean> {
    const favorite = await setMark(propertyId, 'favorite');

    if (favorite) {
      const client = assertSupabase();
      const userId = await getCurrentUserId();
      const { error } = await client
        .from('user_property_marks')
        .delete()
        .eq('user_id', userId)
        .eq('property_id', propertyId)
        .eq('mark_type', 'ignored');

      if (error) throw new Error(error.message);
    }

    return favorite;
  },

  async toggleIgnored(propertyId: string): Promise<boolean> {
    const ignored = await setMark(propertyId, 'ignored');

    if (ignored) {
      const client = assertSupabase();
      const userId = await getCurrentUserId();
      const { error } = await client
        .from('user_property_marks')
        .delete()
        .eq('user_id', userId)
        .eq('property_id', propertyId)
        .eq('mark_type', 'favorite');

      if (error) throw new Error(error.message);
    }

    return ignored;
  },
};
