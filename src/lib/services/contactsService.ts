import { supabase } from '../supabase';
import type { Tables } from '../database.types';
import { notesService, type NoteWithAuthor } from './notesService';

type ProfileRow = Tables<'profiles'>;
export type SupabaseContact = Tables<'contacts'>;
export type SupabaseDeal = Tables<'deals'>;
type ActivityRow = Tables<'activities'>;
type ContactPropertyRow = Tables<'contact_properties'>;
export type PropertyContactLink = ContactPropertyRow;
type PropertyRow = Tables<'properties'>;
type ListingRow = Tables<'listings'>;

export type ContactRelationship = 'owner' | 'interested' | 'former_owner' | 'tenant' | string;

export interface ListContactsParams {
  search?: string;
  role?: string | string[];
}

export interface CreateContactInput {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  roles: string[];
  notes?: string | null;
  source?: string | null;
  owner_id?: string | null;
}

export type UpdateContactInput = Partial<Pick<
  SupabaseContact,
  'full_name' | 'email' | 'phone' | 'roles' | 'notes' | 'source' | 'owner_id' | 'last_interaction_at'
>>;

export interface ContactPropertyLink extends ContactPropertyRow {
  property: PropertyRow | null;
  currentListing: ListingRow | null;
  address: string;
  city: string;
  currentPrice: number | null;
  photos: string[];
}

export interface ContactFull extends SupabaseContact {
  properties: ContactPropertyLink[];
  deals: SupabaseDeal[];
  activities: ContactActivity[];
  notesList: NoteWithAuthor[];
}

export type ContactActivity = ActivityRow & {
  actor: Pick<ProfileRow, 'id' | 'full_name' | 'email'> | null;
};

type RawContactProperty = ContactPropertyRow & {
  properties?: PropertyRow | PropertyRow[] | null;
};

type ListingByPropertyId = Map<string, ListingRow>;
type MutationError = { message: string } | null;

type InsertContactQuery = {
  insert(values: {
    agency_id: string;
    created_by: string;
    owner_id: string | null;
    full_name: string;
    email: string | null;
    phone: string | null;
    roles: string[];
    source: string | null;
    notes: string | null;
  }): {
    select(columns: string): {
      single(): Promise<{ data: SupabaseContact | null; error: MutationError }>;
    };
  };
};

type UpdateContactQuery = {
  update(values: UpdateContactInput): {
    eq(column: 'id', value: string): {
      select(columns: string): {
        single(): Promise<{ data: SupabaseContact | null; error: MutationError }>;
      };
    };
  };
};

type InsertContactPropertyQuery = {
  insert(values: {
    contact_id: string;
    property_id: string;
    relationship: string;
  }): {
    select(columns: string): {
      single(): Promise<{ data: unknown; error: MutationError }>;
    };
  };
};

function assertSupabase() {
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  return supabase;
}

