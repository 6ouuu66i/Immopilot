import { CircleDollarSign, Edit3, Eye, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useDeals } from '../lib/useDeals';
import { useAgencyCommissions, useMyCommissions } from '../lib/useCommissions';
import {
  centsToEuros,
  eurosToCents,
  formatAmount,
  getValidCommissionTransitions,
  type CommissionPeriod,
  type CommissionStatus,
  type CommissionWithRelations,
} from '../lib/services/commissionsService';

type ViewScope = 'mine' | 'agency';
type StatusFilter = CommissionStatus | 'all';

const STATUS_LABELS: Record<CommissionStatus, string> = {
  draft: 'Brouillon',
  expected: 'Prevue',
  payable: 'A recevoir',
  paid: 'Payee',
  cancelled: 'Annulee',
};

const PERIOD_LABELS: Record<CommissionPeriod, string> = {
  month: 'Ce mois',
  quarter: 'Trimestre',
  year: 'Annee',
  all: 'Tout',
};

function propertyAddress(commission: CommissionWithRelations) {
  const property = commission.deal?.property;
  if (!property) return 'Bien non renseigne';
  const street = [property.street, property.house_number].filter(Boolean).join(' ');
  return [street, property.postal_code, property.locality].filter(Boolean).join(', ') || 'Adresse non renseignee';
}

function profileName(profile: CommissionWithRelations['agent']) {
  return profile?.full_name ?? profile?.email ?? 'Agent';
}

