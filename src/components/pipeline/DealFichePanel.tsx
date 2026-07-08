// src/components/pipeline/DealFichePanel.tsx
import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import type { store as appStore } from '../../lib/store';
import { formatAmount } from '../../lib/services/commissionsService';
import { useNotes } from '../../lib/useNotes';
import { ScoreRing } from '../biens/ScoreRing';
import { useAgencyCommissions, useMyCommissions } from '../../lib/useCommissions';
import { taskToView, useTasksFor } from '../../lib/useTasks';
import { useMyTransfers } from '../../lib/useTransfers';
import type { Deal, DealStage, PropertyKey } from '../../types';
import { NotesList, StatusBadge } from '../ui';

type Store = typeof appStore;

interface DealFichePanelProps {
  deal: Deal;
  store: Store;
  onClose: () => void;
  onMoveDeal: (dealId: string, stageName: string) => void;
  onUpdateDealLinks?: (dealId: string, links: { contactId?: string; propertyId?: PropertyKey }) => void;
  onCloseDeal?: (dealId: string, outcome: 'won' | 'lost') => void;
  onReopenDeal?: (dealId: string) => void;
}

const priceFormatter = new Intl.NumberFormat('fr-BE', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
});
function fmt(v: number) { return priceFormatter.format(v).replace(/\s?EUR/, ' €'); }

