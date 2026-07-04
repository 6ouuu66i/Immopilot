import { ArrowLeftRight, Check, Clock, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useMyTransfers } from '../lib/useTransfers';
import type { TransferRequestFull, TransferStatus } from '../lib/services/transfersService';

type TransferTab = 'received' | 'sent' | 'history';

function profileName(profile: TransferRequestFull['from_agent']) {
  return profile?.full_name ?? profile?.email ?? 'Agent';
}

function propertyAddress(transfer: TransferRequestFull) {
  const property = transfer.deal?.property;
  if (!property) return 'Bien non renseigne';
  const street = [property.street, property.house_number].filter(Boolean).join(' ');
  return [street, property.postal_code, property.locality].filter(Boolean).join(', ') || 'Adresse non renseignee';
}

function dealTitle(transfer: TransferRequestFull) {
  return transfer.deal?.reference ?? transfer.deal?.title ?? 'Deal';
}

function statusLabel(status: TransferStatus) {
  if (status === 'pending') return 'En attente';
  if (status === 'accepted') return 'Accepte';
  if (status === 'refused') return 'Refuse';
  return 'Annule';
}

function statusClass(status: TransferStatus) {
  if (status === 'accepted') return 'is-success';
  if (status === 'refused') return 'is-danger';
  if (status === 'cancelled') return 'is-muted';
  return 'is-warning';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-BE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function openTransferDeal(transfer: TransferRequestFull) {
  if (transfer.deal?.reference) window.location.hash = `#pipeline?deal=${encodeURIComponent(transfer.deal.reference)}`;
  else if (transfer.deal_id) window.location.hash = `#pipeline?dealId=${encodeURIComponent(transfer.deal_id)}`;
}

export function Transfers() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TransferTab>('received');
  const [search, setSearch] = useState('');
  const [refusalTransfer, setRefusalTransfer] = useState<TransferRequestFull | null>(null);
  const [refusalReason, setRefusalReason] = useState('');
  const transfersState = useMyTransfers({ direction: 'all' });

  const rows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const base = transfersState.transfers.filter((transfer) => {
      if (tab === 'received') return transfer.status === 'pending' && transfer.from_agent_id === user?.id;
      if (tab === 'sent') return transfer.status === 'pending' && transfer.requested_by === user?.id;
      return transfer.status !== 'pending';
    });

    if (!normalized) return base;
    return base.filter((transfer) => [
      dealTitle(transfer),
      propertyAddress(transfer),
      profileName(transfer.from_agent),
      profileName(transfer.to_agent),
      transfer.message ?? '',
    ].join(' ').toLowerCase().includes(normalized));
  }, [search, tab, transfersState.transfers, user?.id]);

  async function submitRefusal() {
    if (!refusalTransfer) return;
    await transfersState.refuseTransfer(refusalTransfer.id, refusalReason);
    setRefusalTransfer(null);
    setRefusalReason('');
  }

  return (
    <main className="transfers-page">
      <header className="transfers-header">
        <div>
          <span className="transfers-eyebrow"><ArrowLeftRight size={15} /> Transferts</span>
          <h1>Transferts de deals</h1>
          <p>Suivez les demandes entrantes, vos demandes envoyees et l'historique des decisions.</p>
        </div>
      </header>

      <section className="transfers-toolbar">
        <label className="transfers-search">
          <Search size={15} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un deal, une adresse, un agent..." />
        </label>
        <div className="transfers-tabs">
          <button className={tab === 'received' ? 'active' : ''} type="button" onClick={() => setTab('received')}>
            Recus <span>{transfersState.pendingReceived.length}</span>
          </button>
          <button className={tab === 'sent' ? 'active' : ''} type="button" onClick={() => setTab('sent')}>
            Envoyes <span>{transfersState.pendingSent.length}</span>
          </button>
          <button className={tab === 'history' ? 'active' : ''} type="button" onClick={() => setTab('history')}>
            Historique <span>{transfersState.history.length}</span>
          </button>
        </div>
      </section>

      {transfersState.error && <div className="transfers-error">{transfersState.error}</div>}

      <section className="transfers-list">
        {transfersState.isLoading ? (
          <div className="transfers-empty">Chargement des transferts...</div>
        ) : rows.length === 0 ? (
          <div className="transfers-empty">Aucun transfert dans cette vue.</div>
        ) : rows.map((transfer) => {
          const otherAgent = transfer.from_agent_id === user?.id ? transfer.requester : transfer.from_agent;
          return (
            <article key={transfer.id} className="transfers-row">
              <button type="button" className="transfers-row-main" onClick={() => openTransferDeal(transfer)}>
                <span className="transfers-row-icon"><ArrowLeftRight size={16} /></span>
                <span className="transfers-row-copy">
                  <span>
                    <strong>{dealTitle(transfer)}</strong>
                    <i className={statusClass(transfer.status)}>{statusLabel(transfer.status)}</i>
                  </span>
                  <small>{propertyAddress(transfer)}</small>
                  <em>{profileName(otherAgent)} · {formatDate(transfer.created_at)}</em>
                  {transfer.message && <small className="transfers-message">{transfer.message}</small>}
                </span>
              </button>
              <div className="transfers-row-actions">
                {tab === 'received' && transfer.status === 'pending' && (
                  <>
                    <button type="button" onClick={() => { void transfersState.acceptTransfer(transfer.id); }}><Check size={14} /> Accepter</button>
                    <button type="button" onClick={() => setRefusalTransfer(transfer)}><X size={14} /> Refuser</button>
                  </>
                )}
                {tab === 'sent' && transfer.status === 'pending' && (
                  <button type="button" onClick={() => { void transfersState.cancelTransfer(transfer.id); }}><Clock size={14} /> Annuler</button>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {refusalTransfer && (
        <div className="transfers-modal-backdrop" role="presentation" onMouseDown={() => setRefusalTransfer(null)}>
          <div className="transfers-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <h2>Refuser le transfert</h2>
            <p>{profileName(refusalTransfer.requester)} souhaite reprendre {dealTitle(refusalTransfer)}.</p>
            <label>
              Raison optionnelle
              <textarea value={refusalReason} onChange={(event) => setRefusalReason(event.target.value)} rows={4} />
            </label>
            <div className="transfers-modal-actions">
              <button type="button" onClick={() => setRefusalTransfer(null)}>Annuler</button>
              <button type="button" onClick={() => { void submitRefusal(); }}>Refuser</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
