import { supabase } from '../supabase';
import type { Tables, TablesInsert, TablesUpdate } from '../database.types';

type ProfileRow = Tables<'profiles'>;
type DealRow = Tables<'deals'>;
type PropertyRow = Tables<'properties'>;
export type TransferRequestRow = Tables<'transfer_requests'>;
type TransferRequestInsert = TablesInsert<'transfer_requests'>;
type TransferRequestUpdate = TablesUpdate<'transfer_requests'>;

export type TransferDirection = 'sent' | 'received' | 'all';
export type TransferStatus = TransferRequestRow['status'];

export interface RequestTransferInput {
  dealId: string;
  message?: string | null;
}

export interface ListMyTransfersInput {
  direction?: TransferDirection;
}

export interface ListAgencyTransfersInput {
  status?: TransferStatus | 'all';
  agentId?: string | null;
}

export interface TransferDealSummary extends Pick<DealRow, 'id' | 'reference' | 'title' | 'owner_id' | 'closed_at' | 'property_id'> {
  property: Pick<PropertyRow, 'id' | 'street' | 'house_number' | 'locality' | 'postal_code'> | null;
}

export interface TransferRequestFull extends TransferRequestRow {
  deal: TransferDealSummary | null;
  from_agent: ProfileRow | null;
  to_agent: ProfileRow | null;
  requester: ProfileRow | null;
}

type MutationError = { message: string } | null;

type InsertTransferQuery = {
  insert(values: TransferRequestInsert): {
    select(columns: string): {
      single(): Promise<{ data: TransferRequestRow | null; error: MutationError }>;
    };
  };
};

type UpdateTransferQuery = {
  update(values: TransferRequestUpdate): {
    eq(column: 'id' | 'status' | 'from_agent_id' | 'requested_by', value: string): {
      select(columns: string): {
        single(): Promise<{ data: TransferRequestRow | null; error: MutationError }>;
      };
    };
  };
};

const TRANSFER_SELECT = `
  *,
  deal:deals!transfer_requests_deal_id_fkey(
    id,
    reference,
    title,
    owner_id,
    closed_at,
    property_id,
    property:properties!deals_property_id_fkey(id,street,house_number,locality,postal_code)
  ),
  from_agent:profiles!transfer_requests_from_agent_id_fkey(*),
  to_agent:profiles!transfer_requests_to_agent_id_fkey(*),
  requester:profiles!transfer_requests_requested_by_fkey(*)
`;

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
  if (!profile.is_active) throw new Error('Votre compte agent est inactif.');
  return profile;
}

