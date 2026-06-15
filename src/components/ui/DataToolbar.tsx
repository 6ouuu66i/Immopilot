import { LayoutGrid, List, Search } from 'lucide-react';
import type { ReactNode } from 'react';

export interface DataToolbarView {
  id: string;
  label: string;
  icon?: 'grid' | 'list' | ReactNode;
}

interface DataToolbarProps {
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  views?: DataToolbarView[];
  activeView?: string;
  onViewChange?: (viewId: string) => void;
  filters?: ReactNode;
  actions?: ReactNode;
  rightSlot?: ReactNode;
  compact?: boolean;
}

function renderViewIcon(icon: DataToolbarView['icon']) {
  if (icon === 'grid') return <LayoutGrid size={15} />;
  if (icon === 'list') return <List size={15} />;
  return icon;
}

export function DataToolbar({
  searchValue,
  searchPlaceholder = 'Rechercher...',
  onSearchChange,
  views,
  activeView,
  onViewChange,
  filters,
  actions,
  rightSlot,
  compact = false,
}: DataToolbarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minHeight: compact ? 36 : 40,
        fontFamily: 'var(--notion-sans)',
      }}
    >
      {onSearchChange && (
        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <Search
            size={15}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9A9A9A' }}
          />
          <input
            type="search"
            placeholder={searchPlaceholder}
            value={searchValue ?? ''}
            onChange={(event) => onSearchChange(event.target.value)}
            style={{
              width: '100%',
              height: compact ? 36 : 38,
              padding: '0 12px 0 36px',
              border: '1px solid #E6E4DF',
              borderRadius: 8,
              outline: 'none',
              background: '#FFFFFF',
              color: '#1D1F1E',
              font: 'inherit',
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {filters}

      {views && views.length > 0 && (
        <div style={{ display: 'flex', border: '1px solid #E6E4DF', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
          {views.map((view, index) => {
            const active = activeView === view.id;
            return (
              <button
                key={view.id}
                type="button"
                onClick={() => onViewChange?.(view.id)}
                title={view.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  height: compact ? 34 : 36,
                  minWidth: 42,
                  padding: '0 12px',
                  border: 'none',
                  borderLeft: index === 0 ? 'none' : '1px solid #E6E4DF',
                  background: active ? '#1E5A3A' : '#FFFFFF',
                  color: active ? '#FFFFFF' : '#6B6B6B',
                  cursor: 'pointer',
                  font: 'inherit',
                  fontSize: 12.5,
                  fontWeight: 650,
                }}
              >
                {renderViewIcon(view.icon)}
              </button>
            );
          })}
        </div>
      )}

      {rightSlot}
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}
