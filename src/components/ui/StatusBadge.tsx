import type { ReactNode } from 'react';

export type StatusBadgeTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'violet'
  | 'dark';

interface StatusBadgeProps {
  children: ReactNode;
  tone?: StatusBadgeTone;
  size?: 'sm' | 'md';
  leadingDot?: boolean;
  title?: string;
}

const TONES: Record<StatusBadgeTone, { background: string; color: string; border: string; dot: string }> = {
  neutral: {
    background: 'var(--color-neutral-bg)',
    color: 'var(--color-neutral-text)',
    border: 'var(--color-neutral-border)',
    dot: 'var(--color-text-tertiary)',
  },
  success: {
    background: 'var(--color-success-bg)',
    color: 'var(--color-success-text)',
    border: 'var(--color-success-border)',
    dot: 'var(--color-success-text)',
  },
  warning: {
    background: 'var(--color-warning-bg)',
    color: 'var(--color-warning-text)',
    border: 'var(--color-warning-border)',
    dot: 'var(--color-warning-text)',
  },
  danger: {
    background: 'var(--color-danger-bg)',
    color: 'var(--color-danger-text)',
    border: 'var(--color-danger-border)',
    dot: 'var(--color-danger-text)',
  },
  info: {
    background: 'var(--color-info-bg)',
    color: 'var(--color-info-text)',
    border: 'var(--color-info-border)',
    dot: 'var(--color-info-text)',
  },
  violet: {
    background: 'var(--color-signal-behavior-bg)',
    color: 'var(--color-signal-behavior-text)',
    border: 'var(--color-signal-behavior-border)',
    dot: 'var(--color-signal-behavior-text)',
  },
  dark: {
    background: 'var(--color-text-primary)',
    color: 'var(--color-text-inverse)',
    border: 'var(--color-text-primary)',
    dot: 'var(--color-text-inverse)',
  },
};

export function StatusBadge({
  children,
  tone = 'neutral',
  size = 'sm',
  leadingDot = false,
  title,
}: StatusBadgeProps) {
  const colors = TONES[tone];
  const isSmall = size === 'sm';

  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        width: 'fit-content',
        maxWidth: '100%',
        minHeight: isSmall ? 20 : 24,
        padding: isSmall ? '2px 7px' : '3px 9px',
        borderRadius: 999,
        border: `1px solid ${colors.border}`,
        background: colors.background,
        color: colors.color,
        fontFamily: 'var(--notion-sans)',
        fontSize: isSmall ? 10.5 : 11.5,
        fontWeight: 650,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}
    >
      {leadingDot && (
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: colors.dot,
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}
