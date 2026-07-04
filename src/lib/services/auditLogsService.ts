import type { Json, Tables } from '../database.types';
import { assertSupabase, getCurrentAdminProfile } from './adminUtils';

export type AuditLogRow = Tables<'audit_logs'>;
type ProfileRow = Tables<'profiles'>;

export interface AuditLogFull extends AuditLogRow {
  actor: Pick<ProfileRow, 'id' | 'full_name' | 'email' | 'avatar_url'> | null;
}

export interface AuditLogFilters {
  action?: string | null;
  actorId?: string | null;
  period?: 'week' | 'month' | 'all';
}

export async function insertAuditLog(action: string, targetType: string, targetId: string | null, payload?: Json | null) {
  const client = assertSupabase();
  const profile = await getCurrentAdminProfile();
  const { error } = await client.from('audit_logs').insert({
    agency_id: profile.agency_id as string,
    actor_id: profile.id,
    action,
    target_type: targetType,
    target_id: targetId,
    payload: payload ?? null,
  } as never);
  if (error) throw new Error(error.message);
}

export const auditLogsService = {
  async list({ action, actorId, period = 'all' }: AuditLogFilters = {}): Promise<AuditLogFull[]> {
    const client = assertSupabase();
    const profile = await getCurrentAdminProfile();
    let query = client
      .from('audit_logs')
      .select('*, actor:profiles!audit_logs_actor_id_fkey(id,full_name,email,avatar_url)')
      .eq('agency_id', profile.agency_id as string)
      .order('created_at', { ascending: false })
      .limit(100);

    if (action) query = query.eq('action', action);
    if (actorId) query = query.eq('actor_id', actorId);
    if (period !== 'all') {
      const since = new Date();
      since.setDate(since.getDate() - (period === 'week' ? 7 : 31));
      query = query.gte('created_at', since.toISOString());
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as AuditLogFull[];
  },
};
