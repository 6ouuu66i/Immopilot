import { ArrowLeftRight, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../lib/auth';
import {
  transfersService,
  type TransferRequestFull,
  type TransferStatus,
} from '../lib/services/transfersService';

type AdminStatusFilter = TransferStatus | 'all';

function profileName(profile: TransferRequestFull['from_agent']) {
  return profile?.full_name ?? profile?.email ?? 'Agent';
}

function propertyAddress(transfer: TransferRequestFull) {
  const property = transfer.deal?.property;
  if (!property) return 'Bien non renseigne';
  const street = [property.street, property.house_number].filter(Boolean).join(' ');
  return [street, property.postal_code, property.locality].filter(Boolean).join(', ') || 'Adresse non renseignee';
}

function statusLabel(status: TransferStatus) {
  if (status === 'pending') return 'En attente';
  if (status === 'accepted') return 'Accepte';
  if (status === 'refused') return 'Refuse';
  return 'Annule';
}

export function AdminTransfersPanel() {
  const { profile } = useAuth();
  const [transfers, setTransfers] = useState<TransferRequestFull[]>([]);
  const [status, setStatus] = useState<AdminStatusFilter>('all');
  const [agentId, setAgentId] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agents = useMemo(() => {
    const map = new Map<string, string>();
    transfers.forEach((transfer) => {
      if (transfer.from_agent) map.set(transfer.from_agent.id, profileName(transfer.from_agent));
      if (transfer.to_agent) map.set(transfer.to_agent.id, profileName(transfer.to_agent));
      if (transfer.requester) map.set(transfer.requester.id, profileName(transfer.requester));
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [transfers]);

  useEffect(() => {
    if (profile?.role !== 'admin') return;
    setIsLoading(true);
    setError(null);
    transfersService.listAgencyTransfers({ status, agentId: agentId || null })
      .then(setTransfers)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Chargement des transferts impossible.'))
      .finally(() => setIsLoading(false));
  }, [agentId, profile?.role, status]);

  const visibleTransfers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return transfers;
    return transfers.filter((transfer) => [
      transfer.deal?.reference ?? '',
      transfer.deal?.title ?? '',
      propertyAddress(transfer),
      profileName(transfer.from_agent),
      profileName(transfer.to_agent),
      profileName(transfer.requester),
      transfer.message ?? '',
    ].join(' ').toLowerCase().includes(normalized));
  }, [search, transfers]);

  if (profile?.role !== 'admin') return null;

  return (
    <section className="admin-transfers-panel">
      <header>
        <div>
          <span><ArrowLeftRight size={15} /> Transferts</span>
          <h2>Transferts de l'agence</h2>
          <p>Lecture seule pour suivre les demandes entre agents.</p>
        </div>
      </header>

      <div className="admin-transfers-toolbar">
        <label>
          <Search size={15} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher..." />
        </label>
        <select value={status} onChange={(event) => setStatus(event.target.value as AdminStatusFilter)}>
          <option value="all">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="accepted">Acceptes</option>
          <option value="refused">Refuses</option>
          <option value="cancelled">Annules</option>
        </select>
        <select value={agentId} onChange={(event) => setAgentId(event.target.value)}>
          <option value="">Tous les agents</option>
          {agents.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div>

      {error && <div className="admin-transfers-error">{error}</div>}
      <div className="admin-transfers-list">
        {isLoading ? (
          <div className="admin-transfers-empty">Chargement...</div>
        ) : visibleTransfers.length === 0 ? (
          <div className="admin-transfers-empty">Aucun transfert.</div>
        ) : visibleTransfers.map((transfer) => (
          <button
            key={transfer.id}
            type="button"
            className="admin-transfers-row"
            onClick={() => {
              window.location.hash = transfer.deal?.reference
                ? `#pipeline?deal=${encodeURIComponent(transfer.deal.reference)}`
                : `#pipeline?dealId=${encodeURIComponent(transfer.deal_id)}`;
            }}
          >
            <strong>{transfer.deal?.reference ?? transfer.deal?.title ?? 'Deal'}</strong>
            <span>{propertyAddress(transfer)}</span>
            <span>{profileName(transfer.from_agent)} {'->'} {profileName(transfer.to_agent)}</span>
            <i>{statusLabel(transfer.status)}</i>
          </button>
        ))}
      </div>
    </section>
  );
}
