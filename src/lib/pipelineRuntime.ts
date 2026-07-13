import type { ListingScoresByProperty } from './services/listingScoresService';
import type { SupabaseContact } from './services/contactsService';
import type { DealFull, UpdateDealInput } from './services/dealsService';
import type { PipelineStageRow } from './services/pipelineStagesService';
import type { Activity, Agent, Contact, PipelineStage, Property, Task } from '../types';
import type { PipelineDataState, PipelineDeal, PipelineRuntimeData, PipelineStageView } from '../types/pipeline';

function normalizeAgentRole(role: string | null | undefined): Agent['role'] {
  return role === 'admin' || role === 'agent' ? role : 'agent';
}

function mapStage(stage: PipelineStageRow): PipelineStageView {
  return {
    id: stage.id,
    name: stage.name,
    color: stage.color ?? undefined,
    position: stage.position,
    isWon: stage.is_won,
    isLost: stage.is_lost,
  };
}

function mapProperty(deal: DealFull, scoresByProperty: ListingScoresByProperty): Property | undefined {
  const property = deal.property;
  if (!property) return undefined;

  const listing = deal.currentListing;
  const publishedAt = listing?.published_at ?? listing?.first_seen_at;
  const publishedDays = publishedAt
    ? Math.max(0, Math.ceil((Date.now() - new Date(publishedAt).getTime()) / 86_400_000))
    : 0;

  return {
    id: property.id,
    supabasePropertyId: property.id,
    supabaseListingId: listing?.id,
    title: listing?.title_fr ?? listing?.title_nl ?? property.address_key ?? deal.title ?? deal.reference ?? 'Bien',
    propertyType: property.property_subtype ?? property.property_type ?? 'Bien',
    city: property.locality ?? property.province ?? 'Belgique',
    price: listing?.price ?? 0,
    photos: listing?.photo_urls ?? [],
    tag: listing?.is_fsbo ? 'FSBO' : listing?.ai_badges?.[0] ?? '',
    score: scoresByProperty[property.id]?.score ?? 0,
    peb: 'N/A',
    surface: property.living_area ?? property.land_area ?? 0,
    bedrooms: property.bedroom_count ?? 0,
    bathrooms: property.bathroom_count ?? 0,
    source: listing?.source ?? 'Supabase',
    reserved: Boolean(deal.closed_at),
    ownerId: deal.owner_id,
    fsbo: Boolean(listing?.is_fsbo),
    publishedAt,
    publishedDays,
    floodZone: 'Faible',
    notes: [],
    yieldEstimate: listing?.ai_gross_yield ? `${Number(listing.ai_gross_yield).toFixed(1)}%` : 'N/A',
    description: listing?.description_fr ?? listing?.description_nl ?? '',
    priceHistory: [{ date: (listing?.last_seen_at ?? deal.created_at).slice(0, 10), price: listing?.price ?? 0 }],
    status: deal.closed_at ? 'archivé' : 'disponible',
  };
}

function preferPropertyDeal(candidate: DealFull, current: DealFull): boolean {
  const candidateIsActive = !candidate.closed_at && !candidate.is_won && !candidate.is_lost;
  const currentIsActive = !current.closed_at && !current.is_won && !current.is_lost;
  if (candidateIsActive !== currentIsActive) return candidateIsActive;
  return candidate.updated_at > current.updated_at;
}

function mapContact(deal: DealFull): Contact | undefined {
  if (!deal.contact) return undefined;
  return {
    id: deal.contact.id,
    reference: deal.contact.reference ?? 'CTC-...',
    name: deal.contact.full_name,
    email: deal.contact.email ?? 'Email a completer',
    phone: deal.contact.phone ?? 'Telephone a completer',
    roles: (deal.contact.roles.length > 0 ? deal.contact.roles : ['prospect']) as Contact['roles'],
    notes: deal.contact.notes ? [deal.contact.notes] : [],
    assignedDeals: [deal.id],
    assignedProperties: [deal.property_id],
  };
}

function mapAvailableContact(contact: SupabaseContact): Contact {
  return {
    id: contact.id,
    reference: contact.reference ?? 'CTC-...',
    name: contact.full_name,
    email: contact.email ?? 'Email a completer',
    phone: contact.phone ?? 'Telephone a completer',
    roles: (contact.roles.length > 0 ? contact.roles : ['prospect']) as Contact['roles'],
    notes: contact.notes ? [contact.notes] : [],
    assignedDeals: [],
    assignedProperties: [],
  };
}

function mapAgent(deal: DealFull): Agent | undefined {
  if (!deal.owner) return undefined;
  return {
    id: deal.owner.id,
    name: deal.owner.full_name ?? deal.owner.email,
    role: normalizeAgentRole(deal.owner.role),
    avatar: deal.owner.avatar_url ?? '',
    status: deal.owner.is_active ? 'active' : 'inactive',
  };
}

