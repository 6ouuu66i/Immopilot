import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Circle,
  Flame,
  Home,
  Lightbulb,
  ListFilter,
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
  Star,
  TrendingDown,
} from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import type { store as appStore } from '../lib/store';
import type { Deal, Property, PropertySignal, Task } from '../types';
import dashboardDoodleBanner from '../assets/dashboard-doodle-banner-wide.png';

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

interface PriorityOpportunity {
  address: string;
  city: string;
  id: string;
  microcopy: string;
  photo: string;
  price: string;
  score: number;
  signal: string;
  source: string;
  surface: string;
  title: string;
}

interface RecentSignal {
  detail: string;
  id: string;
  title: string;
  tone: 'hot' | 'good' | 'warn' | 'neutral';
  value: string;
}

const currencyFormatter = new Intl.NumberFormat('fr-BE', {
  currency: 'EUR',
  maximumFractionDigits: 0,
  style: 'currency',
});

function cleanText(value: string): string {
  return value
    .replaceAll('Ã©', 'é')
    .replaceAll('Ã¨', 'è')
    .replaceAll('Ãª', 'ê')
    .replaceAll('Ã«', 'ë')
    .replaceAll('Ã ', 'à')
    .replaceAll('Ã¢', 'â')
    .replaceAll('Ã´', 'ô')
    .replaceAll('Ã»', 'û')
    .replaceAll('Ã§', 'ç')
    .replaceAll('Ã‰', 'É')
    .replaceAll('â‚¬', '€')
    .replaceAll('â€”', '-')
    .replaceAll('â€œ', '“')
    .replaceAll('â€', '”')
    .replaceAll('Â·', '·')
    .replaceAll('Â²', '²')
    .replaceAll('Å“', 'œ')
    .replaceAll('Ã®', 'î');
}

function formatCurrency(value: number): string {
  return currencyFormatter
    .format(value)
    .replace(/\s?EUR/, ' €')
    .replace(/\u00A0/g, ' ');
}

function formatScore(value: number): number {
  return Math.max(64, Math.min(89, Math.round(value - 6)));
}

function propertyMicrocopy(property: Property): string {
  if (property.tag === 'Baisse de prix') return 'Relance prioritaire';
  if (property.fsbo || property.tag === 'FSBO') return 'Vendeur particulier';
  if (property.score >= 86) return 'Prix sous marché';
  if (property.surface >= 170) return 'Grand format rare';
  return 'À qualifier';
}

function signalTone(type: PropertySignal['type']): RecentSignal['tone'] {
  if (type === 'high' || type === 'drop') return 'hot';
  if (type === 'fsbo' || type === 'new') return 'good';
  if (type === 'old' || type === 'repub') return 'warn';
  return 'neutral';
}

function buildOpportunity(property: Property, deal?: Deal): PriorityOpportunity {
  const signal = property.fsbo || property.tag === 'FSBO'
    ? 'Propriétaire'
    : property.tag === 'Baisse de prix'
      ? 'Baisse de prix'
      : property.score >= 80
        ? 'Prix attractif'
        : cleanText(property.tag);

  return {
    address: deal?.title ? cleanText(deal.title).replace(cleanText(property.title), '').trim() || cleanText(property.city) : cleanText(property.city),
    city: cleanText(property.city),
    id: String(property.id),
    microcopy: propertyMicrocopy(property),
    photo: property.photos[0],
    price: formatCurrency(property.price),
    score: formatScore(property.score),
    signal,
    source: cleanText(property.source),
    surface: `${property.surface} m²`,
    title: cleanText(property.title),
  };
}

function signalValue(signal: PropertySignal): string {
  if (signal.value) return cleanText(signal.value);
  if (signal.type === 'drop') return '-12%';
  if (signal.type === 'old') return '+23 j';
  if (signal.type === 'high') return 'IA';
  return 'new';
}

