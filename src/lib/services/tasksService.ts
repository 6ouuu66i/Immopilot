import { supabase } from '../supabase';
import type { Tables, TablesUpdate } from '../database.types';
import { isSupabaseUuid } from './notesService';

type ProfileRow = Tables<'profiles'>;
type TaskRow = Tables<'tasks'>;
type DealRow = Tables<'deals'>;
type ContactRow = Tables<'contacts'>;
type PropertyRow = Tables<'properties'>;
type ListingRow = Tables<'listings'>;
type TaskUpdate = TablesUpdate<'tasks'>;

export type TaskScope = 'overdue' | 'today' | 'this_week' | 'all' | 'completed';
export type TaskPriorityValue = 'haute' | 'moyenne' | 'basse' | 'high' | 'medium' | 'low' | string;

export interface TaskRelations {
  deal: Pick<DealRow, 'id' | 'reference' | 'title'> | null;
  contact: Pick<ContactRow, 'id' | 'reference' | 'full_name'> | null;
  property: Pick<PropertyRow, 'id' | 'street' | 'house_number' | 'locality' | 'postal_code'> | null;
  listing: Pick<ListingRow, 'property_id' | 'title_fr' | 'title_nl' | 'source'> | null;
}

export interface TaskWithRelations extends TaskRow {
  relations: TaskRelations;
}

export interface TasksByCompletion {
  open: TaskWithRelations[];
  completed: TaskWithRelations[];
}

export interface ListMyTasksInput {
  scope?: TaskScope;
}

export interface ListAgencyTasksInput {
  owner_id?: string | null;
  scope?: TaskScope;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  due_date?: string | null;
  priority?: TaskPriorityValue | null;
  deal_id?: string | null;
  property_id?: string | null;
  contact_id?: string | null;
}

export type UpdateTaskInput = Pick<TaskUpdate, 'title' | 'description' | 'due_date' | 'priority' | 'is_completed'>;

type MutationError = { message: string } | null;
type QueryResult<Row> = { data: Row[] | null; error: MutationError };

type TaskListQuery = PromiseLike<QueryResult<TaskRow>> & {
  eq(column: string, value: string | boolean): TaskListQuery;
  gte(column: string, value: string): TaskListQuery;
  lt(column: string, value: string): TaskListQuery;
  not(column: string, operator: string, value: string | null): TaskListQuery;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): TaskListQuery;
};

type InsertTaskQuery = {
  insert(values: {
    agency_id: string;
    owner_id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    priority: string | null;
    deal_id: string | null;
    property_id: string | null;
    contact_id: string | null;
  }): {
    select(columns: string): {
      single(): Promise<{ data: TaskRow | null; error: MutationError }>;
    };
  };
};

type UpdateTaskQuery = {
  update(values: TaskUpdate): {
    eq(column: 'id', value: string): {
      select(columns: string): {
        single(): Promise<{ data: TaskRow | null; error: MutationError }>;
      };
    };
  };
};

function assertSupabase() {
  if (!supabase) throw new Error("Supabase n'est pas configure.");
  return supabase;
}

async function getCurrentProfile(): Promise<ProfileRow> {
  const client = assertSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();

  if (userError) throw new Error(userError.message);
  if (!userData.user) throw new Error('Utilisateur non connecte.');

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  const typedProfile = profile as ProfileRow | null;
  if (!typedProfile?.agency_id) throw new Error('Profil agence introuvable.');

  return typedProfile;
}

function localDayBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function localWeekEndIso() {
  const { start } = localDayBounds();
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return end.toISOString();
}

function validateSingleTarget(input: Pick<CreateTaskInput, 'deal_id' | 'property_id' | 'contact_id'>) {
  const targets = [input.deal_id, input.property_id, input.contact_id].filter(isSupabaseUuid);
  if (targets.length > 1) {
    throw new Error("Une tache ne peut etre liee qu'a un seul objet.");
  }
}

