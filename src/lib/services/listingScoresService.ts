import type { Json } from '../database.types';
import { supabase } from '../supabase';

export type ListingScoreBand = 'forte' | 'surveiller' | 'faible';
export type ListingScoreConfidence = 'haute' | 'moyenne' | 'faible';

export interface ScoreReason {
  signal: string;
  family: string;
  contribution: number;
  reason_fr: string;
  facts: string[];
}

export interface ListingScoreBreakdown {
  reasons: ScoreReason[];
  informational: string[];
  excluded: string[];
  raw: Json;
}

export interface ListingScore {
  property_id: string;
  score: number;
  raw_score: number;
  band: ListingScoreBand;
  confidence: ListingScoreConfidence;
  confidence_score: number;
  confidence_detail: Json;
  breakdown: ListingScoreBreakdown;
  families_count: number;
  signals_count: number;
  score_version: number;
  computed_at: string;
}

export type ListingScoresByProperty = Record<string, ListingScore>;

interface ListingScoreRow {
  property_id: string;
  score: number | string;
  raw_score: number | string;
  band: ListingScoreBand;
  confidence: ListingScoreConfidence;
  confidence_score: number | string;
  confidence_detail: Json;
  breakdown: Json;
  families_count: number;
  signals_count: number;
  score_version: number;
  computed_at: string;
}

interface SupabaseError {
  message: string;
}

interface ListingScoresQueryResult {
  data: ListingScoreRow[] | null;
  error: SupabaseError | null;
}

type ListingScoresInQuery = PromiseLike<ListingScoresQueryResult>;

interface ListingScoresSelectQuery {
  in(column: 'property_id', values: string[]): ListingScoresInQuery;
}

interface ListingScoresTableQuery {
  select(columns: string): ListingScoresSelectQuery;
}

function assertSupabase() {
  if (!supabase) throw new Error("Supabase n'est pas configure.");
  return supabase;
}

function uniquePropertyIds(propertyIds: string[]) {
  return Array.from(new Set(propertyIds.filter(Boolean)));
}

function asRecord(value: Json | undefined): Record<string, Json> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, Json> : {};
}

function asArray(value: Json | undefined): Json[] {
  return Array.isArray(value) ? value : [];
}

function numberValue(value: Json | number | string | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function stringValue(value: Json | undefined): string {
  return typeof value === 'string' ? value : '';
}

function readBreakdown(value: Json): ListingScoreBreakdown {
  const root = asRecord(value);
  const reasons = asArray(root.reasons).map((item) => {
    const reason = asRecord(item);
    return {
      signal: stringValue(reason.signal),
      family: stringValue(reason.family),
      contribution: numberValue(reason.contribution),
      reason_fr: stringValue(reason.reason_fr),
      facts: asArray(reason.facts).map((fact) => String(fact)),
    };
  });

  return {
    reasons,
    informational: asArray(root.informational).map((item) => String(item)),
    excluded: asArray(root.excluded).map((item) => String(item)),
    raw: value,
  };
}

function mapRow(row: ListingScoreRow): ListingScore {
  return {
    ...row,
    score: numberValue(row.score),
    raw_score: numberValue(row.raw_score),
    confidence_score: numberValue(row.confidence_score),
    breakdown: readBreakdown(row.breakdown),
  };
}

export const listingScoresService = {
  async listByPropertyIds(propertyIds: string[]): Promise<ListingScoresByProperty> {
    const ids = uniquePropertyIds(propertyIds);
    if (ids.length === 0) return {};

    const client = assertSupabase();
    const scoresQuery = client.from('listing_scores' as never) as unknown as ListingScoresTableQuery;
    const { data, error } = await scoresQuery
      .select('property_id, score, raw_score, band, confidence, confidence_score, confidence_detail, breakdown, families_count, signals_count, score_version, computed_at')
      .in('property_id', ids);

    if (error) throw new Error(error.message);

    return (data ?? []).reduce<ListingScoresByProperty>((acc, row) => {
      acc[row.property_id] = mapRow(row);
      return acc;
    }, {});
  },
};
