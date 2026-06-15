import { MetricCard, type MetricCardProps } from './MetricCard';

interface KpiStripProps {
  metrics: MetricCardProps[];
  actions?: React.ReactNode;
  compact?: boolean;
}

export function KpiStrip({ metrics, actions, compact = false }: KpiStripProps) {
  return (
    <section
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: actions ? 12 : 0,
        fontFamily: 'var(--notion-sans)',
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'stretch',
          background: '#FFFFFF',
          border: '1px solid #E6E4DF',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        {metrics.map((metric, index) => (
          <MetricCard
            key={metric.label}
            {...metric}
            last={metric.last ?? index === metrics.length - 1}
          />
        ))}
      </div>
      {actions && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
            minHeight: compact ? 36 : 44,
          }}
        >
          {actions}
        </div>
      )}
    </section>
  );
}
