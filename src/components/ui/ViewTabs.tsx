import type { ReactNode } from 'react';

export interface ViewTabItem {
  id: string;
  label: string;
  count?: number | string;
  icon?: ReactNode;
}

interface ViewTabsProps {
  tabs: ViewTabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  ariaLabel?: string;
}

export function ViewTabs({ tabs, activeTab, onChange, ariaLabel = 'Vues' }: ViewTabsProps) {
  return (
    <nav
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        minWidth: 0,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        fontFamily: 'var(--notion-sans)',
      }}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 34,
              padding: '0 11px',
              border: '1px solid transparent',
              borderBottomColor: active ? '#1D1F1E' : 'transparent',
              borderRadius: 0,
              background: active ? '#FFFFFF' : 'transparent',
              color: active ? '#1D1F1E' : '#6B6B6B',
              font: 'inherit',
              fontSize: 12.5,
              fontWeight: active ? 750 : 550,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span
                style={{
                  minWidth: 20,
                  height: 20,
                  padding: '0 6px',
                  borderRadius: 999,
                  display: 'inline-grid',
                  placeItems: 'center',
                  background: '#F3F2EF',
                  color: '#6B6B6B',
                  fontSize: 10.5,
                  fontWeight: 700,
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
