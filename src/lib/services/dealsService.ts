import { supabase } from '../supabase';
import type { Json, Tables, TablesUpdate } from '../database.types';
import { notesService, type NoteWithAuthor } from './notesService';
import { pipelineStagesService, type PipelineStageRow } from './pipelineStagesService';
import { insertAuditLog } from './auditLogsService';
import { getCurrentAdminProfile } from './adminUtils';

type ProfileRow = Tables<'profiles'>;
type ContactRow = Tables<'contacts'>;
type PropertyRow = Tables<'properties'>;
type ListingRow = Tables<'listings'>;
type ActivityRow = Tables<'activities'>;
type TaskRow = Tables<'tasks'>;
type DealUpdate = TablesUpdate<'deals'>;

export type SupabaseDeal = Tables<'deals'>;
export type DealActivity = ActivityRow & {
  actor: Pick<ProfileRow, 'id' | 'full_name' | 'email'> | null;
};

export interface DealByReferenceResult {
  id: string;
  deal: SupabaseDeal;
}

export interface ListDealsFilters {
  stage_id?: string | null;
  owner_id?: string | null;
  search?: string | null;
  includeClosed?: boolean;
}

export interface CreateDealInput {
  property_id: string;
  contact_id?: string | null;
  stage_id?: string | null;
  title?: string | null;
  estimated_commission?: number | null;
  expected_close_date?: string | null;
}

export type UpdateDealInput = DealUpdate;

export interface CloseDealInput {
  is_won: boolean;
  lost_reason?: string | null;
}

export interface DealFull extends SupabaseDeal {
  property: PropertyRow | null;
  currentListing: ListingRow | null;
  contact: ContactRow | null;
  owner: ProfileRow | null;
  stage: PipelineStageRow | null;
  activities: DealActivity[];
  tasks: TaskRow[];
  notesList: NoteWithAuthor[];
}

type ListingByPropertyId = Map<string, ListingRow>;
type MutationError = { message: string } | null;
type ActivitiesByDeal = Record<string, DealActivity[]>;
type TasksByDeal = Record<string, TaskRow[]>;

type InsertDealQuery = {
  insert(values: {
    agency_id: string;
    owner_id: string;
    property_id: string;
    stage_id: string;
    contact_id: string | null;
    title: string | null;
    estimated_commission: number | null;
    expected_close_date: string | null;
  }): {
    select(columns: string): {
      single(): Promise<{ data: SupabaseDeal | null; error: MutationError }>;
    };
  };
};

type UpdateDealQuery = {
  update(values: DealUpdate): {
    eq(column: 'id', value: string): {
      select(columns: string): {
        single(): Promise<{ data: SupabaseDeal | null; error: MutationError }>;
      };
    };
  };
};

type InsertActivityQuery = {
  insert(values: {
    agency_id: string;
    actor_id: string | null;
    type: string;
    deal_id: string | null;
    property_id: string | null;
    contact_id?: string | null;
    payload?: Json | null;
  }): Promise<{ error: MutationError }>;
};

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

function cleanSearch(value: string) {
  return value.replaceAll('%', '').replaceAll(',', ' ').trim();
}

