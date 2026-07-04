import {
  Bell,
  ArrowLeftRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronLeft,
  CircleDollarSign,
  ContactRound,
  Filter,
  Home,
  Layers3,
  ListChecks,
  LogOut,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Shield,
  UsersRound,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import type { store as appStore } from '../lib/store';
import { resolveNotificationUrl, type NotificationRow } from '../lib/services/notificationsService';
import { useNotifications } from '../lib/useNotifications';

type Store = typeof appStore;

interface AppShellProps {
  activeRoute: string;
  children: ReactNode;
  store: Store;
}

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: typeof Home;
  count?: number;
}

const mainNav: NavItem[] = [
  { key: 'dashboard', label: 'Tableau de bord', href: '#dashboard', icon: Home },
];

const prospectNav: NavItem[] = [
  { key: 'biens', label: 'Biens', href: '#biens', icon: Building2 },
];

const crmNav: NavItem[] = [
  { key: 'pipeline', label: 'Opportunités', href: '#pipeline', icon: BriefcaseBusiness },
  { key: 'contacts', label: 'Contacts', href: '#contacts', icon: ContactRound },
  { key: 'agenda', label: 'Tâches', href: '#agenda', icon: ListChecks },
  { key: 'transfers', label: 'Transferts', href: '#transfers', icon: ArrowLeftRight },
  { key: 'commissions', label: 'Commissions', href: '#commissions', icon: CircleDollarSign },
];

const settingsNav: NavItem[] = [
  { key: 'filters', label: 'Filtres', href: '#biens', icon: Filter },
  { key: 'team', label: 'Équipe', href: '#contacts', icon: UsersRound },
  { key: 'settings', label: 'Paramètres', href: '#settings', icon: Settings },
];

const adminNav: NavItem = { key: 'admin', label: 'Admin', href: '#admin', icon: Shield };

