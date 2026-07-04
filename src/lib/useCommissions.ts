import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth';
import {
  commissionsService,
  type AgencyCommissionFilters,
  type CommissionFilters,
  type CommissionStatus,
  type CommissionWithRelations,
  type CreateCommissionInput,
  type UpdateCommissionInput,
} from './services/commissionsService';

export interface UseCommissionsResult {
  commissions: CommissionWithRelations[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export interface UseAgencyCommissionsResult extends UseCommissionsResult {
  createCommission: (input: CreateCommissionInput) => Promise<CommissionWithRelations>;
  updateCommission: (commissionId: string, patch: UpdateCommissionInput) => Promise<CommissionWithRelations>;
  updateStatus: (commissionId: string, status: CommissionStatus) => Promise<CommissionWithRelations>;
  markAsPaid: (commissionId: string) => Promise<CommissionWithRelations>;
  deleteCommission: (commissionId: string) => Promise<void>;
}

export interface UseCommissionResult {
  commission: CommissionWithRelations | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function filtersKey(filters: CommissionFilters | AgencyCommissionFilters) {
  return JSON.stringify({
    status: filters.status ?? 'all',
    period: filters.period ?? 'all',
    agent_id: 'agent_id' in filters ? filters.agent_id ?? null : null,
  });
}

function replaceCommission(commissions: CommissionWithRelations[], commission: CommissionWithRelations) {
  const exists = commissions.some((item) => item.id === commission.id);
  if (!exists) return [commission, ...commissions];
  return commissions.map((item) => (item.id === commission.id ? commission : item));
}

export function useMyCommissions(filters: CommissionFilters = {}): UseCommissionsResult {
  const { user } = useAuth();
  const [commissions, setCommissions] = useState<CommissionWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = filtersKey(filters);
  const stableFilters = useMemo<CommissionFilters>(() => ({
    period: filters.period,
    status: filters.status,
  }), [key]);

  const refresh = useCallback(async () => {
    if (!user) {
      setCommissions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      setCommissions(await commissionsService.listMyCommissions(stableFilters));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Chargement des commissions impossible.');
    } finally {
      setIsLoading(false);
    }
  }, [stableFilters, user]);

  useEffect(() => {
    void refresh();
  }, [key, refresh]);

  return { commissions, isLoading, error, refresh };
}

export function useAgencyCommissions(filters: AgencyCommissionFilters = {}): UseAgencyCommissionsResult {
  const { user, profile } = useAuth();
  const [commissions, setCommissions] = useState<CommissionWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = filtersKey(filters);
  const stableFilters = useMemo<AgencyCommissionFilters>(() => ({
    agent_id: filters.agent_id,
    period: filters.period,
    status: filters.status,
  }), [key]);

  const refresh = useCallback(async () => {
    if (!user || profile?.role !== 'admin') {
      setCommissions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      setCommissions(await commissionsService.listAgencyCommissions(stableFilters));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Chargement des commissions agence impossible.');
    } finally {
      setIsLoading(false);
    }
  }, [profile?.role, stableFilters, user]);

  useEffect(() => {
    void refresh();
  }, [key, refresh]);

  const createCommission = useCallback(async (input: CreateCommissionInput) => {
    setError(null);
    try {
      const created = await commissionsService.createCommission(input);
      setCommissions((current) => [created, ...current]);
      return created;
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : 'Creation de la commission impossible.';
      setError(message);
      throw new Error(message);
    }
  }, []);

  const updateCommission = useCallback(async (commissionId: string, patch: UpdateCommissionInput) => {
    const previous = commissions;
    setError(null);
    setCommissions((current) => current.map((commission) => (
      commission.id === commissionId
        ? { ...commission, ...patch, updated_at: new Date().toISOString() }
        : commission
    )));
    try {
      const updated = await commissionsService.updateCommission(commissionId, patch);
      setCommissions((current) => replaceCommission(current, updated));
      return updated;
    } catch (updateError) {
      setCommissions(previous);
      const message = updateError instanceof Error ? updateError.message : 'Modification de la commission impossible.';
      setError(message);
      throw new Error(message);
    }
  }, [commissions]);

  const updateStatus = useCallback(async (commissionId: string, status: CommissionStatus) => {
    return updateCommission(commissionId, { status });
  }, [updateCommission]);

  const markAsPaid = useCallback(async (commissionId: string) => {
    return updateCommission(commissionId, { status: 'paid' });
  }, [updateCommission]);

  const deleteCommission = useCallback(async (commissionId: string) => {
    const previous = commissions;
    setError(null);
    setCommissions((current) => current.filter((commission) => commission.id !== commissionId));
    try {
      await commissionsService.deleteCommission(commissionId);
    } catch (deleteError) {
      setCommissions(previous);
      const message = deleteError instanceof Error ? deleteError.message : 'Suppression de la commission impossible.';
      setError(message);
      throw new Error(message);
    }
  }, [commissions]);

  return {
    commissions,
    isLoading,
    error,
    refresh,
    createCommission,
    updateCommission,
    updateStatus,
    markAsPaid,
    deleteCommission,
  };
}

export function useCommission(commissionId: string | null | undefined): UseCommissionResult {
  const { user } = useAuth();
  const [commission, setCommission] = useState<CommissionWithRelations | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(commissionId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user || !commissionId) {
      setCommission(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      setCommission(await commissionsService.getCommission(commissionId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Chargement de la commission impossible.');
    } finally {
      setIsLoading(false);
    }
  }, [commissionId, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { commission, isLoading, error, refresh };
}