function useDashboardData(store: Store) {
  return useMemo(() => {
    const properties = store.getProperties();
    const deals = store.getDeals();
    const tasks = store.getTasks();
    const signals = store.getSignals();

    const priceDrops = properties.filter((property) => property.tag === 'Baisse de prix').length;
    const privateSellers = properties.filter((property) => property.fsbo || property.tag === 'FSBO').length;
    const hotProperties = properties.filter((property) => property.score >= 80).length;
    const openTasks = tasks.filter((task) => !task.done);

    const kpis: KpiCard[] = [
      {
        accent: 'blue',
        delta: '+12 cette semaine',
        icon: Home,
        label: 'Nouveaux biens',
        value: String(properties.length),
      },
      {
        accent: 'green',
        delta: '+5 cette semaine',
        icon: Flame,
        label: 'Opportunités chaudes',
        value: String(hotProperties),
      },
      {
        accent: 'amber',
        delta: '-3 cette semaine',
        icon: TrendingDown,
        label: 'Baisses de prix',
        value: String(priceDrops),
      },
      {
        accent: 'violet',
        delta: "Aujourd'hui",
        icon: CalendarClock,
        label: 'Relances à faire',
        value: String(openTasks.length + privateSellers),
      },
    ];

    const opportunities = properties
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((property) => buildOpportunity(property, deals.find((deal) => deal.propertyId === property.id)));

    const todayTasks = openTasks
      .slice()
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
      .slice(0, 6);

    const recentSignals: RecentSignal[] = signals.slice(0, 4).map((signal) => ({
      detail: cleanText(signal.info),
      id: signal.id,
      title: cleanText(signal.heading),
      tone: signalTone(signal.type),
      value: signalValue(signal),
    }));

    return { kpis, opportunities, recentSignals, todayTasks };
  }, [store]);
}

export function Dashboard({ store }: DashboardProps) {
  const { kpis, opportunities, recentSignals, todayTasks } = useDashboardData(store);

  return (
    <div className="ip-dashboard ip-dashboard-wow">
      <DoodleStrip />

      <section className="ip-wow-content">
        <div className="ip-wow-main">
          <section className="ip-wow-hero">
        <div className="ip-wow-title">
          <span className="ip-wow-page-icon" aria-hidden="true">
            <ListFilter size={24} />
          </span>
          <div>
            <h1>Dashboard</h1>
            <p>Bonjour Thomas, voici vos opportunités du jour.</p>
          </div>
        </div>
      </section>

      <section className="ip-focus-card" aria-label="Focus du jour">
        <span className="ip-focus-star" aria-hidden="true">
          <Star size={18} />
        </span>
        <div>
          <strong>Focus du jour</strong>
          <p>12 nouvelles opportunités à fort potentiel détectées cette semaine sur Immoweb et Zimmo.</p>
        </div>
        <a href="#biens">
          Voir les nouvelles
          <ArrowUpRight size={15} />
        </a>
      </section>

      <section className="ip-wow-kpis" aria-label="Indicateurs principaux">
        {kpis.map((kpi) => (
          <KpiCardView key={kpi.label} kpi={kpi} />
        ))}
      </section>

      <div className="ip-wow-table-zone">
        <article className="ip-wow-table-card">
          <header className="ip-view-bar">
            <nav aria-label="Vues des opportunités">
              <a className="is-active" href="#dashboard">
                Toutes les opportunités
              </a>
              <a href="#biens">Nouveaux biens <span>28</span></a>
              <a href="#biens">Baisses de prix <span>9</span></a>
              <a href="#biens">Favoris <Star size={13} /> <span>12</span></a>
              <a href="#agenda">À contacter <span>17</span></a>
            </nav>
            <div className="ip-view-tools">
              <button type="button">
                <ListFilter size={14} />
                Filtrer
              </button>
              <button type="button">Trier</button>
              <button type="button" aria-label="Paramètres de vue">
                <SlidersHorizontal size={15} />
              </button>
            </div>
          </header>

          <OpportunityTable opportunities={opportunities} />

          <a className="ip-load-more" href="#biens">
            Voir plus de biens
            <ChevronDown size={16} />
          </a>
        </article>
        </div>
        </div>

        <aside className="ip-wow-rail" aria-label="Tâches et signaux">
          <Panel title="Tâches du jour" count={todayTasks.length} actionIcon={Plus}>
            <div className="ip-wow-task-list">
              {todayTasks.map((task) => (
                <TaskRow key={task.id} store={store} task={task} />
              ))}
            </div>
            <a className="ip-side-link" href="#agenda">Voir toutes les tâches</a>
          </Panel>

          <Panel title="Signaux à surveiller" count={recentSignals.length}>
            <div className="ip-wow-signal-list">
              {recentSignals.map((signal) => (
                <SignalRow key={signal.id} signal={signal} />
              ))}
            </div>
            <a className="ip-side-link" href="#biens">Voir tous les signaux</a>
          </Panel>

          <a className="ip-tip-card" href="#settings">
            <span>
              <Lightbulb size={22} />
            </span>
            <div>
              <strong>Astuce ImmoPilot</strong>
              <p>Activez les alertes “Propriétaires motivés” pour ne rien manquer.</p>
            </div>
            <ArrowUpRight size={16} />
          </a>
        </aside>
      </section>
    </div>
  );
}

