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
  neutral: { background: '#F3F2EF', color: '#5F5B52', border: '#E6E4DF', dot: '#9A9A9A' },
  success: { background: '#EAF7EF', color: '#166534', border: '#CFE8D8', dot: '#1E5A3A' },
  warning: { background: '#FFF3D8', color: '#8A5D0A', border: '#F2D89B', dot: '#D97706' },
  danger: { background: '#FDEBEC', color: '#991B1B', border: '#F5C7C9', dot: '#C8553D' },
  info: { background: '#EAF2FB', color: '#1D4E89', border: '#CFE0F2', dot: '#2D6CDF' },
  violet: { background: '#F1ECFA', color: '#5B3E91', border: '#DED3F1', dot: '#7C3AED' },
  dark: { background: '#1D1F1E', color: '#FFFFFF', border: '#1D1F1E', dot: '#FFFFFF' },
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
