import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth';
import { createPropertyIdsKey, queryKeys } from './queryKeys';
import {
  contactsService,
  type PropertyContactLink,
} from './services/contactsService';

export interface UsePropertyContactLinksResult {
  links: PropertyContactLink[];
  isLoading: boolean;
  error: string | null;
  invalidate: () => Promise<void>;
}

export function usePropertyContactLinks(propertyIds?: string[]): UsePropertyContactLinksResult {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const stablePropertyIds = useMemo(() => createPropertyIdsKey(propertyIds ?? []), [propertyIds]);
  const loadAll = propertyIds === undefined;
  const queryPropertyIds = loadAll ? undefined : stablePropertyIds;
  const queryKey = queryKeys.propertyContactLinks(user?.id, loadAll ? ['all'] : stablePropertyIds);
  const query = useQuery({
    queryKey,
    queryFn: () => contactsService.listPropertyContactLinks(queryPropertyIds),
    enabled: Boolean(user) && (loadAll || stablePropertyIds.length > 0),
  });

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    links: query.data ?? [],
    isLoading: query.isLoading || query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    invalidate,
  };
}
