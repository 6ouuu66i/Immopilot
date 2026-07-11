import type { ReactNode } from 'react';

export interface PropertyInsightZoneProps {
  ariaLabel: string;
  children: ReactNode;
  leading: ReactNode;
  size?: 'compact' | 'panel';
}

export function PropertyInsightZone({
  ariaLabel,
  children,
  leading,
  size = 'compact',
}: PropertyInsightZoneProps) {
  return (
    <div
      aria-label={ariaLabel}
      style={{
        display: 'grid',
        gridTemplateColumns: size === 'panel' ? '86px minmax(0, 1fr)' : '44px minmax(0, 1fr)',
        gap: size === 'panel' ? 12 : 8,
        alignItems: 'center',
        minWidth: 0,
      }}
    >
      {leading}
      <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
        {children}
      </div>
    </div>
  );
}
