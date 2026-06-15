// src/pages/Pipeline.tsx
import { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, List, Plus } from 'lucide-react';
import type { store as appStore } from '../lib/store';
import { KanbanBoard }        from '../components/pipeline/KanbanBoard';
import { PipelineListView }   from '../components/pipeline/PipelineListView';
import { DealFichePanel }     from '../components/pipeline/DealFichePanel';
import { PageIllustrationHeader } from '../components/ui';
import '../components/pipeline/pipeline.css';

type Store = typeof appStore;
type ViewMode = 'kanban' | 'list';

interface PipelineProps {
  store: Store;
}

const commFormatter = new Intl.NumberFormat('fr-BE', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
});
function fmtComm(v: number) { return commFormatter.format(v).replace(/\s?EUR/, ' €'); }

// ── Sub-components ─────────────────────────────────────────────────────────────

interface KpiCellProps { label: string; value: number | string; delta: string; last?: boolean; }

function KpiCell({ label, value, delta, last }: KpiCellProps) {
  return (
    <div style={{
      flex: 1,
      padding: '14px 20px',
      display: 'flex', flexDirection: 'column', gap: 6,
      borderRight: last ? 'none' : '1px solid #E6E4DF',
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#9A9A9A', fontFamily: 'var(--notion-mono)', textTransform: 'uppercase' as const }}>
        {label}
      </span>
      <span style={{ fontSize: 28, fontWeight: 700, color: '#1D1F1E', fontFamily: 'var(--notion-sans)', lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontSize: 11, color: '#6B6B6B', fontFamily: 'var(--notion-sans)' }}>
        {delta}
      </span>
    </div>
  );
}


// ── Pipeline Page ──────────────────────────────────────────────────────────────

export function Pipeline({ store }: PipelineProps) {
  const [viewMode, setViewMode]             = useState<ViewMode>('kanban');
  const [selectedDealId, setSelectedDealId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
    return params.get('dealId');
  });
  const [, forceUpdate]                     = useState(0);

  useEffect(() => {
    const handler = () => forceUpdate(n => n + 1);
    const syncSelectedDeal = () => {
      const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
      const dealId = params.get('dealId');
      if (dealId) setSelectedDealId(dealId);
    };
    window.addEventListener('ip-state-changed', handler);
    window.addEventListener('hashchange', syncSelectedDeal);
    syncSelectedDeal();
    return () => {
      window.removeEventListener('ip-state-changed', handler);
      window.removeEventListener('hashchange', syncSelectedDeal);
    };
  }, []);

  const deals  = store.getDeals();
  const stages = store.getPipelineStages();
  const selectedDeal = selectedDealId ? store.getDeal(selectedDealId) : undefined;
  const panelOpen    = Boolean(selectedDeal);

  const kpis = useMemo(() => {
    const active     = deals.filter(d => !['Perdu', 'Bien vendu'].includes(d.stage));
    const mandats    = deals.filter(d => d.stage === 'Mandat signé').length;
    const vendus     = deals.filter(d => d.stage === 'Bien vendu').length;
    const commission = active.reduce((sum, d) => sum + d.commissionAmount, 0);
    return { active: active.length, mandats, vendus, commission };
  }, [deals]);

  const handleSelectDeal = (dealId: string) => {
    setSelectedDealId(prev => prev === dealId ? null : dealId);
  };

  const handleMoveDeal = (dealId: string, stageName: string) => {
    store.moveDealStage(dealId, stageName);
  };

  return (
    <div style={{
      minHeight: '100%',
      background: '#F7F6F3',
      fontFamily: 'var(--notion-sans)',
      position: 'relative',
    }}>

      {/* ── Illustration header ── */}
      <PageIllustrationHeader
        imageUrl="/pipeline-header-illustration.png"
        height={150}
        padding="12px 32px 0"
        backgroundPosition="center 48%"
        backgroundSize="100% auto"
      />

      {/* ── Page title ── */}
      <div style={{ padding: '0 32px', marginTop: -4, marginBottom: 16 }}>
        <h1 style={{
          margin: 0,
          fontFamily: 'var(--notion-serif)',
          fontSize: 32,
          fontWeight: 700,
          lineHeight: 1.05,
          color: '#1F1F1F',
        }}>
          Opportunités
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 15, color: '#474943' }}>
          Suivi commercial de vos dossiers actifs.
        </p>
      </div>

      {/* ── KPI row + actions ── */}
      <div style={{ padding: '0 32px', marginTop: -8, display: 'flex', alignItems: 'stretch', gap: 12, position: 'relative', zIndex: 2 }}>
        {/* KPI container */}
        <div style={{ flex: 1, background: '#fff', border: '1px solid #E6E4DF', borderRadius: 10, display: 'flex', alignItems: 'stretch' }}>
          <KpiCell label="Deals actifs"       value={kpis.active}               delta="Pipeline en cours" />
          <KpiCell label="Mandats signés"     value={kpis.mandats}              delta="Ce mois" />
          <KpiCell label="Biens vendus"       value={kpis.vendus}               delta="Ce mois" />
          <KpiCell label="Commission ouverte" value={fmtComm(kpis.commission)}  delta="Estimée" last />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* View toggle — same as Biens */}
          <div style={{ display: 'flex', border: '1px solid #E6E4DF', borderRadius: 8, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              title="Vue Kanban"
              style={{
                background: viewMode === 'kanban' ? '#1E5A3A' : '#fff',
                border: 'none',
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center',
                color: viewMode === 'kanban' ? '#fff' : '#6B6F6D',
              }}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="Vue Liste"
              style={{
                background: viewMode === 'list' ? '#1E5A3A' : '#fff',
                border: 'none',
                borderLeft: '1px solid #E6E4DF',
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center',
                color: viewMode === 'list' ? '#fff' : '#6B6F6D',
              }}
            >
              <List size={15} />
            </button>
          </div>

          {/* Filtres */}
          <button
            type="button"
            style={{ background: '#fff', border: '1px solid #E6E4DF', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontFamily: 'var(--notion-sans)', color: '#1D1F1E', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="6"  x2="20" y2="6"  />
              <line x1="7" y1="12" x2="17" y2="12" />
              <line x1="10" y1="18" x2="14" y2="18" />
            </svg>
            Filtres
          </button>

          {/* Nouveau deal */}
          <button
            type="button"
            style={{ background: '#1E5A3A', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'var(--notion-sans)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={14} />
            Nouveau deal
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div
        className="pipeline-workarea"
        style={{
          padding: '16px 32px 32px',
          display: 'grid',
          gridTemplateColumns: panelOpen ? 'minmax(0, 1fr) 480px' : 'minmax(0, 1fr)',
          gap: 12,
          alignItems: 'start',
        }}
      >
        <div style={{ minWidth: 0 }}>
          {viewMode === 'kanban' ? (
            <KanbanBoard
              deals={deals}
              stages={stages}
              onSelectDeal={handleSelectDeal}
              onMoveDeal={handleMoveDeal}
              selectedDealId={selectedDealId}
              store={store}
            />
          ) : (
            <PipelineListView
              deals={deals}
              stages={stages}
              onSelectDeal={handleSelectDeal}
              selectedDealId={selectedDealId}
              store={store}
            />
          )}
        </div>

        {panelOpen && selectedDeal && (
          <DealFichePanel
            deal={selectedDeal}
            store={store}
            onClose={() => setSelectedDealId(null)}
            onMoveDeal={handleMoveDeal}
          />
        )}
      </div>
    </div>
  );
}
