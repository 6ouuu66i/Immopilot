import type { CSSProperties } from 'react';
import { CircleDollarSign, Clock3, TrendingDown, UserRound } from 'lucide-react';
import type { Json } from '../lib/database.types';
import type { ListingSignal, ListingSignalType } from '../lib/services/listingSignalsService';

interface SignalBadgesProps {
  signals: ListingSignal[];
  onSignalClick?: (signal: ListingSignal) => void;
}

type SignalTone = 'price' | 'belowMarket' | 'overpriced' | 'context' | 'behavior' | 'alert' | 'neutral';

interface SignalDefinition {
  label: string;
  tone: SignalTone;
}

const MAX_VISIBLE_SIGNALS = 3;

const SIGNAL_DEFINITIONS: Partial<Record<ListingSignalType, SignalDefinition>> = {
  price_drop: { label: 'Baisse prix', tone: 'price' },
  below_market: { label: 'Sous marche', tone: 'belowMarket' },
  overpriced: { label: 'Surcoté', tone: 'overpriced' },
  fsbo: { label: 'FSBO', tone: 'context' },
  competition_shock: { label: 'Nouvelle concurrence', tone: 'context' },
  republished: { label: 'Republie', tone: 'behavior' },
  multi_source: { label: 'Multi-source', tone: 'behavior' },
  agency_mandate_aging: { label: 'Mandat 6 mois', tone: 'behavior' },
  stale_dom_relative: { label: 'Stagnant vs marché', tone: 'behavior' },
  failed_launch: { label: 'Lancement sans traction', tone: 'behavior' },
  back_to_market: { label: 'Retour sur le marché', tone: 'alert' },
};

function SignalIcon({ tone }: { tone: SignalTone }) {
  const size = 11;
  if (tone === 'price' || tone === 'belowMarket') return <TrendingDown size={size} strokeWidth={2.2} />;
  if (tone === 'overpriced') return <CircleDollarSign size={size} strokeWidth={2.2} />;
  if (tone === 'behavior' || tone === 'alert') return <Clock3 size={size} strokeWidth={2.2} />;
  return <UserRound size={size} strokeWidth={2.2} />;
}

const TONE_STYLES: Record<SignalTone, { bg: string; text: string; border: string; dot: string }> = {
  price: {
    bg: 'var(--color-signal-price-bg)',
    text: 'var(--color-signal-price-text)',
    border: 'var(--color-signal-price-border)',
    dot: 'var(--color-brand)',
  },
  belowMarket: {
    bg: '#E8F0EB',
    text: '#1E5A3A',
    border: 'color-mix(in srgb, #1E5A3A 24%, transparent)',
    dot: '#1E5A3A',
  },
  overpriced: {
    bg: '#FAEDE9',
    text: '#B3402E',
    border: 'color-mix(in srgb, #B3402E 24%, transparent)',
    dot: '#B3402E',
  },
  context: {
    bg: 'var(--color-signal-context-bg)',
    text: 'var(--color-signal-context-text)',
    border: 'var(--color-signal-context-border)',
    dot: 'var(--color-info-dot)',
  },
  behavior: {
    bg: 'var(--color-signal-behavior-bg)',
    text: 'var(--color-signal-behavior-text)',
    border: 'var(--color-signal-behavior-border)',
    dot: 'var(--color-signal-behavior-text)',
  },
  alert: {
    bg: 'var(--color-signal-alert-bg)',
    text: 'var(--color-signal-alert-text)',
    border: 'var(--color-signal-alert-border)',
    dot: 'var(--color-warning-dot)',
  },
  neutral: {
    bg: 'var(--color-bg-muted)',
    text: 'var(--color-text-secondary)',
    border: 'var(--color-border-default)',
    dot: 'var(--color-text-tertiary)',
  },
};

const FALLBACK_DEFINITION: SignalDefinition = { label: 'Signal', tone: 'neutral' };

const containerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 5,
  minHeight: 22,
};

