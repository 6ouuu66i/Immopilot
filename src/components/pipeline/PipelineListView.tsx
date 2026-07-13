// src/components/pipeline/PipelineListView.tsx
import { useEffect, useRef, useState } from 'react';
import { formatEuro } from '../../lib/formatCurrency';
import type { Task } from '../../types';
import type { MovePipelineDeal, PipelineDeal, PipelineRuntimeData, PipelineStageView } from '../../types/pipeline';
import { ScoreRing } from '../biens/ScoreRing';

interface PipelineListViewProps {
  deals: PipelineDeal[];
  stages: PipelineStageView[];
  onSelectDeal: (dealId: string) => void;
  onMoveDeal: MovePipelineDeal;
  selectedDealId: string | null;
  propertiesById: PipelineRuntimeData['propertiesById'];
  agentsById: PipelineRuntimeData['agentsById'];
  tasksByDealId: PipelineRuntimeData['tasksByDealId'];
  pendingDealIds: ReadonlySet<string>;
}

function fmt(v: number) { return formatEuro(v); }

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

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function taskTimestamp(task: Task): number {
  if (!task.date) return Number.POSITIVE_INFINITY;
  return new Date(`${task.date}T${task.time || '23:59'}`).getTime();
}

function dueState(task: Task | undefined): 'overdue' | 'today' | 'later' | 'none' {
  if (!task?.date) return 'none';
  const today = localDateKey();
  if (task.date < today) return 'overdue';
  if (task.date === today) return 'today';
  return 'later';
}

function compactTaskTime(task: Task): string {
  const state = dueState(task);
  if (state === 'none') return 'Sans échéance';
  if (state === 'overdue' || state === 'today') return task.time;
  const date = new Date(`${task.date}T12:00:00`);
  const label = Number.isNaN(date.getTime())
    ? task.date
    : date.toLocaleDateString('fr-BE', { day: '2-digit', month: 'short' });
  return `${label} · ${task.time}`;
}

function taskStatusLabel(task: Task): string {
  const state = dueState(task);
  if (state === 'none') return 'Sans échéance';
  if (state === 'overdue') return 'En retard';
  if (state === 'today') return "Aujourd'hui";
  return 'À venir';
}

const BLANK_IMG = (() => {
  const img = new Image(1, 1);
  img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  return img;
})();

// ── List Row ───────────────────────────────────────────────────────────────────

interface ListRowProps {
  deal: PipelineDeal;
  property: ReturnType<PipelineRuntimeData['propertiesById']['get']>;
  agent: ReturnType<PipelineRuntimeData['agentsById']['get']>;
  tasks: Task[];
  selected: boolean;
  isDragging: boolean;
  isPending: boolean;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}

