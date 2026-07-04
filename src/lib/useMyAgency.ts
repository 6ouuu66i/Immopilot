import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './auth';
import {
  agencyService,
  type AgencyRow,
  type UpdateAgencyPatch,
} from './services/agencyService';

export function useMyAgency() {
  const { agency: authAgency, profile, refreshProfile } = useAuth();
  const [agency, setAgency] = useState<AgencyRow | null>(authAgency);
  const [isLoading, setIsLoading] = useState(!authAgency);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    setAgency(authAgency);
    setIsLoading(false);
  }, [authAgency]);

  const refresh = useCallback(async () => {
    if (!profile?.agency_id) {
      setAgency(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const next = await agencyService.getMyAgency();
      setAgency(next);
      await refreshProfile();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chargement de l'agence impossible.");
    } finally {
      setIsLoading(false);
    }
  }, [profile?.agency_id, refreshProfile]);

  const updateAgency = useCallback(async (patch: UpdateAgencyPatch) => {
    if (!isAdmin) throw new Error('Action reservee aux administrateurs.');
    const previous = agency;
    setError(null);
    setAgency((current) => current ? { ...current, ...patch, updated_at: new Date().toISOString() } : current);
    try {
      const updated = await agencyService.updateAgency(patch);
      setAgency(updated);
      await refreshProfile();
      return updated;
    } catch (updateError) {
      setAgency(previous);
      const message = updateError instanceof Error ? updateError.message : "Enregistrement de l'agence impossible.";
      setError(message);
      throw new Error(message);
    }
  }, [agency, isAdmin, refreshProfile]);

  const uploadAgencyLogo = useCallback(async (file: File) => {
    if (!isAdmin) throw new Error('Action reservee aux administrateurs.');
    const previous = agency;
    setError(null);
    try {
      const updated = await agencyService.uploadAgencyLogo(file);
      setAgency(updated);
      await refreshProfile();
      return updated;
    } catch (uploadError) {
      setAgency(previous);
      const message = uploadError instanceof Error ? uploadError.message : "Upload du logo impossible.";
      setError(message);
      throw new Error(message);
    }
  }, [agency, isAdmin, refreshProfile]);

  return {
    agency,
    isLoading,
    error,
    isAdmin,
    refresh,
    updateAgency,
    uploadAgencyLogo,
  };
}
