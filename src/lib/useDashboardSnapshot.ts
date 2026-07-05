import { useQuery } from '@tanstack/react-query';
import { useAuth } from './auth';
import { queryKeys } from './queryKeys';
import { getDashboardSnapshot } from './services/dashboardService';

export function useDashboardSnapshot(limit = 8) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.dashboardSnapshot(user?.id, limit),
    queryFn: () => getDashboardSnapshot(limit),
    enabled: Boolean(user),
  });
}
