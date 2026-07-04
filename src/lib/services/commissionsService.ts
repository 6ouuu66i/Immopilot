import { supabase } from '../supabase';
import type { Tables, TablesInsert, TablesUpdate } from '../database.types';

export type CommissionStatus = Tables<'commissions'>['status'];
export type CommissionRow = Tables<'commissions'>;
type CommissionInsert = TablesInsert<'commissions'>;
type CommissionUpdate = TablesUpdate<'commissions'>;
type DealRow = Tables<'deals'>;
type ProfileRow = Tables<'profiles'>;
type PropertyRow = Tables<'properties'>;

export type CommissionPeriod = 'month' | 'quarter' | 'year' | 'all';

export interface CommissionFilters {
  status?: CommissionStatus | 'all';
  period?: CommissionPeriod;
}

export interface AgencyCommissionFilters extends CommissionFilters {
  agent_id?: string | null;
}

export interface CreateCommissionInput {
  deal_id: string;
  agent_id: string;
  amount: number;
  percentage?: number | null;
  notes?: string | null;
}

export interface UpdateCommissionInput {
  amount?: number;
  percentage?: number | null;
  status?: CommissionStatus;
  notes?: string | null;
}

export interface CommissionDealSummary extends Pick<DealRow, 'id' | 'reference' | 'title' | 'owner_id' | 'property_id'> {
  property: Pick<PropertyRow, 'id' | 'street' | 'house_number' | 'locality' | 'postal_code'> | null;
}

export interface CommissionWithRelations extends CommissionRow {
  deal: CommissionDealSummary | null;
  agent: ProfileRow | null;
  creator: ProfileRow | null;
}

type MutationError = { message: string } | null;

type InsertCommissionQuery = {
  insert(values: CommissionInsert): {
    select(columns: string): {
      single(): Promise<{ data: CommissionRow | null; error: MutationError }>;
    };
  };
};

type UpdateCommissionQuery = {
  update(values: CommissionUpdate): {
    eq(column: 'id', value: string): {
      select(columns: string): {
        single(): Promise<{ data: CommissionRow | null; error: MutationError }>;
      };
    };
  };
};

const COMMISSION_SELECT = `
  *,
  deal:deals!commissions_deal_id_fkey(
    id,
    reference,
    title,
    owner_id,
    property_id,
    property:properties!deals_property_id_fkey(id,street,house_number,locality,postal_code)
  ),
  agent:profiles!commissions_agent_id_fkey(*),
  creator:profiles!commissions_created_by_fkey(*)
`;

const VALID_TRANSITIONS: Record<CommissionStatus, CommissionStatus[]> = {
  draft: ['expected', 'cancelled'],
  expected: ['payable', 'cancelled'],
  payable: ['paid', 'cancelled'],
  paid: [],
  cancelled: [],
};

