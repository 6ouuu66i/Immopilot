import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth';
import {
  mapContactActivities,
  removeContactFromList,
  replaceContactInList,
  upsertContactList,
} from './contactRuntime';
import { queryKeys } from './queryKeys';
import {
  contactsService,
  type ContactFull,
  type CreateContactInput,
  type SupabaseContact,
  type UpdateContactInput,
} from './services/contactsService';

const CONTACT_SEARCH_DEBOUNCE_MS = 300;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface UseContactsResult {
  contacts: SupabaseContact[];
  isLoading: boolean;
  error: string | null;
  search: string;
  setSearch: (value: string) => void;
  refresh: () => Promise<void>;
  createContact: (input: CreateContactInput) => Promise<SupabaseContact>;
  updateContact: (contactId: string, patch: UpdateContactInput) => Promise<SupabaseContact>;
  deleteContact: (contactId: string) => Promise<void>;
}

export interface UseContactResult {
  contact: ContactFull | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export interface UseContactActivitiesResult {
  activitiesByContact: Record<string, ReturnType<typeof mapContactActivities>>;
  isLoading: boolean;
  error: string | null;
}

function useDebouncedValue(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);

  return debounced;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : error ? String(error) : fallback;
}

function createOptimisticContact(input: CreateContactInput, agencyId: string, userId: string): SupabaseContact {
  const now = new Date().toISOString();
  return {
    id: `temp-${Date.now()}`,
    agency_id: agencyId,
    created_at: now,
    created_by: userId,
    email: input.email?.trim() || null,
    full_name: input.full_name.trim(),
    last_interaction_at: null,
    notes: null,
    owner_id: input.owner_id ?? userId,
    phone: input.phone?.trim() || null,
    reference: 'CTC-...',
    roles: input.roles.length > 0 ? input.roles : ['prospect'],
    source: input.source?.trim() || null,
    updated_at: now,
  };
}

export function useContacts(initialParams: { search?: string } = {}): UseContactsResult {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState(initialParams.search ?? '');
  const debouncedSearch = useDebouncedValue(search, CONTACT_SEARCH_DEBOUNCE_MS);
  const queryKey = queryKeys.contacts(user?.id, debouncedSearch);
  const rootQueryKey = queryKeys.contactsRoot(user?.id);
  const contactsQuery = useQuery({
    queryKey,
    queryFn: () => contactsService.listContacts({ search: debouncedSearch }),
    enabled: Boolean(user),
  });
  const createMutation = useMutation({ mutationFn: contactsService.createContact });
  const updateMutation = useMutation({
    mutationFn: ({ contactId, patch }: { contactId: string; patch: UpdateContactInput }) => (
      contactsService.updateContact(contactId, patch)
    ),
  });
  const deleteMutation = useMutation({ mutationFn: contactsService.deleteContact });
  const contacts = contactsQuery.data ?? [];

  const refresh = useCallback(async () => {
    if (!user) return;
    await contactsQuery.refetch();
  }, [contactsQuery, user]);

  const createContact = useCallback(async (input: CreateContactInput) => {
    if (!profile?.agency_id || !user) throw new Error('Utilisateur non connecte.');

    createMutation.reset();
    const previousContacts = queryClient.getQueryData<SupabaseContact[]>(queryKey) ?? [];
    const tempContact = createOptimisticContact(input, profile.agency_id, user.id);
    queryClient.setQueryData(queryKey, upsertContactList(previousContacts, tempContact));

    try {
      const created = await createMutation.mutateAsync(input);
      queryClient.setQueryData<SupabaseContact[]>(queryKey, (current = []) => (
        upsertContactList(current, created, tempContact.id)
      ));
      await queryClient.invalidateQueries({ queryKey: rootQueryKey });
      return created;
    } catch (createError) {
      queryClient.setQueryData(queryKey, previousContacts);
      throw new Error(errorMessage(createError, 'Creation du contact impossible.'));
    }
  }, [createMutation, profile?.agency_id, queryClient, queryKey, rootQueryKey, user]);

  const updateContact = useCallback(async (contactId: string, patch: UpdateContactInput) => {
    if (!user) throw new Error('Utilisateur non connecte.');

    updateMutation.reset();
    const listSnapshots = queryClient.getQueriesData<SupabaseContact[]>({ queryKey: rootQueryKey });
    const detailQueryKey = queryKeys.contact(user.id, contactId);
    const detailSnapshot = queryClient.getQueryData<ContactFull | null>(detailQueryKey);
    const optimistic = contacts.find((contact) => contact.id === contactId);
    if (optimistic) {
      const nextContact = { ...optimistic, ...patch, updated_at: new Date().toISOString() };
      queryClient.setQueriesData<SupabaseContact[]>({ queryKey: rootQueryKey }, (current = []) => (
        replaceContactInList(current, nextContact)
      ));
    }

    try {
      const updated = await updateMutation.mutateAsync({ contactId, patch });
      queryClient.setQueriesData<SupabaseContact[]>({ queryKey: rootQueryKey }, (current = []) => (
        replaceContactInList(current, updated)
      ));
      queryClient.setQueryData<ContactFull | null>(detailQueryKey, (current) => (
        current ? { ...current, ...updated } : current
      ));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: rootQueryKey }),
        queryClient.invalidateQueries({ queryKey: detailQueryKey }),
      ]);
      return updated;
    } catch (updateError) {
      listSnapshots.forEach(([key, value]) => queryClient.setQueryData(key, value));
      queryClient.setQueryData(detailQueryKey, detailSnapshot);
      throw new Error(errorMessage(updateError, 'Modification du contact impossible.'));
    }
  }, [contacts, queryClient, rootQueryKey, updateMutation, user]);

  const deleteContact = useCallback(async (contactId: string) => {
    if (!user) throw new Error('Utilisateur non connecte.');

    deleteMutation.reset();
    const listSnapshots = queryClient.getQueriesData<SupabaseContact[]>({ queryKey: rootQueryKey });
    const detailQueryKey = queryKeys.contact(user.id, contactId);
    const detailSnapshot = queryClient.getQueryData<ContactFull | null>(detailQueryKey);
    queryClient.setQueriesData<SupabaseContact[]>({ queryKey: rootQueryKey }, (current = []) => (
      removeContactFromList(current, contactId)
    ));

    try {
      await deleteMutation.mutateAsync(contactId);
      queryClient.removeQueries({ queryKey: detailQueryKey, exact: true });
      await queryClient.invalidateQueries({ queryKey: rootQueryKey });
    } catch (deleteError) {
      listSnapshots.forEach(([key, value]) => queryClient.setQueryData(key, value));
      queryClient.setQueryData(detailQueryKey, detailSnapshot);
      throw new Error(errorMessage(deleteError, 'Suppression du contact impossible.'));
    }
  }, [deleteMutation, queryClient, rootQueryKey, user]);

  const mutationError = createMutation.error ?? updateMutation.error ?? deleteMutation.error;
  const error = contactsQuery.error
    ? errorMessage(contactsQuery.error, 'Chargement des contacts impossible.')
    : mutationError
      ? errorMessage(mutationError, 'Mutation du contact impossible.')
      : null;

  return {
    contacts,
    isLoading: contactsQuery.isLoading,
    error,
    search,
    setSearch,
    refresh,
    createContact,
    updateContact,
    deleteContact,
  };
}

