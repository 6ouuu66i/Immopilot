// src/components/pipeline/PipelineListView.tsx
import { useState } from 'react';
import type { store as appStore } from '../../lib/store';
import type { Deal } from '../../types';

type Store = typeof appStore;

interface PipelineListViewProps {
  deals: Deal[];
  stages: ReturnType<Store['getPipelineStages']>;
  onSelectDeal: (dealId: string) => void;
  selectedDealId: string | null;
  store: Store;
}

const priceFormatter = new Intl.NumberFormat('fr-BE', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
});
function fmt(v: number) { return priceFormatter.format(v).replace(/\s?EUR/, ' €'); }

function stageNameToId(name: string): string {
  const n = (name ?? '').trim().toLowerCase();
  if (n.includes('nouveau'))  return 'nouveau';
  if (n.includes('qualif'))   return 'qualifie';
  if (n.includes('contact'))  return 'contact';
  if (n.includes('visite'))   return 'visite';
  if (n.includes('propos'))   return 'proposition';
  if (n.includes('mandat'))   return 'mandat';
  if (n.includes('vend'))     return 'vendu';
  if (n.includes('perd'))     return 'perdu';
  return 'nouveau';
}

// ── List Row ───────────────────────────────────────────────────────────────────

interface ListRowProps {
  deal: Deal;
  store: Store;
  selected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function ListRow({ deal, store, selected, onSelect, onDragStart, onDragEnd }: ListRowProps) {
  const property = store.getProperty(deal.propertyId);
  const agent    = store.getAgents().find(a => a.id === deal.ownerId);
  const score    = property?.score ?? 70;
  const offset   = Math.round(180 - (180 * (score / 100)));
  const scoreClass =
    score >= 80 ? 'score-excellent' :
    score >= 60 ? 'score-moderate'  : 'score-critical';

  return (
    <div
      className="list-row"
      style={{ outline: selected ? '2px solid #1E5A3A' : 'none', outlineOffset: -2 }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
    >
      <div className="lr-thumb">
        {property?.photos[0] && (
          <img src={property.photos[0]} alt="" loading="lazy" />
        )}
      </div>
      <div>
        <div className="lr-title">{property?.title ?? deal.title}</div>
        <div className="lr-city">{property?.city ?? '—'}</div>
      </div>
      <div className="lr-price">{fmt(deal.price)}</div>
      <div className="lr-commission">{fmt(deal.commissionAmount)}</div>
      <div className="lr-owner">
        {agent?.avatar && (
          <div className="lr-avatar" style={{ backgroundImage: `url('${agent.avatar}')` }} />
        )}
        <span className="lr-owner-name">{agent?.name ?? '—'}</span>
      </div>
      <div />
      <div className="lr-score">
        <svg viewBox="0 0 100 100" className={`sketch-double-score ${scoreClass}`} style={{ width: 30, height: 30 }}>
          <path d="M 50,11 C 71,9 87,25 89,49 C 91,73 75,89 50,87 C 25,85 9,69 11,49 C 13,29 29,13 50,11 Z" className="sketch-bg-fill" />
          <path d="M 50,11 C 71,9 87,25 89,49 C 91,73 75,89 50,87 C 25,85 9,69 11,49 C 13,29 29,13 50,11 Z" className="sketch-circle-back-1" />
          <path
            className="sketch-progress-ribbon"
            d="M 22,70 C 13,50 17,29 37,18 C 57,7 78,13 86,33 C 94,53 85,74 65,83"
            strokeDasharray="180"
            strokeDashoffset={offset}
          />
          <text x="50" y="54" className="sketch-text-score" style={{ fontSize: '32px' }}>{score}</text>
        </svg>
      </div>
      <div className="lr-actions">
        <button
          type="button"
          className="lr-menu-btn"
          onClick={e => e.stopPropagation()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="19" cy="12" r="1.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Pipeline List View ─────────────────────────────────────────────────────────

export function PipelineListView({
  deals, stages, onSelectDeal, selectedDealId, store,
}: PipelineListViewProps) {
  const [draggingDealId, setDraggingDealId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  const handleDrop = (stageName: string, e: React.DragEvent) => {
    e.preventDefault();
    if (!draggingDealId) return;
    const deal = deals.find(d => d.id === draggingDealId);
    if (deal && stageNameToId(deal.stage) !== stageNameToId(stageName)) {
      store.moveDealStage(draggingDealId, stageName);
    }
    setDraggingDealId(null);
  };

  return (
    <div className="list-view">
      {stages.map(stage => {
        const stageId         = stageNameToId(stage.name);
        const stageDeals      = deals.filter(d => stageNameToId(d.stage) === stageId);
        const totalCommission = stageDeals.reduce((sum, d) => sum + d.commissionAmount, 0);

        return (
          <div
            key={stage.id}
            className={`list-group${dragOverStageId === stageId ? ' drag-over' : ''}`}
            data-stage={stageId}
            onDragOver={e => { e.preventDefault(); setDragOverStageId(stageId); }}
            onDragLeave={() => setDragOverStageId(null)}
            onDrop={e => { setDragOverStageId(null); handleDrop(stage.name, e); }}
          >
            <div className="list-group-head">
              {stage.name}
              <span className="list-group-count">{stageDeals.length}</span>
              <span className="list-group-total">
                {totalCommission > 0 ? (
                  <><strong>{totalCommission.toLocaleString('fr-BE')} €</strong> commission</>
                ) : ''}
              </span>
            </div>
            {stageDeals.length === 0 ? (
              <div className="list-empty">Aucun deal</div>
            ) : (
              stageDeals.map(deal => (
                <ListRow
                  key={deal.id}
                  deal={deal}
                  store={store}
                  selected={selectedDealId === deal.id}
                  onSelect={() => onSelectDeal(deal.id)}
                  onDragStart={e => {
                    e.dataTransfer.setData('text/plain', deal.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggingDealId(deal.id);
                  }}
                  onDragEnd={() => setDraggingDealId(null)}
                />
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
