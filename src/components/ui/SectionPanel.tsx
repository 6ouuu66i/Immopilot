import type { ReactNode } from 'react';

interface SectionPanelProps {
  title?: ReactNode;
  eyebrow?: ReactNode;
  count?: number | string;
  action?: ReactNode;
  children: ReactNode;
  compact?: boolean;
}

export function SectionPanel({
  title,
  eyebrow,
  count,
  action,
  children,
  compact = false,
}: SectionPanelProps) {
  return (
    <section
      style={{
        border: '1px solid #E6E4DF',
        borderRadius: compact ? 8 : 10,
        background: '#FFFFFF',
        padding: compact ? 10 : 12,
        fontFamily: 'var(--notion-sans)',
      }}
    >
      {(title || eyebrow || action) && (
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            marginBottom: compact ? 8 : 10,
          }}
        >
          <div style={{ minWidth: 0 }}>
            {eyebrow && (
              <div
                style={{
                  marginBottom: 4,
                  color: '#8E8B83',
                  fontFamily: 'var(--notion-mono)',
                  fontSize: 9.5,
                  fontWeight: 750,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {eyebrow}
              </div>
            )}
            {title && (
              <h3 style={{ margin: 0, color: '#1D1F1E', fontSize: compact ? 12.5 : 13.5, fontWeight: 750 }}>
                {title}
                {count !== undefined && (
                  <span style={{ marginLeft: 7, color: '#8E8B83', fontSize: 11, fontWeight: 650 }}>
                    {count}
                  </span>
                )}
              </h3>
            )}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
