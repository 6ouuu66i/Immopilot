import { supabase } from '../supabase';
import type { Json, Tables, TablesUpdate } from '../database.types';
import { dealsService } from './dealsService';

/**
 * Notification metadata convention:
 * - transfer: { deal_id, deal_reference, requested_by?, to_agent_id?, status?, refusal_reason? }
 * - deal: { deal_reference? } when related_id is not enough or should avoid an extra lookup
 * - property: { property_id? } for future cases where related_id is not the property id
 * - task: { task_id? }
 * - commission: { commission_id? }
 * - generic future notifications may provide { route } or { url } with an internal hash route.
 */
export type NotificationMetadata = Record<string, Json | undefined>;
export type NotificationRow = Tables<'notifications'> & {
  metadata: NotificationMetadata | null;
};
type NotificationUpdate = TablesUpdate<'notifications'>;

export interface ListNotificationsInput {
  unreadOnly?: boolean;
  limit?: number;
}

type MutationError = { message: string } | null;

type UpdateNotificationQuery = {
  update(values: NotificationUpdate): {
    eq(column: 'id' | 'user_id' | 'is_read', value: string | boolean): UpdateNotificationFilter;
  };
};

type UpdateNotificationFilter = {
  eq(column: 'id' | 'user_id' | 'is_read', value: string | boolean): UpdateNotificationFilter;
} & Promise<{ error: MutationError }>;

function assertSupabase() {
  if (!supabase) throw new Error("Supabase n'est pas configure.");
  return supabase;
}

async function getCurrentUserId(): Promise<string> {
  const client = assertSupabase();
  const { data, error } = await client.auth.getUser();
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Utilisateur non connecte.');
  return data.user.id;
}

function getMetadata(notification: NotificationRow): NotificationMetadata {
  if (!notification.metadata || Array.isArray(notification.metadata) || typeof notification.metadata !== 'object') return {};
  return notification.metadata;
}

function getMetadataString(metadata: NotificationMetadata, key: string): string | null {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function internalHashRoute(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith('#')) return value;
  return null;
}

export async function resolveNotificationUrl(notification: NotificationRow): Promise<string> {
  const metadata = getMetadata(notification);
  const explicitRoute = internalHashRoute(getMetadataString(metadata, 'route') ?? getMetadataString(metadata, 'url'));
  if (explicitRoute) return explicitRoute;

  if (!notification.related_type && !notification.related_id) return '#notifications';

  if (notification.related_type === 'deal') {
    const dealReference = getMetadataString(metadata, 'deal_reference');
    if (dealReference) return `#pipeline?deal=${encodeURIComponent(dealReference)}`;
    if (!notification.related_id) return '#pipeline';
    const deal = await dealsService.getDeal(notification.related_id).catch(() => null);
    if (deal?.reference) return `#pipeline?deal=${encodeURIComponent(deal.reference)}`;
    return `#pipeline?dealId=${encodeURIComponent(notification.related_id)}`;
  }

  if (notification.related_type === 'property') {
    const propertyId = getMetadataString(metadata, 'property_id') ?? notification.related_id;
    return propertyId ? `#biens?propertyId=${encodeURIComponent(propertyId)}` : '#biens';
  }

  if (notification.related_type === 'task') {
    const taskId = getMetadataString(metadata, 'task_id') ?? notification.related_id;
    return taskId ? `#agenda?taskId=${encodeURIComponent(taskId)}` : '#agenda';
  }

  if (notification.related_type === 'commission') {
    const commissionId = getMetadataString(metadata, 'commission_id') ?? notification.related_id;
    return commissionId ? `#commissions?commissionId=${encodeURIComponent(commissionId)}` : '#commissions';
  }

  if (notification.related_type === 'transfer') {
    const dealReference = getMetadataString(metadata, 'deal_reference');
    if (dealReference) return `#pipeline?deal=${encodeURIComponent(dealReference)}`;
    return '#pipeline';
  }

  return '#notifications';
}

export const notificationsService = {
  async listNotifications({ unreadOnly = false, limit = 10 }: ListNotificationsInput = {}): Promise<NotificationRow[]> {
    const client = assertSupabase();
    const userId = await getCurrentUserId();
    let query = client
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) query = query.eq('is_read', false);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as NotificationRow[];
  },

  async getUnreadCount(): Promise<number> {
    const client = assertSupabase();
    const userId = await getCurrentUserId();
    const { count, error } = await client
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw new Error(error.message);
    return count ?? 0;
  },

  async markAsRead(notificationId: string): Promise<void> {
    const client = assertSupabase();
    const query = client.from('notifications') as unknown as UpdateNotificationQuery;
    const { error } = await query
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);

    if (error) throw new Error(error.message);
  },

  async markAllAsRead(): Promise<void> {
    const client = assertSupabase();
    const userId = await getCurrentUserId();
    const query = client.from('notifications') as unknown as UpdateNotificationQuery;
    const { error } = await query
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw new Error(error.message);
  },

  async deleteNotification(notificationId: string): Promise<void> {
    const client = assertSupabase();
    const { error } = await client
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) throw new Error(error.message);
  },
};
