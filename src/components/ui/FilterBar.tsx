import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';

interface FilterBarProps {
  children: ReactNode;
  label?: string;
  onReset?: () => void;
  resetLabel?: string;
}

export function FilterBar({
  children,
  label = 'Filtres actifs',
  onReset,
  resetLabel = 'Réinitialiser',
}: FilterBarProps) {
  return (
    <section
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 48,
        padding: '8px 12px',
        border: '1px solid #E6E4DF',
        borderRadius: 8,
        background: '#F3F2EF',
        fontFamily: 'var(--notion-sans)',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: '#1E5A3A',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        <SlidersHorizontal size={13} />
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
        {children}
      </div>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            marginLeft: 'auto',
            border: 0,
            background: 'transparent',
            color: '#8E8B83',
            font: 'inherit',
            fontSize: 12,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <RotateCcw size={12} />
          {resetLabel}
        </button>
      )}
    </section>
  );
}
