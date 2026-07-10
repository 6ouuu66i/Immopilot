// src/pages/Pipeline.tsx
import { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, List, Plus } from 'lucide-react';
import type { store as appStore } from '../lib/store';
import { KanbanBoard } from '../components/pipeline/KanbanBoard';
import { PipelineListView } from '../components/pipeline/PipelineListView';
import { DealFichePanel } from '../components/pipeline/DealFichePanel';
import { PipelineSkeleton } from '../components/pipeline/PipelineSkeleton';
import { useDeals } from '../lib/useDeals';
import { useListingScores } from '../lib/useListingScores';
import { usePipelineStages } from '../lib/usePipelineStages';
import type { DealFull } from '../lib/services/dealsService';
import type { ListingScoresByProperty } from '../lib/services/listingScoresService';
import type { PipelineStageRow } from '../lib/services/pipelineStagesService';
import { formatEuro } from '../lib/formatCurrency';
import type { Activity, Agent, Contact, Deal, PipelineStage, Property, Task } from '../types';
import '../components/pipeline/pipeline.css';

type Store = typeof appStore;
type ViewMode = 'kanban' | 'list';

interface PipelineProps {
  store: Store;
}

function getDealParamFromHash(): string | null {
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  return params.get('deal') ?? params.get('dealId');
}

function fmtComm(v: number) {
  return formatEuro(v);
}

function normalizeAgentRole(role: string | null | undefined): Agent['role'] {
  return role === 'admin' || role === 'agent' ? role : 'agent';
}

function mapStage(stage: PipelineStageRow): PipelineStage {
  return {
    id: stage.id,
    name: stage.name,
    color: stage.color ?? undefined,
  };
}

function mapProperty(deal: DealFull, scoresByProperty: ListingScoresByProperty): Property {
  const property = deal.property;
  const listing = deal.currentListing;
  const title = listing?.title_fr ?? listing?.title_nl ?? deal.title ?? deal.reference ?? 'Deal';
  const listingScore = scoresByProperty[deal.property_id];

  return {
    id: deal.property_id,
    supabasePropertyId: deal.property_id,
    title,
    propertyType: property?.property_subtype ?? property?.property_type ?? 'Bien',
    city: property?.locality ?? property?.province ?? 'Belgique',
    price: listing?.price ?? 0,
    photos: listing?.photo_urls ?? [],
    tag: listing?.is_fsbo ? 'FSBO' : 'Nouveau',
    score: listingScore?.score ?? 0,
    peb: 'N/A',
    surface: property?.living_area ?? property?.land_area ?? 0,
    bedrooms: property?.bedroom_count ?? 0,
    bathrooms: property?.bathroom_count ?? 0,
    source: listing?.source ?? 'Supabase',
    reserved: Boolean(deal.closed_at),
    ownerId: deal.owner_id,
    fsbo: Boolean(listing?.is_fsbo),
    publishedDays: 0,
    floodZone: 'Faible',
    notes: [],
    yieldEstimate: listing?.ai_gross_yield ? `${Number(listing.ai_gross_yield).toFixed(1)}%` : 'N/A',
    description: listing?.description_fr ?? listing?.description_nl ?? '',
    priceHistory: [{ date: (listing?.last_seen_at ?? deal.created_at).slice(0, 10), price: listing?.price ?? 0 }],
    status: deal.closed_at ? 'archivé' : 'disponible',
  };
}

function mapContact(deal: DealFull): Contact | undefined {
  if (!deal.contact) return undefined;
  return {
    id: deal.contact.id,
    reference: deal.contact.reference ?? 'CTC-...',
    name: deal.contact.full_name,
    email: deal.contact.email ?? 'Email a completer',
    phone: deal.contact.phone ?? 'Telephone a completer',
    roles: (deal.contact.roles.length > 0 ? deal.contact.roles : ['prospect']) as Contact['roles'],
    notes: deal.contact.notes ? [deal.contact.notes] : [],
    assignedDeals: [deal.id],
    assignedProperties: [deal.property_id],
  };
}

function mapAgent(deal: DealFull): Agent {
  const owner = deal.owner;
  return {
    id: deal.owner_id,
    name: owner?.full_name ?? owner?.email ?? 'Agent',
    role: normalizeAgentRole(owner?.role),
    avatar: owner?.avatar_url ?? '',
    status: 'active',
  };
}

