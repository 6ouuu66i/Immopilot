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
    <nav aria-label={ariaLabel} className="lv-tabs">
      {tabs.map((tab) => {
        const active = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`lv-tab ${active ? 'is-active' : ''}`}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && <span className="lv-tab-count">{tab.count}</span>}
          </button>
        );
      })}
    </nav>
  );
}
