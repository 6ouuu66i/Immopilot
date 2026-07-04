// src/components/pipeline/KanbanBoard.tsx
import { useEffect, useRef, useState } from 'react';
import type { store as appStore } from '../../lib/store';
import type { Deal, Task } from '../../types';
import { ScoreRing } from '../biens/ScoreRing';

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
  const n = (name ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (n.includes('nouveau'))  return 'nouveau';
  if (n.includes('analyser') || n.includes('analyse')) return 'analyse';
  if (n.includes('a contacter')) return 'a-contacter';
  if (n === 'rdv' || n.includes('rendez')) return 'rdv';
  if (n.includes('qualif'))   return 'qualifie';
  if (n.includes('contacte')) return 'contacte';
  if (n.includes('contact'))  return 'contact';
  if (n.includes('visite'))   return 'visite';
  if (n.includes('propos'))   return 'proposition';
  if (n.includes('mandat'))   return 'mandat';
  if (n.includes('vend'))     return 'vendu';
  if (n.includes('perd'))     return 'perdu';
  return n.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'stage';
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function taskTimestamp(task: Task): number {
  return new Date(`${task.date}T${task.time || '23:59'}`).getTime();
}

function dueState(task: Task | undefined): 'overdue' | 'today' | 'later' | 'none' {
  if (!task) return 'none';
  const today = localDateKey();
  if (task.date < today) return 'overdue';
  if (task.date === today) return 'today';
  return 'later';
}

function compactTaskTime(task: Task): string {
  const state = dueState(task);
  if (state === 'overdue' || state === 'today') return task.time;
  const date = new Date(`${task.date}T12:00:00`);
  const label = Number.isNaN(date.getTime())
    ? task.date
    : date.toLocaleDateString('fr-BE', { day: '2-digit', month: 'short' });
  return `${label} · ${task.time}`;
}

function taskStatusLabel(task: Task): string {
  const state = dueState(task);
  if (state === 'overdue') return 'En retard';
  if (state === 'today') return "Aujourd'hui";
  return 'À venir';
}

// Transparent 1×1 PNG used to suppress the native drag ghost
const BLANK_IMG = (() => {
  const img = new Image(1, 1);
  img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  return img;
})();

// ── Deal Card ──────────────────────────────────────────────────────────────────

interface DealCardProps {
  deal: Deal;
  store: Store;
  selected: boolean;
  isDragging: boolean;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}

function DealCard({ deal, store, selected, isDragging, onSelect, onDragStart, onDragEnd }: DealCardProps) {
  const property = store.getProperty(deal.propertyId);
  const agent    = store.getAgents().find(a => a.id === deal.ownerId);
  const photo    = property?.photos[0] ?? '';
  const score    = property?.score ?? 70;
  const openTasks = store
    .getDealTasks(deal.id)
    .filter(task => !task.done)
    .sort((a, b) => taskTimestamp(a) - taskTimestamp(b));
  const nextTask = openTasks[0];
  const taskState = dueState(nextTask);
  const urgentTask = taskState === 'overdue' || taskState === 'today';

  return (
    <article
      className={`deal-card${isDragging ? ' dragging' : ''}`}
      style={{ outline: selected ? '2px solid var(--color-brand)' : 'none', outlineOffset: 2 }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
    >
      <div className="dc-img">
        {photo && <img src={photo} alt={property?.title ?? ''} loading="lazy" />}
      </div>
      <div className="dc-ai">
        <ScoreRing score={score} size="sm" />
      </div>
      <div className="dc-body">
        {openTasks.length > 0 && (
          <div className="dc-task-badges">
            <span className="dc-task-count">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M8 6h13" />
                <path d="M8 12h13" />
                <path d="M8 18h13" />
                <path d="m3 6 1 1 2-2" />
                <path d="m3 12 1 1 2-2" />
                <path d="m3 18 1 1 2-2" />
              </svg>
              {openTasks.length} {openTasks.length > 1 ? 'tâches' : 'tâche'}
            </span>
            {urgentTask && (
              <span className={`dc-task-due ${taskState}`}>
                {taskState === 'overdue' ? 'En retard' : "Aujourd'hui"}
              </span>
            )}
          </div>
        )}
        <div className="dc-title">
          <span className="deal-inline-ref">{deal.reference}</span>
          <span className="deal-inline-separator"> · </span>
          {property?.title ?? deal.title}
        </div>
        <div className="dc-meta-line">
          <div className="dc-city">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a8 8 0 0 0-8 8c0 5.5 8 12 8 12s8-6.5 8-12a8 8 0 0 0-8-8z" />
              <circle cx="12" cy="10" r="2.5" fill="var(--color-text-inverse)" />
            </svg>
            {property?.city ?? '—'}
          </div>
          <div className="dc-price">{fmt(deal.price)}</div>
        </div>
        {nextTask && (
          <div className="dc-next-task">
            <span className="dc-next-task-label">Prochaine tâche</span>
            <span className="dc-next-task-title">
              <span className={`dc-next-task-status ${taskState}`}>{taskStatusLabel(nextTask)}</span>
              <span className="dc-next-task-separator"> · </span>
              {compactTaskTime(nextTask)}
              <span className="dc-next-task-separator"> · </span>
              {nextTask.title}
            </span>
            {openTasks.length > 1 && <span className="dc-next-task-more">+{openTasks.length - 1} autre{openTasks.length > 2 ? 's' : ''}</span>}
          </div>
        )}
        <div style={{ borderTop: '1px solid var(--color-border-default)', margin: '10px 0 8px' }} />
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
  stage: { id: string; name: string; color?: string };
  deals: Deal[];
  store: Store;
  selectedDealId: string | null;
  draggingDealId: string | null;
  onSelectDeal: (dealId: string) => void;
  onDrop: (stageName: string) => void;
  onDragStart: (dealId: string, e: React.DragEvent<HTMLElement>) => void;
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
      style={stage.color ? ({ '--col-color': stage.color } as React.CSSProperties) : undefined}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(true); }}
      onDragLeave={e => {
        // Only clear when the pointer truly leaves this column (not into a child)
        const related = e.relatedTarget as Node | null;
        if (!related || !e.currentTarget.contains(related)) setDragOver(false);
      }}
      onDrop={e => {
        e.preventDefault();
        setDragOver(false);
        onDrop(stage.name);
      }}
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
              onDragStart={e => onDragStart(deal.id, e)}
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

const SCROLL_EDGE = 80;
const SCROLL_MAX  = 14;
function edgeSpeed(dist: number) { return Math.ceil(Math.max(0, 1 - dist / SCROLL_EDGE) * SCROLL_MAX); }

export function KanbanBoard({
  deals, stages, onSelectDeal, onMoveDeal, selectedDealId, store,
}: KanbanBoardProps) {
  const [draggingDealId, setDraggingDealId] = useState<string | null>(null);
  // We keep a ref alongside state so handleDrop always reads the live value
  const draggingRef = useRef<string | null>(null);
  const ghostRef    = useRef<HTMLDivElement | null>(null);
  const offsetRef   = useRef({ x: 0, y: 0 });
  const cursorRef   = useRef({ x: 0, y: 0 });
  const scrollRAF   = useRef<number | null>(null);
  const boardRef    = useRef<HTMLDivElement | null>(null);

  // Follow cursor during drag via document-level dragover
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

  const startAutoScroll = (board: HTMLElement | null) => {
    const tick = () => {
      const { x, y } = cursorRef.current;
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const content = document.getElementById('app-content') ?? document.documentElement;
      // Vertical
      if (y < SCROLL_EDGE)        content.scrollTop -= edgeSpeed(y);
      else if (y > vh - SCROLL_EDGE) content.scrollTop += edgeSpeed(vh - y);
      // Horizontal (kanban board)
      if (board) {
        if (x < SCROLL_EDGE)        board.scrollLeft -= edgeSpeed(x);
        else if (x > vw - SCROLL_EDGE) board.scrollLeft += edgeSpeed(vw - x);
      }
      scrollRAF.current = requestAnimationFrame(tick);
    };
    scrollRAF.current = requestAnimationFrame(tick);
  };

  const stopAutoScroll = () => {
    if (scrollRAF.current !== null) { cancelAnimationFrame(scrollRAF.current); scrollRAF.current = null; }
  };

  const startDrag = (dealId: string, e: React.DragEvent<HTMLElement>) => {
    // Suppress native ghost
    e.dataTransfer.setDragImage(BLANK_IMG, 0, 0);
    e.dataTransfer.setData('text/plain', dealId);
    e.dataTransfer.effectAllowed = 'move';

    // Build animated ghost clone
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
      'animation:drag-wiggle 360ms ease-in-out infinite',
      'transform-origin:center top',
      'will-change:transform,left,top',
    ].join(';');
    document.body.appendChild(ghost);
    ghostRef.current = ghost;

    draggingRef.current = dealId;
    // Delay opacity change so ghost paints before source fades
    requestAnimationFrame(() => setDraggingDealId(dealId));
    startAutoScroll(boardRef.current);
  };

  const endDrag = () => {
    stopAutoScroll();
    ghostRef.current?.remove();
    ghostRef.current    = null;
    draggingRef.current = null;
    setDraggingDealId(null);
  };

  const handleDrop = (stageName: string) => {
    const id = draggingRef.current; // always fresh, never stale
    if (!id) return;
    const deal = deals.find(d => d.id === id);
    if (deal && stageNameToId(deal.stage) !== stageNameToId(stageName)) {
      onMoveDeal(id, stageName);
    }
    endDrag();
  };

  return (
    <div className="kanban-board" ref={boardRef}>
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
            onDragStart={startDrag}
            onDragEnd={endDrag}
          />
        );
      })}
    </div>
  );
}