function statusTone(status: CommissionStatus) {
  if (status === 'paid') return 'is-success';
  if (status === 'payable') return 'is-warning';
  if (status === 'cancelled') return 'is-muted';
  return 'is-neutral';
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function sum(commissions: CommissionWithRelations[], statuses: CommissionStatus[]) {
  return commissions
    .filter((commission) => statuses.includes(commission.status))
    .reduce((total, commission) => total + commission.amount, 0);
}

function openDeal(commission: CommissionWithRelations) {
  if (commission.deal?.reference) window.location.hash = `#pipeline?deal=${encodeURIComponent(commission.deal.reference)}`;
  else window.location.hash = `#pipeline?dealId=${encodeURIComponent(commission.deal_id)}`;
}

function readCommissionHashParams() {
  const [, query = ''] = window.location.hash.split('?');
  const params = new URLSearchParams(query);
  return {
    commissionId: params.get('commissionId'),
    dealId: params.get('dealId'),
  };
}

export function Commissions() {
  const { profile } = useAuth();
  const [scope, setScope] = useState<ViewScope>('mine');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [period, setPeriod] = useState<CommissionPeriod>('month');
  const [agentId, setAgentId] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<CommissionWithRelations | null>(null);
  const [creating, setCreating] = useState(false);
  const [focusedCommissionId, setFocusedCommissionId] = useState(() => readCommissionHashParams().commissionId);
  const [initialDealId, setInitialDealId] = useState<string | null>(() => readCommissionHashParams().dealId);
  const isAdmin = profile?.role === 'admin';
  const effectiveScope = isAdmin ? scope : 'mine';
  const myState = useMyCommissions({ status, period });
  const agencyState = useAgencyCommissions({ status, period, agent_id: agentId || null });
  const activeState = effectiveScope === 'agency' ? agencyState : myState;

  useEffect(() => {
    function syncHashParams() {
      const params = readCommissionHashParams();
      setFocusedCommissionId(params.commissionId);
      setInitialDealId(params.dealId);
      if (params.commissionId) {
        setSearch('');
        setStatus('all');
        setPeriod('all');
      }
      if (params.dealId && isAdmin) setCreating(true);
    }

    syncHashParams();
    window.addEventListener('hashchange', syncHashParams);
    return () => window.removeEventListener('hashchange', syncHashParams);
  }, [isAdmin]);

  const visibleCommissions = useMemo(() => {
    const scoped = focusedCommissionId
      ? activeState.commissions.filter((commission) => commission.id === focusedCommissionId)
      : activeState.commissions;
    const normalized = search.trim().toLowerCase();
    if (!normalized) return scoped;
    return scoped.filter((commission) => [
      commission.deal?.reference ?? '',
      commission.deal?.title ?? '',
      propertyAddress(commission),
      profileName(commission.agent),
      commission.notes ?? '',
    ].join(' ').toLowerCase().includes(normalized));
  }, [activeState.commissions, focusedCommissionId, search]);

  const agentOptions = useMemo(() => {
    const map = new Map<string, string>();
    agencyState.commissions.forEach((commission) => {
      if (commission.agent) map.set(commission.agent.id, profileName(commission.agent));
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [agencyState.commissions]);

  const kpis = [
    { label: 'Prevues', value: formatAmount(sum(activeState.commissions, ['draft', 'expected'])) },
    { label: 'A recevoir', value: formatAmount(sum(activeState.commissions, ['payable'])) },
    { label: 'Encaissees', value: formatAmount(sum(activeState.commissions, ['paid'])) },
  ];

  return (
    <main className="commissions-page">
      <header className="commissions-header">
        <div>
          <span className="commissions-eyebrow"><CircleDollarSign size={15} /> Commissions</span>
          <h1>Commissions</h1>
          <p>Suivi des commissions liees aux deals et aux agents.</p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setInitialDealId(null);
              setCreating(true);
            }}
          >
            <Plus size={15} /> Nouvelle commission
          </button>
        )}
      </header>

      {isAdmin && (
        <div className="commissions-scope">
          <button className={scope === 'mine' ? 'active' : ''} type="button" onClick={() => setScope('mine')}>Mes commissions</button>
          <button className={scope === 'agency' ? 'active' : ''} type="button" onClick={() => setScope('agency')}>Toute l'agence</button>
        </div>
      )}

      <section className="commissions-kpis">
        {kpis.map((kpi) => (
          <article key={kpi.label}>
            <span>{kpi.label}</span>
            <strong>{activeState.isLoading ? '—' : kpi.value}</strong>
          </article>
        ))}
      </section>

      <section className="commissions-toolbar">
        <label className="commissions-search">
          <Search size={15} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher deal, agent, note..." />
        </label>
        <select value={period} onChange={(event) => setPeriod(event.target.value as CommissionPeriod)}>
          {Object.entries(PERIOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
          <option value="all">Tous statuts</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {isAdmin && effectiveScope === 'agency' && (
          <select value={agentId} onChange={(event) => setAgentId(event.target.value)}>
            <option value="">Tous agents</option>
            {agentOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}
      </section>

      {activeState.error && <div className="commissions-error">{activeState.error}</div>}
      {focusedCommissionId && !activeState.isLoading && (
        <div className="commissions-focus">
          Commission selectionnee depuis une notification.
          <button type="button" onClick={() => {
            setFocusedCommissionId(null);
            window.location.hash = '#commissions';
          }}>Voir toute la liste</button>
        </div>
      )}

      <section className="commissions-table">
        {activeState.isLoading ? (
          <div className="commissions-empty">Chargement des commissions...</div>
        ) : visibleCommissions.length === 0 ? (
          <div className="commissions-empty">Aucune commission.</div>
        ) : visibleCommissions.map((commission) => (
          <article key={commission.id} className="commissions-row">
            <button type="button" className="commissions-row-main" onClick={() => openDeal(commission)}>
              <span>
                <strong>{commission.deal?.reference ?? commission.deal?.title ?? 'Deal'}</strong>
                <small>{propertyAddress(commission)}</small>
              </span>
              {effectiveScope === 'agency' && <span>{profileName(commission.agent)}</span>}
              <span>{formatAmount(commission.amount)}</span>
              <span>{commission.percentage ? `${commission.percentage.toLocaleString('fr-BE')} %` : '—'}</span>
              <i className={statusTone(commission.status)}>{STATUS_LABELS[commission.status]}</i>
              <span>{formatDate(commission.created_at)}</span>
            </button>
            <div className="commissions-row-actions">
              <button type="button" onClick={() => openDeal(commission)}><Eye size={14} /> Deal</button>
              {isAdmin && (
                <>
                  <button type="button" onClick={() => setEditing(commission)}><Edit3 size={14} /> Modifier</button>
                  {commission.status === 'payable' && (
                    <button type="button" onClick={() => { void agencyState.markAsPaid(commission.id); }}>Payee</button>
                  )}
                  <button type="button" onClick={() => { void agencyState.deleteCommission(commission.id); }}><Trash2 size={14} /></button>
                </>
              )}
            </div>
          </article>
        ))}
      </section>

      {creating && (
        <CommissionModal
          mode="create"
          initialDealId={initialDealId}
          onClose={() => setCreating(false)}
          onSubmit={async (input) => {
            await agencyState.createCommission(input);
            await myState.refresh();
            setScope('agency');
            setCreating(false);
          }}
        />
      )}

      {editing && (
        <CommissionModal
          mode="edit"
          commission={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (input, patch) => {
            await agencyState.updateCommission(editing.id, patch);
            setEditing(null);
          }}
        />
      )}
    </main>
  );
}

interface CommissionModalProps {
  commission?: CommissionWithRelations;
  initialDealId?: string | null;
  mode: 'create' | 'edit';
  onClose: () => void;
  onSubmit: (input: { deal_id: string; agent_id: string; amount: number; percentage?: number | null; notes?: string | null }, patch: { amount?: number; percentage?: number | null; status?: CommissionStatus; notes?: string | null }) => Promise<void>;
}

function CommissionModal({ commission, initialDealId, mode, onClose, onSubmit }: CommissionModalProps) {
  const dealsState = useDeals({ includeClosed: true });
  const [dealId, setDealId] = useState(commission?.deal_id ?? initialDealId ?? '');
  const selectedDeal = dealsState.deals.find((deal) => deal.id === dealId);
  const [agentId, setAgentId] = useState(commission?.agent_id ?? selectedDeal?.owner_id ?? '');
  const [amountEuros, setAmountEuros] = useState(commission ? String(centsToEuros(commission.amount)) : '');
  const [percentage, setPercentage] = useState(commission?.percentage != null ? String(commission.percentage) : '');
  const [notes, setNotes] = useState(commission?.notes ?? '');
  const [status, setStatus] = useState<CommissionStatus>(commission?.status ?? 'draft');
  const [error, setError] = useState<string | null>(null);

  const transitions = commission ? getValidCommissionTransitions(commission.status) : [];

  function syncDeal(value: string) {
    setDealId(value);
    const deal = dealsState.deals.find((item) => item.id === value);
    if (deal) setAgentId(deal.owner_id);
  }

  useEffect(() => {
    if (mode !== 'create' || !initialDealId || dealsState.deals.length === 0) return;
    syncDeal(initialDealId);
  }, [dealsState.deals.length, initialDealId, mode]);

  async function submit() {
    const amount = Number(amountEuros.replace(',', '.'));
    if (!dealId) {
      setError('Choisis un deal.');
      return;
    }
    if (!agentId) {
      setError('Agent introuvable pour ce deal.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Le montant doit etre superieur a 0.');
      return;
    }

    const payload = {
      deal_id: dealId,
      agent_id: agentId,
      amount: eurosToCents(amount),
      percentage: percentage ? Number(percentage.replace(',', '.')) : null,
      notes,
    };

    await onSubmit(payload, {
      amount: payload.amount,
      percentage: payload.percentage,
      notes,
      status: mode === 'edit' ? status : undefined,
    });
  }

  return (
    <div className="commissions-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="commissions-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <h2>{mode === 'create' ? 'Nouvelle commission' : 'Modifier commission'}</h2>
        {error && <div className="commissions-error">{error}</div>}
        <label>
          Deal
          <select value={dealId} onChange={(event) => syncDeal(event.target.value)} disabled={mode === 'edit'}>
            <option value="">Choisir un deal</option>
            {dealsState.deals.map((deal) => (
              <option key={deal.id} value={deal.id}>
                {deal.reference ?? deal.title} · {deal.property?.street ?? deal.property?.locality ?? 'Bien'}
              </option>
            ))}
          </select>
        </label>
        <label>
          Agent
          <input value={selectedDeal?.owner?.full_name ?? selectedDeal?.owner?.email ?? commission?.agent?.full_name ?? agentId} readOnly />
        </label>
        <label>
          Montant (€)
          <input value={amountEuros} onChange={(event) => setAmountEuros(event.target.value)} inputMode="decimal" />
        </label>
        <label>
          Pourcentage
          <input value={percentage} onChange={(event) => setPercentage(event.target.value)} inputMode="decimal" />
        </label>
        {mode === 'edit' && commission && (
          <label>
            Statut
            <select value={status} onChange={(event) => setStatus(event.target.value as CommissionStatus)}>
              <option value={commission.status}>{STATUS_LABELS[commission.status]}</option>
              {transitions.map((next) => <option key={next} value={next}>{STATUS_LABELS[next]}</option>)}
            </select>
          </label>
        )}
        <label>
          Notes
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
        </label>
        <div className="commissions-modal-actions">
          <button type="button" onClick={onClose}>Annuler</button>
          <button type="button" onClick={() => { void submit(); }}>{mode === 'create' ? 'Creer' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  );
}
