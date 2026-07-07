import type { CSSProperties } from 'react';

interface SkeletonBoxProps {
  width?: string | number;
  height?: string | number;
  style?: CSSProperties;
  className?: string;
}

export function SkeletonBox({ width, height, style, className = '' }: SkeletonBoxProps) {
  return (
    <div
      className={`skeleton-box ${className}`}
      style={{
        width,
        height,
        background: 'var(--lv-muted)',
        animation: 'skeleton-pulse 2.5s ease-in-out infinite',
        borderRadius: 0,
        ...style,
      }}
    />
  );
}

interface SkeletonCardProps {
  children?: React.ReactNode;
  style?: CSSProperties;
  className?: string;
}

export function SkeletonCard({ children, style, className = '' }: SkeletonCardProps) {
  return (
    <div
      className={`skeleton-card ${className}`}
      style={{
        background: 'var(--lv-surface)',
        border: '1px solid var(--lv-border)',
        borderRadius: 0,
        padding: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

interface SkeletonAvatarProps {
  size?: string | number;
  shape?: 'square' | 'circle';
  style?: CSSProperties;
  className?: string;
}

export function SkeletonAvatar({ size = 32, shape = 'square', style, className = '' }: SkeletonAvatarProps) {
  return (
    <div
      className={`skeleton-avatar ${className}`}
      style={{
        width: size,
        height: size,
        background: 'var(--lv-muted)',
        animation: 'skeleton-pulse 2.5s ease-in-out infinite',
        borderRadius: shape === 'circle' ? '999px' : 0,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

interface SkeletonTextProps {
  lines?: number;
  width?: string | number;
  height?: string | number;
  lineHeight?: string | number;
  style?: CSSProperties;
  className?: string;
}

export function SkeletonText({ lines = 1, width, height, lineHeight = '12px', style, className = '' }: SkeletonTextProps) {
  if (lines === 1) {
    return (
      <div
        className={`skeleton-text-line ${className}`}
        style={{
          width,
          height: height || lineHeight,
          background: 'var(--lv-muted)',
          animation: 'skeleton-pulse 2.5s ease-in-out infinite',
          borderRadius: 0,
          ...style,
        }}
      />
    );
  }

  return (
    <div className={`skeleton-text-multi ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...style }}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          style={{
            height: lineHeight,
            background: 'var(--lv-muted)',
            animation: 'skeleton-pulse 2.5s ease-in-out infinite',
            animationDelay: `${index * 0.1}s`,
            borderRadius: 0,
            width: index === lines - 1 ? '60%' : undefined,
          }}
        />
      ))}
    </div>
  );
}

interface SkeletonBadgeProps {
  width?: string | number;
  height?: string | number;
  style?: CSSProperties;
  className?: string;
}

export function SkeletonBadge({ width = '48px', height = '18px', style, className = '' }: SkeletonBadgeProps) {
  return (
    <div
      className={`skeleton-badge ${className}`}
      style={{
        width,
        height,
        background: 'var(--lv-muted)',
        animation: 'skeleton-pulse 2.5s ease-in-out infinite',
        borderRadius: 0,
        ...style,
      }}
    />
  );
}

interface SkeletonTableRowProps {
  columns: number;
  columnWidths?: (string | number)[];
  style?: CSSProperties;
  className?: string;
}

export function SkeletonTableRow({ columns, columnWidths = [], style, className = '' }: SkeletonTableRowProps) {
  return (
    <div
      className={`skeleton-table-row ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: '12px',
        alignItems: 'center',
        padding: '8px 14px 8px 8px',
        background: 'var(--lv-surface)',
        border: '1px solid var(--lv-border)',
        borderRadius: 0,
        ...style,
      }}
    >
      {Array.from({ length: columns }).map((_, index) => (
        <SkeletonBox
          key={index}
          height="14px"
          width={columnWidths[index] || '100%'}
          style={{
            background: 'var(--lv-muted)',
            animation: 'skeleton-pulse 2.5s ease-in-out infinite',
            animationDelay: `${index * 0.05}s`,
          }}
        />
      ))}
    </div>
  );
}