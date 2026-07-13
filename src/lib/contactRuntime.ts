import type { Activity } from '../types';
import type { ContactActivity, SupabaseContact } from './services/contactsService';

export type ContactsDataState = 'loading' | 'error' | 'empty' | 'ready';

export function getContactsDataState(
  contacts: SupabaseContact[],
  isLoading: boolean,
  error: string | null,
): ContactsDataState {
  if (isLoading) return 'loading';
  if (error) return 'error';
  return contacts.length === 0 ? 'empty' : 'ready';
}

export function upsertContactList(
  contacts: SupabaseContact[],
  contact: SupabaseContact,
  replacedId?: string,
): SupabaseContact[] {
  return [
    contact,
    ...contacts.filter((current) => current.id !== contact.id && current.id !== replacedId),
  ].sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export function removeContactFromList(contacts: SupabaseContact[], contactId: string): SupabaseContact[] {
  return contacts.filter((contact) => contact.id !== contactId);
}

export function replaceContactInList(
  contacts: SupabaseContact[],
  contact: SupabaseContact,
): SupabaseContact[] {
  if (!contacts.some((current) => current.id === contact.id)) return contacts;
  return contacts
    .map((current) => current.id === contact.id ? contact : current)
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
}

function activityText(activity: ContactActivity): string {
  const payload = activity.payload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const candidate = payload.text ?? payload.message ?? payload.title;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }

  const labels: Record<string, string> = {
    contact_created: 'Contact cree',
    contact_updated: 'Contact modifie',
    deal_created: 'Deal cree',
    deal_lost: 'Deal perdu',
    deal_reopened: 'Deal rouvert',
    deal_won: 'Deal gagne',
    stage_changed: 'Changement de stage',
  };
  return labels[activity.type] ?? activity.type;
}

export function mapContactActivities(
  activities: ContactActivity[],
  contactId: string,
  agencyId: string,
): Activity[] {
  const seen = new Set<string>();

  return activities
    .filter((activity) => activity.contact_id === contactId && activity.agency_id === agencyId)
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .filter((activity) => {
      if (seen.has(activity.id)) return false;
      seen.add(activity.id);
      return true;
    })
    .slice(0, 20)
    .map((activity) => ({
      id: activity.id,
      type: activity.type,
      text: activityText(activity),
      date: activity.created_at.slice(0, 10),
      agentId: activity.actor_id ?? '',
      agentName: activity.actor?.full_name ?? activity.actor?.email ?? 'Agent',
      entityType: 'contact',
      entityId: activity.contact_id ?? undefined,
    }));
}
