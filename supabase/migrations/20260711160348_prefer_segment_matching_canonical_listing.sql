-- Ensure the canonical listing itself matches the property-level seller segment.
-- This keeps mixed properties on the validated segment without showing an agency
-- listing in Particuliers or a professional-only listing in Agence.

-- Split the canonical active-property source by seller segment at property level.
-- PRIVATE has priority for mixed properties. Agency requires no active PRIVATE
-- listing and at least one active listing from the three validated agency types.
-- Properties represented only by notaries, developers or companies are excluded.

CREATE OR REPLACE VIEW public.active_properties_canonical
AS
WITH seller_segments AS (
  SELECT
    active_listing.property_id,
    CASE
      WHEN BOOL_OR(active_listing.customer_type = 'PRIVATE') THEN 'particulier'
      WHEN BOOL_OR(active_listing.customer_type IN (
        'AGENCY',
        'AGENCY_PAYING_WITH_OGONE',
        'REAL_ESTATE_AGENCY'
      )) THEN 'agence'
      ELSE NULL
    END AS seller_segment
  FROM public.listings active_listing
  WHERE active_listing.status = 'active'
    AND active_listing.property_id IS NOT NULL
  GROUP BY active_listing.property_id
)
SELECT DISTINCT ON (l.property_id)
  l.id AS listing_id,
  l.property_id,
  l.source,
  l.url,
  l.status,
  l.price,
  l.old_price,
  l.is_fsbo,
  l.first_seen_at,
  l.last_seen_at,
  l.published_at,
  l.ai_badges,
  l.ai_summary,
  l.ai_gross_yield,
  l.title_fr,
  l.title_nl,
  COALESCE(score.score, 0) AS seller_score,
  CASE
    WHEN l.old_price IS NOT NULL AND l.price IS NOT NULL AND l.old_price > l.price THEN true
    ELSE false
  END AS has_price_drop,
  EXISTS (
    SELECT 1
    FROM public.listing_signals signal
    WHERE signal.listing_id = l.id
      AND signal.signal_type = 'republished'
      AND signal.is_active = true
  ) AS has_republished_signal,
  GREATEST(
    0,
    CEIL(EXTRACT(EPOCH FROM (now() - COALESCE(l.published_at, l.first_seen_at))) / 86400.0)
  )::integer AS days_online,
  l.photo_urls[1] AS primary_photo_url,
  p.id AS canonical_property_id,
  p.street,
  p.house_number,
  p.postal_code,
  p.locality,
  p.province,
  p.property_type,
  p.property_subtype,
  p.bedroom_count,
  p.bathroom_count,
  p.living_area,
  p.land_area,
  COALESCE(p.living_area, p.land_area, 0) AS surface_value,
  l.customer_type,
  seller_segments.seller_segment
FROM public.listings l
JOIN seller_segments ON seller_segments.property_id = l.property_id
JOIN public.properties p ON p.id = l.property_id
LEFT JOIN public.listing_scores score ON score.property_id = l.property_id
WHERE l.status = 'active'
  AND l.property_id IS NOT NULL
  AND seller_segments.seller_segment IS NOT NULL
ORDER BY
  l.property_id,
  CASE
    WHEN seller_segments.seller_segment = 'particulier' AND l.customer_type = 'PRIVATE' THEN 0
    WHEN seller_segments.seller_segment = 'agence' AND l.customer_type IN (
      'AGENCY',
      'AGENCY_PAYING_WITH_OGONE',
      'REAL_ESTATE_AGENCY'
    ) THEN 0
    ELSE 1
  END,
  l.last_seen_at DESC,
  l.first_seen_at DESC;

DROP MATERIALIZED VIEW IF EXISTS public.active_properties_canonical_mat;