function mapTask(task: DealFull['tasks'][number]): Task {
  const due = task.due_date ? new Date(task.due_date) : null;
  return {
    id: task.id,
    title: task.title,
    date: due && !Number.isNaN(due.getTime()) ? due.toISOString().slice(0, 10) : '',
    time: due && !Number.isNaN(due.getTime()) ? due.toTimeString().slice(0, 5) : '09:00',
    priority: task.priority === 'high' || task.priority === 'haute' ? 'haute' : task.priority === 'low' || task.priority === 'basse' ? 'basse' : 'moyenne',
    done: task.is_completed,
    agentId: task.owner_id,
    propertyId: task.property_id ?? null,
    dealId: task.deal_id,
    contactId: task.contact_id,
    place: undefined,
  };
}

function mapActivity(activity: DealFull['activities'][number], agentName: string): Activity {
  const text =
    activity.type === 'stage_changed' ? 'Changement de stage' :
    activity.type === 'deal_created' ? 'Deal cree' :
    activity.type === 'deal_won' ? 'Deal gagne' :
    activity.type === 'deal_lost' ? 'Deal perdu' :
    activity.type === 'deal_reopened' ? 'Deal rouvert' :
    activity.type;

  return {
    id: activity.id,
    type: activity.type,
    text,
    date: activity.created_at.slice(0, 10),
    agentId: activity.actor_id ?? '',
    agentName,
    entityType: 'deal',
    entityId: activity.deal_id ?? undefined,
  };
}

function mapDeal(deal: DealFull): Deal {
  return {
    id: deal.id,
    reference: deal.reference ?? 'DEAL-...',
    propertyId: deal.property_id,
    contactId: deal.contact_id ?? '',
    ownerId: deal.owner_id,
    stage: deal.stage?.name ?? 'Nouveau',
    activities: deal.activities.map((activity) => mapActivity(activity, deal.owner?.full_name ?? deal.owner?.email ?? 'Agent')),
    notes: deal.notes ? [deal.notes] : [],
    tasks: deal.tasks.map((task) => task.id),
    commissionStatus: deal.closed_at ? (deal.is_won ? 'payable' : 'brouillon') : 'prévue',
    commissionAmount: deal.estimated_commission ?? 0,
    title: deal.title ?? deal.reference ?? 'Deal',
    price: deal.currentListing?.price ?? 0,
  };
}

function createPipelineStoreFacade(
  baseStore: Store,
  dealsFull: DealFull[],
  stagesRows: PipelineStageRow[],
  scoresByProperty: ListingScoresByProperty,
): Store {
  const deals = dealsFull.map(mapDeal);
  const properties = new Map<Property['id'], Property>(dealsFull.map((deal) => [deal.property_id, mapProperty(deal, scoresByProperty)]));
  const contacts = new Map(
    dealsFull
      .map(mapContact)
      .filter((contact): contact is Contact => Boolean(contact))
      .map((contact) => [contact.id, contact]),
  );
  const agents = new Map(dealsFull.map(mapAgent).map((agent) => [agent.id, agent]));
  const tasks = new Map(dealsFull.map((deal) => [deal.id, deal.tasks.map(mapTask)]));
  const stages = stagesRows.map(mapStage);

  return {
    ...baseStore,
    getDeals: () => deals,
    getDeal: (id: string) => deals.find((deal) => deal.id === id),
    getDealByReference: (reference: string) => deals.find((deal) => deal.reference === reference),
    getPipelineStages: () => stages,
    getProperty: (id: Property['id']) => properties.get(id),
    getProperties: () => Array.from(properties.values()),
    getContact: (id: string) => contacts.get(id),
    getContacts: () => Array.from(contacts.values()),
    getAgents: () => Array.from(agents.values()),
    getDealTasks: (dealId: string) => tasks.get(dealId) ?? [],
    getTasks: () => Array.from(tasks.values()).flat(),
  } as unknown as Store;
}

interface KpiCellProps {
  label: string;
  value: number | string;
  delta: string;
  last?: boolean;
}

function KpiCell({ label, value, delta, last }: KpiCellProps) {
  return (
    <div className="lv-pipeline-kpi" style={{
      flex: 1,
      padding: '14px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      borderRight: last ? 'none' : '1px solid var(--color-border-default)',
    }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: 0, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans, var(--notion-sans))' }}>
        {label}
      </span>
      <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans, var(--notion-sans))', lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans, var(--notion-sans))' }}>
        {delta}
      </span>
    </div>
  );
}

