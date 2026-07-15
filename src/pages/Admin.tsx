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
  HeartPulse,
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
import { useListingScores } from '../lib/useListingScores';
import { adminService, type AdminOverviewData, type AgentActivityDetails, type ReservedDealRow } from '../lib/services/adminService';
import { agentsService, type AgentWithStats, type InvitationResult } from '../lib/services/agentsService';
import { auditLogsService, type AuditLogFull } from '../lib/services/auditLogsService';
import { formatAmount } from '../lib/services/commissionsService';
import { dealsService } from '../lib/services/dealsService';
import { assertSupabase, formatAddress } from '../lib/services/adminUtils';
import { pipelineStagesService, type PipelineStageRow } from '../lib/services/pipelineStagesService';
import { StatusBadge, type StatusBadgeTone } from '../components/ui/StatusBadge';

type AdminTab = 'overview' | 'agents' | 'transfers' | 'activity' | 'pipeline' | 'reserved' | 'health';

const ADMIN_TABS = [
  { key: 'overview' as const, label: "Vue d'ensemble", icon: BarChart3 },
  { key: 'agents' as const, label: 'Agents', icon: UsersRound },
  { key: 'transfers' as const, label: 'Transferts', icon: ArrowLeftRight },
  { key: 'activity' as const, label: 'Activité', icon: Activity },
  { key: 'pipeline' as const, label: 'Configuration pipeline', icon: SlidersHorizontal },
  { key: 'health' as const, label: 'Santé système', icon: HeartPulse },
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
          {tab === 'health' && <SystemHealthTab />}
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
  const scorePropertyIds = useMemo(() => Array.from(new Set(deals.map((deal) => deal.property_id).filter(Boolean))), [deals]);
  const { scoresByProperty } = useListingScores(scorePropertyIds);
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
            <span className="admin-score-cell">{scoresByProperty[deal.property_id] ? <ScoreRing score={scoresByProperty[deal.property_id].score} size="sm" /> : '-'}</span>
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

type HealthStatus = 'healthy' | 'stale' | 'failed' | 'running' | 'disabled' | 'unknown';

interface HealthFreshnessItem {
  status: HealthStatus;
  last_updated_at: string | null;
  age_seconds: number | null;
}

interface HealthRun {
  id: string;
  source: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  successful_steps: number;
  total_steps: number;
}

interface SystemHealthSnapshot {
  checked_at: string;
  global_status: HealthStatus;
  action_required: string | null;
  pipeline: {
    status: HealthStatus;
    last_attempt: (HealthRun & { failed_step: string | null; error_message: string | null; error_count: number }) | null;
    last_success_at: string | null;
    age_seconds: number | null;
    next_run_at: string | null;
  };
  cron: { status: HealthStatus; active: boolean; schedule: string | null; next_run_at: string | null };
  ingestion: { enabled: boolean; status: HealthStatus; last_callback_at: string | null; last_success_at: string | null };
  freshness: {
    listings: HealthFreshnessItem;
    scores: HealthFreshnessItem;
    signals: HealthFreshnessItem;
    market_reference: HealthFreshnessItem;
    canonical_matview: HealthFreshnessItem;
  };
  history: HealthRun[];
}

interface HealthRpcClient {
  rpc(name: 'get_system_health'): Promise<{ data: unknown; error: { message: string } | null }>;
}

const HEALTH_LABELS: Record<HealthStatus, string> = {
  healthy: 'Sain',
  stale: 'Données anciennes',
  failed: 'Échec',
  running: 'En cours',
  disabled: 'Désactivé',
  unknown: 'Inconnu',
};

const HEALTH_TONES: Record<HealthStatus, StatusBadgeTone> = {
  healthy: 'success',
  stale: 'warning',
  failed: 'danger',
  running: 'info',
  disabled: 'neutral',
  unknown: 'neutral',
};

const HEALTH_ACTIONS: Record<string, string> = {
  inspect_failed_pipeline: "Inspecter l'étape en échec et les journaux du dernier run.",
  inspect_stale_data: 'Vérifier la dernière exécution du pipeline et les données anciennes.',
  verify_monitoring_configuration: 'Vérifier la configuration et la première exécution du monitoring.',
};

function isSystemHealthSnapshot(value: unknown): value is SystemHealthSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SystemHealthSnapshot>;
  return typeof candidate.checked_at === 'string'
    && typeof candidate.global_status === 'string'
    && Boolean(candidate.pipeline && candidate.cron && candidate.ingestion && candidate.freshness)
    && Array.isArray(candidate.history);
}

function formatHealthDate(value: string | null | undefined) {
  if (!value) return 'Aucune donnée';
  return new Intl.DateTimeFormat('fr-BE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Brussels',
  }).format(new Date(value));
}

