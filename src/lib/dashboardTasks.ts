export const DASHBOARD_TASK_LIST_LIMIT = 5;

export interface DashboardTaskCountValues {
  overdue: number;
  today: number;
}

interface DashboardTaskListItem {
  due_date: string | null;
  is_completed: boolean;
}

export function dashboardDueTaskTotal(counts: DashboardTaskCountValues): number {
  return counts.today + counts.overdue;
}

export function selectVisibleDashboardTasks<T extends DashboardTaskListItem>(tasks: T[]): T[] {
  return tasks
    .filter((task) => !task.is_completed)
    .slice()
    .sort((left, right) => `${left.due_date ?? ''}`.localeCompare(`${right.due_date ?? ''}`))
    .slice(0, DASHBOARD_TASK_LIST_LIMIT);
}
