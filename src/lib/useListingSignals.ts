import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth';
import {
  listingSignalsService,
  type SignalsByProperty,
} from './services/listingSignalsService';

interface UseListingSignalsResult {
  signalsByProperty: SignalsByProperty;
  isLoading: boolean;
}

function propertyIdsKey(propertyIds: string[]) {
  return Array.from(new Set(propertyIds.filter(Boolean))).sort().join('|');
}

export function useListingSignals(propertyIds: string[]): UseListingSignalsResult {
  const { user } = useAuth();
  const key = propertyIdsKey(propertyIds);
  const stablePropertyIds = useMemo(() => (key ? key.split('|') : []), [key]);
  const [signalsByProperty, setSignalsByProperty] = useState<SignalsByProperty>({});
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || stablePropertyIds.length === 0) {
      setSignalsByProperty({});
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      setSignalsByProperty(await listingSignalsService.listByPropertyIds(stablePropertyIds));
    } catch {
      setSignalsByProperty({});
    } finally {
      setIsLoading(false);
    }
  }, [stablePropertyIds, user]);

  useEffect(() => {
    void refresh();
  }, [key, refresh]);

  return { signalsByProperty, isLoading };
}
