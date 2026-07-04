import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './auth';
import { pipelineStagesService, type PipelineStageRow } from './services/pipelineStagesService';

let stagesCache: PipelineStageRow[] | null = null;

export interface UsePipelineStagesResult {
  stages: PipelineStageRow[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getStageById: (id: string | null | undefined) => PipelineStageRow | null;
}

export function usePipelineStages(): UsePipelineStagesResult {
  const { user } = useAuth();
  const [stages, setStages] = useState<PipelineStageRow[]>(stagesCache ?? []);
  const [isLoading, setIsLoading] = useState(!stagesCache);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setStages([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const nextStages = await pipelineStagesService.listStages();
      stagesCache = nextStages;
      setStages(nextStages);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Chargement des étapes impossible.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (stagesCache) return;
    void refresh();
  }, [refresh]);

  const getStageById = useCallback(
    (id: string | null | undefined) => stages.find((stage) => stage.id === id) ?? null,
    [stages],
  );

  return {
    stages,
    isLoading,
    error,
    refresh,
    getStageById,
  };
}
