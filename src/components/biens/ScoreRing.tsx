interface ScoreRingProps {
  score: number;
  size?: 'sm' | 'lg';
  label?: string;
}

function getScoreLevel(score: number): 'critical' | 'low' | 'medium' | 'high' {
  if (score < 30) return 'critical';
  if (score < 60) return 'low';
  if (score < 80) return 'medium';
  return 'high';
}

export function ScoreRing({ score, size = 'sm', label = 'Score IA' }: ScoreRingProps) {
  const dimension = size === 'lg' ? 80 : 40;
  const strokeWidth = size === 'lg' ? 7 : 4;
  const radius = (dimension - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const offset = circumference - (safeScore / 100) * circumference;
  const tier = getScoreLevel(safeScore);

  return (
    <span
      aria-label={`${label} ${safeScore}`}
      title={`${label} ${safeScore}`}
      style={{
        position: 'relative',
        display: 'inline-grid',
        placeItems: 'center',
        width: dimension,
        height: dimension,
        flex: `0 0 ${dimension}px`,
        color: 'var(--color-text-primary)',
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
        />
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke={`var(--color-score-ring-${tier})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 180ms ease, stroke 180ms ease' }}
        />
      </svg>
      <span
        style={{
          position: 'relative',
          zIndex: 1,
          fontFamily: 'var(--font-mono, var(--notion-mono))',
          fontSize: size === 'lg' ? 20 : 11,
          fontWeight: 700,
          lineHeight: 1,
          color: 'var(--color-text-primary)',
        }}
      >
        {safeScore}
      </span>
    </span>
  );
}
