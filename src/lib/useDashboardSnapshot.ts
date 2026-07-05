import { useQuery } from '@tanstack/react-query';
import { useAuth } from './auth';
import { getDashboardSnapshot } from './services/dashboardService';

export function useDashboardSnapshot(limit = 8) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dashboard-snapshot', user?.id ?? 'anonymous', limit],
    queryFn: () => getDashboardSnapshot(limit),
    enabled: Boolean(user),
  });
}