function ListRow({ deal, property, agent, tasks, selected, isDragging, isPending, onSelect, onDragStart, onDragEnd }: ListRowProps) {
  const openTasks = tasks
    .filter(task => !task.done)
    .sort((a, b) => taskTimestamp(a) - taskTimestamp(b));
  const nextTask = openTasks[0];
  const taskState = dueState(nextTask);

  return (
    <div
      className={`list-row${isDragging ? ' dragging' : ''}`}
      style={{ outline: selected ? '2px solid var(--color-brand)' : 'none', outlineOffset: -2 }}
      draggable={!isPending && !deal.closedAt && !deal.isWon && !deal.isLost}
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
        <div className="lr-title">
          <span className="deal-inline-ref">{deal.reference}</span>
          <span className="deal-inline-separator"> · </span>
          {property?.title ?? deal.title}
        </div>
        <div className="lr-city">{property?.city ?? '—'}</div>
      </div>
      <div className="lr-price">{fmt(deal.price)}</div>
      <div className="lr-commission">{fmt(deal.commissionAmount)}</div>
      <div className={`lr-followup ${taskState}`}>
        {nextTask ? (
          <>
            <div className="lr-followup-top">
              <span className={`lr-followup-status ${taskState}`}>{taskStatusLabel(nextTask)}</span>
              <span className="lr-followup-count">{openTasks.length} {openTasks.length > 1 ? 'tâches' : 'tâche'}</span>
            </div>
            <div className="lr-followup-title">
              {compactTaskTime(nextTask)} · {nextTask.title}
            </div>
          </>
        ) : (
          <span className="lr-followup-empty">Aucune tâche</span>
        )}
      </div>
      <div className="lr-owner">
        {agent?.avatar && (
          <div className="lr-avatar" style={{ backgroundImage: `url('${agent.avatar}')` }} />
        )}
        <span className="lr-owner-name">{agent?.name ?? '—'}</span>
      </div>
      <div />
      <div className="lr-score">{property && <ScoreRing score={property.score} size="sm" />}</div>
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

const SCROLL_EDGE = 80;
const SCROLL_MAX  = 14;
function edgeSpeed(dist: number) { return Math.ceil(Math.max(0, 1 - dist / SCROLL_EDGE) * SCROLL_MAX); }

export function PipelineListView({
  deals, stages, onSelectDeal, onMoveDeal, selectedDealId,
  propertiesById, agentsById, tasksByDealId, pendingDealIds,
}: PipelineListViewProps) {
  const [draggingDealId, setDraggingDealId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const draggingRef = useRef<string | null>(null);
  const ghostRef    = useRef<HTMLDivElement | null>(null);
  const offsetRef   = useRef({ x: 0, y: 0 });
  const cursorRef   = useRef({ x: 0, y: 0 });
  const scrollRAF   = useRef<number | null>(null);

  // Follow cursor during drag
  useEffect(() => {
    const move = (e: DragEvent) => {
      cursorRef.current = { x: e.clientX, y: e.clientY };
      const ghost = ghostRef.current;
      if (!ghost) return;
      ghost.style.left = `${e.clientX - offsetRef.current.x}px`;
      ghost.style.top  = `${e.clientY - offsetRef.current.y}px`;
    };
    document.addEventListener('dragover', move);
    return () => document.removeEventListener('dragover', move);
  }, []);

  const startAutoScroll = () => {
    const tick = () => {
      const { y } = cursorRef.current;
      const vh = window.innerHeight;
      const content = document.getElementById('app-content') ?? document.documentElement;
      if (y < SCROLL_EDGE)           content.scrollTop -= edgeSpeed(y);
      else if (y > vh - SCROLL_EDGE) content.scrollTop += edgeSpeed(vh - y);
      scrollRAF.current = requestAnimationFrame(tick);
    };
    scrollRAF.current = requestAnimationFrame(tick);
  };

  const stopAutoScroll = () => {
    if (scrollRAF.current !== null) { cancelAnimationFrame(scrollRAF.current); scrollRAF.current = null; }
  };

  const startDrag = (dealId: string, e: React.DragEvent<HTMLElement>) => {
    e.dataTransfer.setDragImage(BLANK_IMG, 0, 0);
    e.dataTransfer.setData('text/plain', dealId);
    e.dataTransfer.effectAllowed = 'move';

    const source = e.currentTarget as HTMLElement;
    const rect   = source.getBoundingClientRect();
    offsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    const ghost = source.cloneNode(true) as HTMLDivElement;
    ghost.style.cssText = [
      'position:fixed',
      `left:${rect.left}px`,
      `top:${rect.top}px`,
      `width:${rect.width}px`,
      'z-index:9999',
      'pointer-events:none',
      'opacity:0.96',
      'border-radius:8px',
      'box-shadow:0 14px 32px -8px color-mix(in srgb, var(--color-text-primary) 38%, transparent),0 6px 14px -4px color-mix(in srgb, var(--color-brand) 18%, transparent)',
      'border:1.5px solid var(--color-brand)',
      'animation:drag-wiggle-subtle 420ms ease-in-out infinite',
      'transform-origin:center left',
      'will-change:transform,left,top',
    ].join(';');
    document.body.appendChild(ghost);
    ghostRef.current = ghost;

    draggingRef.current = dealId;
    requestAnimationFrame(() => setDraggingDealId(dealId));
    startAutoScroll();
  };

  const endDrag = () => {
    stopAutoScroll();
    ghostRef.current?.remove();
    ghostRef.current    = null;
    draggingRef.current = null;
    setDraggingDealId(null);
    setDragOverStageId(null);
  };

  const handleDrop = (stageId: string) => {
    const id = draggingRef.current;
    if (!id) return;
    const deal = deals.find(d => d.id === id);
    if (deal && deal.stageId !== stageId && !pendingDealIds.has(id)) {
      void onMoveDeal(id, stageId).catch(() => undefined);
    }
    endDrag();
  };

  return (
    <div className="list-view">
      {stages.map(stage => {
        const stageId         = stageNameToId(stage.name);
        const stageDeals      = deals.filter(d => d.stageId === stage.id);
        const totalCommission = stageDeals.reduce((sum, d) => sum + d.commissionAmount, 0);

        return (
          <div
            key={stage.id}
            className={`list-group${dragOverStageId === stageId ? ' drag-over' : ''}`}
            data-stage={stageId}
            style={stage.color ? ({ '--col-color': stage.color } as React.CSSProperties) : undefined}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverStageId(stageId); }}
            onDragLeave={e => {
              const related = e.relatedTarget as Node | null;
              if (!related || !e.currentTarget.contains(related)) setDragOverStageId(null);
            }}
            onDrop={() => handleDrop(stage.id)}
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
                  property={propertiesById.get(deal.propertyId)}
                  agent={agentsById.get(deal.ownerId)}
                  tasks={tasksByDealId.get(deal.id) ?? []}
                  selected={selectedDealId === deal.id}
                  isDragging={draggingDealId === deal.id}
                  isPending={pendingDealIds.has(deal.id)}
                  onSelect={() => onSelectDeal(deal.id)}
                  onDragStart={e => startDrag(deal.id, e)}
                  onDragEnd={endDrag}
                />
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
