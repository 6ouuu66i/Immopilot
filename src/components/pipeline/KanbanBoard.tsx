// src/components/pipeline/KanbanBoard.tsx
import { useState } from 'react';
import type { store as appStore } from '../../lib/store';
import type { Deal } from '../../types';

type Store = typeof appStore;

interface KanbanBoardProps {
  deals: Deal[];
  stages: ReturnType<Store['getPipelineStages']>;
  onSelectDeal: (dealId: string) => void;
  onMoveDeal: (dealId: string, stageName: string) => void;
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

// ── Deal Card ──────────────────────────────────────────────────────────────────

interface DealCardProps {
  deal: Deal;
  store: Store;
  selected: boolean;
  isDragging?: boolean;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function DealCard({ deal, store, selected, isDragging, onSelect, onDragStart, onDragEnd }: DealCardProps) {
  const property = store.getProperty(deal.propertyId);
  const agent    = store.getAgents().find(a => a.id === deal.ownerId);
  const photo    = property?.photos[0] ?? '';
  const score    = property?.score ?? 70;
  const offset   = Math.round(180 - (180 * (score / 100)));
  const scoreClass =
    score >= 80 ? 'score-excellent' :
    score >= 60 ? 'score-moderate'  : 'score-critical';

  return (
    <article
      className={`deal-card${isDragging ? ' dragging' : ''}`}
      style={{ outline: selected ? '2px solid #1E5A3A' : 'none', outlineOffset: 2 }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
    >
      <div className="dc-img">
        {photo && <img src={photo} alt={property?.title ?? ''} loading="lazy" />}
      </div>
      <div className="dc-ai">
        <svg viewBox="0 0 100 100" className={`sketch-double-score ${scoreClass}`}>
          <path d="M 50,11 C 71,9 87,25 89,49 C 91,73 75,89 50,87 C 25,85 9,69 11,49 C 13,29 29,13 50,11 Z" className="sketch-bg-fill" />
          <path d="M 50,11 C 71,9 87,25 89,49 C 91,73 75,89 50,87 C 25,85 9,69 11,49 C 13,29 29,13 50,11 Z" className="sketch-circle-back-1" />
          <path d="M 51,9 C 73,12 89,29 86,52 C 83,75 66,90 43,88 C 21,86 7,67 10,41 C 13,15 29,5 51,9 Z" className="sketch-circle-back-2" />
          <path
            className="sketch-progress-ribbon"
            d="M 22,70 C 13,50 17,29 37,18 C 57,7 78,13 86,33 C 94,53 85,74 65,83"
            strokeDasharray="180"
            strokeDashoffset={offset}
          />
          <text x="50" y="54" className="sketch-text-score" style={{ fontSize: '32px' }}>{score}</text>
        </svg>
      </div>
      <div className="dc-body">
        <div className="dc-title">{property?.title ?? deal.title}</div>
        <div className="dc-city">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a8 8 0 0 0-8 8c0 5.5 8 12 8 12s8-6.5 8-12a8 8 0 0 0-8-8z" />
            <circle cx="12" cy="10" r="2.5" fill="#FFFFFF" />
          </svg>
          {property?.city ?? '—'}
        </div>
        <div className="dc-price">{fmt(deal.price)}</div>
        {/* Clean divider replacing the legacy wavy SVG */}
        <div style={{ borderTop: '1px solid #E6E4DF', margin: '10px 0 8px' }} />
        <div className="dc-foot">
          <div className="dc-owner">
            {agent?.avatar && (
              <div className="dc-avatar" style={{ backgroundImage: `url('${agent.avatar}')` }} />
            )}
            <span className="dc-owner-name">{agent?.name.split(' ')[0] ?? '—'}</span>
          </div>
          <span className="dc-commission">{fmt(deal.commissionAmount)}</span>
        </div>
      </div>
    </article>
  );
}

// ── Kanban Column ──────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  stage: { id: string; name: string };
  deals: Deal[];
  store: Store;
  selectedDealId: string | null;
  draggingDealId: string | null;
  onSelectDeal: (dealId: string) => void;
  onDrop: (stageName: string) => void;
  onDragStart: (dealId: string) => void;
  onDragEnd: () => void;
}

function KanbanColumn({
  stage, deals, store, selectedDealId, draggingDealId,
  onSelectDeal, onDrop, onDragStart, onDragEnd,
}: KanbanColumnProps) {
  const [dragOver, setDragOver] = useState(false);
  const stageId         = stageNameToId(stage.name);
  const totalCommission = deals.reduce((sum, d) => sum + d.commissionAmount, 0);

  return (
    <div
      className={`column${dragOver ? ' drag-over' : ''}`}
      data-stage={stageId}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); onDrop(stage.name); }}
    >
      <div className="column-head">
        <div className="column-head-row">
          <span className="column-name">{stage.name}</span>
          <span className="column-count">{deals.length}</span>
        </div>
        <div className="column-total">
          {totalCommission > 0 ? (
            <><strong>{totalCommission.toLocaleString('fr-BE')} €</strong> commission</>
          ) : '—'}
        </div>
      </div>
      <div className="column-body">
        {deals.length === 0 ? (
          <div className="column-empty">Aucun deal dans cette étape</div>
        ) : (
          deals.map(deal => (
            <DealCard
              key={deal.id}
              deal={deal}
              store={store}
              selected={selectedDealId === deal.id}
              isDragging={draggingDealId === deal.id}
              onSelect={() => onSelectDeal(deal.id)}
              onDragStart={e => {
                e.dataTransfer.setData('text/plain', deal.id);
                e.dataTransfer.effectAllowed = 'move';
                onDragStart(deal.id);
              }}
              onDragEnd={onDragEnd}
            />
          ))
        )}
      </div>
      <button type="button" className="column-add">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Ajouter un deal
      </button>
    </div>
  );
}

// ── Kanban Board ───────────────────────────────────────────────────────────────

export function KanbanBoard({
  deals, stages, onSelectDeal, onMoveDeal, selectedDealId, store,
}: KanbanBoardProps) {
  const [draggingDealId, setDraggingDealId] = useState<string | null>(null);

  const handleDrop = (stageName: string) => {
    if (!draggingDealId) return;
    const deal = deals.find(d => d.id === draggingDealId);
    if (deal && stageNameToId(deal.stage) !== stageNameToId(stageName)) {
      onMoveDeal(draggingDealId, stageName);
    }
    setDraggingDealId(null);
  };

  return (
    <div className="kanban-board">
      {stages.map(stage => {
        const stageId    = stageNameToId(stage.name);
        const stageDeals = deals.filter(d => stageNameToId(d.stage) === stageId);
        return (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            deals={stageDeals}
            store={store}
            selectedDealId={selectedDealId}
            draggingDealId={draggingDealId}
            onSelectDeal={onSelectDeal}
            onDrop={handleDrop}
            onDragStart={setDraggingDealId}
            onDragEnd={() => setDraggingDealId(null)}
          />
        );
      })}
    </div>
  );
}
