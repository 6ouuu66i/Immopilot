import { ScoreRing } from '../components/biens/ScoreRing';

const TEST_SCORES = [25, 50, 70, 90];

export function ScoreTest() {
  return (
    <main
      style={{
        minHeight: 'calc(100vh - 58px)',
        background: 'var(--color-bg-page)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-sans, var(--notion-sans))',
        padding: 40,
      }}
    >
      <h1 style={{ margin: 0, fontFamily: 'var(--font-serif, var(--notion-serif))', fontSize: 36, fontWeight: 400 }}>
        Validation Score IA
      </h1>
      <p style={{ margin: '8px 0 28px', color: 'var(--color-text-secondary)', fontSize: 14 }}>
        Les quatre paliers doivent afficher quatre couleurs distinctes.
      </p>
      <section style={{ display: 'flex', gap: 18, alignItems: 'stretch' }}>
        {TEST_SCORES.map((score) => (
          <article
            key={score}
            style={{
              width: 154,
              border: '1px solid var(--color-border-default)',
              borderRadius: 12,
              background: 'var(--color-bg-surface)',
              boxShadow: 'var(--shadow-xs)',
              display: 'grid',
              justifyItems: 'center',
              gap: 12,
              padding: 18,
            }}
          >
            <ScoreRing score={score} size="lg" />
            <strong style={{ fontSize: 14 }}>Score {score}</strong>
          </article>
        ))}
      </section>
    </main>
  );
}
