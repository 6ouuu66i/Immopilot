import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from './auth';
import { createPropertyIdsKey } from './queryKeys';
import {
  listingSignalsService,
  type SignalsByProperty,
} from './services/listingSignalsService';

interface UseListingSignalsResult {
  signalsByProperty: SignalsByProperty;
  isLoading: boolean;
}

export function useListingSignals(propertyIds: string[]): UseListingSignalsResult {
  const { user } = useAuth();
  const stablePropertyIds = useMemo(() => createPropertyIdsKey(propertyIds), [propertyIds]);

  const query = useQuery({
    queryKey: ['listing-signals', user?.id ?? 'anonymous', stablePropertyIds],
    queryFn: () => listingSignalsService.listByPropertyIds(stablePropertyIds),
    enabled: Boolean(user) && stablePropertyIds.length > 0,
  });

  return {
    signalsByProperty: query.data ?? {},
    isLoading: query.isLoading,
  };
}
