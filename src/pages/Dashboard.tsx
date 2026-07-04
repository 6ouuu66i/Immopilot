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
import { listDashboardOpportunities, type DashboardOpportunity } from '../lib/services/dashboardService';
import type { store as appStore } from '../lib/store';
import { taskToView, useTasks } from '../lib/useTasks';
import type { Property, PropertySignal, Task } from '../types';

type Store = typeof appStore;
type KpiTone = 'good' | 'risk' | 'watch' | 'neutral';
type TaskOrigin = 'local' | 'supabase';

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

interface PriorityOpportunity {
  actionLabel: string;
  href: string;
  id: string;
  photo: string | null;
  previousPrice: number | null;
  price: number | null;
  score: number;
  seenLabel: string;
  signal: string;
  source: string;
  subtitle: string;
  surface: number | null;
  title: string;
}

interface DashboardTask {
  origin: TaskOrigin;
  task: Task;
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

function formatAddedAt(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.max(0, Math.round(diffMs / 36e5));
  if (diffHours < 1) return "A l'instant";
  if (diffHours < 24) return `Il y a ${diffHours} h`;
  const diffDays = Math.round(diffHours / 24);
  return `Il y a ${diffDays} j`;
}

function formatPublishedDays(days: number): string {
  if (days <= 0) return "A l'instant";
  if (days === 1) return '1 j en ligne';
  return `${days} j en ligne`;
}

function cleanText(value: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/\u00c3\u00a9/g, 'e'],
    [/\u00c3\u00a8/g, 'e'],
    [/\u00c3\u00aa/g, 'e'],
    [/\u00c3\u00a0/g, 'a'],
    [/\u00c3\u00a2/g, 'a'],
    [/\u00c3\u00a7/g, 'c'],
    [/\u00c3\u00bb/g, 'u'],
    [/\u00c3\u00ae/g, 'i'],
    [/\u00c3\u00b4/g, 'o'],
    [/\u00c3\u0089/g, 'E'],
    [/\u00c5\u201c/g, 'oe'],
    [/\u00c2\u00b7/g, ' - '],
    [/\u00c2\u00b2/g, '2'],
    [/\u00e2\u201a\u00ac/g, 'EUR'],
    [/ÃƒÆ’Ã‚Â©/g, 'e'],
    [/ÃƒÆ’Ã‚Â¨/g, 'e'],
    [/ÃƒÆ’Ã‚Âª/g, 'e'],
    [/ÃƒÆ’Ã‚Â /g, 'a'],
    [/ÃƒÆ’Ã‚Â§/g, 'c'],
    [/ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬/g, 'EUR'],
    [/Ãƒâ€šÃ‚Â·/g, ' - '],
    [/Ãƒâ€šÃ‚Â²/g, '2'],
  ];

  return replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

function getPreviousPrice(property: Property): number | null {
  const previousPrices = property.priceHistory
    .map((item) => item.price)
    .filter((price) => price > property.price);

  if (previousPrices.length === 0) return null;
  return Math.max(...previousPrices);
}

function getPriceDrop(property: Property): number {
  const previousPrice = getPreviousPrice(property);
  return previousPrice ? previousPrice - property.price : 0;
}

function getPropertySignal(property: Property): string {
  if (getPriceDrop(property) > 0) return 'Baisse de prix';
  if (property.fsbo) return 'FSBO';
  if (property.score >= 85) return 'Score IA haut';
  return cleanText(String(property.tag || 'Signal'));
}

function getSignalTone(label: string): KpiTone {
  const normalized = label.toLowerCase();
  if (normalized.includes('baisse') || normalized.includes('drop')) return 'risk';
  if (normalized.includes('fsbo') || normalized.includes('ancien') || normalized.includes('repub')) return 'watch';
  if (normalized.includes('score') || normalized.includes('nouveau')) return 'good';
  return 'neutral';
}

function getSignalToneFromRecord(signal: PropertySignal): KpiTone {
  if (signal.type === 'drop') return 'risk';
  if (signal.type === 'fsbo' || signal.type === 'old' || signal.type === 'repub') return 'watch';
  if (signal.type === 'high' || signal.type === 'new') return 'good';
  return getSignalTone(signal.heading);
}

