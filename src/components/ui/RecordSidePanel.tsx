import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface RecordSidePanelProps {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  media?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  width?: number;
  sticky?: boolean;
  ariaLabel?: string;
}

export function RecordSidePanel({
  title,
  subtitle,
  meta,
  media,
  children,
  footer,
  onClose,
  width = 480,
  sticky = false,
  ariaLabel = 'Fiche detail',
}: RecordSidePanelProps) {
  return (
    <aside
      aria-label={ariaLabel}
      style={{
        width: sticky ? 'auto' : width,
        height: sticky ? 'calc(100vh - 96px)' : 'auto',
        maxHeight: sticky ? 'calc(100vh - 96px)' : 'none',
        position: sticky ? 'sticky' : 'fixed',
        top: sticky ? 12 : 58,
        right: sticky ? 'auto' : 0,
        bottom: sticky ? 'auto' : 0,
        zIndex: sticky ? 1 : 30,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--color-bg-surface)',
        border: sticky ? '1px solid var(--color-border-default)' : '0 solid var(--color-border-default)',
        borderLeft: sticky ? '1px solid var(--color-border-default)' : '1px solid var(--color-border-default)',
        borderRadius: sticky ? 10 : 0,
        boxShadow: sticky ? 'var(--shadow-xs)' : 'var(--shadow-md)',
        fontFamily: 'var(--notion-sans)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          padding: '15px 18px 12px',
          borderBottom: '1px solid var(--color-border-default)',
          flexShrink: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          {meta && <div style={{ marginBottom: 6 }}>{meta}</div>}
          <h2 style={{ margin: 0, color: 'var(--color-text-primary)', fontFamily: 'var(--font-serif, var(--notion-serif))', fontSize: 19, fontWeight: 400, lineHeight: 1.15 }}>
            {title}
          </h2>
          {subtitle && (
            <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 12.5, lineHeight: 1.35 }}>
              {subtitle}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          style={{
            width: 31,
            height: 31,
            border: 'none',
            borderRadius: 6,
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <X size={18} />
        </button>
      </header>
      {media}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>
        {children}
      </div>
      {footer && (
        <footer style={{ padding: 16, borderTop: '1px solid var(--color-border-default)', flexShrink: 0 }}>
          {footer}
        </footer>
      )}
    </aside>
  );
}
