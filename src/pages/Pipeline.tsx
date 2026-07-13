// src/pages/Pipeline.tsx
import { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, List, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { KanbanBoard } from '../components/pipeline/KanbanBoard';
import { PipelineListView } from '../components/pipeline/PipelineListView';
import { DealFichePanel } from '../components/pipeline/DealFichePanel';
import { PipelineSkeleton } from '../components/pipeline/PipelineSkeleton';
import { useAuth } from '../lib/auth';
import { queryKeys } from '../lib/queryKeys';
import { listPropertiesForPipelineLink } from '../lib/supabaseProperties';
import { useContacts } from '../lib/useContacts';
import { useDeals } from '../lib/useDeals';
import { useListingScores } from '../lib/useListingScores';
import { usePipelineStages } from '../lib/usePipelineStages';
import {
  buildPipelineRuntime,
  getPipelineDataState,
  getPipelineStageTransition,
  isSupportedPipelineStage,
  pipelineUiError,
  resolvePipelineDeal,
  togglePipelineDealSelection,
} from '../lib/pipelineRuntime';
import { formatEuro } from '../lib/formatCurrency';
import type { PipelineDealLinks } from '../types/pipeline';
import '../components/pipeline/pipeline.css';

type ViewMode = 'kanban' | 'list';

function getDealParamFromHash(): string | null {
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  return params.get('deal') ?? params.get('dealId');
}

function fmtComm(v: number) {
  return formatEuro(v);
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

export function Pipeline() {
  const { user } = useAuth();
  const dealsState = useDeals({ includeClosed: true });
  const stagesState = usePipelineStages();
  const contactsState = useContacts();
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [selectedDealKey, setSelectedDealKey] = useState<string | null>(() => getDealParamFromHash());
  const [moveError, setMoveError] = useState<string | null>(null);
  const linkPropertiesQuery = useQuery({
    queryKey: queryKeys.pipelineLinkProperties(user?.id),
    queryFn: () => listPropertiesForPipelineLink(),
    enabled: Boolean(user && selectedDealKey),
    staleTime: 5 * 60 * 1000,
  });
  const scorePropertyIds = useMemo(
    () => Array.from(new Set(dealsState.deals.map((deal) => deal.property_id).filter(Boolean))),
    [dealsState.deals],
  );
  const { scoresByProperty } = useListingScores(scorePropertyIds);

  useEffect(() => {
    const syncSelectedDeal = () => setSelectedDealKey(getDealParamFromHash());
    window.addEventListener('hashchange', syncSelectedDeal);
    syncSelectedDeal();
    return () => window.removeEventListener('hashchange', syncSelectedDeal);
  }, []);

  const pipeline = useMemo(
    () => buildPipelineRuntime(dealsState.deals, stagesState.stages, scoresByProperty, {
      contacts: contactsState.contacts,
      properties: linkPropertiesQuery.data ?? [],
    }),
    [contactsState.contacts, dealsState.deals, linkPropertiesQuery.data, scoresByProperty, stagesState.stages],
  );
  const { deals, stages } = pipeline;
  const selectedDeal = resolvePipelineDeal(pipeline, selectedDealKey);
  const selectedDealId = selectedDeal?.id ?? null;
  const panelOpen = Boolean(selectedDeal);

  useEffect(() => {
    if (!panelOpen) return undefined;

    window.dispatchEvent(new Event('ip-property-panel-open'));
    return () => {
      window.dispatchEvent(new Event('ip-property-panel-close'));
    };
  }, [panelOpen]);

  const kpis = useMemo(() => {
    const active = deals.filter((deal) => !deal.closedAt && !deal.isWon && !deal.isLost);
    const mandats = active.filter((deal) => deal.stage.toLocaleLowerCase('fr').includes('mandat')).length;
    const vendus = deals.filter((deal) => deal.isWon).length;
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
    setSelectedDealKey((previousKey) => {
      const nextDealId = togglePipelineDealSelection(pipeline, previousKey, dealId);
      const nextDeal = nextDealId ? pipeline.dealsById.get(nextDealId) : undefined;
      window.location.hash = nextDeal?.reference ? `#pipeline?deal=${encodeURIComponent(nextDeal.reference)}` : '#pipeline';
      return nextDealId;
    });
  };

  const handleMoveDeal = async (dealId: string, stageId: string) => {
    setMoveError(null);
    const deal = pipeline.dealsById.get(dealId);
    const targetStage = stages.find((stage) => stage.id === stageId);
    if (!deal || !targetStage || !isSupportedPipelineStage(stages, stageId)) {
      setMoveError(pipelineUiError('move', 'Etape non supportee.'));
      throw new Error('Etape de pipeline non supportee.');
    }

    try {
      const transition = getPipelineStageTransition(deal, targetStage);
      if (transition.type === 'blocked') {
        if (transition.reason === 'same-stage') return;
        throw new Error(transition.reason === 'closed'
          ? 'Reouvrez ce deal avant de le deplacer.'
          : 'Configuration terminale invalide.');
      }
      if (transition.type === 'close') {
        await dealsState.closeDeal(dealId, {
          is_won: transition.outcome === 'won',
          lost_reason: transition.outcome === 'lost' ? 'Cloture depuis le pipeline' : null,
        });
      } else {
        await dealsState.updateDealStage(dealId, transition.stageId);
      }
    } catch (error) {
      setMoveError(pipelineUiError('move', 'Veuillez reessayer.'));
      throw error;
    }
  };

  const handleUpdateDealLinks = async (dealId: string, links: PipelineDealLinks) => {
    const patch: { contact_id?: string | null; property_id?: string | null } = {};

    if (links.contactId !== undefined) {
      if (links.contactId && !pipeline.contactsById.has(links.contactId)) throw new Error('Contact Supabase introuvable.');
      patch.contact_id = links.contactId || null;
    }

    if (links.propertyId !== undefined) {
      if (!pipeline.propertiesById.has(links.propertyId)) throw new Error('Bien Supabase introuvable.');
      patch.property_id = links.propertyId;
    }

    if (Object.keys(patch).length > 0) {
      await dealsState.updateDeal(dealId, patch);
    }
  };

  const handleCloseDeal = async (dealId: string, outcome: 'won' | 'lost') => {
    await dealsState.closeDeal(dealId, {
      is_won: outcome === 'won',
      lost_reason: outcome === 'lost' ? 'Cloture depuis le pipeline' : null,
    });
  };

  const handleReopenDeal = async (dealId: string) => {
    await dealsState.reopenDeal(dealId);
  };

  const isLoading = dealsState.isLoading || stagesState.isLoading;
  const dataLoadError = dealsState.loadError ?? stagesState.error;
  const loadError = dataLoadError ?? moveError ?? dealsState.mutationError;
  const dataState = getPipelineDataState(dealsState.deals, stagesState.stages, isLoading, dataLoadError);

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
            {dataState === 'loading' ? (
              <PipelineSkeleton viewMode={viewMode} stageCounts={skeletonStageCounts} dealCount={skeletonDealCount} />
            ) : dataState === 'error' ? null : dataState === 'empty' && stages.length === 0 ? (
              <div className="list-empty">Aucune etape de pipeline disponible.</div>
            ) : viewMode === 'kanban' ? (
            <KanbanBoard
              deals={deals}
              stages={stages}
              onSelectDeal={handleSelectDeal}
              onMoveDeal={handleMoveDeal}
              selectedDealId={selectedDealId}
              propertiesById={pipeline.propertiesById}
              agentsById={pipeline.agentsById}
              tasksByDealId={pipeline.tasksByDealId}
              pendingDealIds={dealsState.pendingDealIds}
            />
          ) : (
            <PipelineListView
              deals={deals}
              stages={stages}
              onSelectDeal={handleSelectDeal}
              onMoveDeal={handleMoveDeal}
              selectedDealId={selectedDealId}
              propertiesById={pipeline.propertiesById}
              agentsById={pipeline.agentsById}
              tasksByDealId={pipeline.tasksByDealId}
              pendingDealIds={dealsState.pendingDealIds}
            />
          )}
        </div>
      </div>

      {panelOpen && selectedDeal && (
        <DealFichePanel
          deal={selectedDeal}
          property={pipeline.propertiesById.get(selectedDeal.propertyId)}
          contact={pipeline.contactsById.get(selectedDeal.contactId)}
          stages={stages}
          contacts={pipeline.contacts}
          properties={pipeline.properties}
          isPending={dealsState.pendingDealIds.has(selectedDeal.id)}
          onClose={() => {
            setSelectedDealKey(null);
            window.location.hash = '#pipeline';
          }}
          onMoveDeal={handleMoveDeal}
          onUpdateDealLinks={handleUpdateDealLinks}
          onCloseDeal={handleCloseDeal}
          onReopenDeal={handleReopenDeal}
          onRefreshDeals={dealsState.refresh}
        />
      )}
    </div>
  );
}
