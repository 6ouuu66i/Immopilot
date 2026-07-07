import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useAuth } from './auth';
import { queryKeys } from './queryKeys';
import { propertyMarksService, type PropertyMarks } from './services/propertyMarksService';

interface UsePropertyMarksResult {
  favorites: string[];
  ignored: string[];
  isLoading: boolean;
  error: string | null;
  isFavorite: (propertyId: string | undefined) => boolean;
  isIgnored: (propertyId: string | undefined) => boolean;
  toggleFavorite: (propertyId: string | undefined) => Promise<void>;
  toggleIgnored: (propertyId: string | undefined) => Promise<void>;
}

const EMPTY_MARKS: PropertyMarks = { favorites: [], ignored: [] };

function replaceMark(list: string[], propertyId: string, active: boolean): string[] {
  if (active) return list.includes(propertyId) ? list : [...list, propertyId];
  return list.filter((id) => id !== propertyId);
}

export function usePropertyMarks(): UsePropertyMarksResult {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState<string | null>(null);
  const queryKey = queryKeys.propertyMarks(user?.id);
  const invalidateRelatedQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: queryKeys.supabaseProperties(user?.id) }),
      queryClient.invalidateQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'supabase-properties-page',
      }),
    ]);
  }, [queryClient, queryKey, user?.id]);

  const marksQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user) return EMPTY_MARKS;
      return propertyMarksService.getMarks(user.id);
    },
    enabled: Boolean(user),
  });

  const marks = marksQuery.data ?? EMPTY_MARKS;
  const isLoading = marksQuery.isLoading;
  const error = mutationError ?? (marksQuery.error instanceof Error ? marksQuery.error.message : null);
  const favoriteSet = useMemo(() => new Set(marks.favorites), [marks.favorites]);
  const ignoredSet = useMemo(() => new Set(marks.ignored), [marks.ignored]);

  const isFavorite = useCallback((propertyId: string | undefined) => Boolean(propertyId && favoriteSet.has(propertyId)), [favoriteSet]);
  const isIgnored = useCallback((propertyId: string | undefined) => Boolean(propertyId && ignoredSet.has(propertyId)), [ignoredSet]);

  const favoriteMutation = useMutation({
    mutationFn: async (propertyId: string) => {
      await propertyMarksService.toggleFavorite(propertyId);
    },
  });
  const ignoredMutation = useMutation({
    mutationFn: async (propertyId: string) => {
      await propertyMarksService.toggleIgnored(propertyId);
    },
  });

  const toggleFavorite = useCallback(
    async (propertyId: string | undefined) => {
      if (!propertyId) return;

      const previousMarks = marks;
      const nextFavoriteState = !favoriteSet.has(propertyId);
      const nextMarks = {
        favorites: replaceMark(marks.favorites, propertyId, nextFavoriteState),
        ignored: nextFavoriteState ? replaceMark(marks.ignored, propertyId, false) : marks.ignored,
      };

      setMutationError(null);
      queryClient.setQueryData<PropertyMarks>(queryKey, nextMarks);

      try {
        await favoriteMutation.mutateAsync(propertyId);
        await invalidateRelatedQueries();
      } catch (toggleError) {
        queryClient.setQueryData<PropertyMarks>(queryKey, previousMarks);
        setMutationError(toggleError instanceof Error ? toggleError.message : 'Mise Ã  jour du favori impossible.');
      }
    },
    [favoriteMutation, favoriteSet, invalidateRelatedQueries, marks, queryClient, queryKey],
  );

  const toggleIgnored = useCallback(
    async (propertyId: string | undefined) => {
      if (!propertyId) return;

      const previousMarks = marks;
      const nextIgnoredState = !ignoredSet.has(propertyId);
      const nextMarks = {
        favorites: nextIgnoredState ? replaceMark(marks.favorites, propertyId, false) : marks.favorites,
        ignored: replaceMark(marks.ignored, propertyId, nextIgnoredState),
      };

      setMutationError(null);
      queryClient.setQueryData<PropertyMarks>(queryKey, nextMarks);

      try {
        await ignoredMutation.mutateAsync(propertyId);
        await invalidateRelatedQueries();
      } catch (toggleError) {
        queryClient.setQueryData<PropertyMarks>(queryKey, previousMarks);
        setMutationError(toggleError instanceof Error ? toggleError.message : 'Mise Ã  jour du statut ignorÃ© impossible.');
      }
    },
    [ignoredMutation, ignoredSet, invalidateRelatedQueries, marks, queryClient, queryKey],
  );

  return {
    favorites: marks.favorites,
    ignored: marks.ignored,
    isLoading,
    error,
    isFavorite,
    isIgnored,
    toggleFavorite,
    toggleIgnored,
  };
}
