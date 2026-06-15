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
  neutral: '#8E8B83',
  success: '#1E5A3A',
  warning: '#D97706',
  danger: '#C8553D',
  info: '#2D6CDF',
  violet: '#7C3AED',
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
        padding: '14px 20px',
        display: 'grid',
        gridTemplateColumns: icon ? '28px minmax(0, 1fr)' : 'minmax(0, 1fr)',
        gap: 10,
        alignItems: 'center',
        borderRight: last ? 'none' : '1px solid #E6E4DF',
      }}
    >
      {icon && (
        <span
          aria-hidden="true"
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            display: 'grid',
            placeItems: 'center',
            background: `${accent}14`,
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
            color: '#8E8B83',
            fontFamily: 'var(--notion-mono)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            lineHeight: 1.2,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        <strong
          style={{
            display: 'block',
            marginTop: 7,
            color: '#1D1F1E',
            fontSize: 28,
            fontWeight: 750,
            lineHeight: 1,
            letterSpacing: '-0.01em',
          }}
        >
          {value}
        </strong>
        {delta && (
          <small style={{ display: 'block', marginTop: 7, color: '#6B6B6B', fontSize: 11.5, lineHeight: 1.25 }}>
            {delta}
          </small>
        )}
      </span>
    </article>
  );
}
