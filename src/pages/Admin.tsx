import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Copy,
  Plus,
  RotateCcw,
  Search,
  Shield,
  SlidersHorizontal,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminTransfersPanel } from '../components/AdminTransfersPanel';
import { ScoreRing } from '../components/biens/ScoreRing';
import { useAuth } from '../lib/auth';
import { adminService, type AdminOverviewData, type AgentActivityDetails, type ReservedDealRow } from '../lib/services/adminService';
import { agentsService, type AgentWithStats, type InvitationResult } from '../lib/services/agentsService';
import { auditLogsService, type AuditLogFull } from '../lib/services/auditLogsService';
import { formatAmount } from '../lib/services/commissionsService';
import { dealsService } from '../lib/services/dealsService';
import { formatAddress } from '../lib/services/adminUtils';
import { pipelineStagesService, type PipelineStageRow } from '../lib/services/pipelineStagesService';

type AdminTab = 'overview' | 'agents' | 'transfers' | 'activity' | 'pipeline' | 'reserved';

const ADMIN_TABS = [
  { key: 'overview' as const, label: "Vue d'ensemble", icon: BarChart3 },
  { key: 'agents' as const, label: 'Agents', icon: UsersRound },
  { key: 'transfers' as const, label: 'Transferts', icon: ArrowLeftRight },
  { key: 'activity' as const, label: 'Activité', icon: Activity },
  { key: 'pipeline' as const, label: 'Configuration pipeline', icon: SlidersHorizontal },
  { key: 'reserved' as const, label: 'Biens réservés', icon: ClipboardList },
];

const STAGE_COLORS = ['#6B7280', '#2563EB', '#7C3AED', '#D97706', '#DC2626', '#1E5A3A', '#0891B2', '#BE185D'];

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function profileName(profile: { full_name: string | null; email: string } | null | undefined) {
  return profile?.full_name ?? profile?.email ?? 'Agent';
}

export function Admin() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (profile && profile.role !== 'admin') window.location.hash = '#dashboard';
  }, [profile]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }

  if (profile?.role !== 'admin') return null;

  return (
    <main className="admin-react-page">
      <header className="admin-react-header">
        <div>
          <span><Shield size={15} /> Administration</span>
          <h1>Admin</h1>
          <p>Pilotage agence, agents, pipeline, transferts et contrôles opérationnels.</p>
        </div>
      </header>

      <div className="admin-react-layout">
        <aside className="admin-react-tabs">
          {ADMIN_TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.key} className={tab === item.key ? 'active' : ''} type="button" onClick={() => setTab(item.key)}>
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </aside>

        <section className="admin-react-content">
          {tab === 'overview' && <OverviewTab />}
          {tab === 'agents' && <AgentsTab onToast={notify} />}
          {tab === 'transfers' && <AdminTransfersPanel />}
          {tab === 'activity' && <ActivityTab />}
          {tab === 'pipeline' && <PipelineConfigTab onToast={notify} />}
          {tab === 'reserved' && <ReservedDealsTab onToast={notify} />}
        </section>
      </div>

      {toast && <div className="settings-toast"><Check size={15} /> {toast}</div>}
    </main>
  );
}