export function formatAmount(cents: number): string {
  return new Intl.NumberFormat('fr-BE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100).replace(/\s?EUR/, ' €').replace(/\u00A0/g, ' ');
}

export function eurosToCents(value: number): number {
  return Math.round(value * 100);
}

export function centsToEuros(value: number): number {
  return value / 100;
}

export function getValidCommissionTransitions(status: CommissionStatus): CommissionStatus[] {
  return VALID_TRANSITIONS[status];
}

function assertSupabase() {
  if (!supabase) throw new Error("Supabase n'est pas configure.");
  return supabase;
}

async function getCurrentProfile(): Promise<ProfileRow> {
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
  const profile = data as ProfileRow | null;
  if (!profile?.agency_id) throw new Error('Profil agence introuvable.');
  return profile;
}

function assertAdmin(profile: ProfileRow) {
  if (profile.role !== 'admin') throw new Error('Action reservee aux administrateurs.');
}

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function applyFilters<T extends { gte: (column: string, value: string) => T; lt: (column: string, value: string) => T; eq: (column: string, value: string) => T }>(
  query: T,
  filters: CommissionFilters,
) {
  let next = query;
  if (filters.status && filters.status !== 'all') next = next.eq('status', filters.status);
  if (filters.period && filters.period !== 'all') {
    const now = new Date();
    const start = new Date(now);
    if (filters.period === 'month') start.setUTCDate(1);
    if (filters.period === 'quarter') start.setUTCMonth(Math.floor(now.getUTCMonth() / 3) * 3, 1);
    if (filters.period === 'year') start.setUTCMonth(0, 1);
    start.setUTCHours(0, 0, 0, 0);
    next = next.gte('created_at', start.toISOString());
  }
  return next;
}

function castCommission(row: unknown): CommissionWithRelations {
  return row as CommissionWithRelations;
}

async function getDeal(dealId: string): Promise<DealRow> {
  const client = assertSupabase();
  const { data, error } = await client
    .from('deals')
    .select('*')
    .eq('id', dealId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const deal = data as DealRow | null;
  if (!deal) throw new Error('Deal introuvable.');
  return deal;
}

async function getProfile(profileId: string): Promise<ProfileRow> {
  const client = assertSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const agent = data as ProfileRow | null;
  if (!agent) throw new Error('Agent introuvable.');
  if (!agent.is_active) throw new Error('Agent inactif.');
  return agent;
}

async function hydrateCommission(commissionId: string): Promise<CommissionWithRelations> {
  const client = assertSupabase();
  const { data, error } = await client
    .from('commissions')
    .select(COMMISSION_SELECT)
    .eq('id', commissionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Commission introuvable.');
  return castCommission(data);
}

export const commissionsService = {
  async listMyCommissions(filters: CommissionFilters = {}): Promise<CommissionWithRelations[]> {
    const client = assertSupabase();
    const profile = await getCurrentProfile();
    let query = client
      .from('commissions')
      .select(COMMISSION_SELECT)
      .eq('agent_id', profile.id)
      .order('created_at', { ascending: false });

    query = applyFilters(query, filters);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown[]).map(castCommission);
  },

  async listAgencyCommissions({ agent_id, ...filters }: AgencyCommissionFilters = {}): Promise<CommissionWithRelations[]> {
    const client = assertSupabase();
    const profile = await getCurrentProfile();
    assertAdmin(profile);

    let query = client
      .from('commissions')
      .select(COMMISSION_SELECT)
      .eq('agency_id', profile.agency_id as string)
      .order('created_at', { ascending: false });

    query = applyFilters(query, filters);
    if (agent_id) query = query.eq('agent_id', agent_id);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown[]).map(castCommission);
  },

  async getCommission(commissionId: string): Promise<CommissionWithRelations> {
    return hydrateCommission(commissionId);
  },

  async createCommission(input: CreateCommissionInput): Promise<CommissionWithRelations> {
    const client = assertSupabase();
    const profile = await getCurrentProfile();
    assertAdmin(profile);
    if (input.amount <= 0) throw new Error('Le montant doit etre superieur a 0.');

    const deal = await getDeal(input.deal_id);
    const agent = await getProfile(input.agent_id);
    if (deal.agency_id !== profile.agency_id) throw new Error("Ce deal n'appartient pas a votre agence.");
    if (agent.agency_id !== profile.agency_id) throw new Error("L'agent choisi n'appartient pas a votre agence.");

    const query = client.from('commissions') as unknown as InsertCommissionQuery;
    const { data, error } = await query
      .insert({
        agency_id: deal.agency_id,
        deal_id: deal.id,
        agent_id: input.agent_id,
        created_by: profile.id,
        amount: input.amount,
        percentage: input.percentage ?? null,
        notes: cleanText(input.notes),
        status: 'draft',
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Commission non retournee apres creation.');
    return hydrateCommission(data.id);
  },

  async updateCommission(commissionId: string, patch: UpdateCommissionInput): Promise<CommissionWithRelations> {
    const profile = await getCurrentProfile();
    assertAdmin(profile);
    const current = await hydrateCommission(commissionId);
    const nextPatch: CommissionUpdate = {
      updated_at: new Date().toISOString(),
    };

    if (patch.amount !== undefined) {
      if (patch.amount <= 0) throw new Error('Le montant doit etre superieur a 0.');
      nextPatch.amount = patch.amount;
    }
    if (patch.percentage !== undefined) nextPatch.percentage = patch.percentage;
    if (patch.notes !== undefined) nextPatch.notes = cleanText(patch.notes);
    if (patch.status !== undefined) {
      const allowed = getValidCommissionTransitions(current.status);
      if (!allowed.includes(patch.status) && patch.status !== current.status) {
        throw new Error(`Transition de statut invalide: ${current.status} -> ${patch.status}.`);
      }
      nextPatch.status = patch.status;
      nextPatch.paid_at = patch.status === 'paid' ? new Date().toISOString() : current.paid_at;
    }

    const client = assertSupabase();
    const query = client.from('commissions') as unknown as UpdateCommissionQuery;
    const { data, error } = await query
      .update(nextPatch)
      .eq('id', commissionId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Commission non retournee apres modification.');
    const updated = await hydrateCommission(data.id);
    return updated;
  },

  async updateStatus(commissionId: string, newStatus: CommissionStatus): Promise<CommissionWithRelations> {
    return commissionsService.updateCommission(commissionId, { status: newStatus });
  },

  async markAsPaid(commissionId: string): Promise<CommissionWithRelations> {
    return commissionsService.updateCommission(commissionId, { status: 'paid' });
  },

  async deleteCommission(commissionId: string): Promise<void> {
    const profile = await getCurrentProfile();
    assertAdmin(profile);
    const client = assertSupabase();
    const { error } = await client
      .from('commissions')
      .delete()
      .eq('id', commissionId);

    if (error) throw new Error(error.message);
  },
};
