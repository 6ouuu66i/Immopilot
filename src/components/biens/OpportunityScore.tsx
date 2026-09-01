import type { ListingScore } from '../../lib/services/listingScoresService';

type Band = 'forte' | 'surveiller' | 'faible' | 'unknown';

interface OpportunityScoreProps {
  /** ListingScore from the backend, or undefined. */
  score?: ListingScore;
  /** Fallback numeric score from the property record. */
  fallbackScore: number;
  size?: 'compact' | 'lg';
  /** When the property is off-market / archived. */
  inactive?: boolean;
}

function resolveBand(score?: ListingScore, fallback?: number): { band: Band; value: number } {
  if (score?.band === 'forte') return { band: 'forte', value: score.score };
  if (score?.band === 'surveiller') return { band: 'surveiller', value: score.score };
  const value = score?.score ?? fallback ?? 0;
  if (!value || value <= 0) return { band: 'unknown', value: 0 };
  if (value >= 75) return { band: 'forte', value };
  if (value >= 52) return { band: 'surveiller', value };
  return { band: 'faible', value };
}

const BAND_LABEL: Record<Band, string> = {
  forte: 'Forte opportunité',
  surveiller: 'À surveiller',
  faible: 'Faible priorité',
  unknown: 'Non noté',
};

const BAND_COLOR: Record<Band, string> = {
  forte: 'var(--ip-forest)',
  surveiller: 'var(--ip-ocre)',
  faible: 'var(--ip-faint)',
  unknown: 'var(--ip-faint)',
};

/**
 * Sophisticated opportunity-score treatment: strong numerical typography,
 * contextual band label, and a restrained scale bar. Replaces the generic
 * circular progress indicator. Uses only existing score data — never invents.
 */
export function OpportunityScore({ score, fallbackScore, size = 'compact', inactive = false }: OpportunityScoreProps) {
  const { band, value } = resolveBand(score, fallbackScore);
  const displayBand = inactive ? 'unknown' : band;
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  const pct = `${safeValue}%`;
  const color = inactive ? 'var(--ip-faint)' : BAND_COLOR[displayBand];

  return (
    <div
      className={`ip-score ip-score--${size}`}
      style={{ ['--ip-score-pct' as string]: pct, ['--ip-score-color' as string]: color }}
      role="img"
      aria-label={`Score d'opportunité ${safeValue || 'non noté'} sur 100, ${BAND_LABEL[displayBand]}`}
    >
      <div className="ip-score__head">
        <span className={`ip-score__num ip-score__num--${displayBand}`}>
          {safeValue > 0 ? safeValue : '–'}
        </span>
        <span className="ip-score__max">/100</span>
      </div>
      <span className={`ip-score__band ip-score__band--${displayBand}`}>{BAND_LABEL[displayBand]}</span>
      <span className="ip-score__scale" aria-hidden="true" />
    </div>
  );
}
