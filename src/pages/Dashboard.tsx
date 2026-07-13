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
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScoreRing } from '../components/biens/ScoreRing';
import { useAuth } from '../lib/auth';
import {
  type DashboardOpportunity,
  type DashboardSignalItem,
  type DashboardSnapshot,
} from '../lib/services/dashboardService';
import { useDashboardSnapshot } from '../lib/useDashboardSnapshot';
import { taskLinkLabel, taskToView, useTasks } from '../lib/useTasks';
import type { TaskWithRelations } from '../lib/services/tasksService';

type KpiTone = 'good' | 'risk' | 'watch' | 'neutral';

interface KpiCard {
  delta: string;
  deltaLabel?: string;
  hint: string;
  label: string;
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
  return `${formatNumber(value)} €`;
}

function formatSurface(value: number | null): string {
  return typeof value === 'number' && value > 0 ? `${Math.round(value)} m²` : '-';
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
      delta: `${surveillerCount} à surveiller`,
      deltaLabel: `score moyen ${scoreAverage.toFixed(1)}`,
      hint: 'score ≥ 70',
      label: 'Opportunités chaudes',
      tone: hotCount > 0 ? 'good' : 'neutral',
      value: String(hotCount),
    },
    {
      delta: priceDropTotal > 0 ? `-${formatCurrency(priceDropTotal)}` : '0 €',
      deltaLabel: '7 derniers jours',
      hint: '7 j',
      label: 'Baisses de prix',
      tone: priceDropCount > 0 ? 'risk' : 'neutral',
      value: String(priceDropCount),
    },
    {
      delta: overdueCount > 0 ? `${overdueCount} en retard` : `${todayTaskCount} aujourd'hui`,
      hint: '24 h',
      label: 'Tâches dues',
      tone: overdueCount > 0 ? 'watch' : 'good',
      value: String(todayTaskCount + overdueCount),
    },
    {
      delta: `${fsboCount} à contacter`,
      deltaLabel: 'particuliers',
      hint: 'actifs',
      label: 'Particuliers FSBO',
      tone: fsboCount > 0 ? 'good' : 'neutral',
      value: String(fsboCount),
    },
  ];
}