function mapTask(task: DealFull['tasks'][number]): Task {
  const due = task.due_date ? new Date(task.due_date) : null;
  const hasDueDate = Boolean(due && !Number.isNaN(due.getTime()));
  return {
    id: task.id,
    title: task.title,
    date: hasDueDate ? due!.toISOString().slice(0, 10) : '',
    time: hasDueDate ? due!.toTimeString().slice(0, 5) : '',
    priority: task.priority === 'high' || task.priority === 'haute' ? 'haute' : task.priority === 'low' || task.priority === 'basse' ? 'basse' : 'moyenne',
    done: task.is_completed,
    agentId: task.owner_id,
    propertyId: task.property_id,
    dealId: task.deal_id,
    contactId: task.contact_id,
  };
}

function mapActivity(activity: DealFull['activities'][number]): Activity {
  const labels: Record<string, string> = {
    stage_changed: 'Changement de stage',
    deal_created: 'Deal cree',
    deal_won: 'Deal gagne',
    deal_lost: 'Deal perdu',
    deal_reopened: 'Deal rouvert',
  };
  return {
    id: activity.id,
    type: activity.type,
    text: labels[activity.type] ?? activity.type,
    date: activity.created_at.slice(0, 10),
    agentId: activity.actor_id ?? '',
    agentName: activity.actor?.full_name ?? activity.actor?.email ?? 'Auteur indisponible',
    entityType: 'deal',
    entityId: activity.deal_id ?? undefined,
  };
}

function mapDeal(deal: DealFull): PipelineDeal {
  return {
    id: deal.id,
    reference: deal.reference ?? 'DEAL-...',
    propertyId: deal.property_id,
    contactId: deal.contact_id ?? '',
    ownerId: deal.owner_id,
    stageId: deal.stage_id,
    stage: deal.stage?.name ?? 'Etape indisponible',
    activities: deal.activities.map(mapActivity),
    notes: deal.notes ? [deal.notes] : [],
    tasks: deal.tasks.map((task) => task.id),
    commissionStatus: deal.closed_at ? (deal.is_won ? 'payable' : 'brouillon') : 'prévue',
    commissionAmount: deal.estimated_commission ?? 0,
    title: deal.title ?? deal.reference ?? 'Deal',
    price: deal.currentListing?.price ?? 0,
    closedAt: deal.closed_at,
    isWon: Boolean(deal.is_won),
    isLost: Boolean(deal.is_lost),
  };
}

export interface BuildPipelineRuntimeOptions {
  contacts?: SupabaseContact[];
  properties?: Property[];
}

export function buildPipelineRuntime(
  dealsFull: DealFull[],
  stageRows: PipelineStageRow[],
  scoresByProperty: ListingScoresByProperty,
  options: BuildPipelineRuntimeOptions = {},
): PipelineRuntimeData {
  const deals: PipelineDeal[] = [];
  const propertiesById = new Map<Property['id'], Property>();
  const contactsById = new Map<string, Contact>();
  const agentsById = new Map<string, Agent>();
  const tasksByDealId = new Map<string, Task[]>();
  const propertyDealsById = new Map<string, DealFull>();

  for (const property of options.properties ?? []) {
    if (typeof property.id === 'string') propertiesById.set(property.id, property);
  }
  for (const contact of options.contacts ?? []) {
    contactsById.set(contact.id, mapAvailableContact(contact));
  }

  for (const dealFull of dealsFull) {
    deals.push(mapDeal(dealFull));
    const property = mapProperty(dealFull, scoresByProperty);
    const contact = mapContact(dealFull);
    const agent = mapAgent(dealFull);
    if (property) {
      const currentDeal = propertyDealsById.get(property.id as string);
      if (!currentDeal || preferPropertyDeal(dealFull, currentDeal)) {
        propertyDealsById.set(property.id as string, dealFull);
        propertiesById.set(property.id, property);
      }
    }
    if (contact) {
      const existing = contactsById.get(contact.id);
      contactsById.set(contact.id, {
        ...existing,
        ...contact,
        assignedDeals: Array.from(new Set([...(existing?.assignedDeals ?? []), ...contact.assignedDeals])),
        assignedProperties: Array.from(new Set([...(existing?.assignedProperties ?? []), ...contact.assignedProperties])),
      });
    }
    if (agent) agentsById.set(agent.id, agent);
    tasksByDealId.set(dealFull.id, dealFull.tasks.map(mapTask));
  }

  const stages = stageRows.map(mapStage).sort((left, right) => left.position - right.position);
  return {
    deals,
    stages,
    dealsById: new Map(deals.map((deal) => [deal.id, deal])),
    dealsByReference: new Map(deals.map((deal) => [deal.reference, deal])),
    propertiesById,
    contactsById,
    agentsById,
    tasksByDealId,
    properties: Array.from(propertiesById.values()),
    contacts: Array.from(contactsById.values()),
  };
}

export function getPipelineDataState(
  deals: DealFull[],
  stages: PipelineStageRow[],
  isLoading: boolean,
  error: string | null,
): PipelineDataState {
  const hasCachedData = deals.length > 0 && stages.length > 0;
  if (isLoading && !hasCachedData) return 'loading';
  if (error && !hasCachedData) return 'error';
  return deals.length === 0 || stages.length === 0 ? 'empty' : 'ready';
}

