import {
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChartColumn,
  ChevronLeft,
  CircleHelp,
  ContactRound,
  Filter,
  Home,
  Layers3,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  UsersRound,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { store as appStore } from '../lib/store';

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
];

const analyticsNav: NavItem[] = [
  { key: 'stats', label: 'Statistiques', href: '#dashboard', icon: ChartColumn },
];

const settingsNav: NavItem[] = [
  { key: 'filters', label: 'Filtres', href: '#biens', icon: Filter },
  { key: 'team', label: 'Équipe', href: '#contacts', icon: UsersRound },
  { key: 'settings', label: 'Paramètres', href: '#settings', icon: Settings },
];

export function AppShell({ activeRoute, children, store }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('ip_sidebar_collapsed') === 'true');
  const collapsedRef = useRef(collapsed);
  const shouldRestoreSidebarRef = useRef(false);
  const currentAgent = store.getCurrentAgent();
  const unreadNotifications = store.getNotifications().filter((notification) => !notification.read).length;
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

          <div className="ip-nav-group">
            <div className="ip-nav-group-label">Analytique</div>
            {analyticsNav.map((item) => (
              <SidebarLink key={item.key} item={item} active={activeRoute === item.key} />
            ))}
          </div>

          <div className="ip-nav-group ip-saved-views">
            <div className="ip-nav-group-label">Paramètres</div>
            {settingsNav.map((item) => (
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
          <a className="ip-sidebar-link" href="#notifications">
            <Bell size={17} />
            <span>Alertes</span>
            {unreadNotifications > 0 && <span className="ip-nav-count">{unreadNotifications}</span>}
          </a>
          <a className="ip-sidebar-link" href="#settings">
            <Settings size={17} />
            <span>Paramètres</span>
          </a>
          <button className="ip-sidebar-link" type="button">
            <CircleHelp size={17} />
            <span>Aide</span>
          </button>

          <div className="ip-agent-card">
            <img src={currentAgent.avatar} alt="" />
            <div className="ip-agent-meta">
              <strong>{currentAgent.name}</strong>
              <span>{currentAgent.role === 'admin' ? 'Administrateur' : 'Conseiller agence'}</span>
            </div>
            <ChevronLeft size={15} />
          </div>
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
            <a className="ip-icon-button" href="#notifications" aria-label="Notifications">
              <Bell size={17} />
              {unreadNotifications > 0 && <span className="ip-dot" />}
            </a>
          </div>
        </header>

        <main id="app-content" className="ip-content">
          {children}
        </main>
      </div>
    </div>
  );
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
