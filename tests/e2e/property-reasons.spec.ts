import { expect, test } from '@playwright/test';
import { buildPropertyReasons } from '../../src/lib/propertyReasons';
import type { ListingScore } from '../../src/lib/services/listingScoresService';
import type { ListingSignal, ListingSignalType } from '../../src/lib/services/listingSignalsService';
import type { Property } from '../../src/types';

const NOW = new Date('2026-07-12T12:00:00.000Z');

function property(overrides: Partial<Pick<Property, 'fsbo' | 'price' | 'priceHistory' | 'publishedDays'>> = {}) {
  return {
    fsbo: false,
    price: 300_000,
    priceHistory: [{ date: '2026-07-01', price: 300_000 }],
    publishedDays: 10,
    ...overrides,
  };
}

function signal(signalType: ListingSignalType, metadata: ListingSignal['metadata'] = {}, id = signalType): ListingSignal {
  return {
    id,
    property_id: 'property-1',
    listing_id: 'listing-1',
    signal_type: signalType,
    metadata,
    detected_at: '2026-07-06T12:00:00.000Z',
    is_active: true,
  };
}

function strongScore(): ListingScore {
  return {
    property_id: 'property-1',
    score: 82,
    raw_score: 82,
    band: 'forte',
    confidence: 'haute',
    confidence_score: 90,
    confidence_detail: {},
    breakdown: { reasons: [], informational: [], excluded: [], raw: {} },
    families_count: 3,
    signals_count: 4,
    score_version: 1,
    computed_at: NOW.toISOString(),
  };
}

test('classe baisse de prix, particulier et anciennete dans cet ordre', () => {
  const reasons = buildPropertyReasons({
    property: property({
      fsbo: true,
      publishedDays: 64,
      price: 282_600,
      priceHistory: [
        { date: '2026-06-01', price: 300_000 },
        { date: '2026-07-06', price: 282_600 },
      ],
    }),
    signals: [signal('price_drop', { change_percentage: -5.8 })],
    now: NOW,
  });

  expect(reasons.map((reason) => reason.kind)).toEqual(['price', 'seller', 'longevity']);
});

test('retourne un etat vide lorsqu’aucun signal fiable n’existe', () => {
  expect(buildPropertyReasons({ property: property(), now: NOW })).toEqual([]);
});

test('limite la liste aux trois raisons les plus prioritaires', () => {
  const reasons = buildPropertyReasons({
    property: property({ fsbo: true, publishedDays: 90, priceHistory: [{ date: '2026-07-01', price: 300_000 }, { date: '2026-07-06', price: 280_000 }] }),
    signals: [
      signal('price_drop', { change_percentage: -6.7 }),
      signal('republished', { event_at: '2026-07-05T00:00:00.000Z' }),
      signal('competition_shock', { new_competitor_count: 4, window_days: 14 }),
      signal('below_market', { diff_percentage: -8 }),
    ],
    score: strongScore(),
    now: NOW,
  });

  expect(reasons).toHaveLength(3);
  expect(reasons.map((reason) => reason.kind)).toEqual(['price', 'seller', 'longevity']);
});

test('deduplique les signaux qui decrivent le meme phenomene', () => {
  const reasons = buildPropertyReasons({
    property: property({ publishedDays: 100 }),
    signals: [
      signal('price_drop', { change_percentage: -4 }, 'drop-1'),
      signal('price_drop', { change_percentage: -4 }, 'drop-2'),
      signal('failed_launch', { days_on_market: 100 }),
      signal('stale_dom_relative', { days_on_market: 100, dom_percentile: 0.9 }),
    ],
    now: NOW,
  });

  expect(reasons.filter((reason) => reason.kind === 'price')).toHaveLength(1);
  expect(reasons.filter((reason) => reason.kind === 'longevity')).toHaveLength(1);
});

test('n’invente aucune valeur lorsque les metadonnees sont partielles', () => {
  const [reason] = buildPropertyReasons({
    property: property(),
    signals: [signal('price_drop')],
    now: NOW,
  });

  expect(reason.title).toBe('Baisse de prix récente');
  expect(reason.description).not.toMatch(/%|€/);
});

test('formate correctement pourcentage, prix et nombre de jours', () => {
  const [reason] = buildPropertyReasons({
    property: property({
      price: 282_600,
      priceHistory: [
        { date: '2026-06-01', price: 300_000 },
        { date: '2026-07-06', price: 282_600 },
      ],
    }),
    signals: [signal('price_drop')],
    now: NOW,
  });

  expect(reason.description).toContain('300 000 €');
  expect(reason.description).toContain('282 600 €');
  expect(reason.description).toContain('5,8 %');
  expect(reason.description).toContain('il y a 6 jours');
});
