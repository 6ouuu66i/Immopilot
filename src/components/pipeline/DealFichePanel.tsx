// src/components/pipeline/DealFichePanel.tsx
import { useState } from 'react';
import type { store as appStore } from '../../lib/store';
import type { Deal } from '../../types';

type Store = typeof appStore;

interface DealFichePanelProps {
  deal: Deal;
  store: Store;
  onClose: () => void;
  onMoveDeal: (dealId: string, stageName: string) => void;
}

const priceFormatter = new Intl.NumberFormat('fr-BE', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
});
function fmt(v: number) { return priceFormatter.format(v).replace(/\s?EUR/, ' €'); }

export function DealFichePanel({ deal, store, onClose, onMoveDeal }: DealFichePanelProps) {
  const [noteDraft, setNoteDraft] = useState('');

  const property = store.getProperty(deal.propertyId);
  const contact  = store.getContact(deal.contactId);
  const tasks    = store.getTasks().filter(t => t.dealId === deal.id).slice(0, 5);
  const stages   = store.getPipelineStages();
  const currentStageIdx = stages.findIndex(s => s.name === deal.stage);
  const isActive = !['Perdu', 'Bien vendu'].includes(deal.stage);

  const commStatus =
    deal.stage === 'Bien vendu' ? 'Reçue' :
    deal.stage === 'Perdu'      ? 'Annulée' : 'Ouverte';

  const sellerInitials = contact
    ? contact.name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';

  const handleAddNote = () => {
    if (!noteDraft.trim()) return;
    store.registerNoteToDeal(deal.id, noteDraft.trim());
    setNoteDraft('');
  };

  const handleAdvanceStage = () => {
    if (currentStageIdx < stages.length - 1) {
      onMoveDeal(deal.id, stages[currentStageIdx + 1].name);
    }
  };

  const dealRef = `D-2026-${deal.id.replace('deal-', '').padStart(4, '0')}`;

  return (
    <aside className="fiche-panel">
      <div style={{ animation: 'fiche-in 380ms cubic-bezier(0.32, 0.72, 0, 1)', display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* ── Header ── */}
        <div className="fiche-head">
          <div className="fiche-head-left">
            <span className="deal-ref">Deal #{dealRef}</span>
            <span className={`deal-status ${isActive ? 'actif' : 'inact'}`}>
              {deal.stage === 'Bien vendu' ? 'Vendu' : deal.stage === 'Perdu' ? 'Perdu' : 'Actif'}
            </span>
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
          <div
            className="ai-badge"
            style={{ '--target-score': property?.score ?? 70 } as React.CSSProperties}
          >
            <div className="ai-badge-inner">
              <span>IA</span>
              <strong><span>{property?.score ?? 70}</span></strong>
            </div>
          </div>
        </div>

        {/* ── Info ── */}
        <div className="fiche-info">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <div className="fiche-title">{property?.title ?? deal.title}</div>
            <div className="fiche-price">{fmt(deal.price)}</div>
          </div>
          <div className="fiche-loc-row">
            <div className="fiche-loc">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2a8 8 0 0 0-8 8c0 5.5 8 12 8 12s8-6.5 8-12a8 8 0 0 0-8-8z" />
                <circle cx="12" cy="10" r="2.5" fill="#FFFFFF" stroke="none" />
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
                onClick={() => { if (stage.name !== deal.stage) onMoveDeal(deal.id, stage.name); }}
              >
                <div className="step-icon">
                  {idx < currentStageIdx && (
                    <svg viewBox="0 0 24 24" fill="none" style={{ width: 7, height: 7 }} stroke="#FFFFFF" strokeWidth="3.2">
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
              </div>

              {/* Tasks */}
              <div className="mc">
                <div className="mc-label">Tâches liées</div>
                <div className="task-list">
                  {tasks.length === 0 ? (
                    <div className="task-empty">Aucune tâche liée</div>
                  ) : (
                    tasks.map(task => (
                      <div key={task.id} className={`task-row ${task.done ? 'done' : ''}`}>
                        <div
                          className={`task-check ${task.done ? 'checked' : ''}`}
                          onClick={() => store.toggleTask(task.id)}
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
                  {deal.notes.slice(0, 3).map((note, i) => (
                    <div key={`note-${i}-${note.slice(0, 20)}`} className="note-item">
                      <div className="note-avatar">{sellerInitials}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="note-header">
                          <span className="note-author">{contact?.name ?? 'Agent'}</span>
                        </div>
                        <div className="note-text">{note}</div>
                      </div>
                    </div>
                  ))}
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
              </div>

              {/* Commission */}
              <div className="mc">
                <div className="mc-label">Commission</div>
                <div className="commission-row">
                  <span className="ck">Estimation</span>
                  <span className="cv amount">{fmt(deal.commissionAmount)}</span>
                </div>
                <div className="commission-row">
                  <span className="ck">Pourcentage</span>
                  <span className="cv">{deal.price > 0 ? ((deal.commissionAmount / deal.price) * 100).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '3,00'} %</span>
                </div>
                <div className="commission-row">
                  <span className="ck">Statut</span>
                  <span className="commission-status">{commStatus}</span>
                </div>
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
    </aside>
  );
}
