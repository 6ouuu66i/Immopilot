import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useAuth } from './auth';
import {
  applyOptimisticDealPatch,
  DealMutationLock,
  executeOptimisticMutation,
  replaceDealInList,
  restoreDealInList,
} from './pipelineRuntime';
import { queryKeys } from './queryKeys';
import {
  dealsService,
  type CloseDealInput,
  type CreateDealInput,
  type DealFull,
  type ListDealsFilters,
  type UpdateDealInput,
} from './services/dealsService';
import type { PipelineStageRow } from './services/pipelineStagesService';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface DealQuerySnapshot {
  key: QueryKey;
  deal: DealFull | undefined;
  index: number;
}

export interface UseDealsResult {
  deals: DealFull[];
  isLoading: boolean;
  loadError: string | null;
  mutationError: string | null;
  error: string | null;
  filters: ListDealsFilters;
  setFilters: (filters: ListDealsFilters) => void;
  refresh: () => Promise<void>;
  pendingDealIds: ReadonlySet<string>;
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

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : error ? String(error) : fallback;
}

function snapshotDealQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  rootQueryKey: QueryKey,
  dealId: string,
): DealQuerySnapshot[] {
  return queryClient.getQueriesData<DealFull[]>({ queryKey: rootQueryKey }).map(([key, deals]) => {
    const index = deals?.findIndex((deal) => deal.id === dealId) ?? -1;
    return { key, deal: index >= 0 ? deals?.[index] : undefined, index };
  });
}

function restoreSnapshots(queryClient: ReturnType<typeof useQueryClient>, snapshots: DealQuerySnapshot[]) {
  snapshots.forEach((snapshot) => queryClient.setQueryData<DealFull[]>(
    snapshot.key,
    (current = []) => restoreDealInList(current, snapshot),
  ));
}

function updateSnapshots(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshots: DealQuerySnapshot[],
  updater: (deals: DealFull[], includeClosed: boolean) => DealFull[],
) {
  snapshots.forEach(({ key }) => {
    const filters = key[2] as { includeClosed?: boolean } | undefined;
    queryClient.setQueryData<DealFull[]>(key, (current = []) => updater(current, Boolean(filters?.includeClosed)));
  });
}

