import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth';
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
  const [marks, setMarks] = useState<PropertyMarks>(EMPTY_MARKS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadMarks() {
      if (!user) {
        setMarks(EMPTY_MARKS);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const nextMarks = await propertyMarksService.getMarks(user.id);
        if (active) setMarks(nextMarks);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Chargement des favoris impossible.');
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadMarks();

    return () => {
      active = false;
    };
  }, [user]);

  const favoriteSet = useMemo(() => new Set(marks.favorites), [marks.favorites]);
  const ignoredSet = useMemo(() => new Set(marks.ignored), [marks.ignored]);

  const isFavorite = useCallback((propertyId: string | undefined) => Boolean(propertyId && favoriteSet.has(propertyId)), [favoriteSet]);
  const isIgnored = useCallback((propertyId: string | undefined) => Boolean(propertyId && ignoredSet.has(propertyId)), [ignoredSet]);

  const toggleFavorite = useCallback(
    async (propertyId: string | undefined) => {
      if (!propertyId) return;

      const previousMarks = marks;
      const nextFavoriteState = !favoriteSet.has(propertyId);

      setError(null);
      setMarks({
        favorites: replaceMark(marks.favorites, propertyId, nextFavoriteState),
        ignored: nextFavoriteState ? replaceMark(marks.ignored, propertyId, false) : marks.ignored,
      });

      try {
        await propertyMarksService.toggleFavorite(propertyId);
      } catch (toggleError) {
        setMarks(previousMarks);
        setError(toggleError instanceof Error ? toggleError.message : 'Mise à jour du favori impossible.');
      }
    },
    [favoriteSet, marks],
  );

  const toggleIgnored = useCallback(
    async (propertyId: string | undefined) => {
      if (!propertyId) return;

      const previousMarks = marks;
      const nextIgnoredState = !ignoredSet.has(propertyId);

      setError(null);
      setMarks({
        favorites: nextIgnoredState ? replaceMark(marks.favorites, propertyId, false) : marks.favorites,
        ignored: replaceMark(marks.ignored, propertyId, nextIgnoredState),
      });

      try {
        await propertyMarksService.toggleIgnored(propertyId);
      } catch (toggleError) {
        setMarks(previousMarks);
        setError(toggleError instanceof Error ? toggleError.message : 'Mise à jour du statut ignoré impossible.');
      }
    },
    [ignoredSet, marks],
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
