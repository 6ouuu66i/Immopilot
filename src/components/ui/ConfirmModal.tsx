import { AlertTriangle, X } from 'lucide-react';
import { useEffect } from 'react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'rgba(29,31,30,0.38)',
        backdropFilter: 'blur(4px)',
        fontFamily: 'var(--notion-sans)',
      }}
    >
      <section
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(420px, 100%)',
          borderRadius: 14,
          border: '1px solid #E6E4DF',
          background: '#FFFFFF',
          boxShadow: '0 24px 80px rgba(29,31,30,0.22)',
          overflow: 'hidden',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 18 }}>
          <span
            aria-hidden="true"
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              display: 'grid',
              placeItems: 'center',
              background: danger ? '#FDEBEC' : '#F3F2EF',
              color: danger ? '#991B1B' : '#1D1F1E',
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={17} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, color: '#1D1F1E', fontSize: 16, fontWeight: 750 }}>{title}</h2>
            {description && (
              <p style={{ margin: '6px 0 0', color: '#6B6B6B', fontSize: 13, lineHeight: 1.45 }}>
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fermer"
            style={{ width: 30, height: 30, border: 0, borderRadius: 6, background: 'transparent', color: '#6B6B6B', cursor: 'pointer' }}
          >
            <X size={17} />
          </button>
        </header>
        <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '0 18px 18px' }}>
          <button type="button" onClick={onCancel} style={buttonStyle('secondary')}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} style={buttonStyle(danger ? 'danger' : 'primary')}>
            {confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}

function buttonStyle(kind: 'secondary' | 'primary' | 'danger'): React.CSSProperties {
  const colors = {
    secondary: { background: '#FFFFFF', color: '#1D1F1E', border: '#E6E4DF' },
    primary: { background: '#1E5A3A', color: '#FFFFFF', border: '#1E5A3A' },
    danger: { background: '#991B1B', color: '#FFFFFF', border: '#991B1B' },
  }[kind];

  return {
    height: 36,
    padding: '0 14px',
    borderRadius: 8,
    border: `1px solid ${colors.border}`,
    background: colors.background,
    color: colors.color,
    font: 'inherit',
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
  };
}
