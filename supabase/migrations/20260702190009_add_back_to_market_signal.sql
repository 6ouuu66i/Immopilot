-- Add the event-based back_to_market signal.
-- No backfill is possible for this signal: listings.is_under_option has no
-- historical state, so we cannot know retroactively whether a listing that is
-- currently not under option previously transitioned through an option phase.
-- The signal will only be emitted for future true -> false transitions.

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
        'back_to_market'::text
      ]
    )
  );

CREATE OR REPLACE FUNCTION sync_back_to_market_signal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Transition true -> false while the listing remains active: the option phase
  -- ended without a completed sale, so the property is back on the market.
  IF OLD.is_under_option = true AND NEW.is_under_option = false
     AND NEW.status = 'active' THEN
    INSERT INTO listing_signals (property_id, listing_id, signal_type, metadata)
    VALUES (
      NEW.property_id, NEW.id, 'back_to_market',
      jsonb_build_object('detected_at', now())
    )
    ON CONFLICT (listing_id, signal_type) WHERE is_active = true
    DO UPDATE SET metadata = EXCLUDED.metadata, detected_at = now();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION sync_back_to_market_signal()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_sync_back_to_market_signal
  AFTER UPDATE OF is_under_option ON listings
  FOR EACH ROW
  EXECUTE FUNCTION sync_back_to_market_signal();