CREATE MATERIALIZED VIEW public.active_properties_canonical_mat
AS
WITH seller_segments AS (
  SELECT
    active_listing.property_id,
    CASE
      WHEN BOOL_OR(active_listing.customer_type = 'PRIVATE') THEN 'particulier'
      WHEN BOOL_OR(active_listing.customer_type IN (
        'AGENCY',
        'AGENCY_PAYING_WITH_OGONE',
        'REAL_ESTATE_AGENCY'
      )) THEN 'agence'
      ELSE NULL
    END AS seller_segment
  FROM public.listings active_listing
  WHERE active_listing.status = 'active'
    AND active_listing.property_id IS NOT NULL
  GROUP BY active_listing.property_id
)
SELECT DISTINCT ON (l.property_id)
  l.id AS listing_id,
  l.property_id,
  l.source,
  l.url,
  l.status,
  l.price,
  l.old_price,
  l.is_fsbo,
  l.is_under_option,
  l.first_seen_at,
  l.last_seen_at,
  l.published_at,
  l.ai_badges,
  l.ai_summary,
  l.ai_gross_yield,
  l.title_fr,
  l.title_nl,
  COALESCE(score.score, 0) AS seller_score,
  CASE
    WHEN l.old_price IS NOT NULL AND l.price IS NOT NULL AND l.old_price > l.price THEN true
    ELSE false
  END AS has_price_drop,
  EXISTS (
    SELECT 1
    FROM public.listing_signals signal
    WHERE signal.listing_id = l.id
      AND signal.signal_type = 'republished'
      AND signal.is_active = true
  ) AS has_republished_signal,
  GREATEST(
    0,
    CEIL(EXTRACT(EPOCH FROM (now() - COALESCE(l.published_at, l.first_seen_at))) / 86400.0)
  )::integer AS days_online,
  l.photo_urls[1] AS primary_photo_url,
  l.photo_urls AS photo_urls,
  p.id AS canonical_property_id,
  p.street,
  p.house_number,
  p.postal_code,
  p.locality,
  p.province,
  p.property_type,
  p.property_subtype,
  p.bedroom_count,
  p.bathroom_count,
  p.living_area,
  p.land_area,
  COALESCE(p.living_area, p.land_area, 0) AS surface_value,
  l.customer_type,
  seller_segments.seller_segment
FROM public.listings l
JOIN seller_segments ON seller_segments.property_id = l.property_id
JOIN public.properties p ON p.id = l.property_id
LEFT JOIN public.listing_scores score ON score.property_id = l.property_id
WHERE l.status = 'active'
  AND l.property_id IS NOT NULL
  AND seller_segments.seller_segment IS NOT NULL
ORDER BY
  l.property_id,
  CASE
    WHEN seller_segments.seller_segment = 'particulier' AND l.customer_type = 'PRIVATE' THEN 0
    WHEN seller_segments.seller_segment = 'agence' AND l.customer_type IN (
      'AGENCY',
      'AGENCY_PAYING_WITH_OGONE',
      'REAL_ESTATE_AGENCY'
    ) THEN 0
    ELSE 1
  END,
  l.last_seen_at DESC,
  l.first_seen_at DESC;

CREATE UNIQUE INDEX active_properties_canonical_mat_listing_id_uidx
  ON public.active_properties_canonical_mat (listing_id);

CREATE INDEX active_properties_canonical_mat_last_seen_idx
  ON public.active_properties_canonical_mat (last_seen_at DESC);

CREATE INDEX active_properties_canonical_mat_price_idx
  ON public.active_properties_canonical_mat (price);

CREATE INDEX active_properties_canonical_mat_postal_code_idx
  ON public.active_properties_canonical_mat (postal_code);

CREATE INDEX active_properties_canonical_mat_seller_score_idx
  ON public.active_properties_canonical_mat (seller_score DESC);

CREATE INDEX active_properties_canonical_mat_fsbo_true_idx
  ON public.active_properties_canonical_mat (is_fsbo)
  WHERE is_fsbo = true;

CREATE INDEX active_properties_canonical_mat_seller_segment_idx
  ON public.active_properties_canonical_mat (seller_segment);

COMMENT ON MATERIALIZED VIEW public.active_properties_canonical_mat IS
  'Canonical active properties split into mutually exclusive particulier/agence seller segments. Professional-only properties are intentionally excluded.';

GRANT SELECT ON public.active_properties_canonical_mat TO authenticated;
