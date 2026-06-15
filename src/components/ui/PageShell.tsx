import type { ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
  sidePanel?: ReactNode;
  sidePanelWidth?: number;
  padded?: boolean;
  maxWidth?: number | string;
  className?: string;
}

export function PageShell({
  children,
  sidePanel,
  sidePanelWidth = 480,
  padded = false,
  maxWidth = 'none',
  className,
}: PageShellProps) {
  return (
    <div
      className={className}
      style={{
        minHeight: '100%',
        background: '#F7F6F3',
        color: '#1D1F1E',
        fontFamily: 'var(--notion-sans)',
        position: 'relative',
      }}
    >
      <main
        style={{
          minHeight: '100%',
          padding: padded ? 32 : 0,
          paddingRight: sidePanel ? sidePanelWidth + (padded ? 32 : 0) : padded ? 32 : 0,
          transition: 'padding-right 180ms ease',
        }}
      >
        <div style={{ width: '100%', maxWidth, margin: maxWidth === 'none' ? 0 : '0 auto' }}>
          {children}
        </div>
      </main>
      {sidePanel}
    </div>
  );
}
