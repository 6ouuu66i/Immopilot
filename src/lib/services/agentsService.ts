import type { Tables, TablesInsert, TablesUpdate } from '../database.types';
import { assertSupabase, currentMonthRange, getCurrentAdminProfile } from './adminUtils';

export type AgentRow = Tables<'profiles'>;
export type InvitationRow = Tables<'agency_invitations'>;

export interface AgentStats {
  openDeals: number;
  closedDealsThisMonth: number;
  commissionsThisMonth: number;
  overdueTasks: number;
}

export interface AgentWithStats extends AgentRow {
  stats: AgentStats;
}

export interface CreateInvitationInput {
  email: string;
  role: 'admin' | 'agent';
}

export interface InvitationResult {
  invitation: InvitationRow;
  link: string;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

async function logAdminAction(action: string, targetType: string, targetId: string, payload?: Record<string, unknown>) {
  const client = assertSupabase();
  const profile = await getCurrentAdminProfile();
  const { error } = await client.from('audit_logs').insert({
    agency_id: profile.agency_id as string,
    actor_id: profile.id,
    action,
    target_type: targetType,
    target_id: targetId,
    payload: payload ?? null,
  } as TablesInsert<'audit_logs'> as never);
  if (error) throw new Error(error.message);
}

export const agentsService = {
  async listAgencyAgents(): Promise<AgentWithStats[]> {
    const client = assertSupabase();
    const profile = await getCurrentAdminProfile();
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('agency_id', profile.agency_id as string)
      .order('full_name', { ascending: true, nullsFirst: false });

    if (error) throw new Error(error.message);
    const agents = (data ?? []) as AgentRow[];
    const stats = await Promise.all(agents.map((agent) => agentsService.getAgentStats(agent.id)));
    return agents.map((agent, index) => ({ ...agent, stats: stats[index] }));
  },

  async getAgentStats(agentId: string): Promise<AgentStats> {
    const client = assertSupabase();
    const profile = await getCurrentAdminProfile();
    const { start, end } = currentMonthRange();
    const now = new Date().toISOString();

    const [openDeals, closedDeals, commissions, overdueTasks] = await Promise.all([
      client.from('deals').select('id', { count: 'exact', head: true }).eq('agency_id', profile.agency_id as string).eq('owner_id', agentId).is('closed_at', null),
      client.from('deals').select('id', { count: 'exact', head: true }).eq('agency_id', profile.agency_id as string).eq('owner_id', agentId).gte('closed_at', start).lt('closed_at', end),
      client.from('commissions').select('amount').eq('agency_id', profile.agency_id as string).eq('agent_id', agentId).eq('status', 'paid').gte('paid_at', start).lt('paid_at', end),
      client.from('tasks').select('id', { count: 'exact', head: true }).eq('agency_id', profile.agency_id as string).eq('owner_id', agentId).eq('is_completed', false).lt('due_date', now),
    ]);

    if (openDeals.error) throw new Error(openDeals.error.message);
    if (closedDeals.error) throw new Error(closedDeals.error.message);
    if (commissions.error) throw new Error(commissions.error.message);
    if (overdueTasks.error) throw new Error(overdueTasks.error.message);

    return {
      openDeals: openDeals.count ?? 0,
      closedDealsThisMonth: closedDeals.count ?? 0,
      commissionsThisMonth: (commissions.data ?? []).reduce((sum, row) => sum + (row.amount ?? 0), 0),
      overdueTasks: overdueTasks.count ?? 0,
    };
  },

  async toggleAgentActive(agentId: string): Promise<AgentWithStats> {
    const client = assertSupabase();
    const current = await getCurrentAdminProfile();
    if (agentId === current.id) throw new Error('Vous ne pouvez pas desactiver votre propre compte.');

    const { data: agentData, error: readError } = await client.from('profiles').select('*').eq('id', agentId).eq('agency_id', current.agency_id as string).maybeSingle();
    if (readError) throw new Error(readError.message);
    const agent = agentData as AgentRow | null;
    if (!agent) throw new Error('Agent introuvable.');

    const { data, error } = await client
      .from('profiles')
      .update({ is_active: !agent.is_active, updated_at: new Date().toISOString() } as TablesUpdate<'profiles'> as never)
      .eq('id', agentId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    const updated = data as AgentRow | null;
    if (!updated) throw new Error('Agent non retourne apres modification.');
    await logAdminAction(updated.is_active ? 'agent_reactivated' : 'agent_deactivated', 'profile', agentId, { email: updated.email });
    return { ...updated, stats: await agentsService.getAgentStats(agentId) };
  },

  async updateAgentRole(agentId: string, role: 'admin' | 'agent'): Promise<AgentWithStats> {
    const client = assertSupabase();
    const current = await getCurrentAdminProfile();
    if (agentId === current.id && role !== 'admin') throw new Error('Vous ne pouvez pas retirer votre propre role admin.');

    const { data, error } = await client
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() } as TablesUpdate<'profiles'> as never)
      .eq('id', agentId)
      .eq('agency_id', current.agency_id as string)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    await logAdminAction('agent_role_updated', 'profile', agentId, { role });
    return { ...(data as AgentRow), stats: await agentsService.getAgentStats(agentId) };
  },

  async createInvitation({ email, role }: CreateInvitationInput): Promise<InvitationResult> {
    const client = assertSupabase();
    const profile = await getCurrentAdminProfile();
    const payload: TablesInsert<'agency_invitations'> = {
      agency_id: profile.agency_id as string,
      invited_by: profile.id,
      email: normalizeEmail(email),
      role,
      status: 'pending',
    };

    const { data, error } = await client
      .from('agency_invitations')
      .insert(payload as never)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    const invitation = data as InvitationRow;
    await logAdminAction('invitation_created', 'agency_invitation', invitation.id, { email: invitation.email, role });
    const baseUrl = typeof window === 'undefined' ? 'http://localhost:3000/' : `${window.location.origin}${window.location.pathname}`;
    return {
      invitation,
      link: `${baseUrl}#invite?token=${encodeURIComponent(invitation.token)}`,
    };
  },
};
