import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Circle,
  Filter,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ScoreRing } from '../components/biens/ScoreRing';
import { useAuth } from '../lib/auth';
import {
  getDashboardSnapshot,
  type DashboardOpportunity,
  type DashboardSignalItem,
  type DashboardSnapshot,
} from '../lib/services/dashboardService';
import type { store as appStore } from '../lib/store';
import { taskLinkLabel, taskToView, useTasks } from '../lib/useTasks';
import type { TaskWithRelations } from '../lib/services/tasksService';

type Store = typeof appStore;
type KpiTone = 'good' | 'risk' | 'watch' | 'neutral';

interface DashboardProps {
  store: Store;
}

interface KpiCard {
  delta: string;
  deltaLabel?: string;
  hint: string;
  label: string;
  spark: number[];
  tone: KpiTone;
  value: string;
}

const integerFormatter = new Intl.NumberFormat('fr-BE', {
  maximumFractionDigits: 0,
});

const longDateFormatter = new Intl.DateTimeFormat('fr-BE', {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
  year: 'numeric',
});

function formatNumber(value: number): string {
  return integerFormatter.format(value).replace(/\u00A0/g, ' ');
}

function formatCurrency(value: number | null): string {
  if (typeof value !== 'number') return '-';
  return `${formatNumber(value)} EUR`;
}

function formatSurface(value: number | null): string {
  return typeof value === 'number' && value > 0 ? `${Math.round(value)} m2` : '-';
}

function formatDateTime(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
}

function buildKpis({
  fsboCount,
  hotCount,
  overdueCount,
  priceDropCount,
  priceDropTotal,
  scoreAverage,
  surveillerCount,
  todayTaskCount,
}: {
  fsboCount: number;
  hotCount: number;
  overdueCount: number;
  priceDropCount: number;
  priceDropTotal: number;
  scoreAverage: number;
  surveillerCount: number;
  todayTaskCount: number;
}): KpiCard[] {
  return [
    {
      delta: `${surveillerCount} a surveiller`,
      deltaLabel: `score moy. ${scoreAverage.toFixed(1)}`,
      hint: 'bandes',
      label: 'Opportunites chaudes',
      spark: [0, 0, 1, 1, 1, 0, 0, 0],
      tone: hotCount > 0 ? 'good' : 'neutral',
      value: String(hotCount),
    },
    {
      delta: priceDropTotal > 0 ? `-${formatCurrency(priceDropTotal)}` : '0 EUR',
      deltaLabel: '7 derniers jours',
      hint: '7 j',
      label: 'Baisses de prix',
      spark: [0, 0, 1, 0, 0, 1, 0, 0],
      tone: priceDropCount > 0 ? 'risk' : 'neutral',
      value: String(priceDropCount),
    },
    {
      delta: overdueCount > 0 ? `${overdueCount} en retard` : `${todayTaskCount} aujourd'hui`,
      hint: '24 h',
      label: 'Taches dues',
      spark: [2, 3, 2, 4, 3, 5, 4, 5],
      tone: overdueCount > 0 ? 'watch' : 'good',
      value: String(todayTaskCount + overdueCount),
    },
    {
      delta: `${fsboCount} a contacter`,
      deltaLabel: 'particuliers',
      hint: 'actifs',
      label: 'Particuliers FSBO',
      spark: [0, 1, 1, 2, 2, 2, 3, 2],
      tone: fsboCount > 0 ? 'good' : 'neutral',
      value: String(fsboCount),
    },
  ];
}

