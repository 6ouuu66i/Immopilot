import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth';
import {
  dealsService,
  type CloseDealInput,
  type CreateDealInput,
  type DealFull,
  type ListDealsFilters,
  type UpdateDealInput,
} from './services/dealsService';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface UseDealsResult {
  deals: DealFull[];
  isLoading: boolean;
  error: string | null;
  filters: ListDealsFilters;
  setFilters: (filters: ListDealsFilters) => void;
  refresh: () => Promise<void>;
  createDeal: (input: CreateDealInput) => Promise<DealFull>;
  updateDeal: (dealId: string, patch: UpdateDealInput) => Promise<DealFull>;
  updateDealStage: (dealId: string, newStageId: string) => Promise<DealFull>;
  closeDeal: (dealId: string, input: CloseDealInput) => Promise<DealFull>;
  reopenDeal: (dealId: string) => Promise<DealFull>;
  deleteDeal: (dealId: string) => Promise<void>;
}

export interface UseDealResult {
  deal: DealFull | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function filtersKey(filters: ListDealsFilters) {
  return JSON.stringify({
    stage_id: filters.stage_id ?? null,
    owner_id: filters.owner_id ?? null,
    search: filters.search ?? null,
    includeClosed: Boolean(filters.includeClosed),
  });
}

function replaceDeal(deals: DealFull[], deal: DealFull) {
  return deals.map((item) => (item.id === deal.id ? deal : item));
}

export function useDeals(initialFilters: ListDealsFilters = {}): UseDealsResult {
  const { user } = useAuth();
  const [deals, setDeals] = useState<DealFull[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ListDealsFilters>(initialFilters);
  const key = useMemo(() => filtersKey(filters), [filters]);

  const refresh = useCallback(async () => {
    if (!user) {
      setDeals([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const nextDeals = await dealsService.listDeals(filters);
      setDeals(nextDeals);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Chargement des deals impossible.');
    } finally {
      setIsLoading(false);
    }
  }, [filters, user]);

  useEffect(() => {
    void refresh();
  }, [key, refresh]);

  const createDeal = useCallback(async (input: CreateDealInput) => {
    setError(null);
    try {
      const created = await dealsService.createDeal(input);
      setDeals((current) => [created, ...current]);
      return created;
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : 'Création du deal impossible.';
      setError(message);
      throw new Error(message);
    }
  }, []);

  const updateDeal = useCallback(async (dealId: string, patch: UpdateDealInput) => {
    const previousDeals = deals;
    setError(null);
    setDeals((current) => current.map((deal) => (deal.id === dealId ? { ...deal, ...patch, updated_at: new Date().toISOString() } : deal)));

    try {
      const updated = await dealsService.updateDeal(dealId, patch);
      setDeals((current) => replaceDeal(current, updated));
      return updated;
    } catch (updateError) {
      setDeals(previousDeals);
      const message = updateError instanceof Error ? updateError.message : 'Modification du deal impossible.';
      setError(message);
      throw new Error(message);
    }
  }, [deals]);

  const updateDealStage = useCallback(async (dealId: string, newStageId: string) => {
    return updateDeal(dealId, { stage_id: newStageId });
  }, [updateDeal]);

  const closeDeal = useCallback(async (dealId: string, input: CloseDealInput) => {
    const previousDeals = deals;
    setError(null);
    setDeals((current) => current.filter((deal) => deal.id !== dealId));

    try {
      const updated = await dealsService.closeDeal(dealId, input);
      if (filters.includeClosed) setDeals((current) => replaceDeal(current, updated));
      return updated;
    } catch (closeError) {
      setDeals(previousDeals);
      const message = closeError instanceof Error ? closeError.message : 'Clôture du deal impossible.';
      setError(message);
      throw new Error(message);
    }
  }, [deals, filters.includeClosed]);

  const reopenDeal = useCallback(async (dealId: string) => {
    setError(null);
    try {
      const updated = await dealsService.reopenDeal(dealId);
      setDeals((current) => replaceDeal(current, updated));
      return updated;
    } catch (reopenError) {
      const message = reopenError instanceof Error ? reopenError.message : 'Réouverture du deal impossible.';
      setError(message);
      throw new Error(message);
    }
  }, []);

  const deleteDeal = useCallback(async (dealId: string) => {
    const previousDeals = deals;
    setError(null);
    setDeals((current) => current.filter((deal) => deal.id !== dealId));

    try {
      await dealsService.deleteDeal(dealId);
    } catch (deleteError) {
      setDeals(previousDeals);
      const message = deleteError instanceof Error ? deleteError.message : 'Suppression du deal impossible.';
      setError(message);
      throw new Error(message);
    }
  }, [deals]);

  return {
    deals,
    isLoading,
    error,
    filters,
    setFilters,
    refresh,
    createDeal,
    updateDeal,
    updateDealStage,
    closeDeal,
    reopenDeal,
    deleteDeal,
  };
}

export function useDeal(dealIdOrReference: string | null | undefined): UseDealResult {
  const { user } = useAuth();
  const [deal, setDeal] = useState<DealFull | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(dealIdOrReference));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user || !dealIdOrReference) {
      setDeal(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const nextDeal = UUID_RE.test(dealIdOrReference)
        ? await dealsService.getDeal(dealIdOrReference)
        : await dealsService.getDealFullByReference(dealIdOrReference);
      setDeal(nextDeal);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Chargement du deal impossible.');
    } finally {
      setIsLoading(false);
    }
  }, [dealIdOrReference, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    deal,
    isLoading,
    error,
    refresh,
  };
}