async function getCurrentProfile(): Promise<ProfileRow> {
  const client = assertSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();

  if (userError) throw new Error(userError.message);
  if (!userData.user) throw new Error('Utilisateur non connecté.');

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

function cleanSearch(value: string) {
  return value.replaceAll('%', '').replaceAll(',', ' ').trim();
}

function normalizeNullable(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeProperty(property: RawContactProperty['properties']): PropertyRow | null {
  if (Array.isArray(property)) return property[0] ?? null;
  return property ?? null;
}

function propertyAddress(property: PropertyRow | null) {
  if (!property) return 'Adresse à compléter';
  const street = [property.street, property.house_number].filter(Boolean).join(' ').trim();
  return street || property.address_key || 'Adresse à compléter';
}

function propertyCity(property: PropertyRow | null) {
  return property?.locality ?? property?.province ?? 'Belgique';
}

async function getLatestActiveListings(propertyIds: string[]): Promise<ListingByPropertyId> {
  const client = assertSupabase();
  if (propertyIds.length === 0) return new Map();

  const { data, error } = await client
    .from('listings')
    .select('*')
    .in('property_id', propertyIds)
    .eq('status', 'active')
    .order('last_seen_at', { ascending: false });

  if (error) throw new Error(error.message);

  const listingsByPropertyId: ListingByPropertyId = new Map();
  for (const listing of (data ?? []) as ListingRow[]) {
    if (listing.property_id && !listingsByPropertyId.has(listing.property_id)) {
      listingsByPropertyId.set(listing.property_id, listing);
    }
  }
  return listingsByPropertyId;
}

export const contactsService = {
  async listPropertyContactLinks(propertyIds?: string[]): Promise<PropertyContactLink[]> {
    const client = assertSupabase();
    let query = client
      .from('contact_properties')
      .select('*')
      .order('created_at', { ascending: false });

    if (propertyIds !== undefined) {
      const ids = Array.from(new Set(propertyIds.filter(Boolean)));
      if (ids.length === 0) return [];
      query = query.in('property_id', ids);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return (data ?? []) as PropertyContactLink[];
  },

  async listContacts({ search, role }: ListContactsParams = {}): Promise<SupabaseContact[]> {
    const client = assertSupabase();
    let query = client
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false });

    const normalizedSearch = cleanSearch(search ?? '');
    if (normalizedSearch) {
      const value = `%${normalizedSearch}%`;
      query = query.or(`full_name.ilike.${value},email.ilike.${value},phone.ilike.${value},reference.ilike.${value}`);
    }

    const roles = Array.isArray(role) ? role.filter(Boolean) : role ? [role] : [];
    if (roles.length === 1) query = query.contains('roles', [roles[0]]);
    if (roles.length > 1) query = query.overlaps('roles', roles);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as SupabaseContact[];
  },

  async getContact(contactId: string): Promise<ContactFull | null> {
    const client = assertSupabase();
    const { data, error } = await client
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    const contact = data as SupabaseContact | null;
    if (!contact) return null;

    const [properties, deals, activities, notesList] = await Promise.all([
      contactsService.getContactProperties(contact.id),
      contactsService.getContactDeals(contact.id),
      contactsService.listContactActivities([contact.id]),
      notesService.getNotesForContact(contact.id),
    ]);

    return {
      ...contact,
      properties,
      deals,
      activities,
      notesList,
    };
  },

  async getContactByReference(reference: string): Promise<ContactFull | null> {
    const client = assertSupabase();
    const { data, error } = await client
      .from('contacts')
      .select('id')
      .eq('reference', reference)
      .maybeSingle();

    if (error) throw new Error(error.message);
    const row = data as { id: string } | null;
    return row ? contactsService.getContact(row.id) : null;
  },

  async getContactDeals(contactId: string): Promise<SupabaseDeal[]> {
    const client = assertSupabase();
    const { data, error } = await client
      .from('deals')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as SupabaseDeal[];
  },

  async listContactActivities(contactIds: string[]): Promise<ContactActivity[]> {
    const ids = Array.from(new Set(contactIds.filter(Boolean)));
    if (ids.length === 0) return [];

    const client = assertSupabase();
    const { data, error } = await client
      .from('activities')
      .select('*, actor:profiles!activities_actor_id_fkey(id,full_name,email)')
      .in('contact_id', ids)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as ContactActivity[];
  },

  async createContact(input: CreateContactInput): Promise<SupabaseContact> {
    const fullName = input.full_name.trim();
    if (!fullName) throw new Error('Le nom complet est obligatoire.');

    const client = assertSupabase();
    const profile = await getCurrentProfile();

    const contactsQuery = client.from('contacts') as unknown as InsertContactQuery;
    const { data, error } = await contactsQuery
      .insert({
        agency_id: profile.agency_id as string,
        created_by: profile.id,
        owner_id: input.owner_id ?? profile.id,
        full_name: fullName,
        email: normalizeNullable(input.email),
        phone: normalizeNullable(input.phone),
        roles: input.roles.length > 0 ? input.roles : ['prospect'],
        source: normalizeNullable(input.source),
        notes: null,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Contact non retourne apres creation.');
    const created = data;

    if (input.notes?.trim()) {
      await notesService.createNote({ content: input.notes.trim(), contactId: created.id });
    }

    return created;
  },

  async updateContact(contactId: string, patch: UpdateContactInput): Promise<SupabaseContact> {
    const client = assertSupabase();
    const nextPatch: UpdateContactInput = { ...patch };
    if (nextPatch.full_name !== undefined) {
      nextPatch.full_name = nextPatch.full_name.trim();
      if (!nextPatch.full_name) throw new Error('Le nom complet est obligatoire.');
    }
    if (nextPatch.email !== undefined) nextPatch.email = normalizeNullable(nextPatch.email);
    if (nextPatch.phone !== undefined) nextPatch.phone = normalizeNullable(nextPatch.phone);
    if (nextPatch.source !== undefined) nextPatch.source = normalizeNullable(nextPatch.source);

    const contactsQuery = client.from('contacts') as unknown as UpdateContactQuery;
    const { data, error } = await contactsQuery
      .update(nextPatch)
      .eq('id', contactId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Contact non retourne apres modification.');
    return data;
  },

  async deleteContact(contactId: string): Promise<void> {
    const client = assertSupabase();
    const { error } = await client
      .from('contacts')
      .delete()
      .eq('id', contactId);

    if (error) throw new Error(error.message);
  },

  async linkPropertyToContact(
    contactId: string,
    propertyId: string,
    relationship: ContactRelationship = 'interested',
  ): Promise<ContactPropertyLink> {
    const client = assertSupabase();
    const contactPropertiesQuery = client.from('contact_properties') as unknown as InsertContactPropertyQuery;
    const { data, error } = await contactPropertiesQuery
      .insert({
        contact_id: contactId,
        property_id: propertyId,
        relationship,
      })
      .select('*, properties(*)')
      .single();

    if (error) throw new Error(error.message);
    const row = data as unknown as RawContactProperty;
    const listings = await getLatestActiveListings([row.property_id]);
    const property = normalizeProperty(row.properties);
    const listing = listings.get(row.property_id) ?? null;

    return {
      ...row,
      property,
      currentListing: listing,
      address: propertyAddress(property),
      city: propertyCity(property),
      currentPrice: listing?.price ?? null,
      photos: listing?.photo_urls ?? [],
    };
  },

  async unlinkPropertyFromContact(contactId: string, propertyId: string): Promise<void> {
    const client = assertSupabase();
    const { error } = await client
      .from('contact_properties')
      .delete()
      .eq('contact_id', contactId)
      .eq('property_id', propertyId);

    if (error) throw new Error(error.message);
  },

  async getContactProperties(contactId: string): Promise<ContactPropertyLink[]> {
    const client = assertSupabase();
    const { data, error } = await client
      .from('contact_properties')
      .select('*, properties(*)')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as RawContactProperty[];
    const propertyIds = rows.map((row) => row.property_id);
    const listings = await getLatestActiveListings(propertyIds);

    return rows.map((row) => {
      const property = normalizeProperty(row.properties);
      const listing = listings.get(row.property_id) ?? null;
      return {
        ...row,
        property,
        currentListing: listing,
        address: propertyAddress(property),
        city: propertyCity(property),
        currentPrice: listing?.price ?? null,
        photos: listing?.photo_urls ?? [],
      };
    });
  },
};
