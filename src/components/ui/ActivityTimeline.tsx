import { EmptyState } from './EmptyState';
import type { Activity } from '../../types';

interface ActivityTimelineProps {
  activities: Activity[];
  limit?: number;
  emptyTitle?: string;
  compact?: boolean;
}

export function ActivityTimeline({
  activities,
  limit = 6,
  emptyTitle = 'Aucune activité',
  compact = false,
}: ActivityTimelineProps) {
  const visibleActivities = activities.slice(0, limit);

  if (visibleActivities.length === 0) {
    return <EmptyState compact title={emptyTitle} description="L'historique apparaîtra ici dès qu'une action sera enregistrée." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 8 : 10, fontFamily: 'var(--notion-sans)' }}>
      {visibleActivities.map((activity) => (
        <div
          key={activity.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '9px minmax(0, 1fr)',
            gap: 8,
            alignItems: 'start',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              marginTop: 4,
              borderRadius: 999,
              background: 'var(--color-brand)',
              boxShadow: '0 0 0 3px color-mix(in srgb, var(--color-brand) 9%, transparent)',
            }}
          />
          <span style={{ minWidth: 0 }}>
            <strong style={{ display: 'block', color: 'var(--color-text-primary)', fontSize: compact ? 11 : 12, fontWeight: 650, lineHeight: 1.3 }}>
              {activity.text}
            </strong>
            <small style={{ display: 'block', marginTop: 3, color: 'var(--color-text-tertiary)', fontSize: compact ? 9.5 : 10.5 }}>
              {activity.agentName} · {activity.date}
            </small>
          </span>
        </div>
      ))}
    </div>
  );
}
