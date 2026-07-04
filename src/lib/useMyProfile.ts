import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './auth';
import type { Json } from './database.types';
import {
  profileService,
  type ProfileRow,
  type UpdateMyProfilePatch,
} from './services/profileService';

export function useMyProfile() {
  const { profile: authProfile, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(authProfile);
  const [isLoading, setIsLoading] = useState(!authProfile);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProfile(authProfile);
    setIsLoading(false);
  }, [authProfile]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const next = await profileService.getMyProfile();
      setProfile(next);
      await refreshProfile();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Chargement du profil impossible.');
    } finally {
      setIsLoading(false);
    }
  }, [refreshProfile]);

  const updateProfile = useCallback(async (patch: UpdateMyProfilePatch) => {
    const previous = profile;
    setError(null);
    setProfile((current) => current ? {
      ...current,
      ...patch,
      notification_preferences: patch.notification_preferences
        ? patch.notification_preferences as unknown as Json
        : current.notification_preferences,
      updated_at: new Date().toISOString(),
    } : current);
    try {
      const updated = await profileService.updateMyProfile(patch);
      setProfile(updated);
      await refreshProfile();
      return updated;
    } catch (updateError) {
      setProfile(previous);
      const message = updateError instanceof Error ? updateError.message : 'Enregistrement du profil impossible.';
      setError(message);
      throw new Error(message);
    }
  }, [profile, refreshProfile]);

  const uploadAvatar = useCallback(async (file: File) => {
    const previous = profile;
    setError(null);
    try {
      const updated = await profileService.uploadAvatar(file);
      setProfile(updated);
      await refreshProfile();
      return updated;
    } catch (uploadError) {
      setProfile(previous);
      const message = uploadError instanceof Error ? uploadError.message : "Upload de l'avatar impossible.";
      setError(message);
      throw new Error(message);
    }
  }, [profile, refreshProfile]);

  return {
    profile,
    isLoading,
    error,
    refresh,
    updateProfile,
    uploadAvatar,
  };
}