export function isSupportedPipelineStage(stages: Pick<PipelineStage, 'id'>[], stageId: string): boolean {
  return stages.some((stage) => stage.id === stageId);
}

export function resolvePipelineDeal(
  pipeline: Pick<PipelineRuntimeData, 'dealsById' | 'dealsByReference'>,
  dealIdOrReference: string | null | undefined,
): PipelineDeal | undefined {
  if (!dealIdOrReference) return undefined;
  return pipeline.dealsById.get(dealIdOrReference) ?? pipeline.dealsByReference.get(dealIdOrReference);
}

export function togglePipelineDealSelection(
  pipeline: Pick<PipelineRuntimeData, 'dealsById' | 'dealsByReference'>,
  currentDealIdOrReference: string | null,
  clickedDealId: string,
): string | null {
  return resolvePipelineDeal(pipeline, currentDealIdOrReference)?.id === clickedDealId ? null : clickedDealId;
}

export type PipelineStageTransition =
  | { type: 'move'; stageId: string }
  | { type: 'close'; outcome: 'won' | 'lost' }
  | { type: 'blocked'; reason: 'closed' | 'invalid-terminal-stage' | 'same-stage' };

export function getPipelineStageTransition(
  deal: Pick<PipelineDeal, 'stageId' | 'closedAt' | 'isWon' | 'isLost'>,
  target: Pick<PipelineStageView, 'id' | 'isWon' | 'isLost'>,
): PipelineStageTransition {
  if (deal.closedAt || deal.isWon || deal.isLost) return { type: 'blocked', reason: 'closed' };
  if (deal.stageId === target.id) return { type: 'blocked', reason: 'same-stage' };
  if (target.isWon && target.isLost) return { type: 'blocked', reason: 'invalid-terminal-stage' };
  if (target.isWon) return { type: 'close', outcome: 'won' };
  if (target.isLost) return { type: 'close', outcome: 'lost' };
  return { type: 'move', stageId: target.id };
}

export function pipelineUiError(scope: 'move' | 'notes' | 'tasks', error: string): string {
  const labels = {
    move: 'Deplacement du deal impossible',
    notes: 'Synchronisation notes impossible',
    tasks: 'Synchronisation taches impossible',
  } as const;
  return `${labels[scope]} : ${error}`;
}

export function applyOptimisticDealPatch(
  deal: DealFull,
  patch: UpdateDealInput,
  stages: PipelineStageRow[],
): DealFull {
  const next: DealFull = { ...deal, ...patch, updated_at: new Date().toISOString() };
  if (patch.stage_id !== undefined) next.stage = stages.find((stage) => stage.id === patch.stage_id) ?? null;
  if (patch.contact_id !== undefined && patch.contact_id !== deal.contact_id) next.contact = null;
  if (patch.property_id !== undefined && patch.property_id !== deal.property_id) {
    next.property = null;
    next.currentListing = null;
  }
  return next;
}

export function replaceDealInList(deals: DealFull[], deal: DealFull): DealFull[] {
  return deals.map((current) => current.id === deal.id ? deal : current);
}

export function restoreDealInList(
  deals: DealFull[],
  snapshot: { deal: DealFull | undefined; index: number },
): DealFull[] {
  const withoutTarget = snapshot.deal
    ? deals.filter((deal) => deal.id !== snapshot.deal?.id)
    : deals;
  if (!snapshot.deal) return withoutTarget;
  const insertAt = Math.max(0, Math.min(snapshot.index, withoutTarget.length));
  return [
    ...withoutTarget.slice(0, insertAt),
    snapshot.deal,
    ...withoutTarget.slice(insertAt),
  ];
}

export interface OptimisticMutationOptions<TSnapshot, TResult> {
  snapshot: () => TSnapshot;
  apply: () => void;
  mutate: () => Promise<TResult>;
  commit: (result: TResult) => void;
  rollback: (snapshot: TSnapshot) => void;
  invalidate: () => Promise<unknown>;
}

export async function executeOptimisticMutation<TSnapshot, TResult>(
  options: OptimisticMutationOptions<TSnapshot, TResult>,
): Promise<TResult> {
  const snapshot = options.snapshot();
  options.apply();
  let result: TResult;
  try {
    result = await options.mutate();
  } catch (error) {
    options.rollback(snapshot);
    throw error;
  }
  options.commit(result);
  await options.invalidate();
  return result;
}

export class DealMutationLock {
  private readonly active = new Set<string>();

  constructor(private readonly onChange?: (dealIds: ReadonlySet<string>) => void) {}

  async run<TResult>(dealId: string, operation: () => Promise<TResult>): Promise<TResult> {
    if (this.active.has(dealId)) throw new Error('Une mutation est deja en cours pour ce deal.');
    this.active.add(dealId);
    this.onChange?.(new Set(this.active));
    try {
      return await operation();
    } finally {
      this.active.delete(dealId);
      this.onChange?.(new Set(this.active));
    }
  }
}
