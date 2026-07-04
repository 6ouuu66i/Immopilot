import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Circle,
  Home,
  Lightbulb,
  ListFilter,
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
  Star,
  TrendingDown,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ScoreRing } from '../components/biens/ScoreRing';
import { useAuth } from '../lib/auth';
import { listDashboardOpportunities, type DashboardOpportunity } from '../lib/services/dashboardService';
import type { store as appStore } from '../lib/store';
import { usePropertyMarks } from '../lib/usePropertyMarks';
import { taskToView, useTasks } from '../lib/useTasks';
import type { Task } from '../types';

type Store = typeof appStore;

interface DashboardProps {
  store: Store;
}

interface KpiCard {
  accent: 'blue' | 'green' | 'amber' | 'violet';
  delta: string;
  icon: typeof Home;
  label: string;
  value: string;
}

const currencyFormatter = new Intl.NumberFormat('fr-BE', {
  currency: 'EUR',
  maximumFractionDigits: 0,
  style: 'currency',
});

function formatCurrency(value: number | null): string {
  if (typeof value !== 'number') return '-';
  return currencyFormatter.format(value).replace(/\s?EUR/, ' EUR').replace(/\u00A0/g, ' ');
}

function formatSurface(value: number | null): string {
  return typeof value === 'number' && value > 0 ? `${Math.round(value)} m2` : '-';
}

function formatAddedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.max(0, Math.round(diffMs / 36e5));
  if (diffHours < 1) return "A l'instant";
  if (diffHours < 24) return `Il y a ${diffHours} h`;
  const diffDays = Math.round(diffHours / 24);
  return `Il y a ${diffDays} j`;
}

function cleanText(value: string): string {
  return value
    .replaceAll('ÃƒÂ©', 'e')
    .replaceAll('ÃƒÂ¨', 'e')
    .replaceAll('ÃƒÂª', 'e')
    .replaceAll('ÃƒÂ ', 'a')
    .replaceAll('ÃƒÂ§', 'c')
    .replaceAll('Ã¢â€šÂ¬', 'EUR')
    .replaceAll('Ã‚Â·', '-')
    .replaceAll('Ã‚Â²', '2');
}

function useDashboardData(supabaseTodayTasks: Task[], overdueCount: number) {
  return useMemo(() => {
    const kpis: KpiCard[] = [
      {
        accent: 'blue',
        delta: 'En attente',
        icon: Home,
        label: 'Nouveaux biens',
        value: '-',
      },
      {
        accent: 'green',
        delta: 'En attente',
        icon: TrendingDown,
        label: 'Opportunites chaudes',
        value: '-',
      },
      {
        accent: 'amber',
        delta: 'En attente',
        icon: TrendingDown,
        label: 'Baisses de prix',
        value: '-',
      },
      {
        accent: 'violet',
        delta: 'En retard',
        icon: CalendarClock,
        label: 'Taches en retard',
        value: String(overdueCount),
      },
    ];

    const todayTasks = supabaseTodayTasks
      .slice()
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
      .slice(0, 6);

    return { kpis, todayTasks };
  }, [overdueCount, supabaseTodayTasks]);
}

