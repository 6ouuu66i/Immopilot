import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './auth';
import { queryKeys } from './queryKeys';
import { pipelineStagesService, type PipelineStageRow } from './services/pipelineStagesService';

export interface UsePipelineStagesResult {
  stages: PipelineStageRow[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getStageById: (id: string | null | undefined) => PipelineStageRow | null;
}

export function usePipelineStages(): UsePipelineStagesResult {
  const { user } = useAuth();
  const stagesQuery = useQuery({
    queryKey: queryKeys.pipelineStages(user?.id),
    queryFn: pipelineStagesService.listStages,
    enabled: Boolean(user),
    refetchOnMount: 'always',
  });
  const stages = stagesQuery.data ?? [];

  const refresh = useCallback(async () => {
    if (!user) return;
    await stagesQuery.refetch();
  }, [stagesQuery, user]);

  const getStageById = useCallback(
    (id: string | null | undefined) => stages.find((stage) => stage.id === id) ?? null,
    [stages],
  );

  return {
    stages,
    isLoading: stagesQuery.isLoading,
    error: stagesQuery.error instanceof Error ? stagesQuery.error.message : null,
    refresh,
    getStageById,
  };
}
