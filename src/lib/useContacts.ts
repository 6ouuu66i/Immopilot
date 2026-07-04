import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth';
import {
  contactsService,
  type ContactFull,
  type CreateContactInput,
  type ListContactsParams,
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
  roleFilters: string[];
  setSearch: (value: string) => void;
  setRoleFilters: (roles: string[]) => void;
  toggleRoleFilter: (role: string) => void;
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

function useDebouncedValue(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);

  return debounced;
}

function sortByNewest(contacts: SupabaseContact[]) {
  return [...contacts].sort((a, b) => b.created_at.localeCompare(a.created_at));
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

export function useContacts(initialParams: ListContactsParams = {}): UseContactsResult {
  const { user, profile } = useAuth();
  const [contacts, setContacts] = useState<SupabaseContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(initialParams.search ?? '');
  const [roleFilters, setRoleFilters] = useState<string[]>(() => {
    if (!initialParams.role) return [];
    return Array.isArray(initialParams.role) ? initialParams.role : [initialParams.role];
  });
  const debouncedSearch = useDebouncedValue(search, CONTACT_SEARCH_DEBOUNCE_MS);
  const rolesKey = useMemo(() => roleFilters.join('|'), [roleFilters]);

  const refresh = useCallback(async () => {
    if (!user) {
      setContacts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const nextContacts = await contactsService.listContacts({
        search: debouncedSearch,
        role: roleFilters,
      });
      setContacts(nextContacts);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Chargement des contacts impossible.');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, roleFilters, user]);

  useEffect(() => {
    void refresh();
  }, [refresh, rolesKey]);

  const toggleRoleFilter = useCallback((role: string) => {
    setRoleFilters((current) => current.includes(role)
      ? current.filter((item) => item !== role)
      : [...current, role]);
  }, []);

  const createContact = useCallback(
    async (input: CreateContactInput) => {
      if (!profile?.agency_id || !user) throw new Error('Utilisateur non connecté.');

      const previousContacts = contacts;
      const tempContact = createOptimisticContact(input, profile.agency_id, user.id);
      setError(null);
      setContacts(sortByNewest([tempContact, ...contacts]));

      try {
        const created = await contactsService.createContact(input);
        setContacts((current) => sortByNewest([created, ...current.filter((contact) => contact.id !== tempContact.id)]));
        return created;
      } catch (createError) {
        setContacts(previousContacts);
        const message = createError instanceof Error ? createError.message : 'Création du contact impossible.';
        setError(message);
        throw new Error(message);
      }
    },
    [contacts, profile?.agency_id, user],
  );

  const updateContact = useCallback(
    async (contactId: string, patch: UpdateContactInput) => {
      const previousContacts = contacts;
      setError(null);
      setContacts(contacts.map((contact) => contact.id === contactId ? { ...contact, ...patch, updated_at: new Date().toISOString() } : contact));

      try {
        const updated = await contactsService.updateContact(contactId, patch);
        setContacts((current) => current.map((contact) => contact.id === contactId ? updated : contact));
        return updated;
      } catch (updateError) {
        setContacts(previousContacts);
        const message = updateError instanceof Error ? updateError.message : 'Modification du contact impossible.';
        setError(message);
        throw new Error(message);
      }
    },
    [contacts],
  );

  const deleteContact = useCallback(
    async (contactId: string) => {
      const previousContacts = contacts;
      setError(null);
      setContacts(contacts.filter((contact) => contact.id !== contactId));

      try {
        await contactsService.deleteContact(contactId);
      } catch (deleteError) {
        setContacts(previousContacts);
        const message = deleteError instanceof Error ? deleteError.message : 'Suppression du contact impossible.';
        setError(message);
        throw new Error(message);
      }
    },
    [contacts],
  );

  return {
    contacts,
    isLoading,
    error,
    search,
    roleFilters,
    setSearch,
    setRoleFilters,
    toggleRoleFilter,
    refresh,
    createContact,
    updateContact,
    deleteContact,
  };
}

export function useContact(contactId: string | null | undefined): UseContactResult {
  const { user } = useAuth();
  const [contact, setContact] = useState<ContactFull | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(contactId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user || !contactId || !UUID_RE.test(contactId)) {
      setContact(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const nextContact = await contactsService.getContact(contactId);
      setContact(nextContact);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Chargement du contact impossible.');
    } finally {
      setIsLoading(false);
    }
  }, [contactId, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    contact,
    isLoading,
    error,
    refresh,
  };
}
