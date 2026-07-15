import type { Json } from './database.types';
import type { ListingScore } from './services/listingScoresService';

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
  canonicalRefreshedAt: string | null;
  fsboCount: number;
  hotOpportunitiesCount: number;
  lastListingSeenAt: string | null;
  lastPipelineSuccessAt: string | null;
  lastScoresComputedAt: string | null;
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

function invalidResponse(field: string): never {
  throw new Error(`Reponse Dashboard invalide: champ ${field} manquant ou incorrect.`);
}

function recordValue(value: Json | undefined, field: string): Record<string, Json> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidResponse(field);
  return value as Record<string, Json>;
}

function numberValue(value: Json | undefined, field: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return invalidResponse(field);
}

function stringValue(value: Json | undefined, field: string, allowEmpty = true): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) invalidResponse(field);
  return value;
}

function nullableStringValue(value: Json | undefined, field: string): string | null {
  if (value === null) return null;
  return stringValue(value, field);
}

function nullableNumberValue(value: Json | undefined, field: string): number | null {
  return value === null ? null : numberValue(value, field);
}

function arrayValue(value: Json | undefined, field: string): Json[] {
  if (!Array.isArray(value)) invalidResponse(field);
  return value;
}

function booleanValue(value: Json | undefined, field: string): boolean {
  if (typeof value !== 'boolean') invalidResponse(field);
  return value;
}

function scoreBand(value: Json | undefined, field: string): DashboardOpportunity['band'] {
  if (value === 'forte' || value === 'surveiller' || value === 'faible') return value;
  return invalidResponse(field);
}

function scoreConfidence(value: Json | undefined, field: string): DashboardOpportunity['confidence'] {
  if (value === 'haute' || value === 'moyenne' || value === 'faible') return value;
  return invalidResponse(field);
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
  const row = recordValue(value, 'opportunities[]');
  const propertyId = nullableStringValue(row.propertyId, 'opportunities[].propertyId');

  return {
    addedAt: stringValue(row.addedAt, 'opportunities[].addedAt', false),
    band: scoreBand(row.band, 'opportunities[].band'),
    confidence: scoreConfidence(row.confidence, 'opportunities[].confidence'),
    id: stringValue(row.id, 'opportunities[].id', false),
    photo: nullableStringValue(row.photo, 'opportunities[].photo'),
    price: nullableNumberValue(row.price, 'opportunities[].price'),
    propertyId,
    score: numberValue(row.score, 'opportunities[].score'),
    signal: stringValue(row.signal, 'opportunities[].signal', false),
    source: stringValue(row.source, 'opportunities[].source', false),
    subtitle: stringValue(row.subtitle, 'opportunities[].subtitle'),
    surface: nullableNumberValue(row.surface, 'opportunities[].surface'),
    title: stringValue(row.title, 'opportunities[].title', false),
  };
}

function mapSignalRow(value: Json): DashboardRpcSignalRow {
  const row = recordValue(value, 'signals[]');

  return {
    detected_at: stringValue(row.detected_at, 'signals[].detected_at', false),
    id: stringValue(row.id, 'signals[].id', false),
    is_active: booleanValue(row.is_active, 'signals[].is_active'),
    listing_id: stringValue(row.listing_id, 'signals[].listing_id', false),
    metadata: row.metadata ?? {},
    property_id: stringValue(row.property_id, 'signals[].property_id', false),
    signal_type: stringValue(row.signal_type, 'signals[].signal_type', false),
    source: stringValue(row.source, 'signals[].source', false),
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

export function parseDashboardSnapshot(value: Json): DashboardSnapshot {
  const snapshot = recordValue(value, 'root');
  const distribution = recordValue(snapshot.score_distribution, 'score_distribution');

  return {
    activeListingsCount: numberValue(snapshot.active_listings_count, 'active_listings_count'),
    activePropertiesCount: numberValue(snapshot.active_properties_count, 'active_properties_count'),
    activeSignalsCount: numberValue(snapshot.active_signals_count, 'active_signals_count'),
    canonicalRefreshedAt: nullableStringValue(snapshot.canonical_refreshed_at, 'canonical_refreshed_at'),
    fsboCount: numberValue(snapshot.fsbo_count, 'fsbo_count'),
    hotOpportunitiesCount: numberValue(snapshot.hot_opportunities_count, 'hot_opportunities_count'),
    lastListingSeenAt: nullableStringValue(snapshot.last_listing_seen_at, 'last_listing_seen_at'),
    lastPipelineSuccessAt: nullableStringValue(snapshot.last_pipeline_success_at, 'last_pipeline_success_at'),
    lastScoresComputedAt: nullableStringValue(snapshot.last_scores_computed_at, 'last_scores_computed_at'),
    opportunities: arrayValue(snapshot.opportunities, 'opportunities').map(mapOpportunity),
    priceDropCount: numberValue(snapshot.price_drop_count, 'price_drop_count'),
    priceDropTotal: numberValue(snapshot.price_drop_total, 'price_drop_total'),
    scoreAverage: numberValue(snapshot.score_average, 'score_average'),
    scoreDistribution: {
      faible: numberValue(distribution.faible, 'score_distribution.faible'),
      forte: numberValue(distribution.forte, 'score_distribution.forte'),
      surveiller: numberValue(distribution.surveiller, 'score_distribution.surveiller'),
    },
    scoredPropertiesCount: numberValue(snapshot.scored_properties_count, 'scored_properties_count'),
    signals: arrayValue(snapshot.signals, 'signals').map(mapSignalRow).map(mapSignalItem),
  };
}
