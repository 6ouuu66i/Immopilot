import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from './auth';
import { createPropertyIdsKey, queryKeys } from './queryKeys';
import {
  listingSignalsService,
  type SignalsByProperty,
} from './services/listingSignalsService';

interface UseListingSignalsResult {
  signalsByProperty: SignalsByProperty;
  isLoading: boolean;
  error: string | null;
}

export function useListingSignals(propertyIds: string[]): UseListingSignalsResult {
  const { user } = useAuth();
  const stablePropertyIds = useMemo(() => createPropertyIdsKey(propertyIds), [propertyIds]);

  const query = useQuery({
    queryKey: queryKeys.listingSignals(user?.id, stablePropertyIds),
    queryFn: () => listingSignalsService.listByPropertyIds(stablePropertyIds),
    enabled: Boolean(user) && stablePropertyIds.length > 0,
  });

  return {
    signalsByProperty: query.data ?? {},
    isLoading: query.isLoading || query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
