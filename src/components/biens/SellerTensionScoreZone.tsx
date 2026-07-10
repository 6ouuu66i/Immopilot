import type { ListingSignal } from '../../lib/services/listingSignalsService';
import type { ListingScore, ScoreReason } from '../../lib/services/listingScoresService';
import { ScoreRing } from './ScoreRing';

interface SellerTensionScoreZoneProps {
  score?: ListingScore;
  fallbackScore: number;
  size?: 'compact' | 'panel';
  signals?: ListingSignal[];
  isInactive?: boolean;
}

const BAND_COLOR: Record<string, string> = {
  forte: '#1E5A3A',
  surveiller: '#8A6D1F',
  faible: '#9AA09B',
};

const MANDATE_LABELS: Record<string, string> = {
  monitor: 'Mandat a suivre',
  watchlist_sortie_probable: 'Sortie probable',
  activable_sous_verification: 'Activable sous verification',
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function mandateStatus(signal: ListingSignal | undefined): string | null {
  if (!signal) return null;
  const metadata = asRecord(signal.metadata);
  const candidates = [
    metadata.status,
    metadata.state,
    metadata.mandate_status,
    metadata.aging_status,
    metadata.category,
  ];
  const found = candidates.find((value) => typeof value === 'string' && value.length > 0);
  return typeof found === 'string' ? found : null;
}

function firstMandateSignal(signals: ListingSignal[]) {
  return signals.find((signal) => signal.signal_type === 'agency_mandate_aging' && signal.is_active);
}

function shortReasons(score: ListingScore | undefined) {
  return score?.breakdown.reasons.slice(0, 2) ?? [];
}

function reasonText(reason: ScoreReason) {
  if (reason.facts.length === 0) return reason.reason_fr;
  return `${reason.reason_fr} (${reason.facts.slice(0, 2).join(', ')})`;
}

function formatDate(value: string | undefined) {
  if (!value) return '';
  return new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

export function SellerTensionScoreZone({
  score,
  fallbackScore,
  size = 'compact',
  signals = [],
  isInactive = false,
}: SellerTensionScoreZoneProps) {
  const numericScore = score?.score ?? fallbackScore;
  const band = score?.band ?? 'faible';
  const confidence = score?.confidence ?? 'faible';
  const isLowConfidence = confidence === 'faible';
  const ringColor = isInactive ? '#9AA09B' : BAND_COLOR[band] ?? '#9AA09B';
  const mandate = firstMandateSignal(signals);
  const mandateValue = mandateStatus(mandate);
  const reasons = shortReasons(score);
  const ringSize = size === 'panel' ? 'lg' : 'sm';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: size === 'panel' ? '86px minmax(0, 1fr)' : '44px minmax(0, 1fr)',
        gap: size === 'panel' ? 12 : 8,
        alignItems: 'center',
        minWidth: 0,
      }}
    >
      <ScoreRing
        score={numericScore}
        size={ringSize}
        label="Indice de tension vendeur"
        strokeColor={ringColor}
        dashed={isLowConfidence || isInactive}
        muted={isInactive}
      />

      <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
        {isInactive ? (
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 11.5, lineHeight: 1.35 }}>
            Derniere evaluation le {formatDate(score?.computed_at)} - bien retire du marche
          </span>
        ) : reasons.length > 0 ? (
          <div
            title={reasons.map(reasonText).join(' · ')}
            style={{
              color: 'var(--color-text-primary)',
              fontSize: size === 'panel' ? 12 : 10.5,
              fontWeight: 650,
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: size === 'panel' ? 'normal' : 'nowrap',
            }}
          >
            {reasons.map((reason, index) => (
              <span key={`${reason.signal}-${index}`}>
                <span>{reason.reason_fr}</span>
                {reason.facts.length > 0 && (
                  <span style={{ fontFamily: 'var(--font-mono, var(--notion-mono))' }}> {reason.facts[0]}</span>
                )}
                {index < reasons.length - 1 && <span style={{ color: 'var(--color-text-tertiary)' }}> · </span>}
              </span>
            ))}
          </div>
        ) : (
          <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11.5 }}>Pas encore de score</span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 10.5 }}>
            Confiance : {confidence}
          </span>
          {isLowConfidence && (
            <span style={{ color: 'var(--color-text-secondary)', fontSize: 10.5, fontWeight: 650 }}>
              Données partielles
            </span>
          )}
          {mandateValue && mandateValue !== 'monitor' && (
            <span
              style={{
                border: `1px solid ${mandateValue === 'activable_sous_verification' ? '#1E5A3A' : '#8A6D1F'}`,
                color: 'var(--color-text-primary)',
                background: 'var(--color-bg-surface)',
                borderRadius: 0,
                padding: '2px 5px',
                fontSize: 10,
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              {MANDATE_LABELS[mandateValue] ?? mandateValue}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