function DoodleStrip() {
  return (
    <section className="ip-doodle-strip" aria-hidden="true">
      <img src={dashboardDoodleBanner} alt="" />
    </section>
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

function OpportunityTable({ opportunities }: { opportunities: PriorityOpportunity[] }) {
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
        <span>Ajouté le</span>
        <span />
      </div>
      {opportunities.map((opportunity, index) => (
        <OpportunityRow index={index} key={opportunity.id} opportunity={opportunity} />
      ))}
    </div>
  );
}

function OpportunityRow({ index, opportunity }: { index: number; opportunity: PriorityOpportunity }) {
  return (
    <a className="ip-wow-row" href={`#biens?propertyId=${opportunity.id}`}>
      <span className="ip-checkbox" />
      <span className="ip-property-cell">
        <img src={opportunity.photo} alt="" />
        <span>
          <strong>{opportunity.title}</strong>
          <small>{opportunity.microcopy}</small>
        </span>
      </span>
      <Badge tone={opportunity.source === 'Immoweb' ? 'blue' : opportunity.source === 'Zimmo' ? 'green' : 'amber'}>
        {opportunity.source}
      </Badge>
      <span className="ip-table-price">{opportunity.price}</span>
      <span>{opportunity.surface}</span>
      <Badge tone={opportunity.signal === 'Baisse de prix' ? 'orange' : opportunity.signal === 'Prix attractif' ? 'blue' : 'green'}>
        {opportunity.signal}
      </Badge>
      <Badge tone={opportunity.score >= 82 ? 'scoreGood' : 'score'}>{opportunity.score}</Badge>
      <span>{index < 2 ? `Il y a ${index + 2} h` : `Il y a ${index + 4} h`}</span>
      <MoreHorizontal size={16} />
    </a>
  );
}

function TaskRow({ store, task }: { store: Store; task: Task }) {
  const relatedProperty = task.propertyId ? store.getProperty(task.propertyId) : undefined;

  return (
    <button className="ip-wow-task" type="button" onClick={() => store.toggleTask(task.id)}>
      <span className={`ip-task-check ${task.done ? 'is-done' : ''}`}>
        {task.done ? <CheckCircle2 size={15} /> : <Circle size={15} />}
      </span>
      <span>
        <strong>{cleanText(task.title)}</strong>
        <small>
          {task.time}
          {relatedProperty ? ` · ${cleanText(relatedProperty.city)}` : task.place ? ` · ${cleanText(task.place)}` : ''}
        </small>
      </span>
    </button>
  );
}

function SignalRow({ signal }: { signal: RecentSignal }) {
  return (
    <a className="ip-wow-signal" href="#biens">
      <Badge tone={signal.tone === 'hot' ? 'hot' : signal.tone === 'good' ? 'green' : signal.tone === 'warn' ? 'orange' : 'violet'}>
        {signal.value}
      </Badge>
      <span>
        <strong>{signal.title}</strong>
        <small>{signal.detail}</small>
      </span>
    </a>
  );
}

interface BadgeProps {
  children: ReactNode;
  tone: 'amber' | 'blue' | 'green' | 'hot' | 'orange' | 'score' | 'scoreGood' | 'violet';
}

function Badge({ children, tone }: BadgeProps) {
  return <span className={`ip-wow-badge tone-${tone}`}>{children}</span>;
}