export function Dashboard({ store }: DashboardProps) {
  const { profile } = useAuth();
  const todayTasksState = useTasks({ scope: 'today' });
  const overdueTasksState = useTasks({ scope: 'overdue' });
  const todayTaskViews = useMemo(() => todayTasksState.tasks.map(taskToView), [todayTasksState.tasks]);
  const { kpis, todayTasks } = useDashboardData(todayTaskViews, overdueTasksState.tasks.length);
  const propertyMarks = usePropertyMarks();
  const [opportunities, setOpportunities] = useState<DashboardOpportunity[]>([]);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(true);
  const [opportunitiesError, setOpportunitiesError] = useState<string | null>(null);
  const firstName = (profile?.full_name ?? profile?.email ?? 'Agent').split(' ')[0] || 'Agent';

  useEffect(() => {
    let active = true;
    setOpportunitiesLoading(true);
    listDashboardOpportunities(8)
      .then((items) => {
        if (!active) return;
        setOpportunities(items);
        setOpportunitiesError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setOpportunities([]);
        setOpportunitiesError(error instanceof Error ? error.message : 'Impossible de charger les opportunites.');
      })
      .finally(() => {
        if (active) setOpportunitiesLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="ip-dashboard ip-dashboard-wow">
      <section className="ip-wow-content">
        <div className="ip-wow-top">
          <section className="ip-wow-hero">
            <div className="ip-wow-title">
              <span className="ip-wow-page-icon" aria-hidden="true">
                <ListFilter size={24} />
              </span>
              <div>
                <h1>Tableau de bord</h1>
                <p>Bonjour {firstName}, voici vos opportunites du jour.</p>
              </div>
            </div>
          </section>

          <section className="ip-focus-card" aria-label="Focus du jour">
            <span className="ip-focus-star" aria-hidden="true">
              <Star size={18} />
            </span>
            <div>
              <strong>Focus du jour</strong>
              <p>Aucun signal fort detecte aujourd'hui. Les alertes apparaitront ici quand le moteur de detection sera actif.</p>
            </div>
            <a href="#biens">
              Voir les biens
              <ArrowUpRight size={15} />
            </a>
          </section>
        </div>

        <div className="ip-wow-main">
          <section className="ip-wow-kpis" aria-label="Indicateurs principaux">
            {kpis.map((kpi) => (
              <KpiCardView key={kpi.label} kpi={kpi} />
            ))}
          </section>

          <div className="ip-wow-table-zone">
            <article className="ip-wow-table-card">
              <header className="ip-view-bar">
                <nav aria-label="Vues des opportunites">
                  <a className="is-active" href="#dashboard">
                    Toutes les opportunites
                  </a>
                  <a href="#biens">Nouveaux biens <span>-</span></a>
                  <a href="#biens">Baisses de prix <span>-</span></a>
                  <a href="#biens">Favoris <Star size={13} /> <span>{propertyMarks.favorites.length}</span></a>
                  <a href="#agenda">A contacter <span>{todayTasks.length}</span></a>
                </nav>
                <div className="ip-view-tools">
                  <button type="button">
                    <ListFilter size={14} />
                    Filtrer
                  </button>
                  <button type="button">Trier</button>
                  <button type="button" aria-label="Parametres de vue">
                    <SlidersHorizontal size={15} />
                  </button>
                </div>
              </header>

              <OpportunityTable
                error={opportunitiesError}
                isLoading={opportunitiesLoading}
                opportunities={opportunities}
              />

              <a className="ip-load-more" href="#biens">
                Voir plus de biens
                <ChevronDown size={16} />
              </a>
            </article>
          </div>
        </div>

        <aside className="ip-wow-rail" aria-label="Taches et signaux">
          <Panel title="Taches du jour" count={todayTasks.length} actionIcon={Plus}>
            <div className="ip-wow-task-list">
              {todayTasks.length === 0 ? (
                <div className="ip-dashboard-empty">Aucune tache prevue aujourd'hui.</div>
              ) : (
                todayTasks.map((task) => (
                  <TaskRow key={task.id} store={store} task={task} onToggle={() => { void todayTasksState.toggleTask(task.id); }} />
                ))
              )}
            </div>
            <a className="ip-side-link" href="#agenda">Voir toutes les taches</a>
          </Panel>

          <Panel title="Signaux a surveiller" count={0}>
            <div className="ip-dashboard-empty">
              Les signaux apparaitront ici quand le moteur de detection sera actif.
            </div>
            <a className="ip-side-link" href="#biens">Voir tous les signaux</a>
          </Panel>

          <a className="ip-tip-card" href="#settings">
            <span>
              <Lightbulb size={22} />
            </span>
            <div>
              <strong>Astuce ImmoPilot</strong>
              <p>Activez les alertes proprietaires motives pour ne rien manquer.</p>
            </div>
            <ArrowUpRight size={16} />
          </a>
        </aside>
      </section>
    </div>
  );
}

interface PanelProps {
  actionIcon?: typeof Plus;
  children: ReactNode;
  count?: number;
  title: string;
}

function Panel({ actionIcon: ActionIcon, children, count, title }: PanelProps) {
  return (
    <article className="ip-side-panel">
      <header className="ip-side-header">
        <h2>{title}</h2>
        {count !== undefined && <span>{count}</span>}
        {ActionIcon && (
          <button type="button" aria-label={`Ajouter ${title}`}>
            <ActionIcon size={16} />
          </button>
        )}
      </header>
      {children}
    </article>
  );
}

function KpiCardView({ kpi }: { kpi: KpiCard }) {
  const Icon = kpi.icon;

  return (
    <article className={`ip-wow-kpi accent-${kpi.accent}`}>
      <span className="ip-wow-kpi-icon">
        <Icon size={25} />
      </span>
      <div>
        <p>{kpi.label}</p>
        <strong>{kpi.value}</strong>
        <small>{kpi.delta}</small>
      </div>
    </article>
  );
}

function OpportunityTable({
  error,
  isLoading,
  opportunities,
}: {
  error: string | null;
  isLoading: boolean;
  opportunities: DashboardOpportunity[];
}) {
  if (isLoading) {
    return <div className="ip-dashboard-empty">Chargement des opportunites Supabase...</div>;
  }

  if (error) {
    return <div className="ip-dashboard-empty is-error">{error}</div>;
  }

  if (opportunities.length === 0) {
    return <div className="ip-dashboard-empty">Vos opportunites apparaitront ici apres le premier scraping.</div>;
  }

  return (
    <div className="ip-wow-table">
      <div className="ip-wow-table-head" aria-hidden="true">
        <span />
        <span>Bien</span>
        <span>Source</span>
        <span>Prix</span>
        <span>Surface</span>
        <span>Signal</span>
        <span>Score</span>
        <span>Ajoute le</span>
        <span />
      </div>
      {opportunities.map((opportunity) => (
        <OpportunityRow key={opportunity.id} opportunity={opportunity} />
      ))}
    </div>
  );
}

function OpportunityRow({ opportunity }: { opportunity: DashboardOpportunity }) {
  return (
    <a className="ip-wow-row" href={opportunity.propertyId ? `#biens?propertyId=${opportunity.propertyId}` : '#biens'}>
      <span className="ip-checkbox" />
      <span className="ip-property-cell">
        {opportunity.photo ? <img src={opportunity.photo} alt="" /> : <span className="ip-property-placeholder" />}
        <span>
          <strong>{cleanText(opportunity.title)}</strong>
          <small>{cleanText(opportunity.subtitle)}</small>
        </span>
      </span>
      <Badge tone="source">{cleanText(opportunity.source)}</Badge>
      <span className="ip-table-price">{formatCurrency(opportunity.price)}</span>
      <span>{formatSurface(opportunity.surface)}</span>
      <Badge tone={opportunity.signal === 'Baisse de prix' ? 'price' : opportunity.signal === 'FSBO' ? 'context' : 'score'}>
        {cleanText(opportunity.signal)}
      </Badge>
      <ScoreRing score={opportunity.score} size="sm" />
      <span>{formatAddedAt(opportunity.addedAt)}</span>
      <MoreHorizontal size={16} />
    </a>
  );
}

function TaskRow({ store, task, onToggle }: { store: Store; task: Task; onToggle: () => void }) {
  const relatedProperty = task.propertyId ? store.getProperty(task.propertyId) : undefined;

  return (
    <button className="ip-wow-task" type="button" onClick={onToggle}>
      <span className={`ip-task-check ${task.done ? 'is-done' : ''}`}>
        {task.done ? <CheckCircle2 size={15} /> : <Circle size={15} />}
      </span>
      <span>
        <strong>{cleanText(task.title)}</strong>
        <small>
          {task.time}
          {relatedProperty ? ` - ${cleanText(relatedProperty.city)}` : task.place ? ` - ${cleanText(task.place)}` : ''}
        </small>
      </span>
    </button>
  );
}

interface BadgeProps {
  children: ReactNode;
  tone: 'alert' | 'behavior' | 'context' | 'neutral' | 'price' | 'score' | 'scoreGood' | 'source';
}

function Badge({ children, tone }: BadgeProps) {
  return <span className={`ip-wow-badge tone-${tone}`}>{children}</span>;
}