function formatDuration(durationMs: number | null | undefined) {
  if (durationMs === null || durationMs === undefined) return '-';
  if (durationMs < 1_000) return `${durationMs} ms`;
  return `${(durationMs / 1_000).toFixed(1)} s`;
}

function HealthBadge({ status }: { status: HealthStatus }) {
  return <StatusBadge tone={HEALTH_TONES[status]} leadingDot>{HEALTH_LABELS[status]}</StatusBadge>;
}

function SystemHealthTab() {
  const [health, setHealth] = useState<SystemHealthSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  function refresh() {
    setIsLoading(true);
    setError(null);
    const client = assertSupabase() as unknown as HealthRpcClient;
    void client.rpc('get_system_health')
      .then(({ data, error: rpcError }) => {
        if (rpcError) throw new Error(rpcError.message);
        if (!isSystemHealthSnapshot(data)) throw new Error('Réponse de santé invalide.');
        setHealth(data);
      })
      .catch((loadError) => {
        setHealth(null);
        setError(loadError instanceof Error ? loadError.message : 'État de santé indisponible.');
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(refresh, []);

  const freshnessRows = health ? [
    ['Listings', health.freshness.listings],
    ['Scores', health.freshness.scores],
    ['Signaux', health.freshness.signals],
    ['Référence marché', health.freshness.market_reference],
    ['Vue canonique matérialisée', health.freshness.canonical_matview],
  ] as const : [];

  return (
    <Panel title="Santé système" description="État opérationnel calculé côté serveur, sans fallback mock.">
      <button type="button" onClick={refresh} disabled={isLoading}>
        <RotateCcw size={14} /> {isLoading ? 'Vérification…' : 'Actualiser'}
      </button>

      {error && <div className="admin-error" role="alert">Accès ou lecture impossible : {error}</div>}
      {isLoading && !health && <div className="admin-empty">Chargement de la santé système…</div>}
      {!isLoading && !error && !health && <div className="admin-empty">Aucune donnée de santé disponible.</div>}

      {health && (
        <>
          <div className="admin-kpi-grid">
            <article><span>État global</span><strong><HealthBadge status={health.global_status} /></strong></article>
            <article><span>Pipeline quotidien</span><strong><HealthBadge status={health.pipeline.status} /></strong></article>
            <article>
              <span>Ingestion</span>
              <strong><HealthBadge status={health.ingestion.status} /></strong>
              {!health.ingestion.enabled && <small>Ingestion désactivée</small>}
            </article>
          </div>

          <p className="admin-help">
            Dernière vérification : {formatHealthDate(health.checked_at)}.
            {health.action_required ? ` ${HEALTH_ACTIONS[health.action_required] ?? 'Une vérification est nécessaire.'}` : ' Aucune action nécessaire.'}
          </p>

          <h3 className="admin-section-title">Pipeline</h3>
          <div className="admin-list">
            <div className="admin-list-row"><strong>Dernier run</strong><span>{formatHealthDate(health.pipeline.last_attempt?.started_at)}</span></div>
            <div className="admin-list-row"><strong>Durée</strong><span>{formatDuration(health.pipeline.last_attempt?.duration_ms)}</span></div>
            <div className="admin-list-row"><strong>Étapes réussies</strong><span>{health.pipeline.last_attempt ? `${health.pipeline.last_attempt.successful_steps}/${health.pipeline.last_attempt.total_steps}` : '-'}</span></div>
            <div className="admin-list-row"><strong>Dernier succès</strong><span>{formatHealthDate(health.pipeline.last_success_at)}</span></div>
            <div className="admin-list-row"><strong>Prochaine exécution</strong><span>{formatHealthDate(health.pipeline.next_run_at)}</span></div>
            {health.pipeline.last_attempt?.failed_step && (
              <div className="admin-error" role="alert">
                Étape en échec : {health.pipeline.last_attempt.failed_step}. {health.pipeline.last_attempt.error_message ?? 'Erreur interne nettoyée.'}
              </div>
            )}
          </div>

          <h3 className="admin-section-title">Fraîcheur</h3>
          <div className="admin-list">
            {freshnessRows.map(([label, item]) => (
              <div className="admin-list-row" key={label}>
                <strong>{label}</strong>
                <HealthBadge status={item.status} />
                <span>{formatHealthDate(item.last_updated_at)}</span>
              </div>
            ))}
          </div>

          <h3 className="admin-section-title">Historique récent</h3>
          <div className="admin-list">
            {health.history.length === 0 ? <div className="admin-empty">Aucun run enregistré.</div> : health.history.map((run) => (
              <div className="admin-list-row" key={run.id}>
                <strong>{run.source}</strong>
                <span>{run.status} · {run.successful_steps}/{run.total_steps} étapes</span>
                <span>{formatHealthDate(run.started_at)} · {formatDuration(run.duration_ms)}</span>
              </div>
            ))}
          </div>
        </>
      )}
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
