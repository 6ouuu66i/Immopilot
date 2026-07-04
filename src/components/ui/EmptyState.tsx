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
    <div className={`lv-empty-state ${compact ? 'is-compact' : ''}`}>
      <span aria-hidden="true" className="lv-empty-state-icon">
        {icon ?? <Inbox size={compact ? 15 : 18} />}
      </span>
      <div>
        <strong className="lv-empty-state-title">{title}</strong>
        {description && <p className="lv-empty-state-description">{description}</p>}
      </div>
      {action}
    </div>
  );
}
