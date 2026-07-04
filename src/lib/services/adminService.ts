import type { Tables } from '../database.types';
import { assertSupabase, currentMonthRange, getCurrentAdminProfile } from './adminUtils';

export interface AdminOverviewData {
  activeAgents: number;
  openDeals: number;
  closedDealsThisMonth: number;
  commissionsPaidThisMonth: number;
  overdueTasks: number;
  favoriteProperties: number;
  recentActivities: Array<Tables<'activities'> & { actor: Pick<Tables<'profiles'>, 'id' | 'full_name' | 'email' | 'avatar_url'> | null }>;
}

export interface ReservedDealRow extends Tables<'deals'> {
  owner: Pick<Tables<'profiles'>, 'id' | 'full_name' | 'email' | 'avatar_url'> | null;
  property: Tables<'properties'> | null;
  listing: Tables<'listings'> | null;
}

export interface AgentActivityDetails {
  deals: Tables<'deals'>[];
  tasks: Tables<'tasks'>[];
  transfers: Tables<'transfer_requests'>[];
}

export const adminService = {
  async getOverview(): Promise<AdminOverviewData> {
    const client = assertSupabase();
    const profile = await getCurrentAdminProfile();
    const { start, end } = currentMonthRange();
    const now = new Date().toISOString();

    const [activeAgents, openDeals, closedDeals, commissions, overdueTasks, favoriteMarks, activities] = await Promise.all([
      client.from('profiles').select('id', { count: 'exact', head: true }).eq('agency_id', profile.agency_id as string).eq('is_active', true),
      client.from('deals').select('id', { count: 'exact', head: true }).eq('agency_id', profile.agency_id as string).is('closed_at', null),
      client.from('deals').select('id', { count: 'exact', head: true }).eq('agency_id', profile.agency_id as string).gte('closed_at', start).lt('closed_at', end),
      client.from('commissions').select('amount').eq('agency_id', profile.agency_id as string).eq('status', 'paid').gte('paid_at', start).lt('paid_at', end),
      client.from('tasks').select('id', { count: 'exact', head: true }).eq('agency_id', profile.agency_id as string).eq('is_completed', false).lt('due_date', now),
      client.from('user_property_marks').select('id, user:profiles!user_property_marks_user_id_fkey!inner(agency_id)', { count: 'exact', head: true }).eq('mark_type', 'favorite').eq('user.agency_id', profile.agency_id as string),
      client.from('activities').select('*, actor:profiles!activities_actor_id_fkey(id,full_name,email,avatar_url)').eq('agency_id', profile.agency_id as string).order('created_at', { ascending: false }).limit(10),
    ]);

    for (const result of [activeAgents, openDeals, closedDeals, commissions, overdueTasks, favoriteMarks, activities]) {
      if (result.error) throw new Error(result.error.message);
    }

    return {
      activeAgents: activeAgents.count ?? 0,
      openDeals: openDeals.count ?? 0,
      closedDealsThisMonth: closedDeals.count ?? 0,
      commissionsPaidThisMonth: (commissions.data ?? []).reduce((sum, row) => sum + (row.amount ?? 0), 0),
      overdueTasks: overdueTasks.count ?? 0,
      favoriteProperties: favoriteMarks.count ?? 0,
      recentActivities: (activities.data ?? []) as AdminOverviewData['recentActivities'],
    };
  },

  async listReservedDeals(filters: { agentId?: string | null; period?: 'week' | 'month' | 'all' } = {}): Promise<ReservedDealRow[]> {
    const client = assertSupabase();
    const profile = await getCurrentAdminProfile();
    let query = client
      .from('deals')
      .select(`
        *,
        owner:profiles!deals_owner_id_fkey(id,full_name,email,avatar_url),
        property:properties!deals_property_id_fkey(*)
      `)
      .eq('agency_id', profile.agency_id as string)
      .is('closed_at', null)
      .order('created_at', { ascending: false });

    if (filters.agentId) query = query.eq('owner_id', filters.agentId);
    if (filters.period && filters.period !== 'all') {
      const since = new Date();
      since.setDate(since.getDate() - (filters.period === 'week' ? 7 : 31));
      query = query.gte('created_at', since.toISOString());
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as ReservedDealRow[];
    const propertyIds = rows.map((row) => row.property_id);
    const { data: listings, error: listingsError } = propertyIds.length
      ? await client.from('listings').select('*').in('property_id', propertyIds).eq('status', 'active').order('last_seen_at', { ascending: false })
      : { data: [], error: null };
    if (listingsError) throw new Error(listingsError.message);
    const byProperty = new Map<string, Tables<'listings'>>();
    for (const listing of (listings ?? []) as Tables<'listings'>[]) {
      if (listing.property_id && !byProperty.has(listing.property_id)) byProperty.set(listing.property_id, listing);
    }
    return rows.map((row) => ({ ...row, listing: byProperty.get(row.property_id) ?? null }));
  },

  async getAgentActivityDetails(agentId: string): Promise<AgentActivityDetails> {
    const client = assertSupabase();
    const profile = await getCurrentAdminProfile();
    const [deals, tasks, transfers] = await Promise.all([
      client.from('deals').select('*').eq('agency_id', profile.agency_id as string).eq('owner_id', agentId).order('created_at', { ascending: false }).limit(10),
      client.from('tasks').select('*').eq('agency_id', profile.agency_id as string).eq('owner_id', agentId).order('created_at', { ascending: false }).limit(10),
      client.from('transfer_requests').select('*').eq('agency_id', profile.agency_id as string).or(`from_agent_id.eq.${agentId},to_agent_id.eq.${agentId},requested_by.eq.${agentId}`).order('created_at', { ascending: false }).limit(10),
    ]);
    if (deals.error) throw new Error(deals.error.message);
    if (tasks.error) throw new Error(tasks.error.message);
    if (transfers.error) throw new Error(transfers.error.message);
    return {
      deals: (deals.data ?? []) as Tables<'deals'>[],
      tasks: (tasks.data ?? []) as Tables<'tasks'>[],
      transfers: (transfers.data ?? []) as Tables<'transfer_requests'>[],
    };
  },
};
