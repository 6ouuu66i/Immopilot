import { supabase } from '../supabase';
import type { Tables, TablesInsert, TablesUpdate } from '../database.types';
import { getCurrentAdminProfile } from './adminUtils';

export type PipelineStageRow = Tables<'pipeline_stages'>;
type PipelineStageInsert = TablesInsert<'pipeline_stages'>;
type PipelineStageUpdate = TablesUpdate<'pipeline_stages'>;

function assertSupabase() {
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  return supabase;
}

export const pipelineStagesService = {
  async listStages(): Promise<PipelineStageRow[]> {
    const client = assertSupabase();
    const { data, error } = await client
      .from('pipeline_stages')
      .select('*')
      .order('position', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as PipelineStageRow[];
  },

  async getStageById(id: string): Promise<PipelineStageRow | null> {
    const client = assertSupabase();
    const { data, error } = await client
      .from('pipeline_stages')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data as PipelineStageRow | null;
  },

  async createStage(input: Pick<PipelineStageInsert, 'name' | 'color' | 'position' | 'is_won' | 'is_lost'>): Promise<PipelineStageRow> {
    const client = assertSupabase();
    const profile = await getCurrentAdminProfile();
    await normalizeWonLostFlags(null, input.is_won, input.is_lost);

    const { data, error } = await client
      .from('pipeline_stages')
      .insert({
        agency_id: profile.agency_id as string,
        name: input.name.trim(),
        color: input.color ?? '#6B7280',
        position: input.position,
        is_won: Boolean(input.is_won),
        is_lost: Boolean(input.is_lost),
      } as PipelineStageInsert as never)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as PipelineStageRow;
  },

  async updateStage(stageId: string, patch: PipelineStageUpdate): Promise<PipelineStageRow> {
    await getCurrentAdminProfile();
    await normalizeWonLostFlags(stageId, patch.is_won, patch.is_lost);
    const client = assertSupabase();
    const nextPatch = { ...patch };
    if (typeof nextPatch.name === 'string') nextPatch.name = nextPatch.name.trim();

    const { data, error } = await client
      .from('pipeline_stages')
      .update(nextPatch as never)
      .eq('id', stageId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as PipelineStageRow;
  },

  async reorderStages(stageIds: string[]): Promise<PipelineStageRow[]> {
    await getCurrentAdminProfile();
    const client = assertSupabase();
    const temporaryOffset = 10000;

    for (const [index, id] of stageIds.entries()) {
      const { error } = await client
        .from('pipeline_stages')
        .update({ position: temporaryOffset + index + 1 } as never)
        .eq('id', id);
      if (error) throw new Error(error.message);
    }

    const updates: PipelineStageRow[] = [];
    for (const [index, id] of stageIds.entries()) {
      const { data, error } = await client
        .from('pipeline_stages')
        .update({ position: index + 1 } as never)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      updates.push(data as PipelineStageRow);
    }

    return updates.sort((a, b) => a.position - b.position);
  },

  async deleteStage(stageId: string, fallbackStageId: string): Promise<void> {
    const client = assertSupabase();
    await getCurrentAdminProfile();
    if (stageId === fallbackStageId) throw new Error('Choisissez une etape de remplacement differente.');

    const { error: moveError } = await client
      .from('deals')
      .update({ stage_id: fallbackStageId, updated_at: new Date().toISOString() } as never)
      .eq('stage_id', stageId);
    if (moveError) throw new Error(moveError.message);

    const { error } = await client.from('pipeline_stages').delete().eq('id', stageId);
    if (error) throw new Error(error.message);
  },
};

async function normalizeWonLostFlags(stageId: string | null, isWon?: boolean | null, isLost?: boolean | null) {
  const client = assertSupabase();
  const profile = await getCurrentAdminProfile();
  if (isWon) {
    let query = client.from('pipeline_stages').update({ is_won: false } as never).eq('agency_id', profile.agency_id as string).eq('is_won', true);
    if (stageId) query = query.neq('id', stageId);
    const { error } = await query;
    if (error) throw new Error(error.message);
  }
  if (isLost) {
    let query = client.from('pipeline_stages').update({ is_lost: false } as never).eq('agency_id', profile.agency_id as string).eq('is_lost', true);
    if (stageId) query = query.neq('id', stageId);
    const { error } = await query;
    if (error) throw new Error(error.message);
  }
}
