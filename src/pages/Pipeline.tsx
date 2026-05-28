// src/pages/Pipeline.tsx
import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { store as appStore } from '../lib/store';
import { KanbanBoard }        from '../components/pipeline/KanbanBoard';
import { PipelineListView }   from '../components/pipeline/PipelineListView';
import { DealFichePanel }     from '../components/pipeline/DealFichePanel';
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

interface ViewBtnProps { active: boolean; onClick: () => void; title: string; bordered?: boolean; children: React.ReactNode; }

function ViewBtn({ active, onClick, title, bordered, children }: ViewBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        background: active ? '#1E5A3A' : '#fff',
        border: 'none',
        borderLeft: bordered ? '1px solid #E6E4DF' : 'none',
        padding: '8px 12px',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center',
        color: active ? '#fff' : '#6B6B6B',
        transition: 'background 140ms, color 140ms',
      }}
    >
      {children}
    </button>
  );
}

// ── Pipeline Page ──────────────────────────────────────────────────────────────

export function Pipeline({ store }: PipelineProps) {
  const [viewMode, setViewMode]             = useState<ViewMode>('kanban');
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [, forceUpdate]                     = useState(0);

  useEffect(() => {
    const handler = () => forceUpdate(n => n + 1);
    window.addEventListener('ip-state-changed', handler);
    return () => window.removeEventListener('ip-state-changed', handler);
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
      paddingRight: panelOpen ? 480 : 0,
      transition: 'padding-right 180ms ease',
    }}>

      {/* ── Page header ── */}
      <div style={{ padding: '24px 32px 0' }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, fontFamily: 'var(--notion-serif)', color: '#1D1F1E', letterSpacing: '-0.02em' }}>
          Opportunités
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B6B6B' }}>
          Suivi commercial de vos dossiers actifs
        </p>
      </div>

      {/* ── KPI row + actions ── */}
      <div style={{ padding: '16px 32px 0', display: 'flex', alignItems: 'stretch', gap: 12 }}>
        {/* KPI container */}
        <div style={{ flex: 1, background: '#fff', border: '1px solid #E6E4DF', borderRadius: 10, display: 'flex', alignItems: 'stretch' }}>
          <KpiCell label="Deals actifs"       value={kpis.active}               delta="Pipeline en cours" />
          <KpiCell label="Mandats signés"     value={kpis.mandats}              delta="Ce mois" />
          <KpiCell label="Biens vendus"       value={kpis.vendus}               delta="Ce mois" />
          <KpiCell label="Commission ouverte" value={fmtComm(kpis.commission)}  delta="Estimée" last />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid #E6E4DF', borderRadius: 8, overflow: 'hidden' }}>
            <ViewBtn active={viewMode === 'kanban'} onClick={() => setViewMode('kanban')} title="Vue Kanban">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="7" height="18" rx="1" />
                <rect x="14" y="3" width="7" height="18" rx="1" />
              </svg>
            </ViewBtn>
            <ViewBtn active={viewMode === 'list'} onClick={() => setViewMode('list')} title="Vue Liste" bordered>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <line x1="8"  y1="6"  x2="21" y2="6"  />
                <line x1="8"  y1="12" x2="21" y2="12" />
                <line x1="8"  y1="18" x2="21" y2="18" />
                <line x1="3"  y1="6"  x2="3.01" y2="6"  />
                <line x1="3"  y1="12" x2="3.01" y2="12" />
                <line x1="3"  y1="18" x2="3.01" y2="18" />
              </svg>
            </ViewBtn>
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
      <div style={{ padding: '16px 32px 32px' }}>
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

      {/* ── Fiche panel ── */}
      {panelOpen && selectedDeal && (
        <DealFichePanel
          deal={selectedDeal}
          store={store}
          onClose={() => setSelectedDealId(null)}
          onMoveDeal={handleMoveDeal}
        />
      )}
    </div>
  );
}
