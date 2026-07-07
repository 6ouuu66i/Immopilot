import { SkeletonBox } from '../ui/Skeleton';

export function AgendaSkeleton() {
  return (
    <div className="lv-agenda lv-page agenda-react-page">
      <div className="agenda-react-content">
        {/* Title bar */}
        <header className="agenda-react-titlebar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <SkeletonText width="120px" lineHeight="28px" style={{ marginBottom: '6px' }} />
            <SkeletonText width="280px" lineHeight="15px" />
          </div>
          <SkeletonBox width="280px" height="38px" style={{ borderRadius: 0 }} />
        </header>

        {/* KPI strip */}
        <section className="agenda-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              style={{
                padding: '14px 16px',
                background: 'var(--lv-surface)',
                border: '1px solid var(--lv-border)',
                borderRadius: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <SkeletonText width="64px" lineHeight="12px" />
              <SkeletonBox width="48px" height="28px" />
            </div>
          ))}
        </section>

        {/* Create card */}
        <section className="agenda-create-card" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div
            style={{
              flex: 1,
              height: '44px',
              background: 'var(--lv-surface)',
              border: '1px solid var(--lv-border)',
              borderRadius: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '0 14px',
            }}
          >
            <SkeletonBox width="15px" height="15px" />
            <SkeletonText width="180px" lineHeight="14px" />
          </div>
          <SkeletonBox width="80px" height="44px" />
        </section>

        {/* Main layout */}
        <main className="agenda-layout" style={{ display: 'grid', gridTemplateColumns: '220px 1fr 280px', gap: '16px' }}>
          {/* Sidebar panel */}
          <aside className="agenda-sidebar-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Filter buttons */}
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                style={{
                  height: '38px',
                  background: 'var(--lv-surface)',
                  border: '1px solid var(--lv-border)',
                  borderRadius: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 12px',
                }}
              >
                <SkeletonText width="80px" lineHeight="13px" />
                <SkeletonBox width="24px" height="18px" style={{ borderRadius: '999px' }} />
              </div>
            ))}

            {/* Summary card */}
            <div
              style={{
                marginTop: '8px',
                padding: '14px',
                background: 'var(--lv-surface)',
                border: '1px solid var(--lv-border)',
                borderRadius: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <SkeletonBox width="17px" height="17px" />
              <SkeletonBox width="32px" height="20px" />
              <SkeletonText width="120px" lineHeight="12px" />
            </div>
          </aside>

          {/* Task panel */}
          <section className="agenda-task-panel" style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Panel head */}
            <div className="agenda-task-panel-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--lv-border)' }}>
              <SkeletonText width="140px" lineHeight="13px" />
              <SkeletonText width="120px" lineHeight="13px" />
            </div>

            {/* Task list */}
            <div className="agenda-task-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Array.from({ length: 8 }).map((_, index) => (
                <TaskRowSkeleton key={index} />
              ))}
            </div>
          </section>

          {/* Calendar panel */}
          <aside className="agenda-calendar-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Month card */}
            <div className="agenda-month-card" style={{ background: 'var(--lv-surface)', border: '1px solid var(--lv-border)', borderRadius: 0 }}>
              {/* Month header */}
              <div className="agenda-month-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--lv-border)' }}>
                <SkeletonText width="100px" lineHeight="14px" />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <SkeletonBox width="24px" height="24px" />
                  <SkeletonBox width="24px" height="24px" />
                </div>
              </div>

              {/* Weekday headers */}
              <div className="agenda-month-weekdays" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '8px 4px', borderBottom: '1px solid var(--lv-border)' }}>
                {Array.from({ length: 7 }).map((_, index) => (
                  <SkeletonText key={index} width="20px" lineHeight="11px" style={{ margin: '0 auto' }} />
                ))}
              </div>

              {/* Calendar grid */}
              <div className="agenda-month-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', padding: '4px' }}>
                {Array.from({ length: 42 }).map((_, index) => (
                  <div
                    key={index}
                    style={{
                      aspectRatio: '1',
                      background: index % 7 === 0 || index % 7 === 6 ? 'var(--lv-surface-soft)' : 'var(--lv-surface)',
                      border: '1px solid var(--lv-border)',
                      borderRadius: 0,
                      padding: '4px',
                      position: 'relative',
                    }}
                  >
                    <SkeletonBox width="18px" height="14px" style={{ marginBottom: '4px' }} />
                    {index % 3 === 0 && (
                      <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                        <SkeletonBox width="6px" height="6px" style={{ borderRadius: '999px' }} />
                        <SkeletonBox width="6px" height="6px" style={{ borderRadius: '999px' }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Calendar header */}
            <div className="agenda-calendar-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <SkeletonText width="100px" lineHeight="14px" style={{ marginBottom: '4px' }} />
                <SkeletonText width="80px" lineHeight="12px" />
              </div>
              <SkeletonBox width="72px" height="32px" />
            </div>

            {/* Calendar list */}
            <div className="agenda-calendar-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  style={{
                    height: '40px',
                    background: 'var(--lv-surface)',
                    border: '1px solid var(--lv-border)',
                    borderRadius: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '0 12px',
                  }}
                >
                  <SkeletonBox width="40px" height="12px" />
                  <SkeletonText width="120px" lineHeight="13px" />
                </div>
              ))}
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

function TaskRowSkeleton() {
  return (
    <article
      className="agenda-task-row"
      style={{
        display: 'grid',
        gridTemplateColumns: '18px minmax(0, 1fr) auto',
        alignItems: 'start',
        gap: '8px',
        padding: '10px 0',
        borderBottom: '1px solid color-mix(in srgb, var(--lv-border) 58%, transparent)',
      }}
    >
      {/* Checkbox */}
      <SkeletonBox width="16px" height="16px" style={{ marginTop: '1px', borderRadius: 0 }} />

      {/* Main content */}
      <div className="agenda-task-main" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {/* Title line with badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SkeletonText width="70%" lineHeight="13px" />
          <SkeletonBox width="48px" height="18px" style={{ borderRadius: 0 }} />
        </div>

        {/* Meta line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SkeletonBox width="13px" height="13px" />
          <SkeletonText width="120px" lineHeight="12px" />
          <SkeletonText width="16px" lineHeight="12px" />
          <SkeletonBox width="80px" height="12px" />
          <SkeletonBox width="12px" height="12px" />
        </div>
      </div>

      {/* Date/time inputs */}
      <div className="agenda-task-edit" style={{ display: 'flex', gap: '6px' }}>
        <SkeletonBox width="100px" height="28px" />
        <SkeletonBox width="64px" height="28px" />
      </div>
    </article>
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