export function DealFichePanel({
  deal,
  store,
  onClose,
  onMoveDeal,
  onUpdateDealLinks,
  onCloseDeal,
  onReopenDeal,
}: DealFichePanelProps) {
  const [noteDraft, setNoteDraft] = useState('');
  const [nextActionTitle, setNextActionTitle] = useState('');
  const [selectedContactId, setSelectedContactId] = useState(deal.contactId);
  const [selectedPropertyId, setSelectedPropertyId] = useState(String(deal.propertyId));
  const [actionMessage, setActionMessage] = useState('');
  const [transferMessage, setTransferMessage] = useState('');
  const [refusalReason, setRefusalReason] = useState('');
  const [refusalOpen, setRefusalOpen] = useState(false);

  const { profile } = useAuth();
  const transfersState = useMyTransfers({ direction: 'all' });
  const myCommissionsState = useMyCommissions({ period: 'all' });
  const agencyCommissionsState = useAgencyCommissions({ period: 'all' });
  const property = store.getProperty(deal.propertyId);
  const contact  = store.getContact(deal.contactId);
  const dealTasks = useTasksFor({ dealId: deal.id });
  const tasks    = dealTasks.tasks.slice(0, 5).map(taskToView);
  const dealNotes = useNotes({ dealId: deal.id });
  const stages   = store.getPipelineStages();
  const contacts = store.getContacts();
  const properties = store.getProperties();
  const currentStageIdx = stages.findIndex(s => s.name === deal.stage);
  const isActive = !['Perdu', 'Bien vendu'].includes(deal.stage);
  const isDealOwner = profile?.id === deal.ownerId;
  const commission = (profile?.role === 'admin' ? agencyCommissionsState.commissions : myCommissionsState.commissions)
    .find((item) => item.deal_id === deal.id);
  const pendingIncomingTransfer = transfersState.transfers.find((transfer) => (
    transfer.deal_id === deal.id && transfer.status === 'pending' && transfer.from_agent_id === profile?.id
  ));
  const pendingMyTransfer = transfersState.transfers.find((transfer) => (
    transfer.deal_id === deal.id && transfer.status === 'pending' && transfer.requested_by === profile?.id
  ));


  const sellerInitials = contact
    ? contact.name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';

  const handleAddNote = () => {
    if (!noteDraft.trim()) return;
    void dealNotes.createNote(noteDraft);
    setNoteDraft('');
  };

  useEffect(() => {
    if (!dealNotes.error) return;
    store.addNotification('notes_error', 'Synchronisation notes impossible', dealNotes.error, '#pipeline');
  }, [dealNotes.error, store]);

  useEffect(() => {
    if (!dealTasks.error) return;
    store.addNotification('tasks_error', 'Synchronisation taches impossible', dealTasks.error, '#pipeline');
  }, [dealTasks.error, store]);

  useEffect(() => {
    setSelectedContactId(deal.contactId);
    setSelectedPropertyId(String(deal.propertyId));
    setNextActionTitle('');
    setActionMessage('');
    setTransferMessage('');
    setRefusalReason('');
    setRefusalOpen(false);
  }, [deal.id, deal.contactId, deal.propertyId]);

  const handleAdvanceStage = () => {
    if (currentStageIdx < stages.length - 1) {
      onMoveDeal(deal.id, stages[currentStageIdx + 1].name);
    }
  };

  const handleCreateNextAction = () => {
    const title = nextActionTitle.trim();
    if (!title) {
      setActionMessage('Ajoute une prochaine action.');
      return;
    }

    void dealTasks.createTask({
      title,
      due_date: new Date().toISOString(),
      priority: 'moyenne',
    })
      .then(() => {
        setNextActionTitle('');
        setActionMessage('Tache creee dans Agenda.');
      })
      .catch((error: unknown) => {
        setActionMessage(error instanceof Error ? error.message : 'Creation de la tache impossible.');
      });
  };

  const handleLinkContact = () => {
    onUpdateDealLinks?.(deal.id, { contactId: selectedContactId });
    const linked = store.getContact(selectedContactId);
    setActionMessage(linked ? `Contact lié : ${linked.name}` : 'Contact introuvable.');
  };

  const handleLinkProperty = () => {
    const numericPropertyId = Number(selectedPropertyId);
    const propertyId: PropertyKey = Number.isFinite(numericPropertyId) && String(numericPropertyId) === selectedPropertyId
      ? numericPropertyId
      : selectedPropertyId;
    onUpdateDealLinks?.(deal.id, { propertyId });
    const linked = store.getProperty(propertyId);
    setActionMessage(linked ? `Bien lié : ${linked.title}` : 'Bien introuvable.');
  };

  const handleMilestone = (milestone: 'rdv' | 'offre' | 'mandat_potentiel') => {
    const targetByMilestone: Record<typeof milestone, DealStage> = {
      rdv: 'Visite',
      offre: 'Proposition',
      mandat_potentiel: 'Mandat signé',
    };
    const stageName = targetByMilestone[milestone];
    onMoveDeal(deal.id, stageName);
    setActionMessage(`Statut commercial : ${stageName}`);
  };

  const handleStageSelect = (stageName: DealStage) => {
    if (stageName !== deal.stage) onMoveDeal(deal.id, stageName);
  };

  const handleCloseDeal = (outcome: 'won' | 'lost') => {
    onCloseDeal?.(deal.id, outcome);
    setActionMessage(outcome === 'won' ? 'Deal marque comme gagne.' : 'Deal marque comme perdu.');
  };

  const handleReopenDeal = () => {
    onReopenDeal?.(deal.id);
    setActionMessage('Deal rouvert.');
  };

  const handleRequestTransfer = () => {
    void transfersState.requestTransfer({ dealId: deal.id, message: transferMessage })
      .then(() => {
        setTransferMessage('');
        setActionMessage('Demande de transfert envoyee.');
      })
      .catch((error: unknown) => {
        setActionMessage(error instanceof Error ? error.message : 'Demande de transfert impossible.');
      });
  };

  const handleCancelTransfer = () => {
    if (!pendingMyTransfer) return;
    void transfersState.cancelTransfer(pendingMyTransfer.id)
      .then(() => setActionMessage('Demande de transfert annulee.'))
      .catch((error: unknown) => setActionMessage(error instanceof Error ? error.message : 'Annulation impossible.'));
  };

  const handleAcceptTransfer = () => {
    if (!pendingIncomingTransfer) return;
    void transfersState.acceptTransfer(pendingIncomingTransfer.id)
      .then(() => setActionMessage('Transfert accepte.'))
      .catch((error: unknown) => setActionMessage(error instanceof Error ? error.message : 'Acceptation impossible.'));
  };

  const handleRefuseTransfer = () => {
    if (!pendingIncomingTransfer) return;
    void transfersState.refuseTransfer(pendingIncomingTransfer.id, refusalReason)
      .then(() => {
        setRefusalOpen(false);
        setRefusalReason('');
        setActionMessage('Transfert refuse.');
      })
      .catch((error: unknown) => setActionMessage(error instanceof Error ? error.message : 'Refus impossible.'));
  };

  const dealRef = deal.reference;

  return (
    <aside className="fiche-panel">
      <div style={{ animation: 'fiche-in 380ms cubic-bezier(0.32, 0.72, 0, 1)', display: 'flex', flexDirection: 'column' }}>

        {/* ── Header ── */}
        <div className="fiche-head">
          <div className="fiche-head-left">
            <span className="deal-ref">{dealRef}</span>
            <StatusBadge tone={isActive ? 'success' : 'neutral'} leadingDot>
              {deal.stage === 'Bien vendu' ? 'Vendu' : deal.stage === 'Perdu' ? 'Perdu' : 'Actif'}
            </StatusBadge>
          </div>
          <button className="fiche-close" type="button" onClick={onClose} aria-label="Fermer">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Hero image ── */}
        <div className="hero-wrap">
          <div className="hero">
            {property?.photos[0] && (
              <img src={property.photos[0]} alt={property.title} />
            )}
          </div>
          <div className="ai-badge">
            <ScoreRing score={property?.score ?? 70} size="lg" />
          </div>
        </div>

        {/* ── Info ── */}
        <div className="fiche-info">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <div className="fiche-title-wrap">
              <span className="fiche-title-ref">{dealRef}</span>
              <div className="fiche-title">{property?.title ?? deal.title}</div>
            </div>
            <div className="fiche-price">{fmt(deal.price)}</div>
          </div>
          <div className="fiche-loc-row">
            <div className="fiche-loc">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2a8 8 0 0 0-8 8c0 5.5 8 12 8 12s8-6.5 8-12a8 8 0 0 0-8-8z" />
                <circle cx="12" cy="10" r="2.5" fill="var(--color-text-inverse)" stroke="none" />
              </svg>
              {property?.city ?? '—'} · Belgique
            </div>
          </div>
        </div>

        {/* ── Stepper ── */}
        <div className="stepper-wrapper">
          {stages.map((stage, idx) => {
            const cls =
              idx < currentStageIdx ? 'completed' :
              idx === currentStageIdx ? 'active' : '';
            return (
              <div
                key={stage.id}
                className={`step ${cls}`}
                onClick={() => handleStageSelect(stage.name)}
              >
                <div className="step-icon">
                  {idx < currentStageIdx && (
                    <svg viewBox="0 0 24 24" fill="none" style={{ width: 7, height: 7 }} stroke="var(--color-text-inverse)" strokeWidth="3.2">
                      <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="step-label">{stage.name}</div>
              </div>
            );
          })}
        </div>

        {/* ── Body ── */}
        <div className="deal-quick-actions">
          <button type="button" onClick={() => handleMilestone('rdv')}>Marquer RDV</button>
          <button type="button" onClick={() => handleMilestone('offre')}>Marquer offre</button>
          <button type="button" onClick={() => handleMilestone('mandat_potentiel')}>Mandat potentiel</button>
          {isActive ? (
            <>
              <button type="button" onClick={() => handleCloseDeal('won')}>Gagné</button>
              <button type="button" onClick={() => handleCloseDeal('lost')}>Perdu</button>
            </>
          ) : (
            <button type="button" onClick={handleReopenDeal}>Réouvrir</button>
          )}
        </div>
        {actionMessage && <div className="deal-action-message">{actionMessage}</div>}
        {transfersState.error && <div className="deal-action-message">{transfersState.error}</div>}

        {pendingIncomingTransfer && (
          <div className="deal-transfer-banner">
            <div>
              <strong>{pendingIncomingTransfer.requester?.full_name ?? pendingIncomingTransfer.requester?.email ?? 'Un agent'} souhaite reprendre ce deal</strong>
              {pendingIncomingTransfer.message && <p>{pendingIncomingTransfer.message}</p>}
            </div>
            <div>
              <button type="button" onClick={handleAcceptTransfer}>Accepter le transfert</button>
              <button type="button" onClick={() => setRefusalOpen(true)}>Refuser</button>
            </div>
          </div>
        )}

        {!isDealOwner && (
          <div className="deal-transfer-banner is-muted">
            {pendingMyTransfer ? (
              <>
                <div>
                  <strong>Transfert demande</strong>
                  <p>Votre demande est en attente de validation par le proprietaire actuel.</p>
                </div>
                <div>
                  <button type="button" onClick={handleCancelTransfer}>Annuler la demande</button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <strong>Vous n'etes pas proprietaire de ce deal</strong>
                  <input
                    value={transferMessage}
                    onChange={(event) => setTransferMessage(event.target.value)}
                    placeholder="Message optionnel a l'owner..."
                  />
                </div>
                <div>
                  <button type="button" onClick={handleRequestTransfer}>Demander transfert</button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="fiche-body">
          <div className="body-grid-2">

            {/* Left column */}
            <div className="body-col">
              {/* Vendor */}
              <div className="mc">
                <div className="mc-label">Vendeur</div>
                <div className="mc-vendor-header">
                  <div className="mc-vendor-avatar">{sellerInitials}</div>
                  <div className="mc-vendor-name">{contact?.name ?? '—'}</div>
                </div>
                {contact && (
                  <div className="mc-vendor-contact">
                    <span>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      {contact.phone}
                    </span>
                    <span>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      {contact.email}
                    </span>
                  </div>
                )}
                <div className="deal-link-row">
                  <select value={selectedContactId} onChange={e => setSelectedContactId(e.target.value)}>
                    {contacts.map(item => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  <button type="button" onClick={handleLinkContact}>Lier</button>
                </div>
              </div>

              {/* Tasks */}
              <div className="mc">
                <div className="mc-label">Tâches liées</div>
                <div className="deal-action-row">
                  <input
                    value={nextActionTitle}
                    onChange={e => setNextActionTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateNextAction(); }}
                    placeholder="Prochaine action..."
                  />
                  <button type="button" onClick={handleCreateNextAction}>Ajouter</button>
                </div>
                <div className="task-list">
                  {tasks.length === 0 ? (
                    <div className="task-empty">Aucune tâche liée</div>
                  ) : (
                    tasks.map(task => (
                      <div key={task.id} className={`task-row ${task.done ? 'done' : ''}`}>
                        <div
                          className={`task-check ${task.done ? 'checked' : ''}`}
                          onClick={() => { void dealTasks.toggleTask(task.id); }}
                        />
                        <div className="task-name">{task.title}</div>
                        <div className="task-meta">
                          <span className="task-date">{task.date}</span>
                          <span className={`prio-chip ${task.priority === 'haute' ? 'haute' : task.priority === 'basse' ? 'basse' : 'moy'}`}>
                            {task.priority === 'haute' ? 'Haute' : task.priority === 'basse' ? 'Faible' : 'Moy.'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="mc">
                <div className="mc-label">Notes</div>
                <div className="notes-list">
                  <NotesList
                    notes={dealNotes.notes.slice(0, 3)}
                    isLoading={dealNotes.isLoading}
                    canEditNote={dealNotes.canEditNote}
                    onUpdate={dealNotes.updateNote}
                    onDelete={dealNotes.deleteNote}
                    emptyText="Aucune note pour ce deal."
                    compact
                  />
                </div>
                <div className="notes-input-row" style={{ marginTop: 10 }}>
                  <input
                    className="notes-input"
                    value={noteDraft}
                    onChange={e => setNoteDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddNote(); }}
                    placeholder="Ajouter une note…"
                  />
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="body-col">
              {/* Property */}
              <div className="mc">
                <div className="mc-label">Bien lié</div>
                <div className="mc-bien-row">
                  <div className="mc-bien-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  </div>
                  <div>
                    <div className="mc-bien-title">{property?.title ?? '—'}</div>
                    <div className="mc-bien-loc">{property?.city ?? '—'}</div>
                    {property && (
                      <div className="mc-bien-specs">{property.surface} m² · {property.bedrooms} ch. · PEB {property.peb}</div>
                    )}
                  </div>
                </div>
                <a href="#biens" className="mc-bien-link">
                  Voir le bien
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </a>
                <div className="deal-link-row">
                  <select value={selectedPropertyId} onChange={e => setSelectedPropertyId(e.target.value)}>
                    {properties.map(item => (
                      <option key={item.id} value={item.id}>{item.title} - {item.city}</option>
                    ))}
                  </select>
                  <button type="button" onClick={handleLinkProperty}>Lier</button>
                </div>
              </div>

              {/* Commission */}
              <div className="mc">
                <div className="mc-label">Commission</div>
                {commission ? (
                  <>
                    <div className="commission-row">
                      <span className="ck">Montant</span>
                      <span className="cv amount">{formatAmount(commission.amount)}</span>
                    </div>
                    <div className="commission-row">
                      <span className="ck">Pourcentage</span>
                      <span className="cv">{commission.percentage ? `${commission.percentage.toLocaleString('fr-BE')} %` : '�'}</span>
                    </div>
                    <div className="commission-row">
                      <span className="ck">Statut</span>
                      <span className="commission-status">{commission.status}</span>
                    </div>
                    {commission.notes && <p className="commission-note">{commission.notes}</p>}
                    {profile?.role === 'admin' && <a className="btn-commission" href={`#commissions?commissionId=${commission.id}`}>Gerer</a>}
                  </>
                ) : (
                  <>
                    <div className="task-empty">Aucune commission creee pour ce deal.</div>
                    {profile?.role === 'admin' && <a className="btn-commission" href={`#commissions?dealId=${deal.id}`}>+ Creer une commission</a>}
                  </>
                )}
              </div>

              {/* Activities */}
              <div className="mc">
                <div className="mc-label">Activités</div>
                <div className="activity-list">
                  {deal.activities.slice(0, 5).map(act => (
                    <div key={act.id} className="activity-row">
                      <div className="activity-dot" />
                      <div>
                        <div className="activity-title">{act.text}</div>
                        <div className="activity-meta">
                          <span className="activity-author">{act.agentName}</span>
                          <span className="activity-date">{act.date}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── Footer actions ── */}
        <div className="fiche-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Fermer
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAdvanceStage}
            disabled={currentStageIdx >= stages.length - 1}
          >
            Avancer stage
          </button>
        </div>

      </div>
      {refusalOpen && (
        <div className="deal-transfer-modal-backdrop" role="presentation" onMouseDown={() => setRefusalOpen(false)}>
          <div className="deal-transfer-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <h2>Refuser le transfert</h2>
            <p>La raison est optionnelle et sera envoyee au demandeur.</p>
            <textarea value={refusalReason} onChange={(event) => setRefusalReason(event.target.value)} rows={4} />
            <div>
              <button type="button" onClick={() => setRefusalOpen(false)}>Annuler</button>
              <button type="button" onClick={handleRefuseTransfer}>Refuser</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
