import type { Json } from '../database.types';
import { supabase } from '../supabase';
import type { ListingScore } from './listingScoresService';

interface DashboardSignalRow {
  detected_at: string;
  id: string;
  is_active: boolean;
  listing_id: string;
  metadata: Json;
  property_id: string;
  signal_type: string;
}

interface DashboardRpcSignalRow extends DashboardSignalRow {
  source: string;
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

function asRecord(value: Json | undefined): Record<string, Json> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, Json> : {};
}

function asArray(value: Json | undefined): Json[] {
  return Array.isArray(value) ? value : [];
}

function numberValue(value: Json | undefined): number {
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

function nullableStringValue(value: Json | undefined): string | null {
  const parsed = stringValue(value);
  return parsed || null;
}

function nullableNumberValue(value: Json | undefined): number | null {
  return value === null || value === undefined ? null : numberValue(value);
}

function scoreBand(value: Json | undefined): DashboardOpportunity['band'] {
  return value === 'forte' || value === 'surveiller' || value === 'faible' ? value : 'faible';
}

function scoreConfidence(value: Json | undefined): DashboardOpportunity['confidence'] {
  return value === 'haute' || value === 'moyenne' || value === 'faible' ? value : 'faible';
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
    case 'republished': return 'Annonce republiée';
    case 'below_market': return 'Sous le marché';
    case 'multi_source': return 'Multi-source';
    case 'agency_mandate_aging': return 'Mandat agence ancien';
    case 'overpriced': return 'Surcoté';
    case 'stale_dom_relative': return 'Temps en ligne élevé';
    case 'failed_launch': return 'Lancement faible';
    case 'competition_shock': return 'Concurrence en hausse';
    case 'back_to_market': return 'Retour marché';
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
  if (typeof amount === 'number') return `${amount > 0 ? '+' : ''}${Math.round(amount)} €`;
  if (typeof amount === 'string' && amount.trim()) return amount;

  // Jamais de valeur technique (detected_via, slugs de batch) face à l'agent :
  // à défaut d'une donnée chiffrée lisible, on retombe sur le libellé du signal.
  const label = metadata.label ?? metadata.reason_fr;
  if (typeof label === 'string' && label.trim()) return label;

  return signalLabel(signal.signal_type);
}

function timeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
}

function mapOpportunity(value: Json): DashboardOpportunity {
  const row = asRecord(value);
  const propertyId = nullableStringValue(row.propertyId);

  return {
    addedAt: stringValue(row.addedAt),
    band: scoreBand(row.band),
    confidence: scoreConfidence(row.confidence),
    id: stringValue(row.id) || propertyId || '',
    photo: nullableStringValue(row.photo),
    price: nullableNumberValue(row.price),
    propertyId,
    score: numberValue(row.score),
    signal: stringValue(row.signal) || 'Aucun signal score',
    source: stringValue(row.source),
    subtitle: stringValue(row.subtitle),
    surface: nullableNumberValue(row.surface),
    title: stringValue(row.title) || 'Bien sans titre',
  };
}

function mapSignalRow(value: Json): DashboardRpcSignalRow {
  const row = asRecord(value);

  return {
    detected_at: stringValue(row.detected_at),
    id: stringValue(row.id),
    is_active: row.is_active === true,
    listing_id: stringValue(row.listing_id),
    metadata: row.metadata ?? {},
    property_id: stringValue(row.property_id),
    signal_type: stringValue(row.signal_type),
    source: stringValue(row.source),
  };
}

function mapSignalItem(signal: DashboardRpcSignalRow): DashboardSignalItem {
  return {
    id: signal.id,
    propertyId: signal.property_id,
    source: signal.source,
    timeLabel: timeLabel(signal.detected_at),
    title: signalLabel(signal.signal_type),
    tone: signalTone(signal.signal_type),
    value: signalValue(signal),
  };
}

export async function getDashboardSnapshot(limit = 8): Promise<DashboardSnapshot> {
  const client = assertSupabase();
  const { data, error } = await client.rpc('get_dashboard_snapshot', { p_opportunities_limit: limit });
  if (error) throw new Error(error.message);

  const snapshot = asRecord(data ?? {});
  const distribution = asRecord(snapshot.score_distribution);

  return {
    activeListingsCount: numberValue(snapshot.active_listings_count),
    activePropertiesCount: numberValue(snapshot.active_properties_count),
    activeSignalsCount: numberValue(snapshot.active_signals_count),
    fsboCount: numberValue(snapshot.fsbo_count),
    hotOpportunitiesCount: numberValue(snapshot.hot_opportunities_count),
    lastSyncAt: nullableStringValue(snapshot.last_sync_at),
    opportunities: asArray(snapshot.opportunities).map(mapOpportunity),
    priceDropCount: numberValue(snapshot.price_drop_count),
    priceDropTotal: numberValue(snapshot.price_drop_total),
    scoreAverage: numberValue(snapshot.score_average),
    scoreDistribution: {
      faible: numberValue(distribution.faible),
      forte: numberValue(distribution.forte),
      surveiller: numberValue(distribution.surveiller),
    },
    scoredPropertiesCount: numberValue(snapshot.scored_properties_count),
    signals: asArray(snapshot.signals).map(mapSignalRow).map(mapSignalItem),
  };
}
