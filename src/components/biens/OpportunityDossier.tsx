import type { ListingScore, ScoreReason } from '../../lib/services/listingScoresService';
import type { ListingSignal } from '../../lib/services/listingSignalsService';
import { listingSignalLabel, listingSignalMeta } from '../../lib/biensAssociations';
import { OpportunityScore } from './OpportunityScore';

interface OpportunityDossierProps {
  score?: ListingScore;
  fallbackScore: number;
  signals?: ListingSignal[];
  inactive?: boolean;
}

function strengthFor(contribution: number, maxContribution: number): { pct: string; level: 'strong' | 'medium' | 'weak'; label: string } {
  const ratio = maxContribution > 0 ? contribution / maxContribution : 0;
  const pct = `${Math.max(6, Math.round(ratio * 100))}%`;
  if (ratio >= 0.66) return { pct, level: 'strong', label: 'Fort' };
  if (ratio >= 0.33) return { pct, level: 'medium', label: 'Moyen' };
  return { pct, level: 'weak', label: 'Faible' };
}

/**
 * Signature "Why is this property interesting?" dossier section for the Fiche Bien.
 * Uses only existing score breakdown + signals data. Renders nothing when there is
 * no score and no signals (graceful degradation rather than invented content).
 */
export function OpportunityDossier({ score, fallbackScore, signals = [], inactive = false }: OpportunityDossierProps) {
  const hasScore = Boolean(score) || fallbackScore > 0;
  const reasons = score?.breakdown.reasons ?? [];
  const maxContribution = reasons.reduce((max, r) => Math.max(max, r.contribution), 0);
  const activeSignals = signals.filter((s) => s.is_active);
  const mainSignal = activeSignals[0];
  const supportingSignals = activeSignals.slice(1, 4);

  if (!hasScore && activeSignals.length === 0) {
    return (
      <section className="ip-opportunity-dossier" style={{ padding: '18px 2px 4px' }}>
        <h2 className="ip-dossier-title">Pourquoi ce bien est intéressant</h2>
        <p style={{ margin: '8px 0 0', color: 'var(--ip-faint, #9A9C99)', fontSize: 12.5 }}>
          Pas encore de score d'opportunité ni de signaux actifs pour ce bien.
        </p>
      </section>
    );
  }

  return (
    <section className="ip-opportunity-dossier" style={{ padding: '18px 2px 6px' }}>
      <h2 className="ip-dossier-title">Pourquoi ce bien est intéressant</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 240px) minmax(0, 1fr)', gap: 28, alignItems: 'start', marginTop: 14 }}>
        {/* Score */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '8px 0', borderRight: '1px solid var(--ip-line, #E4E4DF)' }}>
          <OpportunityScore score={score} fallbackScore={fallbackScore} size="lg" inactive={inactive} />
          {score?.confidence && (
            <span style={{ fontSize: 10.5, color: 'var(--ip-stone, #6B6F6D)', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 500 }}>
              Confiance · {score.confidence}
            </span>
          )}
        </div>

        {/* Evidence */}
        <div style={{ minWidth: 0 }}>
          {mainSignal && (
            <div style={{ marginBottom: 14 }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ip-stone, #6B6F6D)' }}>Signal principal</span>
              <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 600, color: 'var(--ip-ink, #1D1F1E)', lineHeight: 1.3 }}>
                {listingSignalLabel(mainSignal)}
              </p>
              {listingSignalMeta(mainSignal) && (
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ip-stone, #6B6F6D)' }}>{listingSignalMeta(mainSignal)}</p>
              )}
            </div>
          )}

          {supportingSignals.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ip-stone, #6B6F6D)' }}>Signaux complémentaires</span>
              <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {supportingSignals.map((signal) => (
                  <li key={signal.id} style={{ fontSize: 12.5, color: 'var(--ip-ink, #1D1F1E)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 5, height: 5, borderRadius: 99, background: 'var(--ip-ocre, #8A6D1F)', flexShrink: 0 }} />
                    {listingSignalLabel(signal)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {reasons.length > 0 && (
            <div>
              <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ip-stone, #6B6F6D)' }}>Facteurs de score</span>
              <div style={{ marginTop: 8 }}>
                {reasons.slice(0, 5).map((reason: ScoreReason, index) => {
                  const s = strengthFor(reason.contribution, maxContribution);
                  return (
                    <div
                      key={`${reason.signal}-${index}`}
                      className="ip-strength"
                      style={{
                        ['--ip-strength-pct' as string]: s.pct,
                        ['--ip-strength-color' as string]: s.level === 'strong' ? 'var(--ip-forest, #1E5A3A)' : s.level === 'medium' ? 'var(--ip-ocre, #8A6D1F)' : 'var(--ip-faint, #9A9C99)',
                      }}
                    >
                      <span className="ip-strength__label" title={reason.facts.join(', ')}>
                        {reason.reason_fr}
                      </span>
                      <span className={`ip-strength__bar`} aria-hidden="true" />
                      <span className={`ip-strength__value ip-strength__value--${s.level}`}>{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
