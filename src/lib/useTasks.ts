import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth';
import type { Task, TaskPriority } from '../types';
import { isSupabaseUuid } from './services/notesService';
import {
  tasksService,
  type CreateTaskInput,
  type TaskScope,
  type TaskWithRelations,
  type UpdateTaskInput,
} from './services/tasksService';

export interface UseTasksFilters {
  scope?: TaskScope;
  owner_id?: string | null;
  agency?: boolean;
}

export interface UseTasksResult {
  tasks: TaskWithRelations[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<TaskWithRelations>;
  updateTask: (taskId: string, patch: UpdateTaskInput) => Promise<TaskWithRelations>;
  completeTask: (taskId: string) => Promise<TaskWithRelations>;
  uncompleteTask: (taskId: string) => Promise<TaskWithRelations>;
  toggleTask: (taskId: string) => Promise<TaskWithRelations | null>;
  deleteTask: (taskId: string) => Promise<void>;
}

export interface UseTasksForParams {
  dealId?: string | null;
  propertyId?: string | null;
  contactId?: string | null;
}

export interface UseTasksForResult {
  openTasks: TaskWithRelations[];
  completedTasks: TaskWithRelations[];
  tasks: TaskWithRelations[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createTask: (input: Omit<CreateTaskInput, 'deal_id' | 'property_id' | 'contact_id'>) => Promise<TaskWithRelations>;
  updateTask: (taskId: string, patch: UpdateTaskInput) => Promise<TaskWithRelations>;
  completeTask: (taskId: string) => Promise<TaskWithRelations>;
  uncompleteTask: (taskId: string) => Promise<TaskWithRelations>;
  toggleTask: (taskId: string) => Promise<TaskWithRelations | null>;
  deleteTask: (taskId: string) => Promise<void>;
}

function filtersKey(filters: UseTasksFilters) {
  return JSON.stringify({
    scope: filters.scope ?? 'all',
    owner_id: filters.owner_id ?? null,
    agency: Boolean(filters.agency),
  });
}

function contextKey(params: UseTasksForParams) {
  return [params.dealId ?? '', params.propertyId ?? '', params.contactId ?? ''].join('|');
}

function getValidContext(params: UseTasksForParams): UseTasksForParams {
  return {
    dealId: isSupabaseUuid(params.dealId) ? params.dealId : null,
    propertyId: isSupabaseUuid(params.propertyId) ? params.propertyId : null,
    contactId: isSupabaseUuid(params.contactId) ? params.contactId : null,
  };
}

function hasSingleContext({ dealId, propertyId, contactId }: UseTasksForParams) {
  return [dealId, propertyId, contactId].filter(Boolean).length === 1;
}

function optimisticTask(input: CreateTaskInput, userId: string, agencyId: string | null | undefined): TaskWithRelations {
  const now = new Date().toISOString();
  return {
    id: `temp-${Date.now()}`,
    agency_id: agencyId ?? '',
    owner_id: userId,
    title: input.title.trim(),
    description: input.description ?? null,
    due_date: input.due_date ?? null,
    priority: input.priority ?? 'moyenne',
    deal_id: input.deal_id ?? null,
    property_id: input.property_id ?? null,
    contact_id: input.contact_id ?? null,
    is_completed: false,
    completed_at: null,
    created_at: now,
    updated_at: now,
    relations: {
      deal: null,
      contact: null,
      property: null,
      listing: null,
    },
  };
}

function replaceTask(tasks: TaskWithRelations[], task: TaskWithRelations) {
  return tasks.map((item) => (item.id === task.id ? task : item));
}

function patchTask(task: TaskWithRelations, patch: UpdateTaskInput): TaskWithRelations {
  const isCompleting = patch.is_completed === true;
  const isUncompleting = patch.is_completed === false;
  return {
    ...task,
    ...patch,
    completed_at: isCompleting ? new Date().toISOString() : isUncompleting ? null : task.completed_at,
    updated_at: new Date().toISOString(),
  };
}

export function taskToView(task: TaskWithRelations): Task {
  const due = task.due_date ? new Date(task.due_date) : null;
  const validDue = due && !Number.isNaN(due.getTime()) ? due : null;
  const priority: TaskPriority =
    task.priority === 'haute' || task.priority === 'high' || task.priority === 'urgent'
      ? 'haute'
      : task.priority === 'basse' || task.priority === 'low' || task.priority === 'faible'
        ? 'basse'
        : 'moyenne';

  return {
    id: task.id,
    title: task.title,
    date: validDue ? validDue.toISOString().slice(0, 10) : '',
    time: validDue ? validDue.toTimeString().slice(0, 5) : '09:00',
    priority,
    done: task.is_completed,
    agentId: task.owner_id,
    propertyId: null,
    dealId: task.deal_id,
    contactId: task.contact_id,
    place: task.relations.property?.locality ?? undefined,
  };
}

export function taskLinkLabel(task: TaskWithRelations): string {
  if (task.relations.deal) return `Deal ${task.relations.deal.reference ?? task.relations.deal.title ?? ''}`.trim();
  if (task.relations.contact) return `Contact ${task.relations.contact.reference ?? task.relations.contact.full_name}`;
  if (task.relations.listing) return `Bien ${task.relations.listing.title_fr ?? task.relations.listing.title_nl ?? task.relations.listing.source}`;
  if (task.relations.property) {
    const property = task.relations.property;
    return `Bien ${[property.street, property.house_number, property.locality].filter(Boolean).join(' ')}`.trim();
  }
  if (task.deal_id) return 'Deal lie';
  if (task.contact_id) return 'Contact lie';
  if (task.property_id) return 'Bien lie';
  return 'Aucun objet lie';
}

export function useTasks(filters: UseTasksFilters = {}): UseTasksResult {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState<string | null>(null);
  const key = useMemo(() => filtersKey(filters), [filters]);
  const queryKey = useMemo(
    () => ['tasks', user?.id ?? 'anonymous', key] as const,
    [key, user?.id],
  );

  const tasksQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user) return [];
      const nextTasks = filters.agency
        ? await tasksService.listAgencyTasks({ owner_id: filters.owner_id, scope: filters.scope })
        : await tasksService.listMyTasks({ scope: filters.scope });
      return nextTasks;
    },
    enabled: Boolean(user),
  });

  const tasks = tasksQuery.data ?? [];
  const isLoading = tasksQuery.isLoading;
  const error = mutationError ?? (tasksQuery.error instanceof Error ? tasksQuery.error.message : null);
  const refresh = useCallback(async () => {
    await tasksQuery.refetch();
  }, [tasksQuery]);

  const createTask = useCallback(async (input: CreateTaskInput) => {
    if (!user) throw new Error('Utilisateur non connecte.');
    const previous = tasks;
    const temp = optimisticTask(input, user.id, profile?.agency_id);
    setMutationError(null);
    queryClient.setQueryData<TaskWithRelations[]>(queryKey, [temp, ...tasks]);

    try {
      const created = await tasksService.createTask(input);
      queryClient.setQueryData<TaskWithRelations[]>(
        queryKey,
        (current = []) => [created, ...current.filter((task) => task.id !== temp.id)],
      );
      await queryClient.invalidateQueries({ queryKey: ['tasks', user.id] });
      return created;
    } catch (createError) {
      queryClient.setQueryData<TaskWithRelations[]>(queryKey, previous);
      const message = createError instanceof Error ? createError.message : 'Creation de la tache impossible.';
      setMutationError(message);
      throw new Error(message);
    }
  }, [profile?.agency_id, queryClient, queryKey, tasks, user]);

  const updateTask = useCallback(async (taskId: string, patch: UpdateTaskInput) => {
    const previous = tasks;
    setMutationError(null);
    queryClient.setQueryData<TaskWithRelations[]>(
      queryKey,
      (current = []) => current.map((task) => (task.id === taskId ? patchTask(task, patch) : task)),
    );

    try {
      const updated = await tasksService.updateTask(taskId, patch);
      queryClient.setQueryData<TaskWithRelations[]>(
        queryKey,
        (current = []) => replaceTask(current, updated),
      );
      if (user) await queryClient.invalidateQueries({ queryKey: ['tasks', user.id] });
      return updated;
    } catch (updateError) {
      queryClient.setQueryData<TaskWithRelations[]>(queryKey, previous);
      const message = updateError instanceof Error ? updateError.message : 'Modification de la tache impossible.';
      setMutationError(message);
      throw new Error(message);
    }
  }, [queryClient, queryKey, tasks, user]);

  const completeTask = useCallback((taskId: string) => updateTask(taskId, { is_completed: true }), [updateTask]);
  const uncompleteTask = useCallback((taskId: string) => updateTask(taskId, { is_completed: false }), [updateTask]);

  const toggleTask = useCallback(async (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return null;
    return task.is_completed ? uncompleteTask(taskId) : completeTask(taskId);
  }, [completeTask, tasks, uncompleteTask]);

  const deleteTask = useCallback(async (taskId: string) => {
    const previous = tasks;
    setMutationError(null);
    queryClient.setQueryData<TaskWithRelations[]>(
      queryKey,
      (current = []) => current.filter((task) => task.id !== taskId),
    );
    try {
      await tasksService.deleteTask(taskId);
      if (user) await queryClient.invalidateQueries({ queryKey: ['tasks', user.id] });
    } catch (deleteError) {
      queryClient.setQueryData<TaskWithRelations[]>(queryKey, previous);
      const message = deleteError instanceof Error ? deleteError.message : 'Suppression de la tache impossible.';
      setMutationError(message);
      throw new Error(message);
    }
  }, [queryClient, queryKey, tasks, user]);

  return { tasks, isLoading, error, refresh, createTask, updateTask, completeTask, uncompleteTask, toggleTask, deleteTask };
}