function normalizeNullable(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function getLatestActiveListings(propertyIds: string[]): Promise<ListingByPropertyId> {
  const client = assertSupabase();
  if (propertyIds.length === 0) return new Map();

  const { data, error } = await client
    .from('listings')
    .select('*')
    .in('property_id', propertyIds)
    .eq('status', 'active')
    .order('last_seen_at', { ascending: false });

  if (error) throw new Error(error.message);

  const listingsByPropertyId: ListingByPropertyId = new Map();
  for (const listing of (data ?? []) as ListingRow[]) {
    if (listing.property_id && !listingsByPropertyId.has(listing.property_id)) {
      listingsByPropertyId.set(listing.property_id, listing);
    }
  }
  return listingsByPropertyId;
}

async function logActivity(deal: SupabaseDeal, type: string, payload: Json | null = null): Promise<void> {
  const client = assertSupabase();
  const profile = await getCurrentProfile();
  const activitiesQuery = client.from('activities') as unknown as InsertActivityQuery;
  const { error } = await activitiesQuery.insert({
    agency_id: deal.agency_id,
    actor_id: profile.id,
    type,
    deal_id: deal.id,
    property_id: deal.property_id,
    contact_id: deal.contact_id,
    payload,
  });

  if (error) throw new Error(error.message);
}

function uniqueDealIds(dealIds: string[]): string[] {
  return Array.from(new Set(dealIds.filter(Boolean)));
}

function groupActivitiesByDeal(rows: DealActivity[]): ActivitiesByDeal {
  const grouped = rows.reduce<ActivitiesByDeal>((acc, row) => {
    if (!row.deal_id) return acc;
    const current = acc[row.deal_id] ?? [];
    if (current.length < 20) current.push(row);
    acc[row.deal_id] = current;
    return acc;
  }, {});

  return grouped;
}

function groupTasksByDeal(rows: TaskRow[]): TasksByDeal {
  return rows.reduce<TasksByDeal>((acc, row) => {
    if (!row.deal_id) return acc;
    const current = acc[row.deal_id] ?? [];
    current.push(row);
    acc[row.deal_id] = current;
    return acc;
  }, {});
}

async function hydrateDeals(deals: SupabaseDeal[]): Promise<DealFull[]> {
  if (deals.length === 0) return [];

  const client = assertSupabase();
  const propertyIds = Array.from(new Set(deals.map((deal) => deal.property_id)));
  const contactIds = Array.from(new Set(deals.map((deal) => deal.contact_id).filter(Boolean))) as string[];
  const ownerIds = Array.from(new Set(deals.map((deal) => deal.owner_id)));
  const stageIds = Array.from(new Set(deals.map((deal) => deal.stage_id)));

  const [propertiesResult, contactsResult, ownersResult, stagesResult, listings] = await Promise.all([
    client.from('properties').select('*').in('id', propertyIds),
    contactIds.length > 0 ? client.from('contacts').select('*').in('id', contactIds) : Promise.resolve({ data: [], error: null }),
    client.from('profiles').select('*').in('id', ownerIds),
    client.from('pipeline_stages').select('*').in('id', stageIds),
    getLatestActiveListings(propertyIds),
  ]);

  if (propertiesResult.error) throw new Error(propertiesResult.error.message);
  if (contactsResult.error) throw new Error(contactsResult.error.message);
  if (ownersResult.error) throw new Error(ownersResult.error.message);
  if (stagesResult.error) throw new Error(stagesResult.error.message);

  const properties = new Map((propertiesResult.data ?? []).map((row) => [row.id, row as PropertyRow]));
  const contacts = new Map(((contactsResult.data ?? []) as ContactRow[]).map((row) => [row.id, row]));
  const owners = new Map((ownersResult.data ?? []).map((row) => [row.id, row as ProfileRow]));
  const stages = new Map((stagesResult.data ?? []).map((row) => [row.id, row as PipelineStageRow]));
  const dealIds = uniqueDealIds(deals.map((deal) => deal.id));
  const [activitiesByDeal, tasksByDeal, notesByDeal] = await Promise.all([
    dealsService.getActivitiesForDeals(dealIds),
    dealsService.getOpenTasksForDeals(dealIds),
    notesService.getNotesForDeals(dealIds),
  ]);

  return deals.map((deal) => ({
    ...deal,
    property: properties.get(deal.property_id) ?? null,
    currentListing: listings.get(deal.property_id) ?? null,
    contact: deal.contact_id ? contacts.get(deal.contact_id) ?? null : null,
    owner: owners.get(deal.owner_id) ?? null,
    stage: stages.get(deal.stage_id) ?? null,
    activities: activitiesByDeal[deal.id] ?? [],
    tasks: tasksByDeal[deal.id] ?? [],
    notesList: notesByDeal[deal.id] ?? [],
  }));
}

export async function getDealByReference(reference: string): Promise<DealByReferenceResult | null> {
  const client = assertSupabase();

  const { data, error } = await client
    .from('deals')
    .select('*')
    .eq('reference', reference)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const deal = data as SupabaseDeal | null;

  return deal ? { id: deal.id, deal } : null;
}

export const dealsService = {
  getDealByReference,

  async listDeals(filters: ListDealsFilters = {}): Promise<DealFull[]> {
    const client = assertSupabase();
    let query = client
      .from('deals')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.stage_id) query = query.eq('stage_id', filters.stage_id);
    if (filters.owner_id) query = query.eq('owner_id', filters.owner_id);
    if (!filters.includeClosed) query = query.is('closed_at', null);

    const normalizedSearch = cleanSearch(filters.search ?? '');
    if (normalizedSearch) {
      const value = `%${normalizedSearch}%`;
      query = query.or(`reference.ilike.${value},title.ilike.${value}`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return hydrateDeals((data ?? []) as SupabaseDeal[]);
  },

  async getDeal(dealId: string): Promise<DealFull | null> {
    const client = assertSupabase();
    const { data, error } = await client
      .from('deals')
      .select('*')
      .eq('id', dealId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    const deal = data as SupabaseDeal | null;
    if (!deal) return null;

    const [hydrated] = await hydrateDeals([deal]);
    return hydrated ?? null;
  },

  async getDealFullByReference(reference: string): Promise<DealFull | null> {
    const result = await getDealByReference(reference);
    return result ? dealsService.getDeal(result.id) : null;
  },

  async createDeal(input: CreateDealInput): Promise<DealFull> {
    const client = assertSupabase();
    const profile = await getCurrentProfile();
    const stages = await pipelineStagesService.listStages();
    const stageId = input.stage_id ?? stages[0]?.id;
    if (!stageId) throw new Error('Aucune étape de pipeline disponible.');

    const dealsQuery = client.from('deals') as unknown as InsertDealQuery;
    const { data, error } = await dealsQuery
      .insert({
        agency_id: profile.agency_id as string,
        owner_id: profile.id,
        property_id: input.property_id,
        stage_id: stageId,
        contact_id: input.contact_id ?? null,
        title: normalizeNullable(input.title),
        estimated_commission: input.estimated_commission ?? null,
        expected_close_date: input.expected_close_date ?? null,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Deal non retourné après création.');
    await logActivity(data, 'deal_created', { reference: data.reference });

    const created = await dealsService.getDeal(data.id);
    if (!created) throw new Error('Deal créé introuvable.');
    return created;
  },

  async updateDeal(dealId: string, patch: UpdateDealInput): Promise<DealFull> {
    const client = assertSupabase();
    const nextPatch: DealUpdate = { ...patch };
    if (nextPatch.title !== undefined) nextPatch.title = normalizeNullable(nextPatch.title);
    if (nextPatch.notes !== undefined) nextPatch.notes = normalizeNullable(nextPatch.notes);

    const dealsQuery = client.from('deals') as unknown as UpdateDealQuery;
    const { data, error } = await dealsQuery
      .update(nextPatch)
      .eq('id', dealId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Deal non retourné après modification.');

    const updated = await dealsService.getDeal(data.id);
    if (!updated) throw new Error('Deal modifié introuvable.');
    return updated;
  },

  async updateDealStage(dealId: string, newStageId: string, expectedStageId: string): Promise<DealFull> {
    const client = assertSupabase();
    const { data, error } = await client
      .from('deals')
      .update({ stage_id: newStageId })
      .eq('id', dealId)
      .eq('stage_id', expectedStageId)
      .is('closed_at', null)
      .eq('is_won', false)
      .eq('is_lost', false)
      .select('*')
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Ce deal a deja change ou ete cloture. Rechargez le pipeline.');
    const [updated] = await hydrateDeals([data as SupabaseDeal]);
    if (!updated) throw new Error('Deal modifie introuvable.');
    return updated;
  },

  async closeDeal(dealId: string, { is_won, lost_reason }: CloseDealInput): Promise<DealFull> {
    const client = assertSupabase();
    const stages = await pipelineStagesService.listStages();
    const terminalStage = stages.find((stage) => is_won ? stage.is_won : stage.is_lost);
    if (!terminalStage) throw new Error(is_won ? 'Etape gagnee introuvable.' : 'Etape perdue introuvable.');
    const { data, error } = await client
      .from('deals')
      .update({
        stage_id: terminalStage.id,
        closed_at: new Date().toISOString(),
        is_won,
        is_lost: !is_won,
        lost_reason: is_won ? null : normalizeNullable(lost_reason),
      })
      .eq('id', dealId)
      .is('closed_at', null)
      .eq('is_won', false)
      .eq('is_lost', false)
      .select('*')
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Ce deal a deja ete cloture ou modifie. Rechargez le pipeline.');
    const [updated] = await hydrateDeals([data as SupabaseDeal]);
    if (!updated) throw new Error('Deal cloture introuvable.');
    return updated;
  },

  async reopenDeal(dealId: string): Promise<DealFull> {
    const client = assertSupabase();
    const stages = await pipelineStagesService.listStages();
    const activeStage = stages.find((stage) => !stage.is_won && !stage.is_lost);
    if (!activeStage) throw new Error('Aucune etape active disponible.');
    const { data, error } = await client
      .from('deals')
      .update({
        stage_id: activeStage.id,
        closed_at: null,
        is_won: false,
        is_lost: false,
        lost_reason: null,
      })
      .eq('id', dealId)
      .not('closed_at', 'is', null)
      .select('*')
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Ce deal est deja ouvert ou a ete modifie. Rechargez le pipeline.');
    const [updated] = await hydrateDeals([data as SupabaseDeal]);
    if (!updated) throw new Error('Deal rouvert introuvable.');
    return updated;
  },

  async releaseAsAdmin(dealId: string, reason = 'Libere par admin'): Promise<DealFull> {
    await getCurrentAdminProfile();
    const updated = await dealsService.updateDeal(dealId, {
      closed_at: new Date().toISOString(),
      is_won: false,
      is_lost: true,
      lost_reason: reason,
    } as DealUpdate);

    await insertAuditLog('deal_released_by_admin', 'deal', updated.id, {
      reference: updated.reference,
      property_id: updated.property_id,
      reason,
    });
    await logActivity(updated, 'deal_released_by_admin', { reason });
    return updated;
  },

  async deleteDeal(dealId: string): Promise<void> {
    const client = assertSupabase();
    const { error } = await client
      .from('deals')
      .delete()
      .eq('id', dealId);

    if (error) throw new Error(error.message);
  },

  async getDealActivities(dealId: string): Promise<DealActivity[]> {
    const client = assertSupabase();
    const { data, error } = await client
      .from('activities')
      .select('*, actor:profiles!activities_actor_id_fkey(id,full_name,email)')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as DealActivity[];
  },

  async getActivitiesForDeals(dealIds: string[]): Promise<ActivitiesByDeal> {
    const ids = uniqueDealIds(dealIds);
    if (ids.length === 0) return {};

    const client = assertSupabase();
    const { data, error } = await client
      .from('activities')
      .select('*, actor:profiles!activities_actor_id_fkey(id,full_name,email)')
      .in('deal_id', ids)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return groupActivitiesByDeal((data ?? []) as unknown as DealActivity[]);
  },

  async getDealOpenTasks(dealId: string): Promise<TaskRow[]> {
    const client = assertSupabase();
    const { data, error } = await client
      .from('tasks')
      .select('*')
      .eq('deal_id', dealId)
      .eq('is_completed', false)
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as TaskRow[];
  },

  async getOpenTasksForDeals(dealIds: string[]): Promise<TasksByDeal> {
    const ids = uniqueDealIds(dealIds);
    if (ids.length === 0) return {};

    const client = assertSupabase();
    const { data, error } = await client
      .from('tasks')
      .select('*')
      .in('deal_id', ids)
      .eq('is_completed', false)
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) throw new Error(error.message);
    return groupTasksByDeal((data ?? []) as TaskRow[]);
  },
};
