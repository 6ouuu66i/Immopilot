-- Phase 0 backtest for "Indice de tension vendeur".
--
-- No persistent writes. The script only creates a session-local TEMP table for
-- result aggregation. Run with:
--   supabase db query --linked --file scripts/backtest_seller_tension_score.sql
--
-- Scope:
-- - Scores are computed at property_id level.
-- - listing_signals remains the raw signal table, but multiple active listings
--   for the same property are collapsed before scoring.
-- - agency_mandate_aging is reported as mandate context only; it is never scored.
-- - marketing_underexposed is planned in the v1 scorecard but is not yet
--   implemented in listing_signals CHECK/triggers, so Marketing is fixed at 0.
-- - PEB is not scored.
--
-- Known limitation:
-- Current schema has point-in-time price_history, but listing_signals were mostly
-- backfilled/detected on 2026-07-02. Weekly snapshots before that date are useful
-- for event-history smoke testing, not for full historical calibration.

DROP TABLE IF EXISTS backtest_seller_tension_results;
CREATE TEMP TABLE backtest_seller_tension_results (
  section text PRIMARY KEY,
  result jsonb NOT NULL
) ON COMMIT DROP;

WITH active_counts AS (
  SELECT
    property_id,
    COUNT(*) AS active_listing_count,
    COUNT(DISTINCT source) AS active_source_count
  FROM public.listings
  WHERE status = 'active'
  GROUP BY property_id
)
INSERT INTO backtest_seller_tension_results (section, result)
SELECT
  '01_active_listing_duplicates' AS section,
  jsonb_build_object(
    'active_listing_rows', COALESCE(SUM(active_listing_count), 0),
    'properties_with_active_listing', COUNT(*),
    'properties_with_multiple_active_listings', COUNT(*) FILTER (WHERE active_listing_count > 1),
    'max_active_listings_for_one_property', MAX(active_listing_count),
    'avg_active_listings_per_active_property', ROUND(AVG(active_listing_count)::numeric, 2)
  ) AS result
FROM active_counts;

WITH history AS (
  SELECT
    COUNT(*) AS price_history_rows,
    COUNT(DISTINCT property_id) AS properties_with_history,
    COUNT(DISTINCT listing_id) AS listings_with_history,
    MIN(detected_at) AS first_detected_at,
    MAX(detected_at) AS last_detected_at
  FROM public.price_history
),
signals AS (
  SELECT
    COUNT(*) AS listing_signal_rows,
    COUNT(*) FILTER (WHERE is_active) AS active_listing_signal_rows,
    COUNT(DISTINCT property_id) FILTER (WHERE is_active) AS active_signal_properties,
    MIN(detected_at) AS first_signal_detected_at,
    MAX(detected_at) AS last_signal_detected_at
  FROM public.listing_signals
)
INSERT INTO backtest_seller_tension_results (section, result)
SELECT
  '02_history_coverage' AS section,
  to_jsonb(history.*) || to_jsonb(signals.*) AS result
FROM history, signals;

