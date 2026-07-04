-- Brique 2A: durable listing signals detected from listing and price events.
-- Republishing is intentionally not detected here: the Immoweb scraper code is
-- not present in this repo, so we cannot confirm whether republishing updates an
-- existing listing row or inserts a new one. The database already contains a
-- price_history change_type named 'republished', but that behavior needs a
-- dedicated migration once the scraper write path is verified.
--
-- Real values verified before writing:
-- - listings.status active value: 'active'; removed value: 'removed'
-- - price_history change_type values for price decreases: 'decrease', 'price_drop'

CREATE TABLE listing_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  listing_id uuid NOT NULL REFERENCES listings(id),
  signal_type text NOT NULL CHECK (signal_type IN (
    'fsbo', 'price_drop', 'republished', 'below_market', 'multi_source'
  )),
  metadata jsonb NOT NULL DEFAULT '{}',
  detected_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_listing_signals_active_unique
  ON listing_signals (listing_id, signal_type)
  WHERE is_active = true;

CREATE INDEX idx_listing_signals_property ON listing_signals (property_id);
CREATE INDEX idx_listing_signals_type_active ON listing_signals (signal_type)
  WHERE is_active = true;

ALTER TABLE listing_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listing_signals_read_all_authenticated"
  ON listing_signals FOR SELECT
  TO authenticated
  USING (true);

-- Trigger 1: FSBO
CREATE OR REPLACE FUNCTION sync_fsbo_signal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_fsbo = true THEN
    INSERT INTO listing_signals (property_id, listing_id, signal_type)
    VALUES (NEW.property_id, NEW.id, 'fsbo')
    ON CONFLICT (listing_id, signal_type) WHERE is_active = true
    DO NOTHING;
  ELSE
    UPDATE listing_signals
    SET is_active = false, resolved_at = now()
    WHERE listing_id = NEW.id AND signal_type = 'fsbo' AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION sync_fsbo_signal() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_sync_fsbo_signal
  AFTER INSERT OR UPDATE OF is_fsbo ON listings
  FOR EACH ROW
  EXECUTE FUNCTION sync_fsbo_signal();

-- Trigger 2: price_drop
CREATE OR REPLACE FUNCTION sync_price_drop_signal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.change_type IN ('decrease', 'price_drop')
    AND NEW.listing_id IS NOT NULL
    AND ABS(NEW.change_percentage) >= 5
  THEN
    INSERT INTO listing_signals (property_id, listing_id, signal_type, metadata)
    VALUES (
      NEW.property_id, NEW.listing_id, 'price_drop',
      jsonb_build_object(
        'change_type', NEW.change_type,
        'change_percentage', NEW.change_percentage,
        'old_price', NEW.old_price,
        'new_price', NEW.new_price
      )
    )
    ON CONFLICT (listing_id, signal_type) WHERE is_active = true
    DO UPDATE SET metadata = EXCLUDED.metadata, detected_at = now();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION sync_price_drop_signal() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_sync_price_drop_signal
  AFTER INSERT ON price_history
  FOR EACH ROW
  EXECUTE FUNCTION sync_price_drop_signal();

-- Trigger 3: below_market
CREATE OR REPLACE FUNCTION sync_below_market_signal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price_per_m2 numeric;
  v_median numeric;
  v_diff_pct numeric;
BEGIN
  SELECT NEW.price::numeric / p.living_area, mr.median_price_per_m2
  INTO v_price_per_m2, v_median
  FROM properties p
  LEFT JOIN market_reference mr
    ON mr.postal_code = p.postal_code
    AND mr.property_type = p.property_type
    AND mr.transaction_type = NEW.transaction_type
  WHERE p.id = NEW.property_id
    AND p.living_area IS NOT NULL AND p.living_area > 0;

  IF v_median IS NULL OR v_price_per_m2 IS NULL THEN
    RETURN NEW;
  END IF;

  v_diff_pct := ((v_price_per_m2 - v_median) / v_median) * 100;

  IF v_diff_pct <= -10 THEN
    INSERT INTO listing_signals (property_id, listing_id, signal_type, metadata)
    VALUES (
      NEW.property_id, NEW.id, 'below_market',
      jsonb_build_object(
        'diff_percentage', ROUND(v_diff_pct, 1),
        'price_per_m2', ROUND(v_price_per_m2, 2),
        'median_price_per_m2', v_median
      )
    )
    ON CONFLICT (listing_id, signal_type) WHERE is_active = true
    DO UPDATE SET metadata = EXCLUDED.metadata, detected_at = now();
  ELSE
    UPDATE listing_signals
    SET is_active = false, resolved_at = now()
    WHERE listing_id = NEW.id AND signal_type = 'below_market' AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION sync_below_market_signal() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_sync_below_market_signal
  AFTER INSERT OR UPDATE OF price ON listings
  FOR EACH ROW
  EXECUTE FUNCTION sync_below_market_signal();

-- Trigger 4: multi_source
CREATE OR REPLACE FUNCTION sync_multi_source_signal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_count int;
  r RECORD;
BEGIN
  SELECT COUNT(DISTINCT source) INTO v_source_count
  FROM listings
  WHERE property_id = NEW.property_id AND status = 'active';

  IF v_source_count >= 2 THEN
    FOR r IN SELECT id FROM listings
             WHERE property_id = NEW.property_id AND status = 'active'
    LOOP
      INSERT INTO listing_signals (property_id, listing_id, signal_type, metadata)
      VALUES (
        NEW.property_id,
        r.id,
        'multi_source',
        jsonb_build_object('source_count', v_source_count)
      )
      ON CONFLICT (listing_id, signal_type) WHERE is_active = true
      DO UPDATE SET metadata = EXCLUDED.metadata;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION sync_multi_source_signal() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_sync_multi_source_signal
  AFTER INSERT OR UPDATE OF status ON listings
  FOR EACH ROW
  EXECUTE FUNCTION sync_multi_source_signal();