export function useContact(contactId: string | null | undefined): UseContactResult {
  const { user } = useAuth();
  const isValidContactId = Boolean(contactId && UUID_RE.test(contactId));
  const contactQuery = useQuery({
    queryKey: queryKeys.contact(user?.id, contactId),
    queryFn: () => contactsService.getContact(contactId as string),
    enabled: Boolean(user && isValidContactId),
  });

  const refresh = useCallback(async () => {
    if (!user || !isValidContactId) return;
    await contactQuery.refetch();
  }, [contactQuery, isValidContactId, user]);

  return {
    contact: contactQuery.data ?? null,
    isLoading: contactQuery.isLoading,
    error: contactQuery.error ? errorMessage(contactQuery.error, 'Chargement du contact impossible.') : null,
    refresh,
  };
}

export function useContactActivities(contacts: SupabaseContact[]): UseContactActivitiesResult {
  const { user } = useAuth();
  const contactIds = useMemo(() => contacts.map((contact) => contact.id), [contacts]);
  const agenciesByContact = useMemo(
    () => new Map(contacts.map((contact) => [contact.id, contact.agency_id])),
    [contacts],
  );
  const activitiesQuery = useQuery({
    queryKey: queryKeys.contactActivities(user?.id, contactIds),
    queryFn: () => contactsService.listContactActivities(contactIds),
    enabled: Boolean(user && contactIds.length > 0),
  });
  const activitiesByContact = useMemo(() => {
    const rows = activitiesQuery.data ?? [];
    return Object.fromEntries(contactIds.map((contactId) => [
      contactId,
      mapContactActivities(rows, contactId, agenciesByContact.get(contactId) ?? ''),
    ]));
  }, [activitiesQuery.data, agenciesByContact, contactIds]);

  return {
    activitiesByContact,
    isLoading: activitiesQuery.isLoading,
    error: activitiesQuery.error ? errorMessage(activitiesQuery.error, 'Chargement des activites impossible.') : null,
  };
}
