-- Detect agency listings that may be reaching the end of a 6-month exclusive
-- mandate. This is scheduled daily because mandate aging is time-based and does
-- not depend on a listing write event.

DO $$
BEGIN
  IF to_regclass('public.listing_signals') IS NULL THEN
    RAISE EXCEPTION
      'public.listing_signals is required before agency mandate aging signals can be scheduled';
  END IF;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION sync_agency_mandate_aging_signal()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Creer/rafraichir le signal pour les annonces d'agence actives
  -- depassant 180 jours depuis leur premiere apparition.
  INSERT INTO listing_signals (property_id, listing_id, signal_type, metadata)
  SELECT
    l.property_id,
    l.id,
    'agency_mandate_aging',
    jsonb_build_object(
      'days_on_market', EXTRACT(DAY FROM now() - l.first_seen_at)::int,
      'first_seen_at', l.first_seen_at
    )
  FROM listings l
  WHERE l.customer_type IN (
      'AGENCY',
      'AGENCY_PAYING_WITH_OGONE',
      'REAL_ESTATE_AGENCY'
    )
    AND l.status = 'active'
    AND l.first_seen_at <= now() - INTERVAL '180 days'
  ON CONFLICT (listing_id, signal_type) WHERE is_active = true
  DO UPDATE SET metadata = EXCLUDED.metadata, detected_at = now();

  -- Desactiver le signal si le bien n'est plus actif ou plus en agence.
  UPDATE listing_signals ls
  SET is_active = false, resolved_at = now()
  FROM listings l
  WHERE ls.listing_id = l.id
    AND ls.signal_type = 'agency_mandate_aging'
    AND ls.is_active = true
    AND (
      l.status != 'active'
      OR l.customer_type NOT IN (
        'AGENCY',
        'AGENCY_PAYING_WITH_OGONE',
        'REAL_ESTATE_AGENCY'
      )
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION sync_agency_mandate_aging_signal()
  FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'sync-agency-mandate-aging-daily',
  '0 3 * * *',
  $$ SELECT sync_agency_mandate_aging_signal(); $$
);