function propertyToOpportunity(property: Property): PriorityOpportunity {
  const previousPrice = getPreviousPrice(property);
  const typeLabel = cleanText(property.propertyType ?? (property.bedrooms >= 3 ? 'Maison' : 'Appartement'));

  return {
    actionLabel: property.fsbo ? 'Appeler vendeur' : previousPrice ? 'Verifier baisse' : 'Ouvrir fiche',
    href: `#biens?propertyId=${property.id}`,
    id: `property-${property.id}`,
    photo: property.photos[0] ?? null,
    previousPrice,
    price: property.price,
    score: property.score,
    seenLabel: formatPublishedDays(property.publishedDays),
    signal: getPropertySignal(property),
    source: cleanText(String(property.source)),
    subtitle: `${cleanText(property.city)} - ${typeLabel} - ${cleanText(String(property.source))}`,
    surface: property.surface,
    title: cleanText(property.title),
  };
}

function supabaseToOpportunity(opportunity: DashboardOpportunity): PriorityOpportunity {
  return {
    actionLabel: 'Ouvrir fiche',
    href: opportunity.propertyId ? `#biens?propertyId=${opportunity.propertyId}` : '#biens',
    id: `listing-${opportunity.id}`,
    photo: opportunity.photo,
    previousPrice: null,
    price: opportunity.price,
    score: opportunity.score,
    seenLabel: formatAddedAt(opportunity.addedAt),
    signal: cleanText(opportunity.signal),
    source: cleanText(opportunity.source),
    subtitle: cleanText(opportunity.subtitle),
    surface: opportunity.surface,
    title: cleanText(opportunity.title),
  };
}

