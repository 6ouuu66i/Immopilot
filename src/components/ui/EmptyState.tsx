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
        border: '1px dashed #D8D5CD',
        borderRadius: 10,
        background: '#FAF9F6',
        color: '#6B6B6B',
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
          background: '#F3F2EF',
          color: '#8E8B83',
        }}
      >
        {icon ?? <Inbox size={compact ? 15 : 18} />}
      </span>
      <div>
        <strong style={{ display: 'block', color: '#1D1F1E', fontSize: compact ? 12 : 13.5 }}>
          {title}
        </strong>
        {description && (
          <p style={{ margin: '4px 0 0', maxWidth: 320, color: '#6B6B6B', fontSize: compact ? 11.5 : 12.5, lineHeight: 1.45 }}>
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
