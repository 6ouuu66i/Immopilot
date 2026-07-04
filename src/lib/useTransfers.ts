import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth';
import {
  transfersService,
  type ListMyTransfersInput,
  type RequestTransferInput,
  type TransferDirection,
  type TransferRequestFull,
} from './services/transfersService';

export interface UseMyTransfersResult {
  transfers: TransferRequestFull[];
  pendingReceived: TransferRequestFull[];
  pendingSent: TransferRequestFull[];
  history: TransferRequestFull[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  requestTransfer: (input: RequestTransferInput) => Promise<TransferRequestFull>;
  acceptTransfer: (transferId: string) => Promise<TransferRequestFull>;
  refuseTransfer: (transferId: string, refusalReason?: string | null) => Promise<TransferRequestFull>;
  cancelTransfer: (transferId: string) => Promise<TransferRequestFull>;
}

export interface UseTransferResult {
  transfer: TransferRequestFull | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function keyFor(direction: TransferDirection) {
  return direction;
}

function replaceTransfer(transfers: TransferRequestFull[], transfer: TransferRequestFull) {
  const exists = transfers.some((item) => item.id === transfer.id);
  if (!exists) return [transfer, ...transfers];
  return transfers.map((item) => (item.id === transfer.id ? transfer : item));
}

function optimisticResolve(transfers: TransferRequestFull[], transferId: string, status: TransferRequestFull['status'], patch: Partial<TransferRequestFull> = {}) {
  return transfers.map((transfer) => (
    transfer.id === transferId
      ? { ...transfer, ...patch, status, resolved_at: new Date().toISOString() }
      : transfer
  ));
}

export function useMyTransfers({ direction = 'all' }: ListMyTransfersInput = {}): UseMyTransfersResult {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState<TransferRequestFull[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = useMemo(() => keyFor(direction), [direction]);

  const refresh = useCallback(async () => {
    if (!user) {
      setTransfers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const next = await transfersService.listMyTransfers({ direction });
      setTransfers(next);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Chargement des transferts impossible.');
    } finally {
      setIsLoading(false);
    }
  }, [direction, user]);

  useEffect(() => {
    void refresh();
  }, [key, refresh]);

  const requestTransfer = useCallback(async (input: RequestTransferInput) => {
    setError(null);
    try {
      const created = await transfersService.requestTransfer(input);
      setTransfers((current) => replaceTransfer(current, created));
      return created;
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Demande de transfert impossible.';
      setError(message);
      throw new Error(message);
    }
  }, []);

  const acceptTransfer = useCallback(async (transferId: string) => {
    const previous = transfers;
    setError(null);
    setTransfers((current) => optimisticResolve(current, transferId, 'accepted'));
    try {
      const updated = await transfersService.acceptTransfer(transferId);
      setTransfers((current) => replaceTransfer(current, updated));
      return updated;
    } catch (acceptError) {
      setTransfers(previous);
      const message = acceptError instanceof Error ? acceptError.message : 'Acceptation du transfert impossible.';
      setError(message);
      throw new Error(message);
    }
  }, [transfers]);

  const refuseTransfer = useCallback(async (transferId: string, refusalReason?: string | null) => {
    const previous = transfers;
    setError(null);
    setTransfers((current) => optimisticResolve(current, transferId, 'refused', { refusal_reason: refusalReason ?? null }));
    try {
      const updated = await transfersService.refuseTransfer(transferId, refusalReason);
      setTransfers((current) => replaceTransfer(current, updated));
      return updated;
    } catch (refuseError) {
      setTransfers(previous);
      const message = refuseError instanceof Error ? refuseError.message : 'Refus du transfert impossible.';
      setError(message);
      throw new Error(message);
    }
  }, [transfers]);

  const cancelTransfer = useCallback(async (transferId: string) => {
    const previous = transfers;
    setError(null);
    setTransfers((current) => optimisticResolve(current, transferId, 'cancelled'));
    try {
      const updated = await transfersService.cancelTransfer(transferId);
      setTransfers((current) => replaceTransfer(current, updated));
      return updated;
    } catch (cancelError) {
      setTransfers(previous);
      const message = cancelError instanceof Error ? cancelError.message : 'Annulation du transfert impossible.';
      setError(message);
      throw new Error(message);
    }
  }, [transfers]);

  const pendingReceived = useMemo(() => transfers.filter((transfer) => transfer.status === 'pending' && transfer.from_agent_id === user?.id), [transfers, user?.id]);
  const pendingSent = useMemo(() => transfers.filter((transfer) => transfer.status === 'pending' && transfer.requested_by === user?.id), [transfers, user?.id]);
  const history = useMemo(() => transfers.filter((transfer) => transfer.status !== 'pending'), [transfers]);

  return {
    transfers,
    pendingReceived,
    pendingSent,
    history,
    isLoading,
    error,
    refresh,
    requestTransfer,
    acceptTransfer,
    refuseTransfer,
    cancelTransfer,
  };
}

export function useTransfer(transferId: string | null | undefined): UseTransferResult {
  const { user } = useAuth();
  const [transfer, setTransfer] = useState<TransferRequestFull | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(transferId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user || !transferId) {
      setTransfer(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const next = await transfersService.getTransfer(transferId);
      setTransfer(next);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Chargement du transfert impossible.');
    } finally {
      setIsLoading(false);
    }
  }, [transferId, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    transfer,
    isLoading,
    error,
    refresh,
  };
}
