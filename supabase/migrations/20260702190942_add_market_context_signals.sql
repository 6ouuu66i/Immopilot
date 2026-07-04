-- Add market-context signal types and their individual batch sync functions.
-- This migration intentionally does not create sync_daily_market_signals() and
-- does not replace the existing pg_cron schedule yet. The individual functions
-- must be validated first on real data before the daily orchestrator is wired.

ALTER TABLE listing_signals
  DROP CONSTRAINT listing_signals_signal_type_check;

ALTER TABLE listing_signals
  ADD CONSTRAINT listing_signals_signal_type_check
  CHECK (
    signal_type = ANY (
      ARRAY[
        'fsbo'::text,
        'price_drop'::text,
        'republished'::text,
        'below_market'::text,
        'multi_source'::text,
        'agency_mandate_aging'::text,
        'back_to_market'::text,
        'overpriced'::text,
        'stale_dom_relative'::text,
        'failed_launch'::text,
        'competition_shock'::text
      ]
    )
  );

CREATE OR REPLACE FUNCTION sync_overpriced_signal_batch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH candidates AS (
    SELECT
      l.id AS listing_id,
      l.property_id,
      ROUND((l.price::numeric / p.living_area), 2) AS price_per_m2,
      mr.median_price_per_m2,
      ROUND(((((l.price::numeric / p.living_area) - mr.median_price_per_m2) / mr.median_price_per_m2) * 100), 1) AS diff_percentage
    FROM listings l
    JOIN properties p ON p.id = l.property_id
    JOIN market_reference mr
      ON mr.postal_code = p.postal_code
      AND mr.property_type = p.property_type
      AND mr.transaction_type = l.transaction_type
    WHERE l.status = 'active'
      AND l.price IS NOT NULL
      AND l.price > 0
      AND p.living_area IS NOT NULL
      AND p.living_area > 0
      AND mr.median_price_per_m2 IS NOT NULL
      AND mr.median_price_per_m2 > 0
      AND ((((l.price::numeric / p.living_area) - mr.median_price_per_m2) / mr.median_price_per_m2) * 100) >= 10
  )
  INSERT INTO listing_signals (property_id, listing_id, signal_type, metadata)
  SELECT
    c.property_id,
    c.listing_id,
    'overpriced',
    jsonb_build_object(
      'diff_percentage', c.diff_percentage,
      'price_per_m2', c.price_per_m2,
      'median_price_per_m2', c.median_price_per_m2,
      'detected_via', 'daily_market_batch'
    )
  FROM candidates c
  ON CONFLICT (listing_id, signal_type) WHERE is_active = true
  DO UPDATE SET metadata = EXCLUDED.metadata, detected_at = now();

  WITH candidates AS (
    SELECT l.id AS listing_id
    FROM listings l
    JOIN properties p ON p.id = l.property_id
    JOIN market_reference mr
      ON mr.postal_code = p.postal_code
      AND mr.property_type = p.property_type
      AND mr.transaction_type = l.transaction_type
    WHERE l.status = 'active'
      AND l.price IS NOT NULL
      AND l.price > 0
      AND p.living_area IS NOT NULL
      AND p.living_area > 0
      AND mr.median_price_per_m2 IS NOT NULL
      AND mr.median_price_per_m2 > 0
      AND ((((l.price::numeric / p.living_area) - mr.median_price_per_m2) / mr.median_price_per_m2) * 100) >= 10
  )
  UPDATE listing_signals ls
  SET is_active = false, resolved_at = now()
  WHERE ls.signal_type = 'overpriced'
    AND ls.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM candidates c WHERE c.listing_id = ls.listing_id
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION sync_overpriced_signal_batch()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION sync_stale_dom_relative_signal_batch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH comparable AS (
    SELECT
      l.id AS listing_id,
      l.property_id,
      p.postal_code,
      p.property_type,
      l.transaction_type,
      FLOOR(EXTRACT(EPOCH FROM (now() - l.published_at)) / 86400)::int AS days_on_market
    FROM listings l
    JOIN properties p ON p.id = l.property_id
    WHERE l.status = 'active'
      AND l.published_at IS NOT NULL
      AND p.postal_code IS NOT NULL
      AND p.property_type IS NOT NULL
      AND l.transaction_type IS NOT NULL
  ),
  ranked AS (
    SELECT
      *,
      COUNT(*) OVER (
        PARTITION BY postal_code, property_type, transaction_type
      ) AS comparable_count,
      PERCENT_RANK() OVER (
        PARTITION BY postal_code, property_type, transaction_type
        ORDER BY days_on_market
      ) AS dom_percentile
    FROM comparable
  ),
  candidates AS (
    SELECT *
    FROM ranked
    WHERE comparable_count >= 5
      AND dom_percentile >= 0.85
  )
  INSERT INTO listing_signals (property_id, listing_id, signal_type, metadata)
  SELECT
    c.property_id,
    c.listing_id,
    'stale_dom_relative',
    jsonb_build_object(
      'days_on_market', c.days_on_market,
      'dom_percentile', ROUND(c.dom_percentile::numeric, 3),
      'comparable_count', c.comparable_count,
      'detected_via', 'daily_market_batch'
    )
  FROM candidates c
  ON CONFLICT (listing_id, signal_type) WHERE is_active = true
  DO UPDATE SET metadata = EXCLUDED.metadata, detected_at = now();

  WITH comparable AS (
    SELECT
      l.id AS listing_id,
      p.postal_code,
      p.property_type,
      l.transaction_type,
      FLOOR(EXTRACT(EPOCH FROM (now() - l.published_at)) / 86400)::int AS days_on_market
    FROM listings l
    JOIN properties p ON p.id = l.property_id
    WHERE l.status = 'active'
      AND l.published_at IS NOT NULL
      AND p.postal_code IS NOT NULL
      AND p.property_type IS NOT NULL
      AND l.transaction_type IS NOT NULL
  ),
  ranked AS (
    SELECT
      *,
      COUNT(*) OVER (
        PARTITION BY postal_code, property_type, transaction_type
      ) AS comparable_count,
      PERCENT_RANK() OVER (
        PARTITION BY postal_code, property_type, transaction_type
        ORDER BY days_on_market
      ) AS dom_percentile
    FROM comparable
  ),
  candidates AS (
    SELECT listing_id
    FROM ranked
    WHERE comparable_count >= 5
      AND dom_percentile >= 0.85
  )
  UPDATE listing_signals ls
  SET is_active = false, resolved_at = now()
  WHERE ls.signal_type = 'stale_dom_relative'
    AND ls.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM candidates c WHERE c.listing_id = ls.listing_id
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION sync_stale_dom_relative_signal_batch()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION sync_failed_launch_signal_batch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH candidates AS (
    SELECT
      l.id AS listing_id,
      l.property_id,
      FLOOR(EXTRACT(EPOCH FROM (now() - l.published_at)) / 86400)::int AS days_on_market
    FROM listings l
    WHERE l.status = 'active'
      AND l.published_at IS NOT NULL
      AND l.published_at < now() - INTERVAL '30 days'
      AND COALESCE(l.is_under_option, false) = false
      AND NOT EXISTS (
        SELECT 1
        FROM price_history ph
        WHERE ph.listing_id = l.id
          AND ph.change_type IN ('decrease', 'price_drop')
      )
  )
  INSERT INTO listing_signals (property_id, listing_id, signal_type, metadata)
  SELECT
    c.property_id,
    c.listing_id,
    'failed_launch',
    jsonb_build_object(
      'days_on_market', c.days_on_market,
      'detected_via', 'daily_market_batch'
    )
  FROM candidates c
  ON CONFLICT (listing_id, signal_type) WHERE is_active = true
  DO UPDATE SET metadata = EXCLUDED.metadata, detected_at = now();

  WITH candidates AS (
    SELECT l.id AS listing_id
    FROM listings l
    WHERE l.status = 'active'
      AND l.published_at IS NOT NULL
      AND l.published_at < now() - INTERVAL '30 days'
      AND COALESCE(l.is_under_option, false) = false
      AND NOT EXISTS (
        SELECT 1
        FROM price_history ph
        WHERE ph.listing_id = l.id
          AND ph.change_type IN ('decrease', 'price_drop')
      )
  )
  UPDATE listing_signals ls
  SET is_active = false, resolved_at = now()
  WHERE ls.signal_type = 'failed_launch'
    AND ls.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM candidates c WHERE c.listing_id = ls.listing_id
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION sync_failed_launch_signal_batch()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION sync_competition_shock_signal_batch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH active_listings AS (
    SELECT
      l.id AS listing_id,
      l.property_id,
      l.transaction_type,
      l.published_at,
      p.postal_code,
      p.property_type
    FROM listings l
    JOIN properties p ON p.id = l.property_id
    WHERE l.status = 'active'
      AND l.published_at IS NOT NULL
      AND p.postal_code IS NOT NULL
      AND p.property_type IS NOT NULL
      AND l.transaction_type IS NOT NULL
  ),
  candidates AS (
    SELECT
      target.listing_id,
      target.property_id,
      COUNT(DISTINCT competitor.property_id) AS new_competitor_count
    FROM active_listings target
    JOIN active_listings competitor
      ON competitor.postal_code = target.postal_code
      AND competitor.property_type = target.property_type
      AND competitor.transaction_type = target.transaction_type
      AND competitor.property_id <> target.property_id
      AND competitor.published_at >= now() - INTERVAL '14 days'
    WHERE target.published_at < now() - INTERVAL '14 days'
      AND NOT EXISTS (
        SELECT 1
        FROM price_history ph
        WHERE ph.listing_id = target.listing_id
          AND ph.detected_at >= now() - INTERVAL '14 days'
          AND ph.change_type IN ('decrease', 'price_drop', 'increase', 'price_increase')
      )
    GROUP BY target.listing_id, target.property_id
    HAVING COUNT(DISTINCT competitor.property_id) >= 3
  )
  INSERT INTO listing_signals (property_id, listing_id, signal_type, metadata)
  SELECT
    c.property_id,
    c.listing_id,
    'competition_shock',
    jsonb_build_object(
      'new_competitor_count', c.new_competitor_count,
      'window_days', 14,
      'detected_via', 'daily_market_batch'
    )
  FROM candidates c
  ON CONFLICT (listing_id, signal_type) WHERE is_active = true
  DO UPDATE SET metadata = EXCLUDED.metadata, detected_at = now();

  WITH active_listings AS (
    SELECT
      l.id AS listing_id,
      l.property_id,
      l.transaction_type,
      l.published_at,
      p.postal_code,
      p.property_type
    FROM listings l
    JOIN properties p ON p.id = l.property_id
    WHERE l.status = 'active'
      AND l.published_at IS NOT NULL
      AND p.postal_code IS NOT NULL
      AND p.property_type IS NOT NULL
      AND l.transaction_type IS NOT NULL
  ),
  candidates AS (
    SELECT target.listing_id
    FROM active_listings target
    JOIN active_listings competitor
      ON competitor.postal_code = target.postal_code
      AND competitor.property_type = target.property_type
      AND competitor.transaction_type = target.transaction_type
      AND competitor.property_id <> target.property_id
      AND competitor.published_at >= now() - INTERVAL '14 days'
    WHERE target.published_at < now() - INTERVAL '14 days'
      AND NOT EXISTS (
        SELECT 1
        FROM price_history ph
        WHERE ph.listing_id = target.listing_id
          AND ph.detected_at >= now() - INTERVAL '14 days'
          AND ph.change_type IN ('decrease', 'price_drop', 'increase', 'price_increase')
      )
    GROUP BY target.listing_id
    HAVING COUNT(DISTINCT competitor.property_id) >= 3
  )
  UPDATE listing_signals ls
  SET is_active = false, resolved_at = now()
  WHERE ls.signal_type = 'competition_shock'
    AND ls.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM candidates c WHERE c.listing_id = ls.listing_id
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION sync_competition_shock_signal_batch()
  FROM PUBLIC, anon, authenticated;