function OverviewTab() {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    adminService.getOverview()
      .then(setData)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Chargement impossible.'))
      .finally(() => setIsLoading(false));
  }, []);

  const kpis = [
    ['Agents actifs', data?.activeAgents],
    ['Deals en cours', data?.openDeals],
    ['Deals clôturés ce mois', data?.closedDealsThisMonth],
    ['Commissions encaissees', data ? formatAmount(data.commissionsPaidThisMonth) : undefined],
    ['Tâches en retard', data?.overdueTasks],
    ['Biens favoris', data?.favoriteProperties],
  ];

  return (
    <Panel title="Vue d'ensemble" description="KPIs agence calcules depuis Supabase.">
      {error && <div className="admin-error">{error}</div>}
      <div className="admin-kpi-grid">
        {kpis.map(([label, value]) => (
          <article key={String(label)}>
            <span>{label}</span>
            <strong>{isLoading ? '-' : value ?? 0}</strong>
          </article>
        ))}
      </div>
      <h3 className="admin-section-title">Activité récente agence</h3>
      <div className="admin-list">
        {isLoading ? <div className="admin-empty">Chargement...</div> : !data?.recentActivities.length ? <div className="admin-empty">Aucune activite.</div> : data.recentActivities.map((activity) => (
          <div key={activity.id} className="admin-list-row">
            <strong>{activity.type}</strong>
            <span>{profileName(activity.actor)} · {formatDate(activity.created_at)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AgentsTab({ onToast }: { onToast: (message: string) => void }) {
  const { profile } = useAuth();
  const [agents, setAgents] = useState<AgentWithStats[]>([]);
  const [selected, setSelected] = useState<AgentWithStats | null>(null);
  const [details, setDetails] = useState<AgentActivityDetails | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitation, setInvitation] = useState<InvitationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    setIsLoading(true);
    agentsService.listAgencyAgents()
      .then(setAgents)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Chargement agents impossible.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(refresh, []);

  async function toggleAgent(agent: AgentWithStats) {
    const updated = await agentsService.toggleAgentActive(agent.id);
    setAgents((current) => current.map((item) => item.id === updated.id ? updated : item));
    onToast(updated.is_active ? 'Agent reactive.' : 'Agent desactive.');
  }

  async function changeRole(agent: AgentWithStats, role: 'admin' | 'agent') {
    const updated = await agentsService.updateAgentRole(agent.id, role);
    setAgents((current) => current.map((item) => item.id === updated.id ? updated : item));
    onToast('Rôle agent modifié.');
  }

  async function openActivity(agent: AgentWithStats) {
    setSelected(agent);
    setDetails(await adminService.getAgentActivityDetails(agent.id));
  }

  return (
    <Panel title="Agents" description="Membres de votre agence et contrôles administrateur.">
      <div className="admin-panel-actions">
        <button type="button" onClick={() => setInviteOpen(true)}><Plus size={14} /> Inviter un agent</button>
      </div>
      {error && <div className="admin-error">{error}</div>}
      <div className="admin-agent-list">
        {isLoading ? <div className="admin-empty">Chargement...</div> : agents.map((agent) => (
          <article key={agent.id} className="admin-agent-row">
            <div className="admin-avatar">{agent.avatar_url ? <img src={agent.avatar_url} alt="" /> : <UserRound size={18} />}</div>
            <div>
              <strong>{profileName(agent)}</strong>
              <span>{agent.email}</span>
            </div>
            <i className={agent.role === 'admin' ? 'is-admin' : ''}>{agent.role}</i>
            <label className="admin-switch">
              <input type="checkbox" checked={agent.is_active} disabled={agent.id === profile?.id} onChange={() => { void toggleAgent(agent); }} />
              <span>{agent.is_active ? 'Actif' : 'Inactif'}</span>
            </label>
            <select value={agent.role} disabled={agent.id === profile?.id} onChange={(event) => { void changeRole(agent, event.target.value as 'admin' | 'agent'); }}>
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>
            <div className="admin-agent-stats">
              <span>{agent.stats.openDeals} deals ouverts</span>
              <span>{agent.stats.closedDealsThisMonth} clôturés</span>
              <span>{formatAmount(agent.stats.commissionsThisMonth)}</span>
            </div>
            <button type="button" onClick={() => { void openActivity(agent); }}>Voir activite</button>
          </article>
        ))}
      </div>

      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} onCreated={(result) => { setInvitation(result); setInviteOpen(false); onToast('Invitation créée.'); }} />}
      {invitation && <InvitationModal result={invitation} onClose={() => setInvitation(null)} />}
      {selected && <AgentDetailsPanel agent={selected} details={details} onClose={() => { setSelected(null); setDetails(null); }} />}
    </Panel>
  );
}

function InviteModal({ onClose, onCreated }: { onClose: () => void; onCreated: (result: InvitationResult) => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'agent'>('agent');
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal title="Inviter un agent" onClose={onClose}>
      {error && <div className="admin-error">{error}</div>}
      <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>Rôle<select value={role} onChange={(event) => setRole(event.target.value as 'admin' | 'agent')}><option value="agent">Agent</option><option value="admin">Admin</option></select></label>
      <div className="admin-modal-actions">
        <button type="button" onClick={onClose}>Annuler</button>
        <button type="button" onClick={() => { agentsService.createInvitation({ email, role }).then(onCreated).catch((createError) => setError(createError instanceof Error ? createError.message : 'Invitation impossible.')); }}>Créer</button>
      </div>
    </Modal>
  );
}

function InvitationModal({ result, onClose }: { result: InvitationResult; onClose: () => void }) {
  return (
    <Modal title="Lien d'invitation" onClose={onClose}>
      <p className="admin-help">Copiez ce lien et envoyez-le manuellement au nouvel agent.</p>
      <input value={result.link} readOnly />
      <div className="admin-modal-actions">
        <button type="button" onClick={() => { void navigator.clipboard?.writeText(result.link); }}><Copy size={14} /> Copier</button>
        <button type="button" onClick={onClose}>Fermer</button>
      </div>
    </Modal>
  );
}

function AgentDetailsPanel({ agent, details, onClose }: { agent: AgentWithStats; details: AgentActivityDetails | null; onClose: () => void }) {
  return (
    <div className="admin-sidepanel">
      <button type="button" onClick={onClose}>Fermer</button>
      <h3>{profileName(agent)}</h3>
      <p>{agent.email}</p>
      {!details ? <div className="admin-empty">Chargement...</div> : (
        <>
          <h4>Deals recents</h4>
          {details.deals.map((deal) => <span key={deal.id}>{deal.reference ?? deal.title ?? deal.id}</span>)}
          <h4>Tâches récentes</h4>
          {details.tasks.map((task) => <span key={task.id}>{task.title}</span>)}
          <h4>Transferts recents</h4>
          {details.transfers.map((transfer) => <span key={transfer.id}>{transfer.status} · {formatDate(transfer.created_at)}</span>)}
        </>
      )}
    </div>
  );
}

function ActivityTab() {
  const [logs, setLogs] = useState<AuditLogFull[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    auditLogsService.list()
      .then(setLogs)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Chargement audit impossible.'))
      .finally(() => setIsLoading(false));
  }, []);
  const visible = logs.filter((log) => `${log.action} ${profileName(log.actor)} ${log.target_type ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <Panel title="Activité" description="Logs d'audit agence.">
      <label className="admin-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filtrer..." /></label>
      {error && <div className="admin-error">{error}</div>}
      <div className="admin-list">
        {isLoading ? <div className="admin-empty">Chargement...</div> : visible.length === 0 ? <div className="admin-empty">Aucun log d'audit.</div> : visible.map((log) => (
          <div key={log.id} className="admin-list-row">
            <strong>{profileName(log.actor)} · {log.action}</strong>
            <span>{log.target_type ?? 'objet'} · {formatDate(log.created_at)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function PipelineConfigTab({ onToast }: { onToast: (message: string) => void }) {
  const [stages, setStages] = useState<PipelineStageRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [deleteStage, setDeleteStage] = useState<PipelineStageRow | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const refresh = () => { void pipelineStagesService.listStages().then(setStages); };
  useEffect(refresh, []);

  async function update(stage: PipelineStageRow, patch: Partial<PipelineStageRow>) {
    const updated = await pipelineStagesService.updateStage(stage.id, patch);
    setStages((current) => current.map((item) => item.id === stage.id ? updated : item).sort((a, b) => a.position - b.position));
    onToast('Étape mise à jour.');
  }

  async function move(stageId: string, direction: -1 | 1) {
    const index = stages.findIndex((stage) => stage.id === stageId);
    const next = [...stages];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setStages(await pipelineStagesService.reorderStages(next.map((stage) => stage.id)));
    onToast('Ordre pipeline mis à jour.');
  }

  async function dropOn(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    const next = [...stages];
    const from = next.findIndex((stage) => stage.id === draggedId);
    const to = next.findIndex((stage) => stage.id === targetId);
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setDraggedId(null);
    setStages(await pipelineStagesService.reorderStages(next.map((stage) => stage.id)));
    onToast('Ordre pipeline mis à jour.');
  }

  return (
    <Panel title="Configuration pipeline" description="Gestion des etapes de pipeline agence.">
      <div className="admin-panel-actions"><button type="button" onClick={() => setCreating(true)}><Plus size={14} /> Ajouter un stage</button></div>
      <div className="admin-stage-list">
        {stages.map((stage) => (
          <article key={stage.id} draggable onDragStart={() => setDraggedId(stage.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { void dropOn(stage.id); }}>
            <span className="admin-stage-color" style={{ background: stage.color ?? '#6B7280' }} />
            <input value={stage.name} onChange={(event) => setStages((current) => current.map((item) => item.id === stage.id ? { ...item, name: event.target.value } : item))} onBlur={(event) => { void update(stage, { name: event.target.value }); }} />
            <select value={stage.color ?? '#6B7280'} onChange={(event) => { void update(stage, { color: event.target.value }); }}>
              {STAGE_COLORS.map((color) => <option key={color} value={color}>{color}</option>)}
            </select>
            <label><input type="checkbox" checked={stage.is_won} onChange={(event) => { void update(stage, { is_won: event.target.checked, is_lost: event.target.checked ? false : stage.is_lost }); }} /> Victoire</label>
            <label><input type="checkbox" checked={stage.is_lost} onChange={(event) => { void update(stage, { is_lost: event.target.checked, is_won: event.target.checked ? false : stage.is_won }); }} /> Perte</label>
            <button type="button" onClick={() => { void move(stage.id, -1); }}><ChevronUp size={14} /></button>
            <button type="button" onClick={() => { void move(stage.id, 1); }}><ChevronDown size={14} /></button>
            <button type="button" disabled={stage.is_default} onClick={() => setDeleteStage(stage)}><Trash2 size={14} /></button>
          </article>
        ))}
      </div>
      {creating && <StageModal position={stages.length + 1} onClose={() => setCreating(false)} onCreated={(stage) => { setStages((current) => [...current, stage].sort((a, b) => a.position - b.position)); setCreating(false); onToast('Stage ajouté.'); }} />}
      {deleteStage && <DeleteStageModal stage={deleteStage} stages={stages.filter((stage) => stage.id !== deleteStage.id)} onClose={() => setDeleteStage(null)} onDeleted={() => { setDeleteStage(null); refresh(); onToast('Stage supprimé.'); }} />}
    </Panel>
  );
}

function StageModal({ position, onClose, onCreated }: { position: number; onClose: () => void; onCreated: (stage: PipelineStageRow) => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(STAGE_COLORS[0]);
  return (
    <Modal title="Ajouter un stage" onClose={onClose}>
      <label>Nom<input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Couleur<select value={color} onChange={(event) => setColor(event.target.value)}>{STAGE_COLORS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <div className="admin-modal-actions"><button type="button" onClick={onClose}>Annuler</button><button type="button" onClick={() => { void pipelineStagesService.createStage({ name, color, position, is_won: false, is_lost: false }).then(onCreated); }}>Ajouter</button></div>
    </Modal>
  );
}

function DeleteStageModal({ stage, stages, onClose, onDeleted }: { stage: PipelineStageRow; stages: PipelineStageRow[]; onClose: () => void; onDeleted: () => void }) {
  const [fallback, setFallback] = useState(stages[0]?.id ?? '');
  return (
    <Modal title="Supprimer le stage" onClose={onClose}>
      <p className="admin-help">Les deals dans "{stage.name}" seront déplacés vers l'étape choisie.</p>
      <label>Étape de remplacement<select value={fallback} onChange={(event) => setFallback(event.target.value)}>{stages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <div className="admin-modal-actions"><button type="button" onClick={onClose}>Annuler</button><button type="button" disabled={!fallback} onClick={() => { void pipelineStagesService.deleteStage(stage.id, fallback).then(onDeleted); }}>Supprimer</button></div>
    </Modal>
  );
}

function ReservedDealsTab({ onToast }: { onToast: (message: string) => void }) {
  const [deals, setDeals] = useState<ReservedDealRow[]>([]);
  const [releaseDeal, setReleaseDeal] = useState<ReservedDealRow | null>(null);
  const refresh = () => { void adminService.listReservedDeals().then(setDeals); };
  useEffect(refresh, []);
  return (
    <Panel title="Biens réservés" description="Deals actifs qui rendent un bien indisponible pour les autres agents.">
      <div className="admin-reserved-list">
        {deals.length === 0 ? <div className="admin-empty">Aucun bien réservé.</div> : deals.map((deal) => (
          <article key={deal.id}>
            <img src={deal.listing?.photo_urls?.[0] ?? ''} alt="" />
            <div><strong>{formatAddress(deal.property)}</strong><span>{deal.reference ?? deal.title ?? 'Deal'} · {profileName(deal.owner)}</span></div>
            <span>{formatDate(deal.created_at)}</span>
            <span className="admin-score-cell">{typeof deal.listing?.ai_score === 'number' ? <ScoreRing score={deal.listing.ai_score} size="sm" /> : '-'}</span>
            <span>{deal.listing?.price ? formatAmount(deal.listing.price * 100) : '-'}</span>
            <button type="button" onClick={() => setReleaseDeal(deal)}><RotateCcw size={14} /> Libérer ce bien</button>
          </article>
        ))}
      </div>
      {releaseDeal && <Modal title="Libérer ce bien" onClose={() => setReleaseDeal(null)}>
        <p className="admin-help">Le deal sera clôturé en perdu avec la raison "Libéré par admin".</p>
        <div className="admin-modal-actions"><button type="button" onClick={() => setReleaseDeal(null)}>Annuler</button><button type="button" onClick={() => { void dealsService.releaseAsAdmin(releaseDeal.id, 'Libéré par admin').then(() => { setReleaseDeal(null); refresh(); onToast('Bien libéré.'); }); }}>Confirmer</button></div>
      </Modal>}
    </Panel>
  );
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <div className="admin-panel"><header><h2>{title}</h2><p>{description}</p></header>{children}</div>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="admin-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
