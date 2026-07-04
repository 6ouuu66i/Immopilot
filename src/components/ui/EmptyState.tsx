import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ title, description, icon, action, compact = false }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        gap: compact ? 6 : 10,
        minHeight: compact ? 72 : 148,
        padding: compact ? 12 : 20,
        border: '1px dashed var(--color-border-strong)',
        borderRadius: 10,
        background: 'var(--color-bg-page)',
        color: 'var(--color-text-secondary)',
        textAlign: 'center',
        fontFamily: 'var(--notion-sans)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: compact ? 30 : 38,
          height: compact ? 30 : 38,
          borderRadius: 999,
          display: 'grid',
          placeItems: 'center',
          background: 'var(--color-bg-muted)',
          color: 'var(--color-text-tertiary)',
        }}
      >
        {icon ?? <Inbox size={compact ? 15 : 18} />}
      </span>
      <div>
        <strong style={{ display: 'block', color: 'var(--color-text-primary)', fontSize: compact ? 12 : 13.5 }}>
          {title}
        </strong>
        {description && (
          <p style={{ margin: '4px 0 0', maxWidth: 320, color: 'var(--color-text-secondary)', fontSize: compact ? 11.5 : 12.5, lineHeight: 1.45 }}>
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
