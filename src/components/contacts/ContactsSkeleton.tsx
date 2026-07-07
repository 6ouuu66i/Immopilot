import { SkeletonBox, SkeletonAvatar } from '../ui/Skeleton';

export function ContactsSkeleton() {
  return (
    <main className="lv-contacts lv-page contacts-page" style={{ minHeight: 'calc(100vh - 58px)', background: 'var(--lv-app-bg)' }}>
      {/* Header */}
      <header className="contacts-head" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px 32px 16px' }}>
        <div className="contacts-title" style={{ flex: 1 }}>
          <SkeletonText width="140px" lineHeight="32px" style={{ marginBottom: '6px' }} />
          <SkeletonText width="280px" lineHeight="15px" />
        </div>

        <SkeletonBox width="280px" height="40px" />

        <div className="contacts-view-toggle" style={{ display: 'flex', border: '1px solid var(--lv-border)', borderRadius: 0, overflow: 'hidden' }}>
          <SkeletonBox width="42px" height="40px" />
          <SkeletonBox width="42px" height="40px" />
        </div>

        <div className="contacts-export" style={{ display: 'flex', border: '1px solid var(--lv-border)', borderRadius: 0, overflow: 'hidden' }}>
          <SkeletonBox width="42px" height="40px" />
          <SkeletonBox width="32px" height="40px" />
        </div>
      </header>

      {/* Body grid */}
      <section className="contacts-body-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '0' }}>
        {/* Left panel */}
        <div className="contacts-left" style={{ padding: '0 32px 32px', borderRight: '1px solid var(--lv-border)' }}>
          {/* Filters row */}
          <div className="filters-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'var(--lv-surface)', border: '1px solid var(--lv-border)', borderRadius: 0 }}>
              <SkeletonBox width="15px" height="15px" />
              <SkeletonText width="80px" lineHeight="13px" />
            </div>
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonBox key={index} width="88px" height="32px" />
            ))}
            <SkeletonBox width="120px" height="32px" />
            <SkeletonBox width="140px" height="32px" />
            <SkeletonBox width="80px" height="32px" />
            <SkeletonBox width="32px" height="32px" />
          </div>

          {/* Table shell */}
          <div className="contacts-table-shell" style={{ background: 'var(--lv-surface)', border: '1px solid var(--lv-border)', borderRadius: 0 }}>
            {/* Table count */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--lv-border)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <SkeletonBox width="32px" height="14px" />
              <SkeletonText width="64px" lineHeight="14px" />
            </div>

            {/* Table scroll area */}
            <div className="table-scroll">
              {/* Table header */}
              <table className="contacts-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--lv-border)' }}>
                    <th style={{ width: '34px', padding: '10px 14px', textAlign: 'left' }}>
                      <SkeletonBox width="16px" height="16px" />
                    </th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}><SkeletonText width="120px" lineHeight="13px" /></th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}><SkeletonText width="100px" lineHeight="13px" /></th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}><SkeletonText width="140px" lineHeight="13px" /></th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}><SkeletonText width="80px" lineHeight="13px" /></th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}><SkeletonText width="40px" lineHeight="13px" /></th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}><SkeletonText width="48px" lineHeight="13px" /></th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}><SkeletonText width="100px" lineHeight="13px" /></th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}><SkeletonText width="120px" lineHeight="13px" /></th>
                    <th style={{ width: '38px', padding: '10px 14px', textAlign: 'left' }}><SkeletonBox width="16px" height="16px" /></th>
                  </tr>
                </thead>
                <tbody>
                  {/* Table rows */}
                  {Array.from({ length: 8 }).map((_, rowIndex) => (
                    <ContactRowSkeleton key={rowIndex} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <footer className="table-footer" style={{ padding: '12px 14px', borderTop: '1px solid var(--lv-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SkeletonBox width="20px" height="20px" />
                <SkeletonText width="100px" lineHeight="14px" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <SkeletonText width="40px" lineHeight="14px" />
                <SkeletonBox width="24px" height="24px" />
                <SkeletonText width="16px" lineHeight="14px" />
                <SkeletonBox width="24px" height="24px" />
              </div>
            </footer>
          </div>
        </div>

        {/* Right panel (contact panel skeleton) */}
        <aside className="contact-panel" style={{ background: 'var(--lv-surface)', borderLeft: '1px solid var(--lv-border)', display: 'flex', flexDirection: 'column' }}>
          {/* Panel top */}
          <div className="panel-top" style={{ padding: '18px', borderBottom: '1px solid var(--lv-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <SkeletonAvatar size="48px" shape="square" />
            <div style={{ flex: 1 }}>
              <SkeletonText width="160px" lineHeight="16px" style={{ marginBottom: '4px' }} />
              <SkeletonText width="120px" lineHeight="13px" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <SkeletonBox width="24px" height="24px" />
              <SkeletonBox width="56px" height="16px" />
            </div>
            <SkeletonBox width="32px" height="32px" />
          </div>

          {/* Panel actions */}
          <div className="panel-actions" style={{ padding: '12px 18px', display: 'flex', gap: '8px', flexWrap: 'wrap', borderBottom: '1px solid var(--lv-border)' }}>
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonBox key={index} width="96px" height="34px" />
            ))}
          </div>

          {/* Action message placeholder */}
          <SkeletonBox width="100%" height="36px" style={{ margin: '12px 18px', borderRadius: 0 }} />

          {/* Panel stats */}
          <div className="panel-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', padding: '16px 18px', borderBottom: '1px solid var(--lv-border)' }}>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <SkeletonText width="40px" lineHeight="12px" />
                <SkeletonBox width="32px" height="20px" />
              </div>
            ))}
          </div>

          {/* Panel sections */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Informations section */}
            <section className="panel-section">
              <div className="section-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <SkeletonText width="100px" lineHeight="14px" />
                <SkeletonBox width="64px" height="28px" />
              </div>
              <div className="info-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <SkeletonBox width="14px" height="14px" />
                    <SkeletonText width="180px" lineHeight="13px" />
                  </div>
                ))}
              </div>
            </section>

            {/* Biens lies section */}
            <section className="panel-section">
              <div className="section-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <SkeletonText width="90px" lineHeight="14px" />
                <SkeletonBox width="88px" height="28px" />
              </div>
              <div className="contact-linked-stack" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Array.from({ length: 2 }).map((_, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '56px 1fr auto',
                      gap: '10px',
                      padding: '10px',
                      background: 'var(--lv-surface)',
                      border: '1px solid var(--lv-border)',
                      borderRadius: 0,
                    }}
                  >
                    <SkeletonBox width="56px" height="42px" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <SkeletonText width="120px" lineHeight="12px" />
                      <SkeletonText width="100px" lineHeight="11px" />
                      <SkeletonText width="64px" lineHeight="12px" />
                    </div>
                    <SkeletonBox width="56px" height="18px" />
                  </div>
                ))}
              </div>
            </section>

            {/* Creer une tache section */}
            <section className="panel-section">
              <div className="section-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <SkeletonText width="110px" lineHeight="14px" />
                <SkeletonBox width="72px" height="28px" />
              </div>
              <div className="contact-task-form" style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '8px' }}>
                <SkeletonBox width="100%" height="34px" />
                <SkeletonBox width="100px" height="34px" />
                <SkeletonBox width="64px" height="34px" />
                <SkeletonBox width="88px" height="34px" />
              </div>
            </section>

            {/* Taches section */}
            <section className="panel-section">
              <div className="section-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <SkeletonText width="56px" lineHeight="14px" />
                <SkeletonText width="56px" lineHeight="14px" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '16px 1fr', gap: '8px', alignItems: 'start' }}>
                    <SkeletonBox width="16px" height="16px" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <SkeletonText width="80%" lineHeight="12px" />
                      <SkeletonText width="60px" lineHeight="10px" />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Activite recente section */}
            <section className="panel-section">
              <div className="section-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <SkeletonText width="110px" lineHeight="14px" />
                <SkeletonText width="64px" lineHeight="14px" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '8px 1fr', gap: '8px', alignItems: 'start' }}>
                    <SkeletonBox width="8px" height="8px" style={{ marginTop: '4px', borderRadius: '999px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <SkeletonText width="90%" lineHeight="12px" />
                      <SkeletonText width="70px" lineHeight="10px" />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Notes section */}
            <section className="panel-section">
              <div className="section-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <SkeletonText width="48px" lineHeight="14px" />
                <SkeletonBox width="64px" height="28px" />
              </div>
              <div className="contact-task-form" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
                <SkeletonBox width="100%" height="34px" />
                <SkeletonBox width="42px" height="34px" />
              </div>
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Array.from({ length: 2 }).map((_, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: '6px', paddingBottom: '10px', borderBottom: '1px solid var(--lv-surface-soft)' }}>
                    <SkeletonBox width="22px" height="22px" style={{ borderRadius: '999px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <SkeletonText width="80px" lineHeight="11px" />
                        <SkeletonText width="64px" lineHeight="9px" />
                      </div>
                      <SkeletonText width="100%" lineHeight="12px" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </aside>
      </section>
    </main>
  );
}

function ContactRowSkeleton() {
  return (
    <tr style={{ borderBottom: '1px solid var(--lv-border)' }}>
      {/* Checkbox */}
      <td style={{ padding: '10px 14px' }}>
        <SkeletonBox width="16px" height="16px" />
      </td>

      {/* Contact (avatar + name) */}
      <td style={{ padding: '10px 14px' }}>
        <div className="contact-cell" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <SkeletonAvatar size="32px" shape="square" />
          <div>
            <SkeletonText width="140px" lineHeight="13px" style={{ marginBottom: '4px' }} />
            <SkeletonText width="100px" lineHeight="11px" />
          </div>
        </div>
      </td>

      {/* Phone */}
      <td style={{ padding: '10px 14px' }}>
        <SkeletonText width="120px" lineHeight="13px" />
      </td>

      {/* Email */}
      <td style={{ padding: '10px 14px' }}>
        <SkeletonText width="160px" lineHeight="13px" />
      </td>

      {/* Status badge */}
      <td style={{ padding: '10px 14px' }}>
        <SkeletonBox width="80px" height="18px" />
      </td>

      {/* Properties count */}
      <td style={{ padding: '10px 14px' }}>
        <SkeletonBox width="24px" height="13px" />
      </td>

      {/* Deals count */}
      <td style={{ padding: '10px 14px' }}>
        <SkeletonBox width="24px" height="13px" />
      </td>

      {/* Last activity */}
      <td style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <SkeletonText width="80px" lineHeight="13px" />
          <SkeletonText width="100px" lineHeight="11px" />
        </div>
      </td>

      {/* Next action */}
      <td style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <SkeletonText width="120px" lineHeight="13px" />
          <SkeletonText width="80px" lineHeight="11px" />
        </div>
      </td>

      {/* Menu */}
      <td style={{ padding: '10px 14px', width: '38px' }}>
        <SkeletonBox width="16px" height="16px" />
      </td>
    </tr>
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