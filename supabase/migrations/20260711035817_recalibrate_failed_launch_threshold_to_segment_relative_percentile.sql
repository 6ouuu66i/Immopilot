-- failed_launch is relative to local time-on-market instead of a fixed 30-day threshold.
-- Keep detected_at unchanged on refresh so the configured event decay is not reset daily.


CREATE OR REPLACE FUNCTION public.sync_failed_launch_signal_batch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  WITH comparable AS (
    SELECT
      l.id AS listing_id,
      l.property_id,
      p.postal_code,
      p.property_type,
      l.transaction_type,
      COALESCE(l.is_under_option, false) AS is_under_option,
      FLOOR(EXTRACT(EPOCH FROM (now() - l.published_at)) / 86400)::int AS days_on_market,
      EXISTS (
        SELECT 1
        FROM public.price_history ph
        WHERE ph.listing_id = l.id
          AND ph.change_type IN ('decrease', 'price_drop')
      ) AS has_price_drop
    FROM public.listings l
    JOIN public.properties p ON p.id = l.property_id
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
      ) AS launch_percentile
    FROM comparable
  ),
  candidates AS (
    SELECT *
    FROM ranked
    WHERE comparable_count >= 5
      AND launch_percentile >= 0.85
      AND is_under_option = false
      AND has_price_drop = false
  )
  INSERT INTO public.listing_signals (property_id, listing_id, signal_type, metadata)
  SELECT
    c.property_id,
    c.listing_id,
    'failed_launch',
    jsonb_build_object(
      'days_on_market', c.days_on_market,
      'launch_percentile', ROUND(c.launch_percentile::numeric, 3),
      'comparable_count', c.comparable_count,
      'detected_via', 'daily_market_batch'
    )
  FROM candidates c
  ON CONFLICT (listing_id, signal_type) WHERE is_active = true
  DO UPDATE SET metadata = EXCLUDED.metadata;

  WITH comparable AS (
    SELECT
      l.id AS listing_id,
      p.postal_code,
      p.property_type,
      l.transaction_type,
      COALESCE(l.is_under_option, false) AS is_under_option,
      FLOOR(EXTRACT(EPOCH FROM (now() - l.published_at)) / 86400)::int AS days_on_market,
      EXISTS (
        SELECT 1
        FROM public.price_history ph
        WHERE ph.listing_id = l.id
          AND ph.change_type IN ('decrease', 'price_drop')
      ) AS has_price_drop
    FROM public.listings l
    JOIN public.properties p ON p.id = l.property_id
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
      ) AS launch_percentile
    FROM comparable
  ),
  candidates AS (
    SELECT listing_id
    FROM ranked
    WHERE comparable_count >= 5
      AND launch_percentile >= 0.85
      AND is_under_option = false
      AND has_price_drop = false
  )
  UPDATE public.listing_signals ls
  SET is_active = false, resolved_at = now()
  WHERE ls.signal_type = 'failed_launch'
    AND ls.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM candidates c WHERE c.listing_id = ls.listing_id
    );
END;
$function$;

SELECT public.sync_failed_launch_signal_batch();
SELECT public.compute_listing_scores();
