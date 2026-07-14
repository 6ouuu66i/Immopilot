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

// F-002: outcome codes for accept_invitation(). Never carries the raw token or the raw
// Postgres error text -- messages are static, mapped strings only, so no server-side
// detail (including the invitation's own SQLSTATE text) can leak into the UI verbatim.
export type AcceptInvitationErrorCode =
  | 'not_authenticated'
  | 'invalid_token'
  | 'not_found'
  | 'already_used'
  | 'expired'
  | 'email_mismatch'
  | 'profile_not_found'
  | 'already_in_agency'
  | 'integrity_error'
  | 'unknown';

export class AcceptInvitationError extends Error {
  code: AcceptInvitationErrorCode;

  constructor(code: AcceptInvitationErrorCode, message: string) {
    super(message);
    this.name = 'AcceptInvitationError';
    this.code = code;
  }
}

// Maps the SQLSTATE codes raised by public.accept_invitation() (see supabase/migrations/
// 20260712050000_create_accept_invitation_function.sql) to a stable outcome code.
const ACCEPT_INVITATION_SQLSTATE_MAP: Record<string, AcceptInvitationErrorCode> = {
  '42501': 'not_authenticated',
  IPV01: 'invalid_token',
  IPV02: 'not_found',
  IPV03: 'already_used',
  IPV04: 'expired',
  IPV05: 'email_mismatch',
  IPV06: 'profile_not_found',
  IPV07: 'already_in_agency',
  IPV08: 'integrity_error',
};

const RESUME_INVITATION_STATUS_MAP: Record<string, AcceptInvitationErrorCode> = {
  not_authenticated: 'not_authenticated',
  invalid_token: 'invalid_token',
  not_found: 'not_found',
  already_used: 'already_used',
  expired: 'expired',
  email_mismatch: 'email_mismatch',
  profile_not_found: 'profile_not_found',
  already_in_agency: 'already_in_agency',
  integrity_error: 'integrity_error',
  unknown: 'unknown',
};

function acceptInvitationMessageForCode(code: AcceptInvitationErrorCode): string {
  switch (code) {
    case 'not_authenticated':
      return 'Vous devez être connecté pour accepter cette invitation.';
    case 'invalid_token':
      return "Ce lien d'invitation n'est pas valide.";
    case 'not_found':
      return 'Cette invitation est introuvable ou a été annulée.';
    case 'already_used':
      return 'Cette invitation a déjà été utilisée.';
    case 'expired':
      return "Cette invitation a expiré. Demandez à votre administrateur d'en générer une nouvelle.";
    case 'email_mismatch':
      return 'Cette invitation a été envoyée à une autre adresse e-mail. Connectez-vous avec le compte correspondant.';
    case 'profile_not_found':
      return 'Profil introuvable pour ce compte.';
    case 'already_in_agency':
      return 'Ce compte est déjà rattaché à une agence.';
    case 'integrity_error':
    case 'unknown':
    default:
      return "Une erreur est survenue lors de l'acceptation de l'invitation. Réessayez ou contactez votre administrateur.";
  }
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

  // F-002: consumed by src/pages/InviteAccept.tsx. Requires an authenticated session
  // (the RPC itself enforces auth.uid() IS NOT NULL); the token is passed through as a
  // plain RPC argument -- it is never logged, never included in an error message here,
  // and never persisted beyond this call.
  async acceptInvitation(token: string): Promise<void> {
    const client = assertSupabase();
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      throw new AcceptInvitationError('invalid_token', acceptInvitationMessageForCode('invalid_token'));
    }

    // accept_invitation is not yet present in the generated Supabase types
    // (src/lib/database.types.ts) since it is applied after this file is written;
    // regenerate types once the migration lands. These `as never` casts only bypass the
    // literal RPC-name/args union check -- they do not affect runtime behavior.
    const { error } = await client.rpc(
      'accept_invitation' as never,
      { p_token: trimmedToken } as never,
    );

    if (error) {
      const rawCode = (error as { code?: string }).code ?? '';
      const code = ACCEPT_INVITATION_SQLSTATE_MAP[rawCode] ?? 'unknown';
      throw new AcceptInvitationError(code, acceptInvitationMessageForCode(code));
    }
  },

  // F-006: after email confirmation the browser no longer has the bearer token. The
  // server-side resume context is keyed by auth.uid(), contains only an invitation ID,
  // and delegates the actual mutation to accept_invitation(token) atomically.
  async resumeInvitationSignup(): Promise<void> {
    const client = assertSupabase();
    const { data, error } = await client.rpc('resume_invitation_signup' as never);

    if (error) {
      throw new AcceptInvitationError('unknown', acceptInvitationMessageForCode('unknown'));
    }

    const result = data as unknown;
    const status = typeof result === 'string' ? result : 'unknown';
    if (status === 'accepted') return;

    const code = RESUME_INVITATION_STATUS_MAP[status] ?? 'unknown';
    throw new AcceptInvitationError(code, acceptInvitationMessageForCode(code));
  },
};