WITH
params AS (
  SELECT now()::timestamptz AS snapshot_at
),
property_context AS (
  SELECT
    l.property_id,
    COUNT(*) FILTER (WHERE l.status = 'active') AS active_listing_count,
    COUNT(DISTINCT l.source) FILTER (WHERE l.status = 'active') AS active_source_count,
    BOOL_OR(COALESCE(l.is_fsbo, false)) FILTER (WHERE l.status = 'active') AS has_fsbo,
    BOOL_OR(NOT COALESCE(l.is_fsbo, false)) FILTER (WHERE l.status = 'active') AS has_agency_listing
  FROM public.listings l
  GROUP BY l.property_id
),
active_signal_events AS (
  SELECT
    ls.property_id,
    ls.signal_type,
    COALESCE((ls.metadata->>'event_at')::timestamptz, ls.detected_at) AS event_at
  FROM public.listing_signals ls
  JOIN property_context pc ON pc.property_id = ls.property_id
  WHERE ls.is_active = true
    AND pc.active_listing_count > 0
    AND ls.signal_type <> 'agency_mandate_aging'
),
price_history_events AS (
  SELECT
    ph.property_id,
    CASE
      WHEN ph.change_type IN ('decrease', 'price_drop') THEN 'price_drop'
      WHEN ph.change_type = 'republished' THEN 'republished'
      ELSE NULL
    END AS signal_type,
    ph.detected_at AS event_at
  FROM public.price_history ph
  JOIN property_context pc ON pc.property_id = ph.property_id
  WHERE pc.active_listing_count > 0
    AND ph.change_type IN ('decrease', 'price_drop', 'republished')
),
events AS (
  SELECT * FROM active_signal_events
  UNION ALL
  SELECT * FROM price_history_events WHERE signal_type IS NOT NULL
),
contributions AS (
  SELECT
    pc.property_id,
    ROUND(
      LEAST(
        38,
        GREATEST(
          MAX(CASE
            WHEN e.signal_type = 'below_market'
              THEN 28 * CASE WHEN pc.has_fsbo THEN 1.2 ELSE 0.5 END
            WHEN e.signal_type = 'overpriced'
              THEN 28
            ELSE 0
          END),
          0
        )
        + GREATEST(
          MAX(CASE
            WHEN e.signal_type = 'price_drop'
              THEN 14 * exp((-ln(2) * GREATEST(EXTRACT(EPOCH FROM ((SELECT snapshot_at FROM params) - e.event_at)) / 86400, 0)) / 21)
            ELSE 0
          END),
          0
        )
      )::numeric,
      2
    ) AS price_score,
    ROUND(
      LEAST(
        25,
        GREATEST(MAX(CASE WHEN e.signal_type = 'stale_dom_relative' THEN 22 ELSE 0 END), 0)
        + GREATEST(
          MAX(CASE
            WHEN e.signal_type = 'failed_launch'
              THEN 15 * exp((-ln(2) * GREATEST(EXTRACT(EPOCH FROM ((SELECT snapshot_at FROM params) - e.event_at)) / 86400, 0)) / 30)
            ELSE 0
          END),
          0
        )
      )::numeric,
      2
    ) AS time_score,
    ROUND(
      GREATEST(
        MAX(CASE
          WHEN e.signal_type = 'back_to_market'
            THEN 26 * exp((-ln(2) * GREATEST(EXTRACT(EPOCH FROM ((SELECT snapshot_at FROM params) - e.event_at)) / 86400, 0)) / 45)
          ELSE 0
        END),
        0
      )::numeric,
      2
    ) AS friction_score,
    ROUND(
      GREATEST(MAX(CASE WHEN e.signal_type = 'competition_shock' THEN 10 ELSE 0 END), 0)::numeric,
      2
    ) AS competition_score,
    ROUND(
      LEAST(
        6,
        GREATEST(MAX(CASE WHEN e.signal_type = 'multi_source' THEN 4 ELSE 0 END), 0)
        + GREATEST(
          MAX(CASE
            WHEN e.signal_type = 'republished'
              THEN 4 * exp((-ln(2) * GREATEST(EXTRACT(EPOCH FROM ((SELECT snapshot_at FROM params) - e.event_at)) / 86400, 0)) / 30)
            ELSE 0
          END),
          0
        )
      )::numeric,
      2
    ) AS diffusion_score,
    0::numeric AS marketing_score
  FROM property_context pc
  LEFT JOIN events e ON e.property_id = pc.property_id
  WHERE pc.active_listing_count > 0
  GROUP BY pc.property_id, pc.has_fsbo
),
scored AS (
  SELECT
    c.*,
    ROUND(
      LEAST(
        100,
        c.price_score + c.time_score + c.friction_score + c.competition_score + c.diffusion_score + c.marketing_score
      ),
      0
    )::int AS raw_score,
    (
      (c.price_score > 0)::int
      + (c.time_score > 0)::int
      + (c.friction_score > 0)::int
      + (c.competition_score > 0)::int
      + (c.diffusion_score > 0)::int
      + (c.marketing_score > 0)::int
    ) AS contributing_families
  FROM contributions c
),
banded AS (
  SELECT
    *,
    CASE
      WHEN raw_score >= 75 AND contributing_families >= 2 THEN 'forte'
      WHEN raw_score >= 52 THEN 'a_surveiller'
      ELSE 'faible_priorite'
    END AS band
  FROM scored
)
INSERT INTO backtest_seller_tension_results (section, result)
SELECT
  '03_current_distribution' AS section,
  jsonb_agg(
    jsonb_build_object(
      'band', band,
      'properties', properties,
      'avg_score', avg_score,
      'min_score', min_score,
      'max_score', max_score
    )
    ORDER BY sort_order
  ) AS result
