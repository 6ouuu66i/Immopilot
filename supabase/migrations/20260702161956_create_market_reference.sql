-- Market reference is refreshed out-of-band after scraping/import completes.
-- Add SELECT refresh_market_reference(); at the end of the existing scraping
-- pipeline once Briques 1-5 are all in place.

CREATE MATERIALIZED VIEW market_reference AS
WITH base AS (
  SELECT
    p.postal_code,
    p.property_type,
    l.transaction_type,
    l.price::numeric / p.living_area AS price_per_m2
  FROM listings l
  JOIN properties p ON p.id = l.property_id
  WHERE l.status = 'active'
    AND p.living_area IS NOT NULL
    AND p.living_area > 0
    AND l.price IS NOT NULL
    AND l.price > 0
    AND p.postal_code IS NOT NULL
    AND p.property_type IS NOT NULL
),
ranked AS (
  SELECT
    postal_code,
    property_type,
    transaction_type,
    price_per_m2,
    PERCENT_RANK() OVER (
      PARTITION BY postal_code, property_type, transaction_type
      ORDER BY price_per_m2
    ) AS pct_rank
  FROM base
),
filtered AS (
  SELECT *
  FROM ranked
  WHERE pct_rank BETWEEN 0.05 AND 0.95
)
SELECT
  postal_code,
  property_type,
  transaction_type,
  ROUND(AVG(price_per_m2)::numeric, 2) AS avg_price_per_m2,
  ROUND(
    (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_per_m2))::numeric,
    2
  ) AS median_price_per_m2,
  COUNT(*) AS sample_size,
  NOW() AS computed_at
FROM filtered
GROUP BY postal_code, property_type, transaction_type
HAVING COUNT(*) >= 5;

-- Index unique requis pour permettre REFRESH MATERIALIZED VIEW CONCURRENTLY.
-- Sans lui, chaque refresh bloquera les lectures pendant son execution.
CREATE UNIQUE INDEX idx_market_reference_unique
  ON market_reference (postal_code, property_type, transaction_type);

-- Index de recherche pour les lookups frequents depuis le moteur de signaux.
CREATE INDEX idx_market_reference_lookup
  ON market_reference (postal_code, property_type);

CREATE OR REPLACE FUNCTION refresh_market_reference()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY market_reference;
END;
$$;

REVOKE EXECUTE ON FUNCTION refresh_market_reference() FROM PUBLIC, anon, authenticated;