export function Dashboard() {
  const { profile } = useAuth();
  const todayTasksState = useTasks({ scope: 'today' });
  const overdueTasksState = useTasks({ scope: 'overdue' });
  const dashboardQuery = useDashboardSnapshot(8);
  const snapshot = dashboardQuery.data ?? null;
  const dashboardLoading = dashboardQuery.isLoading;
  const dashboardError = dashboardQuery.error instanceof Error ? dashboardQuery.error.message : null;
  const firstName = (profile?.full_name ?? profile?.email ?? 'Agent').split(' ')[0] || 'Agent';

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
            <p>Bonjour {firstName}, voici les opportunités et signaux à traiter aujourd'hui.</p>
          </div>
        </div>
        <a className="lv-secondary-button" href="#biens">
          <SlidersHorizontal size={15} />
          Vue du jour
        </a>
      </section>

      <MorningJournal snapshot={snapshot} firstName={firstName} />

      <div className="lv-dashboard-meta" aria-label="Etat de la prospection">
        <span className="lv-live-pill">Live</span>
        <span>{metaDate}</span>
        <span className="lv-meta-separator" aria-hidden="true" />
        <span><b>{formatNumber(snapshot?.activeSignalsCount ?? 0)}</b> signaux actifs</span>
        <span className="lv-meta-separator" aria-hidden="true" />
        <span><b>{formatNumber(snapshot?.activePropertiesCount ?? 0)}</b> biens actifs</span>
        <span className="lv-meta-separator" aria-hidden="true" />
        <span><b>{formatNumber(snapshot?.scoredPropertiesCount ?? 0)}</b> biens scorés</span>
        <span className="lv-meta-separator" aria-hidden="true" />
        <span>Moyenne <b>{snapshot?.scoreAverage.toFixed(1) ?? '0.0'}</b></span>
        <span className="lv-meta-separator" aria-hidden="true" />
        <span>Scores <b>{snapshot?.scoreDistribution.forte ?? 0}</b> fortes / <b>{snapshot?.scoreDistribution.surveiller ?? 0}</b> à surveiller / <b>{snapshot?.scoreDistribution.faible ?? 0}</b> faibles</span>
        <span className="lv-meta-separator" aria-hidden="true" />
        <span>Dernière synchro <b>{lastSync}</b></span>
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
              <h2>Priorités commerciales</h2>
              <p>Biens actifs triés par score vendeur.</p>
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
          <MiniPanel title="Tâches du jour" count={visibleTodayTasks.length} actionHref="#agenda">
            <div className="lv-task-list">
              {todayTasksState.isLoading ? (
                <EmptyDashboardLine>Chargement des tâches...</EmptyDashboardLine>
              ) : tasksError ? (
                <EmptyDashboardLine>{tasksError}</EmptyDashboardLine>
              ) : visibleTodayTasks.length === 0 ? (
                <EmptyDashboardLine>Aucune tâche prévue aujourd'hui.</EmptyDashboardLine>
              ) : (
                visibleTodayTasks.map((task) => (
                  <TaskRow key={task.id} task={task} onToggle={() => { void todayTasksState.toggleTask(task.id); }} />
                ))
              )}
            </div>
            <a className="lv-panel-link" href="#agenda">Voir toutes les tâches</a>
          </MiniPanel>

          <MiniPanel title="Signaux à surveiller" count={visibleSignals.length}>
            <div className="lv-signal-list">
              {dashboardLoading ? (
                <EmptyDashboardLine>Chargement des signaux...</EmptyDashboardLine>
              ) : dashboardError ? (
                <EmptyDashboardLine>{dashboardError}</EmptyDashboardLine>
              ) : visibleSignals.length === 0 ? (
                <EmptyDashboardLine>Aucun signal actif à afficher.</EmptyDashboardLine>
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

/* ── Le Journal du matin ────────────────────────────────────────────
   Première ouverture de la journée : le dashboard se compose comme une
   une de journal — date en serif, manchette dont les chiffres comptent
   depuis zéro, trois biens chauds en vignettes. Une fois par jour. */

const JOURNAL_SEEN_KEY = 'ip_journal_seen';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function useCountUp(target: number, durationMs = 450): number {
  const [value, setoalue] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || target <= 0) {
      setoalue(target);
      return;
    }

    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setoalue(Math.round(eased * target));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [target, durationMs]);

  return value;
}

function JournalFigure({ value, label, tone }: { value: number; label: string; tone: 'risk' | 'good' | 'watch' }) {
  const displayed = useCountUp(value);
  return (
    <span className={`lv-journal-figure tone-${tone}`}>
      <b>{displayed}</b> {label}
    </span>
  );
}

function MorningJournal({ snapshot, firstName }: { snapshot: DashboardSnapshot | null; firstName: string }) {
  const [visible, setoisible] = useState(() => localStorage.getItem(JOURNAL_SEEN_KEY) !== todayKey());
  const markedRef = useRef(false);

  // Marqué « lu » dès qu'il s'affiche avec des données : il ne reparaîtra pas
  // avant demain, mais reste visible tant que l'agent ne le ferme pas.
  useEffect(() => {
    if (visible && snapshot && !markedRef.current) {
      markedRef.current = true;
      localStorage.setItem(JOURNAL_SEEN_KEY, todayKey());
    }
  }, [visible, snapshot]);

  if (!visible || !snapshot) return null;

  const topOpportunities = snapshot.opportunities.slice(0, 3);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Ce matin' : hour < 18 ? 'Cet après-midi' : 'Ce soir';

  // Une manchette n'annonce que ce qui s'est passé : les compteurs à zéro
  // sont retirés, et si tout est calme, on le dit calmement.
  const figures = [
    {
      value: snapshot.priceDropCount,
      label: snapshot.priceDropCount > 1 ? 'baisses de prix' : 'baisse de prix',
      tone: 'risk' as const,
    },
    {
      value: snapshot.hotOpportunitiesCount,
      label: snapshot.hotOpportunitiesCount > 1 ? 'opportunités fortes' : 'opportunité forte',
      tone: 'good' as const,
    },
    {
      value: snapshot.fsboCount,
      label: snapshot.fsboCount > 1 ? 'particuliers à contacter' : 'particulier à contacter',
      tone: 'watch' as const,
    },
  ].filter((figure) => figure.value > 0);

  return (
    <section className="lv-journal" aria-label="Le journal du jour">
      <button
        type="button"
        className="lv-journal-close"
        aria-label="Fermer le journal du jour"
        onClick={() => setoisible(false)}
      >
        ×
      </button>
      <p className="lv-journal-kicker">Le journal du matin</p>
      <h2 className="lv-journal-headline">
        {figures.length === 0 ? (
          <>{greeting}, {firstName} — marché calme, aucun nouveau signal prioritaire.</>
        ) : (
          <>
            {greeting}, {firstName} —{' '}
            {figures.map((figure, index) => (
              <span key={figure.tone}>
                {index > 0 && ' · '}
                <JournalFigure value={figure.value} label={figure.label} tone={figure.tone} />
              </span>
            ))}
          </>
        )}
      </h2>
      {topOpportunities.length > 0 && (
        <div className="lv-journal-picks">
          {topOpportunities.map((opportunity, index) => (
            <a
              key={opportunity.id}
              className="lv-journal-pick"
              style={{ animationDelay: `${350 + index * 110}ms` }}
              href={opportunity.propertyId ? `#biens?propertyId=${opportunity.propertyId}` : '#biens'}
            >
              {opportunity.photo ? <img src={opportunity.photo} alt="" loading="lazy" /> : <span className="lv-journal-pick-thumb" aria-hidden="true" />}
              <span className="lv-journal-pick-copy">
                <strong>{opportunity.title}</strong>
                <small>{formatCurrency(opportunity.price)} · {opportunity.signal}</small>
              </span>
              <ScoreRing score={opportunity.score} size="sm" />
            </a>
          ))}
        </div>
      )}
    </section>
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
    </article>
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
    return <div className="lv-dashboard-empty">Aucune opportunité scorée à afficher.</div>;
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
  ].filter(Boolean).join(' · ');

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
        <small>{`${signal.source} · ${signal.timeLabel}`}</small>
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
