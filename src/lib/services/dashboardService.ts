import type { Json, Tables } from '../database.types';
import { fetchSupabaseProperties, uniqueSupabaseProperties } from '../supabaseProperties';
import { supabase } from '../supabase';
import { listingScoresService, type ListingScore } from './listingScoresService';

type ListingRow = Tables<'listings'>;
type PropertyRow = Tables<'properties'>;

interface DashboardSignalRow {
  detected_at: string;
  id: string;
  is_active: boolean;
  listing_id: string;
  metadata: Json;
  property_id: string;
  signal_type: string;
}

interface PriceHistoryRow {
  change_amount: number | null;
  change_type: string | null;
  detected_at: string;
  id: string;
  listing_id: string | null;
  new_price: number | null;
  old_price: number | null;
  property_id: string | null;
}

export interface DashboardOpportunity {
  addedAt: string;
  band: ListingScore['band'] | 'faible';
  confidence: ListingScore['confidence'] | 'faible';
  id: string;
  photo: string | null;
  price: number | null;
  propertyId: string | null;
  score: number;
  signal: string;
  source: string;
  subtitle: string;
  surface: number | null;
  title: string;
}

export interface DashboardSignalItem {
  id: string;
  propertyId: string;
  source: string;
  timeLabel: string;
  title: string;
  tone: 'good' | 'risk' | 'watch' | 'neutral';
  value: string;
}

export interface DashboardSnapshot {
  activeListingsCount: number;
  activePropertiesCount: number;
  activeSignalsCount: number;
  fsboCount: number;
  hotOpportunitiesCount: number;
  lastSyncAt: string | null;
  opportunities: DashboardOpportunity[];
  priceDropCount: number;
  priceDropTotal: number;
  scoreAverage: number;
  scoreDistribution: {
    faible: number;
    forte: number;
    surveiller: number;
  };
  scoredPropertiesCount: number;
  signals: DashboardSignalItem[];
}

function assertSupabase() {
  if (!supabase) throw new Error("Supabase n'est pas configure.");
  return supabase;
}

function signalTone(signalType: string): DashboardSignalItem['tone'] {
  if (signalType === 'price_drop' || signalType === 'below_market') return 'risk';
  if (signalType === 'fsbo' || signalType === 'republished' || signalType === 'agency_mandate_aging' || signalType === 'back_to_market') return 'watch';
  if (signalType === 'overpriced' || signalType === 'stale_dom_relative' || signalType === 'failed_launch' || signalType === 'competition_shock') return 'good';
  return 'neutral';
}

function signalLabel(signalType: string): string {
  switch (signalType) {
    case 'price_drop': return 'Baisse de prix';
    case 'republished': return 'Annonce republiee';
    case 'below_market': return 'Sous le marche';
    case 'multi_source': return 'Multi-source';
    case 'agency_mandate_aging': return 'Mandat agence ancien';
    case 'overpriced': return 'Surcote';
    case 'stale_dom_relative': return 'Temps en ligne eleve';
    case 'failed_launch': return 'Lancement faible';
    case 'competition_shock': return 'Concurrence en hausse';
    case 'back_to_market': return 'Retour marche';
    case 'fsbo': return 'FSBO';
    default: return signalType.replaceAll('_', ' ');
  }
}

function signalValue(signal: DashboardSignalRow): string {
  const metadata = signal.metadata && typeof signal.metadata === 'object' && !Array.isArray(signal.metadata)
    ? signal.metadata as Record<string, Json>
    : {};

  const percentage = metadata.delta_pct ?? metadata.price_variation_pct ?? metadata.overpricing_pct ?? metadata.gap_pct;
  if (typeof percentage === 'number') return `${percentage > 0 ? '+' : ''}${percentage.toFixed(1)}%`;
  if (typeof percentage === 'string' && percentage.trim()) return percentage;

  const amount = metadata.change_amount ?? metadata.delta_amount;
  if (typeof amount === 'number') return `${amount > 0 ? '+' : ''}${Math.round(amount)} EUR`;
  if (typeof amount === 'string' && amount.trim()) return amount;

  const label = metadata.label ?? metadata.reason_fr ?? metadata.detected_via;
  if (typeof label === 'string' && label.trim()) return label;

  return signalLabel(signal.signal_type);
}

function opportunitySignal(score: ListingScore | undefined, signal: DashboardSignalRow | undefined): string {
  if (score?.breakdown.reasons[0]?.reason_fr) return score.breakdown.reasons[0].reason_fr;
  if (signal) return signalLabel(signal.signal_type);
  return 'Aucun signal score';
}

function timeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
}

function subtitleFor(property: { city: string; propertyType?: string; source: string }) {
  return [property.city, property.propertyType ?? 'Bien', property.source].filter(Boolean).join(' - ');
}

