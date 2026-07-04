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
    <div className={`lv-activity-timeline ${compact ? 'is-compact' : ''}`}>
      {visibleActivities.map((activity) => (
        <div key={activity.id} className="lv-activity-row">
          <span aria-hidden="true" className="lv-activity-dot" />
          <span className="lv-activity-content">
            <strong className="lv-activity-title">{activity.text}</strong>
            <small className="lv-activity-meta">
              {activity.agentName} · {activity.date}
            </small>
          </span>
        </div>
      ))}
    </div>
  );
}
