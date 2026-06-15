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
        background: '#FFFFFF',
        border: sticky ? '1px solid #E6E4DF' : '0 solid #E6E4DF',
        borderLeft: sticky ? '1px solid #E6E4DF' : '1px solid #E6E4DF',
        borderRadius: sticky ? 10 : 0,
        boxShadow: sticky ? '0 8px 24px rgba(29,31,30,0.035)' : '-4px 0 24px rgba(29,31,30,0.06)',
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
          borderBottom: '1px solid #E6E4DF',
          flexShrink: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          {meta && <div style={{ marginBottom: 6 }}>{meta}</div>}
          <h2 style={{ margin: 0, color: '#1D1F1E', fontSize: 17, fontWeight: 750, lineHeight: 1.2 }}>
            {title}
          </h2>
          {subtitle && (
            <p style={{ margin: '4px 0 0', color: '#6B6B6B', fontSize: 12.5, lineHeight: 1.35 }}>
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
            color: '#6B6B6B',
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
        <footer style={{ padding: 16, borderTop: '1px solid #E6E4DF', flexShrink: 0 }}>
          {footer}
        </footer>
      )}
    </aside>
  );
}