export function AppShell({ activeRoute, children, store }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('ip_sidebar_collapsed') === 'true');
  const [, refreshShell] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const collapsedRef = useRef(collapsed);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const shouldRestoreSidebarRef = useRef(false);
  const { agency, profile, signOut } = useAuth();
  const notificationsState = useNotifications(10);
  const visibleSettingsNav = profile?.role === 'admin' ? [...settingsNav, adminNav] : settingsNav;
  const unreadNotifications = notificationsState.unreadCount;
  const agentName = profile?.full_name ?? profile?.email ?? 'Agent ImmoPilot';
  const agentSubtitle = agency?.name ?? (profile?.role === 'admin' ? 'Administrateur' : 'Conseiller agence');
  const agentInitials = agentName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const today = useMemo(
    () =>
      new Intl.DateTimeFormat('fr-BE', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      }).format(new Date()),
    [],
  );

  useEffect(() => {
    collapsedRef.current = collapsed;
    localStorage.setItem('ip_sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const refresh = () => refreshShell((value) => value + 1);

    window.addEventListener('ip-agent-changed', refresh);
    window.addEventListener('ip-notification-received', refresh);

    return () => {
      window.removeEventListener('ip-agent-changed', refresh);
      window.removeEventListener('ip-notification-received', refresh);
    };
  }, []);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!notificationsRef.current?.contains(event.target as Node)) setNotificationsOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  async function handleSignOut() {
    await signOut();
    window.location.hash = '#login';
  }

  async function handleOpenNotification(notification: NotificationRow) {
    await notificationsState.markAsRead(notification.id).catch(() => undefined);
    const url = await resolveNotificationUrl(notification);
    setNotificationsOpen(false);
    window.location.hash = url;
  }

  useEffect(() => {
    const handlePropertyPanelOpen = () => {
      if (shouldRestoreSidebarRef.current) return;

      shouldRestoreSidebarRef.current = !collapsedRef.current;
      if (!collapsedRef.current) setCollapsed(true);
    };

    const handlePropertyPanelClose = () => {
      if (shouldRestoreSidebarRef.current) setCollapsed(false);
      shouldRestoreSidebarRef.current = false;
    };

    window.addEventListener('ip-property-panel-open', handlePropertyPanelOpen);
    window.addEventListener('ip-property-panel-close', handlePropertyPanelClose);

    return () => {
      window.removeEventListener('ip-property-panel-open', handlePropertyPanelOpen);
      window.removeEventListener('ip-property-panel-close', handlePropertyPanelClose);
    };
  }, []);

  return (
    <div className={`ip-shell app ${collapsed ? 'is-collapsed' : ''}`}>
      <aside className="ip-sidebar" aria-label="Navigation principale">
        <div className="ip-sidebar-brand">
          <a className="ip-brand-lockup" href="#dashboard" aria-label="ImmoPilot Dashboard">
            <span className="ip-brand-mark" aria-hidden="true">
              <Building2 size={18} strokeWidth={1.9} />
            </span>
            <span className="ip-brand-copy">
              <span className="ip-brand-name">ImmoPilot</span>
              <span className="ip-brand-sub">Prospection CRM</span>
            </span>
          </a>
          <button
            className="ip-icon-button"
            type="button"
            aria-label={collapsed ? 'Ouvrir la sidebar' : 'Replier la sidebar'}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>

        <nav className="ip-sidebar-nav" aria-label="Workspace">
          <div className="ip-nav-group">
            {mainNav.map((item) => (
              <SidebarLink key={item.key} item={item} active={activeRoute === item.key} />
            ))}
          </div>

          <div className="ip-nav-group">
            <div className="ip-nav-group-label">Prospection</div>
            {prospectNav.map((item) => (
              <SidebarLink key={item.key} item={item} active={activeRoute === item.key} />
            ))}
          </div>

          <div className="ip-nav-group">
            <div className="ip-nav-group-label">CRM</div>
            {crmNav.map((item) => (
              <SidebarLink key={item.key} item={item} active={activeRoute === item.key} />
            ))}
          </div>

          <div className="ip-nav-group ip-saved-views">
            <div className="ip-nav-group-label">Paramètres</div>
            {visibleSettingsNav.map((item) => (
              <SidebarLink key={item.key} item={item} active={activeRoute === item.key} />
            ))}
          </div>
        </nav>

        <div className="ip-sidebar-note" aria-hidden="true">
          <span className="ip-sidebar-note-icon">
            <Layers3 size={16} />
          </span>
          <div>
            <strong>Vue active</strong>
            <p>Biens à traiter cette semaine</p>
          </div>
        </div>

        <div className="ip-sidebar-footer">
          <a className="ip-sidebar-link" href="#settings">
            <Settings size={17} />
            <span>Paramètres</span>
          </a>

          <div className="ip-agent-card">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span className="ip-agent-avatar">{agentInitials}</span>}
            <div className="ip-agent-meta">
              <strong>{agentName}</strong>
              <span>{agentSubtitle}</span>
            </div>
            <ChevronLeft size={15} />
          </div>

          <button className="ip-sidebar-link ip-signout-button" type="button" onClick={handleSignOut}>
            <LogOut size={17} />
            <span>Se déconnecter</span>
          </button>
        </div>
      </aside>

      <div className="ip-workspace">
        <header className="ip-topbar">
          <div className="ip-topbar-left">
            <span className="ip-breadcrumb">Workspace</span>
          </div>
          <label className="ip-command-search">
            <Search size={16} strokeWidth={1.9} />
            <input type="search" placeholder="Rechercher un bien, contact, signal..." />
            <kbd>Ctrl K</kbd>
          </label>
          <div className="ip-topbar-right">
            <span className="ip-date-chip">
              <CalendarDays size={15} />
              {today}
            </span>
            <div className="ip-notification-menu" ref={notificationsRef}>
              <button
                className="ip-icon-button"
                type="button"
                aria-label="Notifications"
                onClick={() => setNotificationsOpen((value) => !value)}
              >
                <Bell size={17} />
                {unreadNotifications > 0 && (
                  <span className="ip-notification-count">{unreadNotifications > 9 ? '9+' : unreadNotifications}</span>
                )}
              </button>

              {notificationsOpen && (
                <div className="ip-notification-dropdown">
                  <header className="ip-notification-dropdown-head">
                    <div>
                      <strong>Notifications</strong>
                      <span>{unreadNotifications} non lue{unreadNotifications > 1 ? 's' : ''}</span>
                    </div>
                    <button type="button" onClick={() => { void notificationsState.markAllAsRead(); }}>
                      Tout marquer lu
                    </button>
                  </header>

                  {notificationsState.error && <div className="ip-notification-error">{notificationsState.error}</div>}

                  <div className="ip-notification-list">
                    {notificationsState.isLoading ? (
                      <div className="ip-notification-empty">Chargement...</div>
                    ) : notificationsState.notifications.length === 0 ? (
                      <div className="ip-notification-empty">Aucune notification.</div>
                    ) : (
                      notificationsState.notifications.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          className={`ip-notification-item ${notification.is_read ? '' : 'is-unread'}`}
                          onClick={() => { void handleOpenNotification(notification); }}
                        >
                          <NotificationIcon type={notification.type} />
                          <span>
                            <strong>{notification.title}</strong>
                            {notification.body && <small>{notification.body}</small>}
                            <em>{formatNotificationTime(notification.created_at)}</em>
                          </span>
                        </button>
                      ))
                    )}
                  </div>

                  <footer className="ip-notification-dropdown-foot">
                    <a href="#notifications" onClick={() => setNotificationsOpen(false)}>Voir toutes les notifications</a>
                  </footer>
                </div>
              )}
            </div>
          </div>
        </header>

        <main id="app-content" className="ip-content">
          {children}
        </main>
      </div>
    </div>
  );
}

function NotificationIcon({ type }: { type: string }) {
  if (type.includes('task')) return <ListChecks size={15} />;
  if (type.includes('deal') || type.includes('transfer')) return <BriefcaseBusiness size={15} />;
  if (type.includes('commission')) return <Building2 size={15} />;
  return <Megaphone size={15} />;
}

function formatNotificationTime(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return 'A l’instant';
  if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `Il y a ${diffHours} h`;
  return new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: 'short' }).format(date);
}

interface SidebarLinkProps {
  active: boolean;
  item: NavItem;
}

function SidebarLink({ active, item }: SidebarLinkProps) {
  const Icon = item.icon;

  return (
    <a className={`ip-sidebar-link ${active ? 'is-active' : ''}`} href={item.href} data-page={item.key}>
      <Icon size={17} strokeWidth={1.9} />
      <span>{item.label}</span>
      {item.count !== undefined && <span className="ip-nav-count">{item.count}</span>}
    </a>
  );
}
