import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from './auth';
import { createPropertyIdsKey, queryKeys } from './queryKeys';
import {
  listingScoresService,
  type ListingScoresByProperty,
} from './services/listingScoresService';

interface UseListingScoresResult {
  scoresByProperty: ListingScoresByProperty;
  isLoading: boolean;
}

export function useListingScores(propertyIds: string[]): UseListingScoresResult {
  const { user } = useAuth();
  const stablePropertyIds = useMemo(() => createPropertyIdsKey(propertyIds), [propertyIds]);

  const query = useQuery({
    queryKey: queryKeys.listingScores(user?.id, stablePropertyIds),
    queryFn: () => listingScoresService.listByPropertyIds(stablePropertyIds),
    enabled: Boolean(user) && stablePropertyIds.length > 0,
  });

  return {
    scoresByProperty: query.data ?? {},
    isLoading: query.isLoading,
  };
}
