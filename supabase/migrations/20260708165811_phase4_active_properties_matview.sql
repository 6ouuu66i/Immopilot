DROP MATERIALIZED VIEW IF EXISTS public.active_properties_canonical_mat;

CREATE MATERIALIZED VIEW public.active_properties_canonical_mat
AS
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
  COALESCE(p.living_area, p.land_area, 0) AS surface_value
FROM public.listings l
JOIN public.properties p ON p.id = l.property_id
LEFT JOIN public.listing_scores score ON score.property_id = l.property_id
WHERE l.status = 'active'
  AND l.property_id IS NOT NULL
ORDER BY l.property_id, l.last_seen_at DESC, l.first_seen_at DESC;

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

GRANT SELECT ON public.active_properties_canonical_mat TO authenticated;

CREATE OR REPLACE FUNCTION public.refresh_active_properties_canonical()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.active_properties_canonical_mat;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_active_properties_canonical() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_scan_complete()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM refresh_market_reference();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_scan_complete refresh_market_reference failed: %', SQLERRM;
  END;

  BEGIN
    PERFORM refresh_active_properties_canonical();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_scan_complete refresh_active_properties_canonical failed: %', SQLERRM;
  END;

  BEGIN
    PERFORM compute_listing_scores();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_scan_complete compute_listing_scores failed: %', SQLERRM;
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_scan_complete() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_scan_complete() TO service_role;

CREATE OR REPLACE FUNCTION public.sync_daily_pipeline()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM refresh_market_reference();
  PERFORM sync_overpriced_signal_batch();
  PERFORM sync_stale_dom_relative_signal_batch();
  PERFORM sync_failed_launch_signal_batch();
  PERFORM sync_competition_shock_signal_batch();
  PERFORM sync_agency_mandate_aging_signal();
  PERFORM compute_listing_scores();
  PERFORM refresh_active_properties_canonical();
  PERFORM purge_listing_score_history();
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sync_daily_pipeline failed: %', SQLERRM;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_daily_pipeline() FROM PUBLIC, anon, authenticated;