FROM (
  SELECT
    band,
    COUNT(*) AS properties,
    ROUND(AVG(raw_score)::numeric, 1) AS avg_score,
    MIN(raw_score) AS min_score,
    MAX(raw_score) AS max_score,
    CASE band WHEN 'forte' THEN 1 WHEN 'a_surveiller' THEN 2 ELSE 3 END AS sort_order
  FROM banded
  GROUP BY band
) distribution;

WITH
params AS (
  SELECT now()::timestamptz AS snapshot_at
),
property_context AS (
  SELECT
    l.property_id,
    COUNT(*) FILTER (WHERE l.status = 'active') AS active_listing_count,
    BOOL_OR(COALESCE(l.is_fsbo, false)) FILTER (WHERE l.status = 'active') AS has_fsbo
  FROM public.listings l
  GROUP BY l.property_id
),
events AS (
  SELECT
    ls.property_id,
    ls.signal_type,
    COALESCE((ls.metadata->>'event_at')::timestamptz, ls.detected_at) AS event_at
  FROM public.listing_signals ls
  JOIN property_context pc ON pc.property_id = ls.property_id
  WHERE ls.is_active = true
    AND pc.active_listing_count > 0
    AND ls.signal_type <> 'agency_mandate_aging'
  UNION ALL
  SELECT
    ph.property_id,
    CASE
      WHEN ph.change_type IN ('decrease', 'price_drop') THEN 'price_drop'
      WHEN ph.change_type = 'republished' THEN 'republished'
      ELSE NULL
    END AS signal_type,
    ph.detected_at AS event_at
  FROM public.price_history ph
  JOIN property_context pc ON pc.property_id = ph.property_id
  WHERE pc.active_listing_count > 0
    AND ph.change_type IN ('decrease', 'price_drop', 'republished')
),
contributions AS (
  SELECT
    pc.property_id,
    ROUND(LEAST(38, GREATEST(MAX(CASE WHEN e.signal_type = 'below_market' THEN 28 * CASE WHEN pc.has_fsbo THEN 1.2 ELSE 0.5 END WHEN e.signal_type = 'overpriced' THEN 28 ELSE 0 END), 0) + GREATEST(MAX(CASE WHEN e.signal_type = 'price_drop' THEN 14 * exp((-ln(2) * GREATEST(EXTRACT(EPOCH FROM ((SELECT snapshot_at FROM params) - e.event_at)) / 86400, 0)) / 21) ELSE 0 END), 0))::numeric, 2) AS price_score,
    ROUND(LEAST(25, GREATEST(MAX(CASE WHEN e.signal_type = 'stale_dom_relative' THEN 22 ELSE 0 END), 0) + GREATEST(MAX(CASE WHEN e.signal_type = 'failed_launch' THEN 15 * exp((-ln(2) * GREATEST(EXTRACT(EPOCH FROM ((SELECT snapshot_at FROM params) - e.event_at)) / 86400, 0)) / 30) ELSE 0 END), 0))::numeric, 2) AS time_score,
    ROUND(GREATEST(MAX(CASE WHEN e.signal_type = 'back_to_market' THEN 26 * exp((-ln(2) * GREATEST(EXTRACT(EPOCH FROM ((SELECT snapshot_at FROM params) - e.event_at)) / 86400, 0)) / 45) ELSE 0 END), 0)::numeric, 2) AS friction_score,
    ROUND(GREATEST(MAX(CASE WHEN e.signal_type = 'competition_shock' THEN 10 ELSE 0 END), 0)::numeric, 2) AS competition_score,
    ROUND(LEAST(6, GREATEST(MAX(CASE WHEN e.signal_type = 'multi_source' THEN 4 ELSE 0 END), 0) + GREATEST(MAX(CASE WHEN e.signal_type = 'republished' THEN 4 * exp((-ln(2) * GREATEST(EXTRACT(EPOCH FROM ((SELECT snapshot_at FROM params) - e.event_at)) / 86400, 0)) / 30) ELSE 0 END), 0))::numeric, 2) AS diffusion_score,
    0::numeric AS marketing_score
  FROM property_context pc
  LEFT JOIN events e ON e.property_id = pc.property_id
  WHERE pc.active_listing_count > 0
  GROUP BY pc.property_id, pc.has_fsbo
),
scored AS (
  SELECT
    c.*,
    ROUND(LEAST(100, c.price_score + c.time_score + c.friction_score + c.competition_score + c.diffusion_score + c.marketing_score), 0)::int AS raw_score,
    ((c.price_score > 0)::int + (c.time_score > 0)::int + (c.friction_score > 0)::int + (c.competition_score > 0)::int + (c.diffusion_score > 0)::int + (c.marketing_score > 0)::int) AS contributing_families
  FROM contributions c
),
banded AS (
  SELECT
    *,
    CASE
      WHEN raw_score >= 75 AND contributing_families >= 2 THEN 'forte'
      WHEN raw_score >= 52 THEN 'a_surveiller'
      ELSE 'faible_priorite'
    END AS band
  FROM scored
)
INSERT INTO backtest_seller_tension_results (section, result)
SELECT
  '04_current_family_averages' AS section,
  jsonb_build_object(
    'properties', COUNT(*),
    'avg_total_score', ROUND(AVG(raw_score)::numeric, 1),
    'avg_contributing_families', ROUND(AVG(contributing_families)::numeric, 2),
    'avg_price', ROUND(AVG(price_score)::numeric, 2),
    'avg_time', ROUND(AVG(time_score)::numeric, 2),
    'avg_friction', ROUND(AVG(friction_score)::numeric, 2),
    'avg_competition', ROUND(AVG(competition_score)::numeric, 2),
    'avg_diffusion', ROUND(AVG(diffusion_score)::numeric, 2),
    'avg_marketing', ROUND(AVG(marketing_score)::numeric, 2)
  ) AS result