function cleanNullable(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizePriority(priority: TaskPriorityValue | null | undefined) {
  if (!priority) return 'normal';
  if (priority === 'haute' || priority === 'high') return 'urgent';
  if (priority === 'moyenne' || priority === 'medium') return 'normal';
  if (priority === 'basse' || priority === 'low') return 'faible';
  return priority;
}

function splitByCompletion(tasks: TaskWithRelations[]): TasksByCompletion {
  return {
    open: tasks.filter((task) => !task.is_completed),
    completed: tasks.filter((task) => task.is_completed),
  };
}

function applyScope(query: TaskListQuery, scope: TaskScope | undefined) {
  const { start, end } = localDayBounds();
  if (scope === 'completed') return query.eq('is_completed', true).order('completed_at', { ascending: false, nullsFirst: false });
  const openQuery = scope && scope !== 'all' ? query.eq('is_completed', false) : query;
  if (scope === 'overdue') return openQuery.lt('due_date', start).not('due_date', 'is', null).order('due_date', { ascending: true });
  if (scope === 'today') return openQuery.gte('due_date', start).lt('due_date', end).order('due_date', { ascending: true });
  if (scope === 'this_week') return openQuery.gte('due_date', start).lt('due_date', localWeekEndIso()).order('due_date', { ascending: true });
  return openQuery.order('is_completed', { ascending: true }).order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
}

async function hydrateTasks(tasks: TaskRow[]): Promise<TaskWithRelations[]> {
  if (tasks.length === 0) return [];
  const client = assertSupabase();

  const dealIds = Array.from(new Set(tasks.map((task) => task.deal_id).filter(isSupabaseUuid)));
  const contactIds = Array.from(new Set(tasks.map((task) => task.contact_id).filter(isSupabaseUuid)));
  const propertyIds = Array.from(new Set(tasks.map((task) => task.property_id).filter(isSupabaseUuid)));

  const [dealsResult, contactsResult, propertiesResult, listingsResult] = await Promise.all([
    dealIds.length > 0 ? client.from('deals').select('id, reference, title').in('id', dealIds) : Promise.resolve({ data: [], error: null }),
    contactIds.length > 0 ? client.from('contacts').select('id, reference, full_name').in('id', contactIds) : Promise.resolve({ data: [], error: null }),
    propertyIds.length > 0 ? client.from('properties').select('id, street, house_number, locality, postal_code').in('id', propertyIds) : Promise.resolve({ data: [], error: null }),
    propertyIds.length > 0
      ? client.from('listings').select('property_id, title_fr, title_nl, source').in('property_id', propertyIds).order('last_seen_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (dealsResult.error) throw new Error(dealsResult.error.message);
  if (contactsResult.error) throw new Error(contactsResult.error.message);
  if (propertiesResult.error) throw new Error(propertiesResult.error.message);
  if (listingsResult.error) throw new Error(listingsResult.error.message);

  const deals = new Map(((dealsResult.data ?? []) as Pick<DealRow, 'id' | 'reference' | 'title'>[]).map((deal) => [deal.id, deal]));
  const contacts = new Map(((contactsResult.data ?? []) as Pick<ContactRow, 'id' | 'reference' | 'full_name'>[]).map((contact) => [contact.id, contact]));
  const properties = new Map(((propertiesResult.data ?? []) as Pick<PropertyRow, 'id' | 'street' | 'house_number' | 'locality' | 'postal_code'>[]).map((property) => [property.id, property]));
  const listings = new Map<string, Pick<ListingRow, 'property_id' | 'title_fr' | 'title_nl' | 'source'>>();
  for (const listing of (listingsResult.data ?? []) as Pick<ListingRow, 'property_id' | 'title_fr' | 'title_nl' | 'source'>[]) {
    if (listing.property_id && !listings.has(listing.property_id)) listings.set(listing.property_id, listing);
  }

  return tasks.map((task) => ({
    ...task,
    relations: {
      deal: task.deal_id ? deals.get(task.deal_id) ?? null : null,
      contact: task.contact_id ? contacts.get(task.contact_id) ?? null : null,
      property: task.property_id ? properties.get(task.property_id) ?? null : null,
      listing: task.property_id ? listings.get(task.property_id) ?? null : null,
    },
  }));
}

async function getTaskById(taskId: string): Promise<TaskWithRelations> {
  const client = assertSupabase();
  const { data, error } = await client.from('tasks').select('*').eq('id', taskId).single();
  if (error) throw new Error(error.message);
  const [task] = await hydrateTasks([data as TaskRow]);
  if (!task) throw new Error('Tache introuvable.');
  return task;
}

async function getTasksByForeignKey(column: 'deal_id' | 'property_id' | 'contact_id', id: string): Promise<TasksByCompletion> {
  if (!isSupabaseUuid(id)) return { open: [], completed: [] };
  const client = assertSupabase();
  const { data, error } = await client
    .from('tasks')
    .select('*')
    .eq(column, id)
    .order('is_completed', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);
  return splitByCompletion(await hydrateTasks((data ?? []) as TaskRow[]));
}

export const tasksService = {
  async listMyTasks({ scope = 'all' }: ListMyTasksInput = {}): Promise<TaskWithRelations[]> {
    const client = assertSupabase();
    const profile = await getCurrentProfile();
    const query = client.from('tasks').select('*').eq('owner_id', profile.id) as unknown as TaskListQuery;
    const { data, error } = await applyScope(query, scope);
    if (error) throw new Error(error.message);
    return hydrateTasks((data ?? []) as TaskRow[]);
  },

  async listAgencyTasks({ owner_id, scope = 'all' }: ListAgencyTasksInput = {}): Promise<TaskWithRelations[]> {
    const client = assertSupabase();
    const profile = await getCurrentProfile();
    if (profile.role !== 'admin') throw new Error('Reserve aux administrateurs.');

    let query = client.from('tasks').select('*').eq('agency_id', profile.agency_id as string) as unknown as TaskListQuery;
    if (owner_id) query = query.eq('owner_id', owner_id);
    const { data, error } = await applyScope(query, scope);
    if (error) throw new Error(error.message);
    return hydrateTasks((data ?? []) as TaskRow[]);
  },

  getTasksForDeal(dealId: string): Promise<TasksByCompletion> {
    return getTasksByForeignKey('deal_id', dealId);
  },

  getTasksForProperty(propertyId: string): Promise<TasksByCompletion> {
    return getTasksByForeignKey('property_id', propertyId);
  },

  getTasksForContact(contactId: string): Promise<TasksByCompletion> {
    return getTasksByForeignKey('contact_id', contactId);
  },

  async createTask(input: CreateTaskInput): Promise<TaskWithRelations> {
    const title = input.title.trim();
    if (!title) throw new Error('Le titre de la tache est obligatoire.');
    validateSingleTarget(input);

    const client = assertSupabase();
    const profile = await getCurrentProfile();
    const tasksQuery = client.from('tasks') as unknown as InsertTaskQuery;
    const { data, error } = await tasksQuery
      .insert({
        agency_id: profile.agency_id as string,
        owner_id: profile.id,
        title,
        description: cleanNullable(input.description),
        due_date: input.due_date ?? null,
        priority: normalizePriority(input.priority),
        deal_id: isSupabaseUuid(input.deal_id) ? input.deal_id : null,
        property_id: isSupabaseUuid(input.property_id) ? input.property_id : null,
        contact_id: isSupabaseUuid(input.contact_id) ? input.contact_id : null,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Tache non retournee apres creation.');
    return getTaskById(data.id);
  },

  async updateTask(taskId: string, patch: UpdateTaskInput): Promise<TaskWithRelations> {
    const client = assertSupabase();
    const nextPatch: TaskUpdate = { ...patch, updated_at: new Date().toISOString() };
    if (typeof nextPatch.title === 'string') nextPatch.title = nextPatch.title.trim();
    if (typeof nextPatch.description === 'string') nextPatch.description = cleanNullable(nextPatch.description);
    if (typeof nextPatch.priority === 'string') nextPatch.priority = normalizePriority(nextPatch.priority);
    if (nextPatch.is_completed === true) nextPatch.completed_at = new Date().toISOString();
    if (nextPatch.is_completed === false) nextPatch.completed_at = null;

    const tasksQuery = client.from('tasks') as unknown as UpdateTaskQuery;
    const { data, error } = await tasksQuery.update(nextPatch).eq('id', taskId).select('*').single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Tache non retournee apres modification.');
    return getTaskById(data.id);
  },

  completeTask(taskId: string): Promise<TaskWithRelations> {
    return tasksService.updateTask(taskId, { is_completed: true });
  },

  uncompleteTask(taskId: string): Promise<TaskWithRelations> {
    return tasksService.updateTask(taskId, { is_completed: false });
  },

  async deleteTask(taskId: string): Promise<void> {
    const client = assertSupabase();
    const { error } = await client.from('tasks').delete().eq('id', taskId);
    if (error) throw new Error(error.message);
  },

  async reorderTasks(taskIds: string[]): Promise<void> {
    void taskIds;
  },
};