export function Dashboard({ store: _store }: DashboardProps) {
  const { profile } = useAuth();
  const todayTasksState = useTasks({ scope: 'today' });
  const overdueTasksState = useTasks({ scope: 'overdue' });
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const firstName = (profile?.full_name ?? profile?.email ?? 'Agent').split(' ')[0] || 'Agent';

  useEffect(() => {
    let active = true;
    setDashboardLoading(true);
    getDashboardSnapshot(8)
      .then((data) => {
        if (!active) return;
        setSnapshot(data);
        setDashboardError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setSnapshot(null);
        setDashboardError(error instanceof Error ? error.message : 'Impossible de charger le dashboard.');
      })
      .finally(() => {
        if (active) setDashboardLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const visibleTodayTasks = useMemo(
    () => todayTasksState.tasks
      .filter((task) => !task.is_completed)
      .slice()
      .sort((a, b) => `${a.due_date ?? ''}`.localeCompare(`${b.due_date ?? ''}`))
      .slice(0, 5),
    [todayTasksState.tasks],
  );
  const overdueOpenTasks = useMemo(
    () => overdueTasksState.tasks.filter((task) => !task.is_completed),
    [overdueTasksState.tasks],
  );

  const kpis = buildKpis({
    fsboCount: snapshot?.fsboCount ?? 0,
    hotCount: snapshot?.hotOpportunitiesCount ?? 0,
    overdueCount: overdueOpenTasks.length,
    priceDropCount: snapshot?.priceDropCount ?? 0,
    priceDropTotal: snapshot?.priceDropTotal ?? 0,
    scoreAverage: snapshot?.scoreAverage ?? 0,
    surveillerCount: snapshot?.scoreDistribution.surveiller ?? 0,
    todayTaskCount: visibleTodayTasks.length,
  });

  const metaDate = longDateFormatter.format(new Date());
  const lastSync = formatDateTime(snapshot?.lastSyncAt ?? null);
  const visibleSignals = snapshot?.signals ?? [];
  const opportunities = snapshot?.opportunities ?? [];
  const tasksError = todayTasksState.error ?? overdueTasksState.error;

  return (
    <main className="lv-dashboard lv-page">
      <section className="lv-dashboard-head">
        <div>
          <div>
            <h1 className="lv-title">Tableau de bord</h1>
            <p>Bonjour {firstName}, voici les opportunites et signaux a traiter aujourd'hui.</p>
          </div>
        </div>
        <a className="lv-secondary-button" href="#biens">
          <SlidersHorizontal size={15} />
          Vue du jour
        </a>
      </section>

      <div className="lv-dashboard-meta" aria-label="Etat de la prospection">
        <span className="lv-live-pill">Live</span>
        <span>{metaDate}</span>
        <span className="lv-meta-separator" aria-hidden="true" />
        <span><b>{formatNumber(snapshot?.activeSignalsCount ?? 0)}</b> signaux actifs</span>
        <span className="lv-meta-separator" aria-hidden="true" />
        <span><b>{formatNumber(snapshot?.activePropertiesCount ?? 0)}</b> biens actifs</span>
        <span className="lv-meta-separator" aria-hidden="true" />
        <span><b>{formatNumber(snapshot?.scoredPropertiesCount ?? 0)}</b> biens scores</span>
        <span className="lv-meta-separator" aria-hidden="true" />
        <span>Moyenne <b>{snapshot?.scoreAverage.toFixed(1) ?? '0.0'}</b></span>
        <span className="lv-meta-separator" aria-hidden="true" />
        <span>Bandes <b>{snapshot?.scoreDistribution.forte ?? 0}</b> / <b>{snapshot?.scoreDistribution.surveiller ?? 0}</b> / <b>{snapshot?.scoreDistribution.faible ?? 0}</b></span>
        <span className="lv-meta-separator" aria-hidden="true" />
        <span>Derniere sync <b>{lastSync}</b></span>
      </div>

      {dashboardError && (
        <div className="lv-dashboard-empty is-error" style={{ marginTop: 16 }}>
          {dashboardError}
        </div>
      )}

      <section className="lv-dashboard-kpis" aria-label="Indicateurs principaux">
        {kpis.map((kpi) => (
          <KpiCardView key={kpi.label} kpi={kpi} />
        ))}
      </section>

      <div className="lv-dashboard-split">
        <section className="lv-priority-panel lv-surface">
          <header className="lv-panel-head">
            <div>
              <h2>Priorites commerciales</h2>
              <p>Biens actifs tries sur le score vendeur reel.</p>
            </div>
            <a href="#biens">
              <Filter size={14} />
              Filtrer
            </a>
          </header>

          <OpportunityList
            error={dashboardError}
            isLoading={dashboardLoading}
            opportunities={opportunities}
          />

          <a className="lv-panel-link" href="#biens">
            Voir plus de biens
            <ChevronDown size={16} />
          </a>
        </section>

        <aside className="lv-dashboard-rail" aria-label="Taches et signaux">
          <MiniPanel title="Taches du jour" count={visibleTodayTasks.length} actionHref="#agenda">
            <div className="lv-task-list">
              {todayTasksState.isLoading ? (
                <EmptyDashboardLine>Chargement des taches...</EmptyDashboardLine>
              ) : tasksError ? (
                <EmptyDashboardLine>{tasksError}</EmptyDashboardLine>
              ) : visibleTodayTasks.length === 0 ? (
                <EmptyDashboardLine>Aucune tache prevue aujourd'hui.</EmptyDashboardLine>
              ) : (
                visibleTodayTasks.map((task) => (
                  <TaskRow key={task.id} task={task} onToggle={() => { void todayTasksState.toggleTask(task.id); }} />
                ))
              )}
            </div>
            <a className="lv-panel-link" href="#agenda">Voir toutes les taches</a>
          </MiniPanel>

          <MiniPanel title="Signaux a surveiller" count={visibleSignals.length}>
            <div className="lv-signal-list">
              {dashboardLoading ? (
                <EmptyDashboardLine>Chargement des signaux...</EmptyDashboardLine>
              ) : dashboardError ? (
                <EmptyDashboardLine>{dashboardError}</EmptyDashboardLine>
              ) : visibleSignals.length === 0 ? (
                <EmptyDashboardLine>Aucun signal actif a afficher.</EmptyDashboardLine>
              ) : (
                visibleSignals.map((signal) => <SignalRow key={signal.id} signal={signal} />)
              )}
            </div>
            <a className="lv-panel-link" href="#biens">Voir tous les signaux</a>
          </MiniPanel>

          <a className="lv-tip-card lv-surface" href="#biens">
            <span>
              <Plus size={18} />
            </span>
            <div>
              <strong>Prochaine action</strong>
              <p>Ouvrez la vue Biens pour traiter les scores surveiller et les signaux actifs en priorite.</p>
            </div>
            <ArrowUpRight size={16} />
          </a>
        </aside>
      </div>
    </main>
  );
}

interface MiniPanelProps {
  actionHref?: string;
  children: ReactNode;
  count: number;
  title: string;
}

function MiniPanel({ actionHref, children, count, title }: MiniPanelProps) {
  const action = actionHref ? (
    <a href={actionHref} aria-label={`Ajouter ${title}`}>
      <Plus size={15} />
    </a>
  ) : null;

  return (
    <article className="lv-mini-panel lv-surface">
      <header>
        <h2>{title}</h2>
        <span>{count}</span>
        {action}
      </header>
      {children}
    </article>
  );
}

function KpiCardView({ kpi }: { kpi: KpiCard }) {
  return (
    <article className={`lv-kpi-card tone-${kpi.tone}`}>
      <div className="lv-kpi-label">
        <span>{kpi.label}</span>
        <b>{kpi.hint}</b>
      </div>
      <div className="lv-kpi-value">
        <strong>{kpi.value}</strong>
        <span className={`lv-kpi-delta ${kpi.tone}`}>{kpi.delta}</span>
      </div>
      {kpi.deltaLabel ? <small>{kpi.deltaLabel}</small> : null}
      <Sparkline points={kpi.spark} />
    </article>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const width = 150;
  const height = 30;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = Math.max(1, max - min);
  const coordinates = points.map((point, index) => {
    const x = (index / Math.max(1, points.length - 1)) * width;
    const y = height - ((point - min) / range) * (height - 4) - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const line = coordinates.join(' ');
  const area = `0,${height} ${line} ${width},${height}`;

  return (
    <svg className="lv-kpi-spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline className="area" points={area} />
      <polyline className="line" points={line} />
    </svg>
  );
}

function OpportunityList({
  error,
  isLoading,
  opportunities,
}: {
  error: string | null;
  isLoading: boolean;
  opportunities: DashboardOpportunity[];
}) {
  if (isLoading) {
    return (
      <div className="lv-priority-table">
        {Array.from({ length: 5 }, (_, index) => (
          <div className="lv-opportunity-skeleton" key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="lv-dashboard-empty is-error">{error}</div>;
  }

  if (opportunities.length === 0) {
    return <div className="lv-dashboard-empty">Aucune opportunite scoree a afficher.</div>;
  }

  return (
    <div className="lv-priority-table">
      {opportunities.map((opportunity) => (
        <OpportunityRow key={opportunity.id} opportunity={opportunity} />
      ))}
    </div>
  );
}

function OpportunityRow({ opportunity }: { opportunity: DashboardOpportunity }) {
  const tone = opportunity.band === 'forte' ? 'good' : opportunity.band === 'surveiller' ? 'watch' : 'neutral';

  return (
    <a className="lv-priority-row" href={opportunity.propertyId ? `#biens?propertyId=${opportunity.propertyId}` : '#biens'}>
      {opportunity.photo ? <img src={opportunity.photo} alt="" /> : <span className="lv-property-thumb" aria-hidden="true" />}
      <span className="lv-row-title">
        <span className="lv-row-title-line">
          <strong>{opportunity.title}</strong>
          <Badge tone={tone}>{opportunity.signal}</Badge>
        </span>
        <small>{opportunity.subtitle}</small>
      </span>
      <span className="lv-row-price">
        <b>{formatCurrency(opportunity.price)}</b>
        <small>{formatSurface(opportunity.surface)}</small>
      </span>
      <ScoreRing score={opportunity.score} size="sm" />
      <span className="lv-row-actions" aria-label="Actions">
        <Phone size={13} />
        <Mail size={13} />
        <MoreHorizontal size={13} />
      </span>
    </a>
  );
}

function TaskRow({ task, onToggle }: { task: TaskWithRelations; onToggle: () => void }) {
  const view = taskToView(task);
  const meta = [
    view.time,
    task.relations.property?.locality ?? taskLinkLabel(task),
  ].filter(Boolean).join(' - ');

  return (
    <button className="lv-task-row" type="button" onClick={onToggle} aria-pressed={task.is_completed}>
      <span className={`lv-task-check ${task.is_completed ? 'is-done' : ''}`}>
        {task.is_completed ? <CheckCircle2 size={15} /> : <Circle size={15} />}
      </span>
      <span>
        <b>{task.title}</b>
        <small>{meta}</small>
      </span>
    </button>
  );
}

function SignalRow({ signal }: { signal: DashboardSignalItem }) {
  return (
    <a className={`lv-signal-row tone-${signal.tone}`} href={`#biens?propertyId=${signal.propertyId}`}>
      <span>
        <strong>{signal.title}</strong>
        <small>{`${signal.source} - ${signal.timeLabel}`}</small>
      </span>
      <b>{signal.value}</b>
    </a>
  );
}

function EmptyDashboardLine({ children }: { children: ReactNode }) {
  return <div className="lv-dashboard-empty">{children}</div>;
}

function Badge({ children, tone }: { children: ReactNode; tone: KpiTone }) {
  return <span className={`lv-signal-pill tone-${tone}`}>{children}</span>;
}
