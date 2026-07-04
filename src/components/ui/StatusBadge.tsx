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

const TONE_CLASS: Record<StatusBadgeTone, string> = {
  neutral: 'neutral',
  success: 'good',
  warning: 'watch',
  danger: 'risk',
  info: 'info',
  violet: 'violet',
  dark: 'dark',
};

export function StatusBadge({
  children,
  tone = 'neutral',
  size = 'sm',
  leadingDot = false,
  title,
}: StatusBadgeProps) {
  return (
    <span
      title={title}
      className={`lv-badge lv-badge-${TONE_CLASS[tone]} ${size === 'md' ? 'lv-badge-md' : 'lv-badge-sm'}`}
    >
      {leadingDot && <span aria-hidden="true" className="lv-badge-dot" />}
      {children}
    </span>
  );
}
