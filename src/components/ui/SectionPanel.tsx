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
        border: '1px solid var(--color-border-default)',
        borderRadius: compact ? 8 : 10,
        background: 'var(--color-bg-surface)',
        padding: compact ? 10 : 12,
        fontFamily: 'var(--notion-sans)',
        boxShadow: 'var(--shadow-xs)',
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
                  color: 'var(--color-text-tertiary)',
                  fontFamily: 'var(--notion-sans)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 500,
                  letterSpacing: 0,
                }}
              >
                {eyebrow}
              </div>
            )}
            {title && (
              <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: compact ? 12.5 : 13.5, fontWeight: 750 }}>
                {title}
                {count !== undefined && (
                  <span style={{ marginLeft: 7, color: 'var(--color-text-tertiary)', fontSize: 11, fontWeight: 650 }}>
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