export function Pipeline({ store }: PipelineProps) {
  const dealsState = useDeals();
  const stagesState = usePipelineStages();
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [selectedDealId, setSelectedDealId] = useState<string | null>(() => getDealParamFromHash());
  const scorePropertyIds = useMemo(
    () => Array.from(new Set(dealsState.deals.map((deal) => deal.property_id).filter(Boolean))),
    [dealsState.deals],
  );
  const { scoresByProperty } = useListingScores(scorePropertyIds);

  useEffect(() => {
    const syncSelectedDeal = () => setSelectedDealId(getDealParamFromHash());
    window.addEventListener('hashchange', syncSelectedDeal);
    syncSelectedDeal();
    return () => window.removeEventListener('hashchange', syncSelectedDeal);
  }, []);

  const pipelineStore = useMemo(
    () => createPipelineStoreFacade(store, dealsState.deals, stagesState.stages, scoresByProperty),
    [dealsState.deals, scoresByProperty, stagesState.stages, store],
  );
  const deals = pipelineStore.getDeals();
  const stages = pipelineStore.getPipelineStages();
  const selectedDeal = selectedDealId
    ? selectedDealId.startsWith('DEAL-')
      ? pipelineStore.getDealByReference(selectedDealId)
      : pipelineStore.getDeal(selectedDealId)
    : undefined;
  const panelOpen = Boolean(selectedDeal);

  useEffect(() => {
    if (!panelOpen) return undefined;

    window.dispatchEvent(new Event('ip-property-panel-open'));
    return () => {
      window.dispatchEvent(new Event('ip-property-panel-close'));
    };
  }, [panelOpen]);

  const kpis = useMemo(() => {
    const active = deals.filter((deal) => !['Perdu', 'Bien vendu'].includes(deal.stage));
    const mandats = deals.filter((deal) => deal.stage === 'Mandat signé').length;
    const vendus = deals.filter((deal) => deal.stage === 'Bien vendu').length;
    const commission = active.reduce((sum, deal) => sum + deal.commissionAmount, 0);
    return { active: active.length, mandats, vendus, commission };
  }, [deals]);
  const skeletonStageCounts = useMemo(() => (
    deals.reduce<Record<string, number>>((counts, deal) => {
      counts[deal.stage] = (counts[deal.stage] ?? 0) + 1;
      return counts;
    }, {})
  ), [deals]);
  const skeletonDealCount = Math.max(1, Math.min(deals.length || 3, 4));

  const handleSelectDeal = (dealId: string) => {
    setSelectedDealId((prev) => {
      const nextDealId = prev === dealId ? null : dealId;
      const nextDeal = nextDealId ? pipelineStore.getDeal(nextDealId) : undefined;
      window.location.hash = nextDeal?.reference ? `#pipeline?deal=${encodeURIComponent(nextDeal.reference)}` : '#pipeline';
      return nextDealId;
    });
  };

  const handleMoveDeal = (dealId: string, stageName: string) => {
    const stage = stagesState.stages.find((item) => item.name === stageName);
    if (!stage) return;
    void dealsState.updateDealStage(dealId, stage.id);
  };

  const handleUpdateDealLinks = (dealId: string, links: { contactId?: string; propertyId?: Property['id'] }) => {
    const patch: { contact_id?: string | null; property_id?: string | null } = {};

    if (links.contactId !== undefined) {
      patch.contact_id = links.contactId || null;
    }

    if (links.propertyId !== undefined) {
      const matchingDeal = dealsState.deals.find((item) => item.property_id === links.propertyId);
      if (matchingDeal?.property_id) {
        patch.property_id = matchingDeal.property_id;
      }
    }

    if (Object.keys(patch).length > 0) {
      void dealsState.updateDeal(dealId, patch);
    }
  };

  const handleCloseDeal = (dealId: string, outcome: 'won' | 'lost') => {
    void dealsState.closeDeal(dealId, {
      is_won: outcome === 'won',
      lost_reason: outcome === 'lost' ? 'Cloture depuis le pipeline' : null,
    });
  };

  const handleReopenDeal = (dealId: string) => {
    void dealsState.reopenDeal(dealId);
  };

  const isLoading = dealsState.isLoading || stagesState.isLoading;
  const loadError = dealsState.error ?? stagesState.error;

  return (
    <div className={`lv-pipeline lv-page ${panelOpen ? 'has-panel' : ''}`} style={{
      minHeight: 'calc(100vh - 58px)',
      background: 'var(--color-bg-page)',
      fontFamily: 'var(--font-sans, var(--notion-sans))',
      position: 'relative',
    }}>
      <div className="lv-pipeline-head" style={{ padding: panelOpen ? '24px 440px 0 32px' : '24px 32px 0', marginBottom: 16, transition: 'padding-right 180ms ease' }}>
        <h1 className="lv-title" style={{
          margin: 0,
          fontFamily: 'var(--font-serif, var(--notion-serif))',
          fontSize: 32,
          fontWeight: 400,
          lineHeight: 1.05,
          color: 'var(--color-text-primary)',
        }}>
          Opportunités
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 15, color: 'var(--color-text-secondary)' }}>
          Suivi commercial de vos dossiers actifs.
        </p>
      </div>

      <div className="lv-pipeline-toolbar" style={{ padding: panelOpen ? '0 440px 0 32px' : '0 32px', display: 'flex', alignItems: 'stretch', gap: 12, position: 'relative', zIndex: 2, transition: 'padding-right 180ms ease' }}>
        <div className="lv-pipeline-kpis" style={{ flex: 1, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 10, display: 'flex', alignItems: 'stretch' }}>
          <KpiCell label="Deals actifs" value={kpis.active} delta="Pipeline en cours" />
          <KpiCell label="Mandats signés" value={kpis.mandats} delta="Ce mois" />
          <KpiCell label="Biens vendus" value={kpis.vendus} delta="Ce mois" />
          <KpiCell label="Commission ouverte" value={fmtComm(kpis.commission)} delta="Estimée" last />
        </div>

        <div className="lv-pipeline-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div className="lv-pipeline-view-toggle" style={{ display: 'flex', border: '1px solid var(--color-border-default)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              className={`lv-icon-toggle ${viewMode === 'kanban' ? 'is-active' : ''}`}
              type="button"
              onClick={() => setViewMode('kanban')}
              title="Vue Kanban"
              style={{
                background: viewMode === 'kanban' ? 'var(--color-brand)' : 'var(--color-bg-surface)',
                border: 'none',
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: viewMode === 'kanban' ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
              }}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              className={`lv-icon-toggle ${viewMode === 'list' ? 'is-active' : ''}`}
              type="button"
              onClick={() => setViewMode('list')}
              title="Vue Liste"
              style={{
                background: viewMode === 'list' ? 'var(--color-brand)' : 'var(--color-bg-surface)',
                border: 'none',
                borderLeft: '1px solid var(--color-border-default)',
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: viewMode === 'list' ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
              }}
            >
              <List size={15} />
            </button>
          </div>

          <button
            type="button"
            className="lv-secondary-button"
            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontFamily: 'var(--font-sans, var(--notion-sans))', color: 'var(--color-text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="7" y1="12" x2="17" y2="12" />
              <line x1="10" y1="18" x2="14" y2="18" />
            </svg>
            Filtres
          </button>

          <button
            type="button"
            className="lv-primary-button"
            title="Sélectionnez un bien pour créer un deal"
            onClick={() => { window.location.hash = '#biens'; }}
            style={{ background: 'var(--color-brand)', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans, var(--notion-sans))', color: 'var(--color-text-inverse)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            + Nouveau deal
          </button>
        </div>
      </div>

      {loadError && (
        <div className="lv-pipeline-error" style={{ margin: '12px 32px 0', padding: '10px 12px', border: '1px solid var(--color-danger-border)', borderRadius: 8, background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', fontSize: 13 }}>
          {loadError}
        </div>
      )}

<div
          className="pipeline-workarea"
          style={{
            padding: panelOpen ? '16px 462px 32px 32px' : '16px 0 32px 32px',
            display: 'block',
            transition: 'padding-right 180ms ease',
          }}
        >
          <div style={{ minWidth: 0 }}>
            {isLoading ? (
              <PipelineSkeleton viewMode={viewMode} stageCounts={skeletonStageCounts} dealCount={skeletonDealCount} />
            ) : viewMode === 'kanban' ? (
            <KanbanBoard
              deals={deals}
              stages={stages}
              onSelectDeal={handleSelectDeal}
              onMoveDeal={handleMoveDeal}
              selectedDealId={selectedDealId}
              store={pipelineStore}
            />
          ) : (
            <PipelineListView
              deals={deals}
              stages={stages}
              onSelectDeal={handleSelectDeal}
              onMoveDeal={handleMoveDeal}
              selectedDealId={selectedDealId}
              store={pipelineStore}
            />
          )}
        </div>
      </div>

      {panelOpen && selectedDeal && (
        <DealFichePanel
          deal={selectedDeal}
          store={pipelineStore}
          onClose={() => {
            setSelectedDealId(null);
            window.location.hash = '#pipeline';
          }}
          onMoveDeal={handleMoveDeal}
          onUpdateDealLinks={handleUpdateDealLinks}
          onCloseDeal={handleCloseDeal}
          onReopenDeal={handleReopenDeal}
        />
      )}
    </div>
  );
}