function isRecord(value: Json): value is Record<string, Json | undefined> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberFromMetadata(metadata: Json, key: string): number | null {
  if (!isRecord(metadata)) return null;
  const value = metadata[key];
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function stringFromMetadata(metadata: Json, key: string): string | null {
  if (!isRecord(metadata)) return null;
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function formatPercent(value: number) {
  return `${Math.abs(value).toLocaleString('fr-BE', { maximumFractionDigits: 1 })}%`;
}

function formatSignedPercent(value: number) {
  return `${value.toLocaleString('fr-BE', { maximumFractionDigits: 1 })}%`;
}

function formatOrdinalPercentile(value: number) {
  const percentile = value <= 1 ? value * 100 : value;
  return `${Math.round(percentile).toLocaleString('fr-BE')}e percentile`;
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fallbackMetadata(metadata: Json) {
  if (!isRecord(metadata) || Object.keys(metadata).length === 0) return 'Signal actif';
  return JSON.stringify(metadata);
}

function definitionFor(signalType: ListingSignalType): SignalDefinition {
  return SIGNAL_DEFINITIONS[signalType] ?? FALLBACK_DEFINITION;
}

function tooltipFor(signal: ListingSignal) {
  const metadata = signal.metadata;

  if (signal.signal_type === 'price_drop') {
    const change = numberFromMetadata(metadata, 'change_percentage');
    return change === null ? fallbackMetadata(metadata) : `Baisse de ${formatPercent(change)}`;
  }

  if (signal.signal_type === 'below_market') {
    const diff = numberFromMetadata(metadata, 'diff_percentage');
    const median = numberFromMetadata(metadata, 'median_price_per_m2');
    if (diff === null) return fallbackMetadata(metadata);
    return median === null
      ? `${formatPercent(diff)} sous la mediane locale`
      : `${formatPercent(diff)} sous la mediane locale (${Math.round(median).toLocaleString('fr-BE')} EUR/m2)`;
  }

  if (signal.signal_type === 'overpriced') {
    const diff = numberFromMetadata(metadata, 'diff_percentage');
    const median = numberFromMetadata(metadata, 'median_price_per_m2');
    if (diff === null) return fallbackMetadata(metadata);
    return median === null
      ? `${formatSignedPercent(diff)} au-dessus de la mediane locale`
      : `${formatSignedPercent(diff)} au-dessus de la mediane locale (${Math.round(median).toLocaleString('fr-BE')} EUR/m2)`;
  }

  if (signal.signal_type === 'fsbo') return 'Annonce particulier active';

  if (signal.signal_type === 'competition_shock') {
    const count = numberFromMetadata(metadata, 'new_competitor_count');
    const windowDays = numberFromMetadata(metadata, 'window_days') ?? 14;
    return count === null
      ? fallbackMetadata(metadata)
      : `${count} nouveaux concurrents comparables sur ${windowDays} jours`;
  }

  if (signal.signal_type === 'republished') {
    const eventAt = formatDate(stringFromMetadata(metadata, 'event_at'));
    return eventAt ? `Republication detectee le ${eventAt}` : fallbackMetadata(metadata);
  }

  if (signal.signal_type === 'multi_source') {
    const count = numberFromMetadata(metadata, 'source_count');
    return count === null ? fallbackMetadata(metadata) : `${count} sources actives pour ce bien`;
  }

  if (signal.signal_type === 'agency_mandate_aging') {
    const days = numberFromMetadata(metadata, 'days_on_market');
    const publishedAt = formatDate(stringFromMetadata(metadata, 'published_at'));
    const firstSeen = formatDate(stringFromMetadata(metadata, 'first_seen_at'));
    const since = publishedAt ?? firstSeen;
    if (days === null) return fallbackMetadata(metadata);
    return since ? `${days} jours en ligne depuis le ${since}` : `${days} jours en ligne`;
  }

  if (signal.signal_type === 'stale_dom_relative') {
    const days = numberFromMetadata(metadata, 'days_on_market');
    const percentile = numberFromMetadata(metadata, 'dom_percentile');
    const count = numberFromMetadata(metadata, 'comparable_count');
    if (days === null || percentile === null) return fallbackMetadata(metadata);
    return count === null
      ? `${days} jours en ligne, ${formatOrdinalPercentile(percentile)} du segment`
      : `${days} jours en ligne, ${formatOrdinalPercentile(percentile)} sur ${count} comparables`;
  }

  if (signal.signal_type === 'failed_launch') {
    const days = numberFromMetadata(metadata, 'days_on_market');
    return days === null
      ? fallbackMetadata(metadata)
      : `${days} jours en ligne sans baisse de prix ni option active`;
  }

  if (signal.signal_type === 'back_to_market') {
    const detectedAt = formatDate(stringFromMetadata(metadata, 'detected_at') ?? signal.detected_at);
    return detectedAt
      ? `Sortie d'option detectee le ${detectedAt}`
      : "Sortie d'option detectee";
  }

  return fallbackMetadata(metadata);
}

export function SignalBadges({ signals, onSignalClick }: SignalBadgesProps) {
  if (signals.length === 0) return null;

  const visibleSignals = signals.slice(0, MAX_VISIBLE_SIGNALS);
  const hiddenSignals = signals.slice(MAX_VISIBLE_SIGNALS);
  const hiddenTitle = hiddenSignals
    .map((signal) => `${definitionFor(signal.signal_type).label}: ${tooltipFor(signal)}`)
    .join('\n');

  return (
    <div style={containerStyle} aria-label="Signaux actifs">
      {visibleSignals.map((signal) => {
        const definition = definitionFor(signal.signal_type);
        const tone = TONE_STYLES[definition.tone];

        return (
          <button
            key={signal.id}
            type="button"
            title={tooltipFor(signal)}
            onClick={(event) => {
              if (!onSignalClick) return;
              event.stopPropagation();
              onSignalClick(signal);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              maxWidth: '100%',
              borderRadius: 0,
              border: `1px solid ${tone.border}`,
              background: tone.bg,
              color: tone.text,
              padding: '3px 7px',
              fontSize: 10.5,
              fontWeight: 680,
              fontFamily: 'var(--lv-font-mono, var(--notion-mono))',
              lineHeight: 1.15,
              whiteSpace: 'nowrap',
              cursor: onSignalClick ? 'pointer' : 'default',
            }}
          >
            <SignalIcon tone={definition.tone} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{definition.label}</span>
          </button>
        );
      })}
      {hiddenSignals.length > 0 ? (
        <span
          title={hiddenTitle}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 0,
            border: `1px solid ${TONE_STYLES.neutral.border}`,
            background: TONE_STYLES.neutral.bg,
            color: TONE_STYLES.neutral.text,
            padding: '3px 7px',
            fontSize: 10.5,
            fontWeight: 700,
            fontFamily: 'var(--lv-font-mono, var(--notion-mono))',
            lineHeight: 1.15,
            whiteSpace: 'nowrap',
          }}
        >
          +{hiddenSignals.length}
        </span>
      ) : null}
    </div>
  );
}