export function useDeals(initialFilters: ListDealsFilters = {}): UseDealsResult {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ListDealsFilters>(initialFilters);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [pendingDealIds, setPendingDealIds] = useState<ReadonlySet<string>>(new Set());
  const lockRef = useRef<DealMutationLock | null>(null);
  if (!lockRef.current) lockRef.current = new DealMutationLock(setPendingDealIds);

  const queryKey = queryKeys.deals(user?.id, filters);
  const rootQueryKey = queryKeys.dealsRoot(user?.id);
  const dealsQuery = useQuery({
    queryKey,
    queryFn: () => dealsService.listDeals(filters),
    enabled: Boolean(user),
  });
  const createMutation = useMutation({ mutationFn: dealsService.createDeal });
  const updateMutation = useMutation({
    mutationFn: ({ dealId, patch }: { dealId: string; patch: UpdateDealInput }) => dealsService.updateDeal(dealId, patch),
  });
  const stageMutation = useMutation({
    mutationFn: ({ dealId, stageId, expectedStageId }: { dealId: string; stageId: string; expectedStageId: string }) => (
      dealsService.updateDealStage(dealId, stageId, expectedStageId)
    ),
  });
  const closeMutation = useMutation({
    mutationFn: ({ dealId, input }: { dealId: string; input: CloseDealInput }) => dealsService.closeDeal(dealId, input),
  });
  const reopenMutation = useMutation({ mutationFn: dealsService.reopenDeal });
  const deleteMutation = useMutation({ mutationFn: dealsService.deleteDeal });
  const deals = dealsQuery.data ?? [];

  const refresh = useCallback(async () => {
    if (!user) return;
    await dealsQuery.refetch();
  }, [dealsQuery, user]);

  const invalidateDeals = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: rootQueryKey }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dealRoot(user?.id) }),
    ]);
  }, [queryClient, rootQueryKey, user?.id]);

  const runLocked = useCallback(async <T,>(dealId: string, operation: () => Promise<T>): Promise<T> => {
    setMutationError(null);
    try {
      return await lockRef.current!.run(dealId, operation);
    } catch (error) {
      setMutationError(errorMessage(error, 'Mutation du deal impossible.'));
      throw error;
    }
  }, []);

  const createDeal = useCallback(async (input: CreateDealInput) => {
    setMutationError(null);
    try {
      const created = await createMutation.mutateAsync(input);
      queryClient.setQueryData<DealFull[]>(queryKey, (current = []) => [created, ...current.filter((deal) => deal.id !== created.id)]);
      await invalidateDeals();
      return created;
    } catch (error) {
      setMutationError(errorMessage(error, 'Creation du deal impossible.'));
      throw error;
    }
  }, [createMutation, invalidateDeals, queryClient, queryKey]);

  const updateDeal = useCallback((dealId: string, patch: UpdateDealInput) => runLocked(dealId, async () => {
    await queryClient.cancelQueries({ queryKey: rootQueryKey });
    const stages = user
      ? queryClient.getQueryData<PipelineStageRow[]>(queryKeys.pipelineStages(user.id)) ?? []
      : [];
    return executeOptimisticMutation({
      snapshot: () => snapshotDealQueries(queryClient, rootQueryKey, dealId),
      apply: () => queryClient.setQueriesData<DealFull[]>({ queryKey: rootQueryKey }, (current = []) => (
        current.map((deal) => deal.id === dealId ? applyOptimisticDealPatch(deal, patch, stages) : deal)
      )),
      mutate: () => updateMutation.mutateAsync({ dealId, patch }),
      commit: (updated) => queryClient.setQueriesData<DealFull[]>({ queryKey: rootQueryKey }, (current = []) => (
        replaceDealInList(current, updated)
      )),
      rollback: (snapshots) => restoreSnapshots(queryClient, snapshots),
      invalidate: invalidateDeals,
    });
  }), [invalidateDeals, queryClient, rootQueryKey, runLocked, updateMutation, user]);

  const updateDealStage = useCallback((dealId: string, newStageId: string) => runLocked(dealId, async () => {
    const stages = user
      ? queryClient.getQueryData<PipelineStageRow[]>(queryKeys.pipelineStages(user.id)) ?? []
      : [];
    if (!stages.some((stage) => stage.id === newStageId)) {
      const error = new Error('Etape de pipeline non supportee.');
      setMutationError(error.message);
      throw error;
    }
    await queryClient.cancelQueries({ queryKey: rootQueryKey });
    const snapshots = snapshotDealQueries(queryClient, rootQueryKey, dealId);
    const currentDeal = snapshots.find((snapshot) => snapshot.deal)?.deal;
    if (!currentDeal) throw new Error('Deal introuvable dans le pipeline. Rechargez la page.');
    return executeOptimisticMutation({
      snapshot: () => snapshots,
      apply: () => queryClient.setQueriesData<DealFull[]>({ queryKey: rootQueryKey }, (current = []) => (
        current.map((deal) => deal.id === dealId ? applyOptimisticDealPatch(deal, { stage_id: newStageId }, stages) : deal)
      )),
      mutate: () => stageMutation.mutateAsync({
        dealId,
        stageId: newStageId,
        expectedStageId: currentDeal.stage_id,
      }),
      commit: (updated) => queryClient.setQueriesData<DealFull[]>({ queryKey: rootQueryKey }, (current = []) => (
        replaceDealInList(current, updated)
      )),
      rollback: (snapshots) => restoreSnapshots(queryClient, snapshots),
      invalidate: invalidateDeals,
    });
  }), [invalidateDeals, queryClient, rootQueryKey, runLocked, stageMutation, user]);

  const closeDeal = useCallback((dealId: string, input: CloseDealInput) => runLocked(dealId, async () => {
    await queryClient.cancelQueries({ queryKey: rootQueryKey });
    const now = new Date().toISOString();
    const stages = user
      ? queryClient.getQueryData<PipelineStageRow[]>(queryKeys.pipelineStages(user.id)) ?? []
      : [];
    const terminalStage = stages.find((stage) => input.is_won ? stage.is_won : stage.is_lost);
    if (!terminalStage) throw new Error(input.is_won ? 'Etape gagnee introuvable.' : 'Etape perdue introuvable.');
    let snapshots: DealQuerySnapshot[] = [];
    return executeOptimisticMutation({
      snapshot: () => {
        snapshots = snapshotDealQueries(queryClient, rootQueryKey, dealId);
        return snapshots;
      },
      apply: () => updateSnapshots(queryClient, snapshots, (current, includeClosed) => (
        current
          .map((deal) => deal.id === dealId ? {
            ...deal,
            stage_id: terminalStage.id,
            stage: terminalStage,
            closed_at: now,
            is_won: input.is_won,
            is_lost: !input.is_won,
            lost_reason: input.is_won ? null : input.lost_reason ?? null,
          } : deal)
          .filter((deal) => includeClosed || !deal.closed_at)
      )),
      mutate: () => closeMutation.mutateAsync({ dealId, input }),
      commit: (updated) => updateSnapshots(queryClient, snapshots, (current, includeClosed) => (
        includeClosed ? replaceDealInList(current, updated) : current.filter((deal) => deal.id !== updated.id)
      )),
      rollback: (snapshots) => restoreSnapshots(queryClient, snapshots),
      invalidate: invalidateDeals,
    });
  }), [closeMutation, invalidateDeals, queryClient, rootQueryKey, runLocked, user]);

  const reopenDeal = useCallback((dealId: string) => runLocked(dealId, async () => {
    await queryClient.cancelQueries({ queryKey: rootQueryKey });
    const snapshots = snapshotDealQueries(queryClient, rootQueryKey, dealId);
    try {
      const updated = await reopenMutation.mutateAsync(dealId);
      queryClient.setQueriesData<DealFull[]>({ queryKey: rootQueryKey }, (current = []) => replaceDealInList(current, updated));
      await invalidateDeals();
      return updated;
    } catch (error) {
      restoreSnapshots(queryClient, snapshots);
      throw error;
    }
  }), [invalidateDeals, queryClient, reopenMutation, rootQueryKey, runLocked]);

  const deleteDeal = useCallback((dealId: string) => runLocked(dealId, async () => {
    await queryClient.cancelQueries({ queryKey: rootQueryKey });
    return executeOptimisticMutation({
      snapshot: () => snapshotDealQueries(queryClient, rootQueryKey, dealId),
      apply: () => queryClient.setQueriesData<DealFull[]>({ queryKey: rootQueryKey }, (current = []) => current.filter((deal) => deal.id !== dealId)),
      mutate: () => deleteMutation.mutateAsync(dealId),
      commit: () => undefined,
      rollback: (snapshots) => restoreSnapshots(queryClient, snapshots),
      invalidate: invalidateDeals,
    });
  }), [deleteMutation, invalidateDeals, queryClient, rootQueryKey, runLocked]);

  const loadError = dealsQuery.error ? errorMessage(dealsQuery.error, 'Chargement des deals impossible.') : null;
  return {
    deals,
    isLoading: dealsQuery.isLoading,
    loadError,
    mutationError,
    error: loadError ?? mutationError,
    filters,
    setFilters,
    refresh,
    pendingDealIds,
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
  const dealQuery = useQuery({
    queryKey: queryKeys.deal(user?.id, dealIdOrReference),
    queryFn: () => UUID_RE.test(dealIdOrReference ?? '')
      ? dealsService.getDeal(dealIdOrReference as string)
      : dealsService.getDealFullByReference(dealIdOrReference as string),
    enabled: Boolean(user && dealIdOrReference),
  });

  const refresh = useCallback(async () => {
    if (!user || !dealIdOrReference) return;
    await dealQuery.refetch();
  }, [dealIdOrReference, dealQuery, user]);

  return {
    deal: dealQuery.data ?? null,
    isLoading: dealQuery.isLoading,
    error: dealQuery.error ? errorMessage(dealQuery.error, 'Chargement du deal impossible.') : null,
    refresh,
  };
}