FROM banded;

WITH
snapshots AS (
  SELECT generate_series(
    date_trunc('week', (SELECT MIN(detected_at) FROM public.price_history)),
    date_trunc('week', now()),
    interval '1 week'
  )::timestamptz AS snapshot_at
),
property_context AS (
  SELECT
    l.property_id,
    COUNT(*) FILTER (WHERE l.status = 'active') AS active_listing_count,
    BOOL_OR(COALESCE(l.is_fsbo, false)) FILTER (WHERE l.status = 'active') AS has_fsbo
  FROM public.listings l
  GROUP BY l.property_id
),
events AS (
  SELECT
    ls.property_id,
    ls.signal_type,
    COALESCE((ls.metadata->>'event_at')::timestamptz, ls.detected_at) AS event_at,
    ls.resolved_at
  FROM public.listing_signals ls
  JOIN property_context pc ON pc.property_id = ls.property_id
  WHERE pc.active_listing_count > 0
    AND ls.signal_type <> 'agency_mandate_aging'
  UNION ALL
  SELECT
    ph.property_id,
    CASE
      WHEN ph.change_type IN ('decrease', 'price_drop') THEN 'price_drop'
      WHEN ph.change_type = 'republished' THEN 'republished'
      ELSE NULL
    END AS signal_type,
    ph.detected_at AS event_at,
    NULL::timestamptz AS resolved_at
  FROM public.price_history ph
  JOIN property_context pc ON pc.property_id = ph.property_id
  WHERE pc.active_listing_count > 0
    AND ph.change_type IN ('decrease', 'price_drop', 'republished')
),
scored_snapshots AS (
  SELECT
    s.snapshot_at,
    pc.property_id,
    ROUND((LEAST(100,
      LEAST(38, GREATEST(MAX(CASE WHEN e.signal_type = 'below_market' THEN 28 * CASE WHEN pc.has_fsbo THEN 1.2 ELSE 0.5 END WHEN e.signal_type = 'overpriced' THEN 28 ELSE 0 END), 0) + GREATEST(MAX(CASE WHEN e.signal_type = 'price_drop' THEN 14 * exp((-ln(2) * GREATEST(EXTRACT(EPOCH FROM (s.snapshot_at - e.event_at)) / 86400, 0)) / 21) ELSE 0 END), 0))
      + LEAST(25, GREATEST(MAX(CASE WHEN e.signal_type = 'stale_dom_relative' THEN 22 ELSE 0 END), 0) + GREATEST(MAX(CASE WHEN e.signal_type = 'failed_launch' THEN 15 * exp((-ln(2) * GREATEST(EXTRACT(EPOCH FROM (s.snapshot_at - e.event_at)) / 86400, 0)) / 30) ELSE 0 END), 0))
      + GREATEST(MAX(CASE WHEN e.signal_type = 'back_to_market' THEN 26 * exp((-ln(2) * GREATEST(EXTRACT(EPOCH FROM (s.snapshot_at - e.event_at)) / 86400, 0)) / 45) ELSE 0 END), 0)
      + GREATEST(MAX(CASE WHEN e.signal_type = 'competition_shock' THEN 10 ELSE 0 END), 0)
      + LEAST(6, GREATEST(MAX(CASE WHEN e.signal_type = 'multi_source' THEN 4 ELSE 0 END), 0) + GREATEST(MAX(CASE WHEN e.signal_type = 'republished' THEN 4 * exp((-ln(2) * GREATEST(EXTRACT(EPOCH FROM (s.snapshot_at - e.event_at)) / 86400, 0)) / 30) ELSE 0 END), 0))
      + 0
    ))::numeric, 0)::int AS raw_score,
    (
      (LEAST(38, GREATEST(MAX(CASE WHEN e.signal_type = 'below_market' THEN 28 * CASE WHEN pc.has_fsbo THEN 1.2 ELSE 0.5 END WHEN e.signal_type = 'overpriced' THEN 28 ELSE 0 END), 0) + GREATEST(MAX(CASE WHEN e.signal_type = 'price_drop' THEN 14 * exp((-ln(2) * GREATEST(EXTRACT(EPOCH FROM (s.snapshot_at - e.event_at)) / 86400, 0)) / 21) ELSE 0 END), 0)) > 0)::int
      + (LEAST(25, GREATEST(MAX(CASE WHEN e.signal_type = 'stale_dom_relative' THEN 22 ELSE 0 END), 0) + GREATEST(MAX(CASE WHEN e.signal_type = 'failed_launch' THEN 15 * exp((-ln(2) * GREATEST(EXTRACT(EPOCH FROM (s.snapshot_at - e.event_at)) / 86400, 0)) / 30) ELSE 0 END), 0)) > 0)::int
      + (GREATEST(MAX(CASE WHEN e.signal_type = 'back_to_market' THEN 26 * exp((-ln(2) * GREATEST(EXTRACT(EPOCH FROM (s.snapshot_at - e.event_at)) / 86400, 0)) / 45) ELSE 0 END), 0) > 0)::int
      + (GREATEST(MAX(CASE WHEN e.signal_type = 'competition_shock' THEN 10 ELSE 0 END), 0) > 0)::int
      + (LEAST(6, GREATEST(MAX(CASE WHEN e.signal_type = 'multi_source' THEN 4 ELSE 0 END), 0) + GREATEST(MAX(CASE WHEN e.signal_type = 'republished' THEN 4 * exp((-ln(2) * GREATEST(EXTRACT(EPOCH FROM (s.snapshot_at - e.event_at)) / 86400, 0)) / 30) ELSE 0 END), 0)) > 0)::int
      + 0
    ) AS contributing_families
  FROM snapshots s
  CROSS JOIN property_context pc
  LEFT JOIN events e
    ON e.property_id = pc.property_id
    AND e.signal_type IS NOT NULL
    AND e.event_at <= s.snapshot_at
    AND (e.resolved_at IS NULL OR e.resolved_at > s.snapshot_at)
  WHERE pc.active_listing_count > 0
  GROUP BY s.snapshot_at, pc.property_id, pc.has_fsbo
),
banded AS (
  SELECT
    snapshot_at,
    CASE
      WHEN raw_score >= 75 AND contributing_families >= 2 THEN 'forte'
      WHEN raw_score >= 52 THEN 'a_surveiller'
      ELSE 'faible_priorite'
    END AS band,
    raw_score
  FROM scored_snapshots
)
INSERT INTO backtest_seller_tension_results (section, result)
SELECT
  '05_weekly_snapshot_distribution_limited_history' AS section,
  jsonb_agg(
    jsonb_build_object(
      'week', snapshot_at::date,
      'band', band,
      'properties', properties,
      'avg_score', avg_score
    )
    ORDER BY snapshot_at, sort_order
  ) AS result
FROM (
  SELECT
    snapshot_at,
    band,
    COUNT(*) AS properties,
    ROUND(AVG(raw_score)::numeric, 1) AS avg_score,
    CASE band WHEN 'forte' THEN 1 WHEN 'a_surveiller' THEN 2 ELSE 3 END AS sort_order
  FROM banded
  GROUP BY snapshot_at, band
) weekly;

SELECT section, result
FROM backtest_seller_tension_results
ORDER BY section;
