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
        background: 'var(--color-bg-overlay)',
        backdropFilter: 'blur(4px)',
        fontFamily: 'var(--font-sans, var(--notion-sans))',
      }}
    >
      <section
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(420px, 100%)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--color-border-default)',
          background: 'var(--color-bg-surface)',
          boxShadow: 'none',
          overflow: 'hidden',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 18 }}>
          <span
            aria-hidden="true"
            style={{
              width: 34,
              height: 34,
              borderRadius: 'var(--radius)',
              display: 'grid',
              placeItems: 'center',
              background: danger ? 'var(--color-danger-bg)' : 'var(--color-bg-muted)',
              color: danger ? 'var(--color-danger-text)' : 'var(--color-text-primary)',
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={17} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, color: 'var(--color-text-primary)', fontFamily: 'var(--font-title, var(--lv-font-title))', fontSize: 20, fontWeight: 700 }}>{title}</h2>
            {description && (
              <p style={{ margin: '6px 0 0', color: 'var(--color-text-secondary)', fontSize: 13, lineHeight: 1.45 }}>
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fermer"
            style={{ width: 30, height: 30, border: 0, borderRadius: 'var(--radius)', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
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
    secondary: { background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', border: 'var(--color-border-default)' },
    primary: { background: 'var(--color-brand)', color: 'var(--color-text-inverse)', border: 'var(--color-brand)' },
    danger: { background: 'var(--color-danger)', color: 'var(--color-text-inverse)', border: 'var(--color-danger)' },
  }[kind];

  return {
    height: 36,
    padding: '0 14px',
    borderRadius: 'var(--radius)',
    border: `1px solid ${colors.border}`,
    background: colors.background,
    color: colors.color,
    font: 'inherit',
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
  };
}