export function useTasksFor(params: UseTasksForParams): UseTasksForResult {
  const { user, profile } = useAuth();
  const [openTasks, setOpenTasks] = useState<TaskWithRelations[]>([]);
  const [completedTasks, setCompletedTasks] = useState<TaskWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const validContext = useMemo(() => getValidContext(params), [params.dealId, params.propertyId, params.contactId]);
  const key = useMemo(() => contextKey(validContext), [validContext]);
  const tasks = useMemo(() => [...openTasks, ...completedTasks], [completedTasks, openTasks]);

  const setAllTasks = useCallback((nextTasks: TaskWithRelations[]) => {
    setOpenTasks(nextTasks.filter((task) => !task.is_completed));
    setCompletedTasks(nextTasks.filter((task) => task.is_completed));
  }, []);

  const refresh = useCallback(async () => {
    if (!user || !hasSingleContext(validContext)) {
      setOpenTasks([]);
      setCompletedTasks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = validContext.dealId
        ? await tasksService.getTasksForDeal(validContext.dealId)
        : validContext.propertyId
          ? await tasksService.getTasksForProperty(validContext.propertyId)
          : await tasksService.getTasksForContact(validContext.contactId as string);
      setOpenTasks(result.open);
      setCompletedTasks(result.completed);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Chargement des taches impossible.');
    } finally {
      setIsLoading(false);
    }
  }, [user, validContext]);

  useEffect(() => {
    void refresh();
  }, [key, refresh]);

  const createTask = useCallback(async (input: Omit<CreateTaskInput, 'deal_id' | 'property_id' | 'contact_id'>) => {
    if (!user) throw new Error('Utilisateur non connecte.');
    const scopedInput: CreateTaskInput = {
      ...input,
      deal_id: validContext.dealId ?? null,
      property_id: validContext.propertyId ?? null,
      contact_id: validContext.contactId ?? null,
    };
    const previous = tasks;
    const temp = optimisticTask(scopedInput, user.id, profile?.agency_id);
    setError(null);
    setOpenTasks((current) => [temp, ...current]);

    try {
      const created = await tasksService.createTask(scopedInput);
      setAllTasks([created, ...previous]);
      return created;
    } catch (createError) {
      setAllTasks(previous);
      const message = createError instanceof Error ? createError.message : 'Creation de la tache impossible.';
      setError(message);
      throw new Error(message);
    }
  }, [profile?.agency_id, setAllTasks, tasks, user, validContext]);

  const updateTask = useCallback(async (taskId: string, patch: UpdateTaskInput) => {
    const previous = tasks;
    setError(null);
    setAllTasks(tasks.map((task) => (task.id === taskId ? patchTask(task, patch) : task)));

    try {
      const updated = await tasksService.updateTask(taskId, patch);
      setAllTasks(replaceTask(previous, updated));
      return updated;
    } catch (updateError) {
      setAllTasks(previous);
      const message = updateError instanceof Error ? updateError.message : 'Modification de la tache impossible.';
      setError(message);
      throw new Error(message);
    }
  }, [setAllTasks, tasks]);

  const completeTask = useCallback((taskId: string) => updateTask(taskId, { is_completed: true }), [updateTask]);
  const uncompleteTask = useCallback((taskId: string) => updateTask(taskId, { is_completed: false }), [updateTask]);
  const toggleTask = useCallback(async (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return null;
    return task.is_completed ? uncompleteTask(taskId) : completeTask(taskId);
  }, [completeTask, tasks, uncompleteTask]);

  const deleteTask = useCallback(async (taskId: string) => {
    const previous = tasks;
    setError(null);
    setAllTasks(tasks.filter((task) => task.id !== taskId));
    try {
      await tasksService.deleteTask(taskId);
    } catch (deleteError) {
      setAllTasks(previous);
      const message = deleteError instanceof Error ? deleteError.message : 'Suppression de la tache impossible.';
      setError(message);
      throw new Error(message);
    }
  }, [setAllTasks, tasks]);

  return {
    openTasks,
    completedTasks,
    tasks,
    isLoading,
    error,
    refresh,
    createTask,
    updateTask,
    completeTask,
    uncompleteTask,
    toggleTask,
    deleteTask,
  };
}
