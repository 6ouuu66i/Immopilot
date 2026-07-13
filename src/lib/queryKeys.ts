import type { PropertySellerSegment, SupabasePropertyListFilters } from './supabaseProperties';

export function createPropertyIdsKey(propertyIds: string[]): string[] {
  return Array.from(new Set(propertyIds.filter(Boolean))).sort();
}

function normalizeStringArray(values?: string[]) {
  return values ? createPropertyIdsKey(values) : undefined;
}

export function normalizePropertyListFilters(filters: SupabasePropertyListFilters = {}) {
  return {
    ageMinDays: filters.ageMinDays ?? null,
    city: filters.city ?? null,
    favoritePropertyIds: normalizeStringArray(filters.favoritePropertyIds),
    includeAssociationPropertyIds: normalizeStringArray(filters.includeAssociationPropertyIds),
    excludeAssociationPropertyIds: normalizeStringArray(filters.excludeAssociationPropertyIds),
    fsboOnly: filters.fsboOnly ?? false,
    ignoredPropertyIds: normalizeStringArray(filters.ignoredPropertyIds),
    maxPrice: filters.maxPrice ?? null,
    minBedrooms: filters.minBedrooms ?? null,
    minPrice: filters.minPrice ?? null,
    minScore: filters.minScore ?? null,
    minSurface: filters.minSurface ?? null,
    postalCode: filters.postalCode ?? null,
    propertyTypeLabel: filters.propertyTypeLabel ?? null,
    searchText: filters.searchText ?? null,
    sellerFilter: filters.sellerFilter ?? null,
    signalFilter: filters.signalFilter ?? null,
    source: filters.source ?? null,
  };
}

export const queryKeys = {
  contactsRoot(userId: string | null | undefined) {
    return ['contacts', userId ?? 'anonymous'] as const;
  },
  contacts(userId: string | null | undefined, search = '') {
    return [...queryKeys.contactsRoot(userId), search.trim()] as const;
  },
  contact(userId: string | null | undefined, contactId: string | null | undefined) {
    return ['contact', userId ?? 'anonymous', contactId ?? 'none'] as const;
  },
  contactActivities(userId: string | null | undefined, contactIds: string[]) {
    return ['contact-activities', userId ?? 'anonymous', createPropertyIdsKey(contactIds)] as const;
  },
  propertyMarks(userId: string | null | undefined) {
    return ['property-marks', userId ?? 'anonymous'] as const;
  },
  supabasePropertiesPage(
    userId: string | null | undefined,
    segment: PropertySellerSegment,
    page: number,
    pageSize: number,
    sort: 'recent' | 'price_asc' | 'price_desc' | 'score' = 'recent',
    filters: SupabasePropertyListFilters = {},
  ) {
    return [
      'supabase-properties-page',
      userId ?? 'anonymous',
      segment,
      page,
      pageSize,
      sort,
      normalizePropertyListFilters(filters),
    ] as const;
  },
  listingScores(userId: string | null | undefined, propertyIds: string[]) {
    return ['listing-scores', userId ?? 'anonymous', createPropertyIdsKey(propertyIds)] as const;
  },
  listingSignals(userId: string | null | undefined, propertyIds: string[]) {
    return ['listing-signals', userId ?? 'anonymous', createPropertyIdsKey(propertyIds)] as const;
  },
  propertyContactLinks(userId: string | null | undefined, propertyIds: string[]) {
    return ['property-contact-links', userId ?? 'anonymous', createPropertyIdsKey(propertyIds)] as const;
  },
  dashboardSnapshot(userId: string | null | undefined, limit = 8) {
    return ['dashboard-snapshot', userId ?? 'anonymous', limit] as const;
  },
};
