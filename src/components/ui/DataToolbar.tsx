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
    <div className={`lv-toolbar ${compact ? 'lv-toolbar-compact' : ''}`}>
      {onSearchChange && (
        <div className="lv-toolbar-search">
          <Search size={15} className="lv-toolbar-search-icon" />
          <input
            type="search"
            placeholder={searchPlaceholder}
            value={searchValue ?? ''}
            onChange={(event) => onSearchChange(event.target.value)}
            className="lv-input lv-input-search"
          />
        </div>
      )}

      {filters}

      {views && views.length > 0 && (
        <div className="lv-view-toggle">
          {views.map((view, index) => {
            const active = activeView === view.id;
            return (
              <button
                key={view.id}
                type="button"
                onClick={() => onViewChange?.(view.id)}
                title={view.label}
                className={`lv-view-toggle-button ${active ? 'is-active' : ''}`}
                data-first={index === 0 ? 'true' : undefined}
              >
                {renderViewIcon(view.icon)}
              </button>
            );
          })}
        </div>
      )}

      {rightSlot}
      {actions && <div className="lv-toolbar-actions">{actions}</div>}
    </div>
  );
}
