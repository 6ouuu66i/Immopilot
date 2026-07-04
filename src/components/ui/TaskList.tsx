import { CheckCircle2, Circle } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Task } from '../../types';
import { EmptyState } from './EmptyState';
import { StatusBadge } from './StatusBadge';

interface TaskListProps {
  tasks: Task[];
  onToggleTask?: (taskId: string) => void;
  getMeta?: (task: Task) => ReactNode;
  emptyTitle?: string;
  compact?: boolean;
}

function priorityTone(priority: Task['priority']) {
  if (priority === 'haute') return 'danger' as const;
  if (priority === 'basse') return 'neutral' as const;
  return 'warning' as const;
}

export function TaskList({
  tasks,
  onToggleTask,
  getMeta,
  emptyTitle = 'Aucune tâche',
  compact = false,
}: TaskListProps) {
  if (tasks.length === 0) {
    return <EmptyState compact title={emptyTitle} description="Rien à traiter dans cette vue pour le moment." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 6 : 8 }}>
      {tasks.map((task) => (
        <button
          key={task.id}
          type="button"
          onClick={() => onToggleTask?.(task.id)}
          style={{
            display: 'grid',
            gridTemplateColumns: compact ? '16px minmax(0, 1fr)' : '18px minmax(0, 1fr) auto',
            alignItems: 'start',
            gap: 8,
            width: '100%',
            padding: compact ? '4px 0' : '8px 0',
            border: 0,
            borderBottom: compact ? 0 : '1px solid var(--color-border-subtle)',
            background: 'transparent',
            color: 'var(--color-text-primary)',
            textAlign: 'left',
            cursor: onToggleTask ? 'pointer' : 'default',
            fontFamily: 'var(--notion-sans)',
          }}
        >
          <span style={{ color: task.done ? 'var(--color-success-text)' : 'var(--color-text-disabled)', marginTop: 1 }}>
            {task.done ? <CheckCircle2 size={compact ? 14 : 16} /> : <Circle size={compact ? 14 : 16} />}
          </span>
          <span style={{ minWidth: 0 }}>
            <strong
              style={{
                display: 'block',
                color: task.done ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
                fontSize: compact ? 11.5 : 12.5,
                fontWeight: 650,
                lineHeight: 1.25,
                textDecoration: task.done ? 'line-through' : 'none',
              }}
            >
              {task.title}
            </strong>
            <small style={{ display: 'block', marginTop: 3, color: 'var(--color-text-tertiary)', fontSize: compact ? 10 : 11.5 }}>
              {getMeta?.(task) ?? `${task.date} · ${task.time}`}
            </small>
          </span>
          {!compact && <StatusBadge tone={priorityTone(task.priority)}>{task.priority}</StatusBadge>}
        </button>
      ))}
    </div>
  );
}
