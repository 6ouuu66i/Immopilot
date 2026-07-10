interface ScoreRingProps {
  score: number;
  size?: 'sm' | 'lg';
  label?: string;
  strokeColor?: string;
  dashed?: boolean;
  muted?: boolean;
}

// Sémantique produit en 3 bandes, alignée sur listing_scores.band :
// ≥70 Forte (vert), 40-69 À surveiller (ambre), <40 Faible (gris neutre).
// Jamais de rouge sur un bien — le rouge est réservé aux erreurs système.
function getScoreLevel(score: number): 'low' | 'medium' | 'high' {
  if (score < 40) return 'low';
  if (score < 70) return 'medium';
  return 'high';
}

function getBandLabel(score: number): string {
  const level = getScoreLevel(score);
  if (level === 'high') return 'Forte';
  if (level === 'medium') return 'À surveiller';
  return 'Faible';
}

export function ScoreRing({
  score,
  size = 'sm',
  label = 'Score IA',
  strokeColor,
  dashed = false,
  muted = false,
}: ScoreRingProps) {
  const dimension = size === 'lg' ? 80 : 40;
  const strokeWidth = size === 'lg' ? 7 : 4;
  const radius = (dimension - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const notScored = safeScore <= 0;
  const progressLength = (safeScore / 100) * circumference;
  const tier = getScoreLevel(safeScore);
  const bandLabel = getBandLabel(safeScore);
  const ringStroke = strokeColor ?? `var(--color-score-ring-${tier})`;
  const dashArray = dashed
    ? getDashedProgress(progressLength, circumference, size)
    : `${progressLength} ${circumference}`;
  const trackOpacity = muted ? 0.45 : 1;
  const ringOpacity = muted ? 0.62 : 1;
  const textColor = notScored
    ? 'var(--color-text-tertiary)'
    : muted
      ? 'var(--color-text-secondary)'
      : 'var(--color-text-primary)';
  const accessibleLabel = notScored ? `${label} non calculé` : `${label} ${safeScore} · ${bandLabel}`;

  return (
    <span
      aria-label={accessibleLabel}
      title={accessibleLabel}
      style={{
        position: 'relative',
        display: 'inline-grid',
        placeItems: 'center',
        width: dimension,
        height: dimension,
        flex: `0 0 ${dimension}px`,
        color: textColor,
        opacity: muted ? 0.88 : 1,
      }}
    >
      <svg
        width={dimension}
        height={dimension}
        viewBox={`0 0 ${dimension} ${dimension}`}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke="var(--color-score-ring-track)"
          strokeWidth={strokeWidth}
          opacity={trackOpacity}
        />
        {!notScored && (
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            stroke={ringStroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={dashArray}
            opacity={ringOpacity}
            style={{ transition: 'stroke-dashoffset 180ms ease, stroke 180ms ease' }}
          />
        )}
      </svg>
      <span
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: size === 'lg' ? 2 : 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-sans, var(--notion-sans))',
            fontVariantNumeric: 'tabular-nums',
            fontSize: size === 'lg' ? 20 : 11,
            fontWeight: 700,
            lineHeight: 1,
            color: textColor,
          }}
        >
          {notScored ? '–' : safeScore}
        </span>
        {size === 'lg' && !notScored && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 650,
              lineHeight: 1,
              letterSpacing: '0.02em',
              color: `var(--color-score-ring-${tier})`,
              whiteSpace: 'nowrap',
            }}
          >
            {bandLabel}
          </span>
        )}
      </span>
    </span>
  );
}

function getDashedProgress(progressLength: number, circumference: number, size: 'sm' | 'lg') {
  if (progressLength <= 0) return `0 ${circumference}`;

  const dash = size === 'lg' ? 7 : 4;
  const gap = size === 'lg' ? 5 : 3;
  const segments: number[] = [];
  let remaining = progressLength;

  while (remaining > 0) {
    const nextDash = Math.min(dash, remaining);
    segments.push(nextDash);
    remaining -= nextDash;

    if (remaining <= 0) break;

    const nextGap = Math.min(gap, remaining);
    segments.push(nextGap);
    remaining -= nextGap;
  }

  if (segments.length % 2 === 0) segments.push(0);
  segments.push(Math.max(circumference - progressLength, 0));
  return segments.map((segment) => Number(segment.toFixed(2))).join(' ');
}
