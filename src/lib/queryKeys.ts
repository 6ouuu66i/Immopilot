import type { SupabasePropertyListFilters } from './supabaseProperties';

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