function scoreDistribution(scores: ListingScore[]) {
  return scores.reduce(
    (acc, score) => {
      acc[score.band] += 1;
      return acc;
    },
    { forte: 0, surveiller: 0, faible: 0 },
  );
}

export async function getDashboardSnapshot(limit = 8): Promise<DashboardSnapshot> {
  const client = assertSupabase();
  const activeListings = await fetchSupabaseProperties();
  const activeProperties = uniqueSupabaseProperties(activeListings);
  const propertyIds = activeProperties
    .map((property) => property.supabasePropertyId)
    .filter((propertyId): propertyId is string => Boolean(propertyId));

  const sevenDaysAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)).toISOString();

  const [scoresByProperty, activeSignalsCountResult, signalsResult, priceDropsResult] = await Promise.all([
    listingScoresService.listByPropertyIds(propertyIds),
    client
      .from('listing_signals')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    client
      .from('listing_signals')
      .select('id, property_id, listing_id, signal_type, metadata, detected_at, is_active')
      .eq('is_active', true)
      .order('detected_at', { ascending: false })
      .limit(64)
      .returns<DashboardSignalRow[]>(),
    client
      .from('price_history')
      .select('id, property_id, listing_id, old_price, new_price, change_amount, change_type, detected_at')
      .gte('detected_at', sevenDaysAgo)
      .in('change_type', ['decrease', 'price_drop'])
      .order('detected_at', { ascending: false })
      .returns<PriceHistoryRow[]>(),
  ]);

  if (activeSignalsCountResult.error) throw new Error(activeSignalsCountResult.error.message);
  if (signalsResult.error) throw new Error(signalsResult.error.message);
  if (priceDropsResult.error) throw new Error(priceDropsResult.error.message);

  const scores = Object.values(scoresByProperty) as ListingScore[];
  const signals = signalsResult.data ?? [];
  const recentPriceDrops = priceDropsResult.data ?? [];
  const propertiesById = new Map(activeProperties.map((property) => [property.supabasePropertyId as string, property]));
  const latestSignalByProperty = new Map<string, DashboardSignalRow>();

  for (const signal of signals) {
    if (!latestSignalByProperty.has(signal.property_id)) {
      latestSignalByProperty.set(signal.property_id, signal);
    }
  }

  const opportunities = activeProperties
    .map((property) => {
      const propertyId = property.supabasePropertyId as string;
      const score = scoresByProperty[propertyId];
      const signal = latestSignalByProperty.get(propertyId);
      return {
        addedAt: score?.computed_at ?? null,
        band: score?.band ?? 'faible',
        confidence: score?.confidence ?? 'faible',
        id: propertyId,
        photo: property.photos[0] ?? null,
        price: property.price,
        propertyId,
        score: score?.score ?? 0,
        signal: opportunitySignal(score, signal),
        source: property.source,
        subtitle: subtitleFor(property),
        surface: property.surface,
        title: property.title,
      };
    })
    .sort((a, b) => {
      const scoreDelta = b.score - a.score;
      if (scoreDelta !== 0) return scoreDelta;
      return a.title.localeCompare(b.title);
    })
    .slice(0, limit);

  const signalItems = signals
    .map((signal) => {
      const property = propertiesById.get(signal.property_id);
      if (!property) return null;
      return {
        id: signal.id,
        propertyId: signal.property_id,
        source: property.source,
        timeLabel: timeLabel(signal.detected_at),
        title: signalLabel(signal.signal_type),
        tone: signalTone(signal.signal_type),
        value: signalValue(signal),
      } satisfies DashboardSignalItem;
    })
    .filter((item): item is DashboardSignalItem => Boolean(item))
    .slice(0, 4);

  const distribution = scoreDistribution(scores);
  const scoreAverage = scores.length > 0
    ? Number((scores.reduce((sum, score) => sum + score.score, 0) / scores.length).toFixed(1))
    : 0;
  const lastSyncAt = scores
    .map((score) => score.computed_at)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;

  return {
    activeListingsCount: activeListings.length,
    activePropertiesCount: activeProperties.length,
    activeSignalsCount: activeSignalsCountResult.count ?? 0,
    fsboCount: activeProperties.filter((property) => property.fsbo).length,
    hotOpportunitiesCount: distribution.forte,
    lastSyncAt,
    opportunities,
    priceDropCount: recentPriceDrops.length,
    priceDropTotal: recentPriceDrops.reduce((sum, row) => sum + Math.abs(row.change_amount ?? 0), 0),
    scoreAverage,
    scoreDistribution: distribution,
    scoredPropertiesCount: scores.length,
    signals: signalItems,
  };
}
