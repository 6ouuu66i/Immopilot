import type { ReactNode } from 'react';

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  icon?: ReactNode;
  last?: boolean;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'violet';
}

const TONE_COLORS: Record<NonNullable<MetricCardProps['tone']>, string> = {
  neutral: 'var(--color-text-tertiary)',
  success: 'var(--color-success-text)',
  warning: 'var(--color-warning-text)',
  danger: 'var(--color-danger-text)',
  info: 'var(--color-info-text)',
  violet: 'var(--color-signal-behavior-text)',
};

export function MetricCard({
  label,
  value,
  delta,
  icon,
  last = false,
  tone = 'neutral',
}: MetricCardProps) {
  const accent = TONE_COLORS[tone];

  return (
    <article
      style={{
        flex: 1,
        minWidth: 0,
        padding: 'var(--space-4) var(--space-5)',
        display: 'grid',
        gridTemplateColumns: icon ? '28px minmax(0, 1fr)' : 'minmax(0, 1fr)',
        gap: 10,
        alignItems: 'center',
        borderRight: last ? 'none' : '1px solid var(--color-border-default)',
      }}
    >
      {icon && (
        <span
          aria-hidden="true"
          style={{
            width: 28,
            height: 28,
            borderRadius: 'var(--radius)',
            display: 'grid',
            placeItems: 'center',
            background: 'var(--color-bg-muted)',
            color: accent,
          }}
        >
          {icon}
        </span>
      )}
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            color: 'var(--color-text-secondary)',
            fontSize: 11.5,
            fontWeight: 600,
            letterSpacing: 0,
            lineHeight: 1.2,
          }}
        >
          {label}
        </span>
        <strong
          style={{
            display: 'block',
            marginTop: 7,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono, var(--notion-mono))',
            fontVariantNumeric: 'tabular-nums',
            fontSize: 28,
            fontWeight: 750,
            lineHeight: 1,
            letterSpacing: 0,
          }}
        >
          {value}
        </strong>
        {delta && (
          <small style={{ display: 'block', marginTop: 7, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono, var(--notion-mono))', fontVariantNumeric: 'tabular-nums', fontSize: 11.5, lineHeight: 1.25 }}>
            {delta}
          </small>
        )}
      </span>
    </article>
  );
}