function sortPropertiesForDashboard(properties: Property[]): Property[] {
  return properties
    .slice()
    .sort((a, b) => {
      const scoreDelta = b.score - a.score;
      if (scoreDelta !== 0) return scoreDelta;
      return a.publishedDays - b.publishedDays;
    });
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildKpis({
  activeSignals,
  fsboCount,
  hotCount,
  overdueCount,
  priceDropCount,
  priceDropTotal,
  todayTaskCount,
}: {
  activeSignals: number;
  fsboCount: number;
  hotCount: number;
  overdueCount: number;
  priceDropCount: number;
  priceDropTotal: number;
  todayTaskCount: number;
}): KpiCard[] {
  return [
    {
      delta: `${activeSignals} signaux`,
      deltaLabel: 'a inspecter',
      hint: '7 j',
      label: 'Opportunites chaudes',
      spark: [3, 4, 3, 5, 4, 6, 7, 8],
      tone: 'good',
      value: String(hotCount),
    },
    {
      delta: priceDropTotal > 0 ? `-${formatCurrency(priceDropTotal)}` : '0 EUR',
      deltaLabel: 'baisse cumulee',
      hint: '7 j',
      label: 'Baisses de prix',
      spark: [1, 1, 2, 1, 2, 3, 2, 2],
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
      hint: '30 j',
      label: 'Particuliers FSBO',
      spark: [0, 1, 1, 2, 2, 2, 3, 2],
      tone: fsboCount > 0 ? 'good' : 'neutral',
      value: String(fsboCount),
    },
  ];
}

export function Dashboard({ store }: DashboardProps) {
  const { profile } = useAuth();
  const todayTasksState = useTasks({ scope: 'today' });
  const overdueTasksState = useTasks({ scope: 'overdue' });
  const [storeRevision, setStoreRevision] = useState(0);
  const [opportunities, setOpportunities] = useState<DashboardOpportunity[]>([]);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(true);
  const [opportunitiesError, setOpportunitiesError] = useState<string | null>(null);
  const todayKey = getTodayKey();
  const firstName = (profile?.full_name ?? profile?.email ?? 'Agent').split(' ')[0] || 'Agent';

  useEffect(() => {
    const bumpStoreRevision = () => setStoreRevision((version) => version + 1);
    window.addEventListener('ip-state-changed', bumpStoreRevision);
    window.addEventListener('ip-agent-changed', bumpStoreRevision);
    return () => {
      window.removeEventListener('ip-state-changed', bumpStoreRevision);
      window.removeEventListener('ip-agent-changed', bumpStoreRevision);
    };
  }, []);

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

  const localProperties = useMemo(() => store.getProperties(), [store, storeRevision]);
  const localSignals = useMemo(() => store.getActiveSignals(), [store, storeRevision]);
  const localTodayTasks = useMemo(() => store.getTasksForDate(todayKey), [store, storeRevision, todayKey]);
  const localOverdueTasks = useMemo(
    () => store.getTasks().filter((task) => !task.done && task.date < todayKey),
    [store, storeRevision, todayKey],
  );
  const supabaseTodayTasks = useMemo(() => todayTasksState.tasks.map(taskToView), [todayTasksState.tasks]);
  const taskItems: DashboardTask[] = useMemo(() => {
    if (supabaseTodayTasks.length > 0) {
      return supabaseTodayTasks
        .slice()
        .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
        .map((task) => ({ origin: 'supabase', task }));
    }

    return localTodayTasks
      .slice()
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
      .map((task) => ({ origin: 'local', task }));
  }, [localTodayTasks, supabaseTodayTasks]);

  const localPriorities = useMemo(
    () => sortPropertiesForDashboard(localProperties).slice(0, 8).map(propertyToOpportunity),
    [localProperties],
  );
  const supabasePriorities = useMemo(() => opportunities.map(supabaseToOpportunity), [opportunities]);
  const priorityItems = supabasePriorities.length > 0 ? supabasePriorities : localPriorities;
  const hasLocalFallback = supabasePriorities.length === 0 && localPriorities.length > 0;
  const prioritySource = supabasePriorities.length > 0 ? 'Supabase' : 'Local';
  const priceDropProperties = localProperties.filter((property) => getPriceDrop(property) > 0);
  const hotCount = supabasePriorities.length > 0
    ? supabasePriorities.filter((item) => item.score >= 80).length
    : localProperties.filter((property) => property.score >= 80).length;
  const priceDropTotal = priceDropProperties.reduce((sum, property) => sum + getPriceDrop(property), 0);
  const overdueCount = overdueTasksState.tasks.length > 0 ? overdueTasksState.tasks.length : localOverdueTasks.length;
  const kpis = buildKpis({
    activeSignals: localSignals.length,
    fsboCount: localProperties.filter((property) => property.fsbo).length,
    hotCount,
    overdueCount,
    priceDropCount: priceDropProperties.length,
    priceDropTotal,
    todayTaskCount: taskItems.filter((item) => !item.task.done).length,
  });

  const metaDate = cleanText(longDateFormatter.format(new Date()));
  const lastSync = new Date().toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
  const visibleTasks = taskItems.slice(0, 5);
  const visibleSignals = localSignals.slice(0, 4);

  const toggleTask = (item: DashboardTask) => {
    if (item.origin === 'supabase') {
      void todayTasksState.toggleTask(item.task.id);
      return;
    }

    store.toggleTask(item.task.id);
    setStoreRevision((version) => version + 1);
  };

  return (
    <main className="lv-dashboard lv-page">
      <section className="lv-dashboard-head">
        <div>
          <div>
            <h1 className="lv-title">Tableau de bord</h1>
            <p>Bonjour {cleanText(firstName)}, voici les opportunites et signaux a traiter aujourd'hui.</p>
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
        <span><b>{localSignals.length}</b> nouveaux signaux</span>
        <span className="lv-meta-separator" aria-hidden="true" />
        <span><b>{formatNumber(localProperties.length)}</b> biens suivis</span>
        <span className="lv-meta-separator" aria-hidden="true" />
        <span>Derniere sync <b>{lastSync}</b></span>
        {hasLocalFallback ? (
          <>
            <span className="lv-meta-separator" aria-hidden="true" />
            <span>Mode <b>{prioritySource}</b></span>
          </>
        ) : null}
      </div>

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
              <p>Les biens avec signaux exploitables maintenant.</p>
            </div>
            <a href="#biens">
              <Filter size={14} />
              Filtrer
            </a>
          </header>

          <OpportunityList
            error={hasLocalFallback ? null : opportunitiesError}
            isLoading={opportunitiesLoading && priorityItems.length === 0}
            opportunities={priorityItems}
          />

          <a className="lv-panel-link" href="#biens">
            Voir plus de biens
            <ChevronDown size={16} />
          </a>
        </section>

        <aside className="lv-dashboard-rail" aria-label="Taches et signaux">
          <MiniPanel title="Taches du jour" count={visibleTasks.length} actionHref="#agenda">
            <div className="lv-task-list">
              {todayTasksState.isLoading && visibleTasks.length === 0 ? (
                <EmptyDashboardLine>Chargement des taches...</EmptyDashboardLine>
              ) : visibleTasks.length === 0 ? (
                <EmptyDashboardLine>Aucune tache prevue aujourd'hui.</EmptyDashboardLine>
              ) : (
                visibleTasks.map((item) => (
                  <TaskRow key={`${item.origin}-${item.task.id}`} store={store} task={item.task} onToggle={() => toggleTask(item)} />
                ))
              )}
            </div>
            <a className="lv-panel-link" href="#agenda">Voir toutes les taches</a>
          </MiniPanel>

          <MiniPanel title="Signaux a surveiller" count={visibleSignals.length}>
            <div className="lv-signal-list">
              {visibleSignals.length === 0 ? (
                <EmptyDashboardLine>Les signaux apparaitront ici quand le moteur de detection sera actif.</EmptyDashboardLine>
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
              <p>Ouvrez la vue Biens pour traiter les favoris, les baisses et les FSBO en priorité.</p>
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
  opportunities: PriorityOpportunity[];
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

  if (error && opportunities.length === 0) {
    return <div className="lv-dashboard-empty is-error">{error}</div>;
  }

  if (opportunities.length === 0) {
    return <div className="lv-dashboard-empty">Vos opportunites apparaitront ici apres le premier scraping.</div>;
  }

  return (
    <div className="lv-priority-table">
      {opportunities.map((opportunity) => (
        <OpportunityRow key={opportunity.id} opportunity={opportunity} />
      ))}
    </div>
  );
}

function OpportunityRow({ opportunity }: { opportunity: PriorityOpportunity }) {
  const drop = opportunity.previousPrice && opportunity.price ? opportunity.previousPrice - opportunity.price : 0;
  const tone = getSignalTone(opportunity.signal);

  return (
    <a className="lv-priority-row" href={opportunity.href}>
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
        {drop > 0 ? <small>-{formatCurrency(drop)}</small> : <small>{formatSurface(opportunity.surface)}</small>}
      </span>
      <ScoreRing score={opportunity.score} size="sm" />
      <span className="lv-row-actions" aria-label={opportunity.actionLabel}>
        <Phone size={13} />
        <Mail size={13} />
        <MoreHorizontal size={13} />
      </span>
    </a>
  );
}

function TaskRow({ store, task, onToggle }: { store: Store; task: Task; onToggle: () => void }) {
  const relatedProperty = task.propertyId ? store.getProperty(task.propertyId) : undefined;
  const meta = [
    task.time,
    relatedProperty ? cleanText(relatedProperty.city) : task.place ? cleanText(task.place) : null,
  ].filter(Boolean).join(' - ');

  return (
    <button className="lv-task-row" type="button" onClick={onToggle} aria-pressed={task.done}>
      <span className={`lv-task-check ${task.done ? 'is-done' : ''}`}>
        {task.done ? <CheckCircle2 size={15} /> : <Circle size={15} />}
      </span>
      <span>
        <b>{cleanText(task.title)}</b>
        <small>{meta}</small>
      </span>
    </button>
  );
}

function SignalRow({ signal }: { signal: PropertySignal }) {
  const tone = getSignalToneFromRecord(signal);
  const value = signal.value ?? signal.info;

  return (
    <a className={`lv-signal-row tone-${tone}`} href={`#biens?signalId=${signal.id}`}>
      <span>
        <strong>{cleanText(signal.heading)}</strong>
        <small>{cleanText(signal.source ? `${signal.source} - ${signal.time}` : signal.time)}</small>
      </span>
      <b>{cleanText(value)}</b>
    </a>
  );
}

function EmptyDashboardLine({ children }: { children: ReactNode }) {
  return <div className="lv-dashboard-empty">{children}</div>;
}

function Badge({ children, tone }: { children: ReactNode; tone: KpiTone }) {
  return <span className={`lv-signal-pill tone-${tone}`}>{children}</span>;
}
