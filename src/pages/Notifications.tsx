import { Bell, BriefcaseBusiness, CheckCheck, ListChecks, Megaphone, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { resolveNotificationUrl, type NotificationRow } from '../lib/services/notificationsService';
import { useNotifications } from '../lib/useNotifications';

type NotificationFilter = 'all' | 'unread' | string;

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-BE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function iconFor(type: string) {
  if (type.includes('task')) return <ListChecks size={16} />;
  if (type.includes('deal') || type.includes('transfer')) return <BriefcaseBusiness size={16} />;
  return <Megaphone size={16} />;
}

function typeLabel(type: string) {
  return type.replaceAll('_', ' ');
}

export function Notifications() {
  const notificationsState = useNotifications(100);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [search, setSearch] = useState('');

  const types = useMemo(() => {
    const set = new Set(notificationsState.notifications.map((notification) => notification.type));
    return Array.from(set).sort();
  }, [notificationsState.notifications]);

  const visibleNotifications = useMemo(() => {
    const query = search.trim().toLowerCase();
    return notificationsState.notifications.filter((notification) => {
      if (filter === 'unread' && notification.is_read) return false;
      if (filter !== 'all' && filter !== 'unread' && notification.type !== filter) return false;
      if (!query) return true;
      return [notification.title, notification.body ?? '', notification.type]
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [filter, notificationsState.notifications, search]);

  const openNotification = async (notification: NotificationRow) => {
    await notificationsState.markAsRead(notification.id).catch(() => undefined);
    window.location.hash = await resolveNotificationUrl(notification);
  };

  return (
    <main className="notifications-page">
      <header className="notifications-header">
        <div>
          <span className="notifications-eyebrow"><Bell size={15} /> Centre d'alertes</span>
          <h1>Notifications</h1>
          <p>Suivez les alertes, transferts, tâches et événements commerciaux de votre espace.</p>
        </div>
        <button type="button" onClick={() => { void notificationsState.markAllAsRead(); }}>
          <CheckCheck size={15} />
          Tout marquer comme lu
        </button>
      </header>

      <section className="notifications-toolbar">
        <label className="notifications-search">
          <Search size={15} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher une notification..." />
        </label>
        <div className="notifications-tabs">
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} label="Toutes" count={notificationsState.notifications.length} />
          <FilterButton active={filter === 'unread'} onClick={() => setFilter('unread')} label="Non lues" count={notificationsState.unreadCount} />
          {types.map((type) => (
            <FilterButton
              key={type}
              active={filter === type}
              onClick={() => setFilter(type)}
              label={typeLabel(type)}
              count={notificationsState.notifications.filter((notification) => notification.type === type).length}
            />
          ))}
        </div>
      </section>

      {notificationsState.error && <div className="notifications-error">{notificationsState.error}</div>}

      <section className="notifications-list-page">
        {notificationsState.isLoading ? (
          <div className="notifications-empty">Chargement des notifications...</div>
        ) : visibleNotifications.length === 0 ? (
          <div className="notifications-empty">Aucune notification dans cette vue.</div>
        ) : (
          visibleNotifications.map((notification) => (
            <article key={notification.id} className={`notifications-row ${notification.is_read ? '' : 'is-unread'}`}>
              <button type="button" className="notifications-row-main" onClick={() => { void openNotification(notification); }}>
                <span className="notifications-row-icon">{iconFor(notification.type)}</span>
                <span className="notifications-row-copy">
                  <span>
                    <strong>{notification.title}</strong>
                    {!notification.is_read && <i>Non lue</i>}
                  </span>
                  {notification.body && <small>{notification.body}</small>}
                  <em>{typeLabel(notification.type)} - {formatDate(notification.created_at)}</em>
                </span>
              </button>
              <div className="notifications-row-actions">
                {!notification.is_read && (
                  <button type="button" onClick={() => { void notificationsState.markAsRead(notification.id); }}>Lu</button>
                )}
                <button type="button" aria-label="Supprimer" onClick={() => { void notificationsState.deleteNotification(notification.id); }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

function FilterButton({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button type="button" className={active ? 'active' : ''} onClick={onClick}>
      {label}
      <span>{count}</span>
    </button>
  );
}
