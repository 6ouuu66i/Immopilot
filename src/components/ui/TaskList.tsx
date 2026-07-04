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
    <div className={`lv-task-list ${compact ? 'is-compact' : ''}`}>
      {tasks.map((task) => (
        <button
          key={task.id}
          type="button"
          onClick={() => onToggleTask?.(task.id)}
          className={`lv-task-row ${task.done ? 'is-done' : ''} ${compact ? 'is-compact' : ''}`}
          data-clickable={onToggleTask ? 'true' : 'false'}
        >
          <span className="lv-task-check">
            {task.done ? <CheckCircle2 size={compact ? 14 : 16} /> : <Circle size={compact ? 14 : 16} />}
          </span>
          <span className="lv-task-content">
            <strong className="lv-task-title">{task.title}</strong>
            <small className="lv-task-meta">
              {getMeta?.(task) ?? `${task.date} · ${task.time}`}
            </small>
          </span>
          {!compact && <StatusBadge tone={priorityTone(task.priority)}>{task.priority}</StatusBadge>}
        </button>
      ))}
    </div>
  );
}
