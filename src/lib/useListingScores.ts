import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth';
import {
  listingScoresService,
  type ListingScoresByProperty,
} from './services/listingScoresService';

interface UseListingScoresResult {
  scoresByProperty: ListingScoresByProperty;
  isLoading: boolean;
}

function propertyIdsKey(propertyIds: string[]) {
  return Array.from(new Set(propertyIds.filter(Boolean))).sort().join('|');
}

export function useListingScores(propertyIds: string[]): UseListingScoresResult {
  const { user } = useAuth();
  const key = propertyIdsKey(propertyIds);
  const stablePropertyIds = useMemo(() => (key ? key.split('|') : []), [key]);
  const [scoresByProperty, setScoresByProperty] = useState<ListingScoresByProperty>({});
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || stablePropertyIds.length === 0) {
      setScoresByProperty({});
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      setScoresByProperty(await listingScoresService.listByPropertyIds(stablePropertyIds));
    } catch {
      setScoresByProperty({});
    } finally {
      setIsLoading(false);
    }
  }, [stablePropertyIds, user]);

  useEffect(() => {
    void refresh();
  }, [key, refresh]);

  return { scoresByProperty, isLoading };
}
