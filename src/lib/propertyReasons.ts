import type { Json } from './database.types';
import type { ListingScore } from './services/listingScoresService';
import type { ListingSignal } from './services/listingSignalsService';
import type { Property } from '../types';

export type PropertyReasonKind = 'price' | 'seller' | 'longevity' | 'market' | 'competition' | 'score';

export interface PropertyReason {
  kind: PropertyReasonKind;
  title: string;
  description: string;
}

export interface BuildPropertyReasonsInput {
  property: Pick<Property, 'fsbo' | 'price' | 'priceHistory' | 'publishedDays'>;
  signals?: ListingSignal[];
  score?: ListingScore;
  now?: Date;
}

interface RankedReason extends PropertyReason {
  priority: number;
}

function metadataRecord(metadata: Json): Record<string, Json> {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata as Record<string, Json>
    : {};
}

function metadataNumber(metadata: Json, ...keys: string[]): number | null {
  const record = metadataRecord(metadata);
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function formatPercent(value: number): string {
  return `${Math.abs(value).toLocaleString('fr-BE', { maximumFractionDigits: 1 })} %`;
}

function formatPrice(value: number): string {
  return `${Math.round(value).toLocaleString('fr-BE')} €`;
}

function formatDate(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function elapsedDays(value: string, now: Date): number | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

function detectionSuffix(signal: ListingSignal, now: Date): string {
  const days = elapsedDays(signal.detected_at, now);
  if (days === null) return '';
  if (days === 0) return " aujourd’hui";
  return ` il y a ${days} jour${days > 1 ? 's' : ''}`;
}

function priceReason(
  property: BuildPropertyReasonsInput['property'],
  signals: ListingSignal[],
  now: Date,
): RankedReason | null {
  const signal = signals.find((item) => item.signal_type === 'price_drop');
  const history = property.priceHistory.filter((entry) => Number.isFinite(entry.price) && entry.price > 0);
  const previous = history.length > 1 ? history[history.length - 2].price : null;
  const current = history.length > 1 ? history[history.length - 1].price : property.price;
  const hasHistoryDrop = previous !== null && current > 0 && previous > current;

  if (!signal && !hasHistoryDrop) return null;

  const dropCount = signal ? metadataNumber(signal.metadata, 'price_drop_count', 'drop_count', 'change_count') : null;
  const metadataPrevious = signal ? metadataNumber(signal.metadata, 'old_price', 'previous_price') : null;
  const metadataCurrent = signal ? metadataNumber(signal.metadata, 'new_price', 'current_price') : null;
  const oldPrice = hasHistoryDrop ? previous : metadataPrevious;
  const newPrice = hasHistoryDrop ? current : metadataCurrent;
  const calculatedPercent = oldPrice && newPrice && oldPrice > newPrice
    ? ((oldPrice - newPrice) / oldPrice) * 100
    : null;
  const metadataPercent = signal ? metadataNumber(signal.metadata, 'change_percentage', 'delta_pct', 'price_variation_pct') : null;
  const percent = calculatedPercent ?? metadataPercent;
  const suffix = signal ? detectionSuffix(signal, now) : '';

  let description = 'Une baisse de prix active a été détectée.';
  if (oldPrice && newPrice && oldPrice > newPrice) {
    description = `Le prix est passé de ${formatPrice(oldPrice)} à ${formatPrice(newPrice)}${percent !== null ? `, soit -${formatPercent(percent)}` : ''}${suffix}.`;
  } else if (percent !== null) {
    description = `Le prix a diminué de ${formatPercent(percent)}${suffix}.`;
  } else if (signal) {
    const detectedAt = formatDate(signal.detected_at);
    if (detectedAt) description = `Une baisse de prix a été détectée le ${detectedAt}.`;
  }

  return {
    kind: 'price',
    priority: 10,
    title: dropCount !== null && dropCount >= 2 ? 'Plusieurs baisses de prix' : 'Baisse de prix récente',
    description,
  };
}

function longevityReason(property: BuildPropertyReasonsInput['property'], signals: ListingSignal[]): RankedReason | null {
  const orderedTypes = ['republished', 'failed_launch', 'stale_dom_relative', 'agency_mandate_aging'];
  const signal = orderedTypes
    .map((type) => signals.find((item) => item.signal_type === type))
    .find(Boolean);

  if (signal?.signal_type === 'republished') {
    const eventAt = metadataRecord(signal.metadata).event_at;
    const date = typeof eventAt === 'string' ? formatDate(eventAt) : formatDate(signal.detected_at);
    return {
      kind: 'longevity',
      priority: 30,
      title: 'Annonce republiée',
      description: date ? `Une republication a été détectée le ${date}.` : 'Une republication active a été détectée.',
    };
  }

  const signalDays = signal ? metadataNumber(signal.metadata, 'days_on_market') : null;
  const days = signalDays ?? (property.publishedDays >= 60 ? property.publishedDays : null);
  if (days === null) return null;

  if (signal?.signal_type === 'failed_launch') {
    return {
      kind: 'longevity',
      priority: 31,
      title: 'Lancement sans traction',
      description: `${Math.round(days)} jours en ligne sans baisse de prix ni option active.`,
    };
  }

  if (signal?.signal_type === 'stale_dom_relative') {
    const percentile = metadataNumber(signal.metadata, 'dom_percentile');
    const percentileValue = percentile === null ? null : Math.round(percentile <= 1 ? percentile * 100 : percentile);
    return {
      kind: 'longevity',
      priority: 32,
      title: `En ligne depuis ${Math.round(days)} jours`,
      description: percentileValue === null
        ? `L’annonce est active depuis ${Math.round(days)} jours.`
        : `Cette durée se situe au ${percentileValue}e percentile de son segment.`,
    };
  }

  return {
    kind: 'longevity',
    priority: 33,
    title: signal?.signal_type === 'agency_mandate_aging' ? 'Vieillissement du mandat' : `En ligne depuis ${Math.round(days)} jours`,
    description: `L’annonce est active depuis ${Math.round(days)} jours.`,
  };
}

function marketReason(signals: ListingSignal[]): RankedReason | null {
  const signal = signals.find((item) => item.signal_type === 'below_market' || item.signal_type === 'overpriced');
  if (!signal) return null;
  const diff = metadataNumber(signal.metadata, 'diff_percentage', 'gap_pct', 'overpricing_pct');
  if (diff === null) return null;
  const below = signal.signal_type === 'below_market';
  return {
    kind: 'market',
    priority: 50,
    title: below ? 'Prix sous le marché' : 'Prix au-dessus du marché',
    description: `Le prix est estimé à ${formatPercent(diff)} ${below ? 'sous' : 'au-dessus de'} la médiane locale.`,
  };
}

function competitionReason(signals: ListingSignal[]): RankedReason | null {
  const signal = signals.find((item) => item.signal_type === 'competition_shock');
  if (!signal) return null;
  const count = metadataNumber(signal.metadata, 'new_competitor_count');
  if (count === null) return null;
  const windowDays = metadataNumber(signal.metadata, 'window_days');
  return {
    kind: 'competition',
    priority: 40,
    title: 'Pression concurrentielle',
    description: `${Math.round(count)} nouveau${count > 1 ? 'x' : ''} bien${count > 1 ? 's' : ''} comparable${count > 1 ? 's' : ''}${windowDays === null ? '' : ` en ${Math.round(windowDays)} jours`}.`,
  };
}

export function buildPropertyReasons({ property, signals = [], score, now = new Date() }: BuildPropertyReasonsInput): PropertyReason[] {
  const activeSignals = signals.filter((signal) => signal.is_active);
  const ranked: RankedReason[] = [];
  const price = priceReason(property, activeSignals, now);
  if (price) ranked.push(price);

  if (property.fsbo || activeSignals.some((signal) => signal.signal_type === 'fsbo')) {
    ranked.push({
      kind: 'seller',
      priority: 20,
      title: 'Vendeur particulier',
      description: 'Aucune agence n’est identifiée sur l’annonce.',
    });
  }

  const longevity = longevityReason(property, activeSignals);
  if (longevity) ranked.push(longevity);
  const competition = competitionReason(activeSignals);
  if (competition) ranked.push(competition);
  const market = marketReason(activeSignals);
  if (market) ranked.push(market);

  if (score && score.score >= 75) {
    ranked.push({
      kind: 'score',
      priority: 60,
      title: 'Forte opportunité commerciale',
      description: `Seller score ${Math.round(score.score)}/100, avec une confiance ${score.confidence}.`,
    });
  }

  const seenKinds = new Set<PropertyReasonKind>();
  return ranked
    .sort((a, b) => a.priority - b.priority)
    .filter((reason) => {
      if (seenKinds.has(reason.kind)) return false;
      seenKinds.add(reason.kind);
      return true;
    })
    .slice(0, 3)
    .map(({ priority: _priority, ...reason }) => reason);
}
