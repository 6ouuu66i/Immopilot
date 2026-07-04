import { useCallback, useEffect, useId, useState } from 'react';
import { useAuth } from './auth';
import { supabase } from './supabase';
import {
  notificationsService,
  type NotificationRow,
} from './services/notificationsService';

export interface UseNotificationsResult {
  notifications: NotificationRow[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
}

function sortNotifications(notifications: NotificationRow[]) {
  return [...notifications].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function mergeNotification(current: NotificationRow[], notification: NotificationRow) {
  const exists = current.some((item) => item.id === notification.id);
  return sortNotifications(exists
    ? current.map((item) => (item.id === notification.id ? notification : item))
    : [notification, ...current]);
}

function unread(notifications: NotificationRow[]) {
  return notifications.filter((notification) => !notification.is_read).length;
}

export function useNotifications(limit = 10): UseNotificationsResult {
  const { user } = useAuth();
  const subscriptionId = useId();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [nextNotifications, nextUnreadCount] = await Promise.all([
        notificationsService.listNotifications({ limit }),
        notificationsService.getUnreadCount(),
      ]);
      setNotifications(nextNotifications);
      setUnreadCount(nextUnreadCount);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Chargement des notifications impossible.');
    } finally {
      setIsLoading(false);
    }
  }, [limit, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!supabase || !user) return undefined;

    const channel = supabase
      .channel(`notifications:${user.id}:${subscriptionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as NotificationRow;
          setNotifications((current) => mergeNotification(current, notification).slice(0, limit));
          setUnreadCount((current) => current + (notification.is_read ? 0 : 1));
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          setError('Realtime notifications indisponible. Verifie la publication Supabase.');
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [limit, subscriptionId, user]);

  const markAsRead = useCallback(async (notificationId: string) => {
    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;
    const target = notifications.find((notification) => notification.id === notificationId);
    if (!target || target.is_read) return;

    setError(null);
    setNotifications((current) => current.map((notification) => (
      notification.id === notificationId
        ? { ...notification, is_read: true, read_at: new Date().toISOString() }
        : notification
    )));
    setUnreadCount((current) => Math.max(0, current - 1));

    try {
      await notificationsService.markAsRead(notificationId);
    } catch (markError) {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      const message = markError instanceof Error ? markError.message : 'Marquage impossible.';
      setError(message);
      throw new Error(message);
    }
  }, [notifications, unreadCount]);

  const markAllAsRead = useCallback(async () => {
    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;

    setError(null);
    setNotifications((current) => current.map((notification) => (
      notification.is_read ? notification : { ...notification, is_read: true, read_at: new Date().toISOString() }
    )));
    setUnreadCount(0);

    try {
      await notificationsService.markAllAsRead();
    } catch (markError) {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      const message = markError instanceof Error ? markError.message : 'Marquage global impossible.';
      setError(message);
      throw new Error(message);
    }
  }, [notifications, unreadCount]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;
    const target = notifications.find((notification) => notification.id === notificationId);

    setError(null);
    setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
    if (target && !target.is_read) setUnreadCount((current) => Math.max(0, current - 1));

    try {
      await notificationsService.deleteNotification(notificationId);
    } catch (deleteError) {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      const message = deleteError instanceof Error ? deleteError.message : 'Suppression impossible.';
      setError(message);
      throw new Error(message);
    }
  }, [notifications, unreadCount]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
}
