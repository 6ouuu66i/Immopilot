-- Add the event-based republished signal and backfill state-based signals from
-- the current listing state. price_drop and republished are not backfilled from
-- historical price_history rows because they represent past events rather than
-- the current listing state.
--
-- Verification before writing:
-- - price_history has 17 rows with change_type = 'republished'
-- - all existing republished rows have listing_id populated
-- - no current listing has both republished and decrease/price_drop history, but
--   those signal types can coexist because the active unique index is on
--   (listing_id, signal_type)

CREATE OR REPLACE FUNCTION sync_republished_signal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.change_type = 'republished' AND NEW.listing_id IS NOT NULL THEN
    INSERT INTO listing_signals (property_id, listing_id, signal_type, metadata)
    VALUES (
      NEW.property_id, NEW.listing_id, 'republished',
      jsonb_build_object('detected_via', 'price_history', 'event_at', NEW.detected_at)
    )
    ON CONFLICT (listing_id, signal_type) WHERE is_active = true
    DO UPDATE SET metadata = EXCLUDED.metadata, detected_at = now();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION sync_republished_signal() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_sync_republished_signal
  AFTER INSERT ON price_history
  FOR EACH ROW
  EXECUTE FUNCTION sync_republished_signal();

DO $$
BEGIN
  -- FSBO: current active private-seller listings.
  INSERT INTO listing_signals (property_id, listing_id, signal_type)
  SELECT l.property_id, l.id, 'fsbo'
  FROM listings l
  WHERE l.status = 'active'
    AND l.is_fsbo = true
    AND l.property_id IS NOT NULL
  ON CONFLICT (listing_id, signal_type) WHERE is_active = true
  DO NOTHING;

  -- Below market: current active listings priced at least 10% below the local
  -- market median for postal_code/property_type/transaction_type.
  INSERT INTO listing_signals (property_id, listing_id, signal_type, metadata)
  SELECT
    l.property_id,
    l.id,
    'below_market',
    jsonb_build_object(
      'diff_percentage',
      ROUND(((((l.price::numeric / p.living_area) - mr.median_price_per_m2) / mr.median_price_per_m2) * 100), 1),
      'price_per_m2',
      ROUND((l.price::numeric / p.living_area), 2),
      'median_price_per_m2',
      mr.median_price_per_m2,
      'detected_via',
      'backfill_current_state'
    )
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
    AND ((((l.price::numeric / p.living_area) - mr.median_price_per_m2) / mr.median_price_per_m2) * 100) <= -10
  ON CONFLICT (listing_id, signal_type) WHERE is_active = true
  DO NOTHING;

  -- Multi-source: current properties that have active listings on at least two
  -- distinct sources. Add the signal to every active listing for those properties.
  WITH multi_source_properties AS (
    SELECT
      property_id,
      COUNT(DISTINCT source) AS source_count
    FROM listings
    WHERE status = 'active'
      AND property_id IS NOT NULL
      AND source IS NOT NULL
    GROUP BY property_id
    HAVING COUNT(DISTINCT source) >= 2
  )
  INSERT INTO listing_signals (property_id, listing_id, signal_type, metadata)
  SELECT
    l.property_id,
    l.id,
    'multi_source',
    jsonb_build_object(
      'source_count', msp.source_count,
      'detected_via', 'backfill_current_state'
    )
  FROM listings l
  JOIN multi_source_properties msp ON msp.property_id = l.property_id
  WHERE l.status = 'active'
  ON CONFLICT (listing_id, signal_type) WHERE is_active = true
  DO NOTHING;
END;
$$;
