import { SkeletonBox, SkeletonCard } from '../ui/Skeleton';

interface PipelineSkeletonProps {
  viewMode: 'kanban' | 'list';
}

export function PipelineSkeleton({ viewMode }: PipelineSkeletonProps) {
  if (viewMode === 'list') {
    return <PipelineListSkeleton />;
  }
  return <PipelineKanbanSkeleton />;
}

function PipelineKanbanSkeleton() {
  const stages = ['Nouveau', 'Qualifie', 'Contact', 'Visite', 'Proposition', 'Mandat', 'Vendu', 'Perdu'];

  return (
    <div
      className="kanban-board"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 260px)',
        gap: '12px',
        overflowX: 'auto',
        paddingBottom: '18px',
      }}
    >
      {stages.map((stage, index) => (
        <div key={stage} className="column" style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Column header */}
          <div className="column-head" style={{ padding: '12px 14px 10px', background: 'var(--lv-surface)', border: '1px solid var(--lv-border)', borderRadius: 0 }}>
            <div className="column-head-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <SkeletonBox width="7px" height="7px" style={{ borderRadius: '999px' }} />
                <SkeletonText width="80px" lineHeight="11px" />
              </div>
              <SkeletonBox width="24px" height="16px" style={{ borderRadius: '999px' }} />
            </div>
            <div style={{ marginTop: '6px' }}>
              <SkeletonText width="60px" lineHeight="11px" />
            </div>
          </div>

          {/* Column body with cards */}
          <div className="column-body" style={{ flex: 1, marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Array.from({ length: 5 }).map((_, cardIndex) => (
              <DealCardSkeleton key={`${index}-${cardIndex}`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DealCardSkeleton() {
  return (
    <SkeletonCard style={{ borderRadius: 0, overflow: 'hidden' }}>
      {/* Image placeholder */}
      <div style={{ width: '100%', height: '110px', background: 'var(--lv-muted)', animation: 'skeleton-pulse 2.5s ease-in-out infinite' }} />

      {/* Card body */}
      <div style={{ padding: '10px 12px' }}>
        {/* Task badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '7px', minHeight: '21px' }}>
          <SkeletonBox width="48px" height="18px" style={{ borderRadius: '999px' }} />
          <SkeletonBox width="56px" height="18px" style={{ borderRadius: '999px' }} />
        </div>

        {/* Title lines */}
        <SkeletonText width="85%" lineHeight="13px" style={{ marginBottom: '3px' }} />
        <SkeletonText width="60%" lineHeight="11px" style={{ marginBottom: '8px' }} />

        {/* Meta line (city + price) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
          <SkeletonBox width="100px" height="11px" />
          <SkeletonBox width="64px" height="13px" />
        </div>

        {/* Next task area */}
        <div style={{ padding: '7px 8px', borderRadius: 0, background: 'var(--lv-surface-soft)', border: '1px solid var(--lv-border)' }}>
          <SkeletonText width="70%" lineHeight="11px" />
        </div>

        {/* Footer (owner + commission) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <SkeletonBox width="18px" height="18px" style={{ borderRadius: '999px' }} />
            <SkeletonBox width="64px" height="11px" />
          </div>
          <SkeletonBox width="56px" height="11px" />
        </div>
      </div>
    </SkeletonCard>
  );
}

function PipelineListSkeleton() {
  return (
    <div className="list-view" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 0 18px' }}>
      {/* Group headers for each stage */}
      {['Nouveau', 'Qualifie', 'Contact', 'Visite', 'Proposition', 'Mandat', 'Vendu', 'Perdu'].map((stage) => (
        <div key={stage} className="list-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Group header */}
          <div className="list-group-head" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px 4px 0' }}>
            <SkeletonBox width="7px" height="7px" style={{ borderRadius: '999px' }} />
            <SkeletonText width="80px" lineHeight="11px" />
            <SkeletonBox width="24px" height="16px" style={{ borderRadius: '999px' }} />
            <SkeletonText width="100px" lineHeight="11px" style={{ marginLeft: 'auto' }} />
          </div>

          {/* List rows */}
          {Array.from({ length: 3 }).map((_, rowIndex) => (
            <ListRowSkeleton key={`${stage}-${rowIndex}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

function ListRowSkeleton() {
  return (
    <div
      className="list-row"
      style={{
        display: 'grid',
        gridTemplateColumns: '80px minmax(180px, 1fr) 96px 112px 170px 126px 28px 50px 34px',
        gap: '12px',
        alignItems: 'center',
        padding: '8px 14px 8px 8px',
        background: 'var(--lv-surface)',
        border: '1px solid var(--lv-border)',
        borderRadius: 0,
      }}
    >
      {/* Thumbnail */}
      <SkeletonBox width="80px" height="56px" />

      {/* Title + city */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <SkeletonText width="90%" lineHeight="13px" />
        <SkeletonText width="60%" lineHeight="11px" />
      </div>

      {/* Price */}
      <SkeletonBox width="96px" height="14px" />

      {/* Commission */}
      <SkeletonBox width="80px" height="13px" />

      {/* Follow-up */}
      <div style={{ padding: '6px 8px', borderRadius: 0, background: 'var(--lv-surface-soft)', border: '1px solid var(--lv-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
          <SkeletonBox width="60px" height="10px" />
          <SkeletonBox width="32px" height="9px" />
        </div>
        <SkeletonText width="80%" lineHeight="11px" />
      </div>

      {/* Owner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <SkeletonBox width="22px" height="22px" style={{ borderRadius: '999px' }} />
        <SkeletonBox width="80px" height="11px" />
      </div>

      {/* Score placeholder */}
      <SkeletonBox width="34px" height="34px" />

      {/* Actions placeholder */}
      <SkeletonBox width="30px" height="30px" style={{ borderRadius: 0, margin: '0 auto' }} />

      {/* Menu */}
      <SkeletonBox width="20px" height="20px" />
    </div>
  );
}

function SkeletonText({ width, height, lineHeight = '12px', style }: { width?: string | number; height?: string | number; lineHeight?: string | number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width,
        height: height || lineHeight,
        background: 'var(--lv-muted)',
        animation: 'skeleton-pulse 2.5s ease-in-out infinite',
        borderRadius: 0,
        ...style,
      }}
    />
  );
}