async function getDealForTransfer(dealId: string): Promise<DealRow> {
  const client = assertSupabase();
  const { data, error } = await client
    .from('deals')
    .select('*')
    .eq('id', dealId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const deal = data as DealRow | null;
  if (!deal) throw new Error('Deal introuvable.');
  if (deal.closed_at) throw new Error('Ce deal est cloture et ne peut pas etre transfere.');
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
  const profile = data as ProfileRow | null;
  if (!profile) throw new Error('Agent introuvable.');
  return profile;
}

function normalizeMessage(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function castTransferFull(row: unknown): TransferRequestFull {
  return row as TransferRequestFull;
}

async function hydrateTransfer(transferId: string): Promise<TransferRequestFull> {
  const client = assertSupabase();
  const { data, error } = await client
    .from('transfer_requests')
    .select(TRANSFER_SELECT)
    .eq('id', transferId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Demande de transfert introuvable.');
  return castTransferFull(data);
}

export const transfersService = {
  async requestTransfer({ dealId, message }: RequestTransferInput): Promise<TransferRequestFull> {
    const client = assertSupabase();
    const profile = await getCurrentProfile();
    const deal = await getDealForTransfer(dealId);
    const owner = await getProfile(deal.owner_id);

    if (deal.owner_id === profile.id) throw new Error('Vous etes deja proprietaire de ce deal.');
    if (!owner.is_active) throw new Error("L'agent proprietaire de ce deal est inactif.");
    if (deal.agency_id !== profile.agency_id || owner.agency_id !== profile.agency_id) {
      throw new Error('Le transfert est autorise uniquement entre agents de la meme agence.');
    }

    const { data: existing, error: existingError } = await client
      .from('transfer_requests')
      .select('id')
      .eq('deal_id', deal.id)
      .eq('requested_by', profile.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);
    if (existing) throw new Error('Une demande de transfert est deja en attente pour ce deal.');

    const query = client.from('transfer_requests') as unknown as InsertTransferQuery;
    const { data, error } = await query
      .insert({
        agency_id: deal.agency_id,
        deal_id: deal.id,
        from_agent_id: deal.owner_id,
        to_agent_id: profile.id,
        requested_by: profile.id,
        message: normalizeMessage(message),
        status: 'pending',
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Demande de transfert non retournee.');
    return hydrateTransfer(data.id);
  },

  async acceptTransfer(transferId: string): Promise<TransferRequestFull> {
    const profile = await getCurrentProfile();
    const transfer = await hydrateTransfer(transferId);
    if (transfer.status !== 'pending') throw new Error("Cette demande n'est plus en attente.");
    if (transfer.from_agent_id !== profile.id) throw new Error('Seul le proprietaire actuel du deal peut accepter ce transfert.');

    const client = assertSupabase();
    const query = client.from('transfer_requests') as unknown as UpdateTransferQuery;
    const { data, error } = await query
      .update({ status: 'accepted', resolved_at: new Date().toISOString() })
      .eq('id', transferId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Transfert non retourne apres acceptation.');
    return hydrateTransfer(data.id);
  },

  async refuseTransfer(transferId: string, refusalReason?: string | null): Promise<TransferRequestFull> {
    const profile = await getCurrentProfile();
    const transfer = await hydrateTransfer(transferId);
    if (transfer.status !== 'pending') throw new Error("Cette demande n'est plus en attente.");
    if (transfer.from_agent_id !== profile.id) throw new Error('Seul le proprietaire actuel du deal peut refuser ce transfert.');

    const client = assertSupabase();
    const query = client.from('transfer_requests') as unknown as UpdateTransferQuery;
    const { data, error } = await query
      .update({ status: 'refused', refusal_reason: normalizeMessage(refusalReason), resolved_at: new Date().toISOString() })
      .eq('id', transferId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Transfert non retourne apres refus.');
    return hydrateTransfer(data.id);
  },

  async cancelTransfer(transferId: string): Promise<TransferRequestFull> {
    const profile = await getCurrentProfile();
    const transfer = await hydrateTransfer(transferId);
    if (transfer.status !== 'pending') throw new Error("Cette demande n'est plus en attente.");
    if (transfer.requested_by !== profile.id) throw new Error('Seul le demandeur peut annuler cette demande.');

    const client = assertSupabase();
    const query = client.from('transfer_requests') as unknown as UpdateTransferQuery;
    const { data, error } = await query
      .update({ status: 'cancelled', resolved_at: new Date().toISOString() })
      .eq('id', transferId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Transfert non retourne apres annulation.');
    return hydrateTransfer(data.id);
  },

  async listMyTransfers({ direction = 'all' }: ListMyTransfersInput = {}): Promise<TransferRequestFull[]> {
    const client = assertSupabase();
    const profile = await getCurrentProfile();
    let query = client
      .from('transfer_requests')
      .select(TRANSFER_SELECT)
      .order('created_at', { ascending: false });

    if (direction === 'sent') query = query.eq('requested_by', profile.id);
    if (direction === 'received') query = query.eq('from_agent_id', profile.id);
    if (direction === 'all') {
      query = query.or(`requested_by.eq.${profile.id},from_agent_id.eq.${profile.id},to_agent_id.eq.${profile.id}`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown[]).map(castTransferFull);
  },

  async listAgencyTransfers({ status = 'all', agentId }: ListAgencyTransfersInput = {}): Promise<TransferRequestFull[]> {
    const client = assertSupabase();
    const profile = await getCurrentProfile();
    if (profile.role !== 'admin') throw new Error('Lecture reservee aux administrateurs.');

    let query = client
      .from('transfer_requests')
      .select(TRANSFER_SELECT)
      .eq('agency_id', profile.agency_id as string)
      .order('created_at', { ascending: false });

    if (status !== 'all') query = query.eq('status', status);
    if (agentId) query = query.or(`from_agent_id.eq.${agentId},to_agent_id.eq.${agentId},requested_by.eq.${agentId}`);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown[]).map(castTransferFull);
  },

  async getTransfer(transferId: string): Promise<TransferRequestFull> {
    return hydrateTransfer(transferId);
  },
};
