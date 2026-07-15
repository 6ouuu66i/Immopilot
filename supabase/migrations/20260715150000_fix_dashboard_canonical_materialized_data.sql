-- F-008 / F-014: keep one canonical business definition, serve the Dashboard
-- from its materialized snapshot, and expose only guarded RPCs to clients.

DROP MATERIALIZED VIEW IF EXISTS public.active_properties_canonical_mat_next;
DROP MATERIALIZED VIEW IF EXISTS public.active_properties_canonical_mat_previous;

CREATE MATERIALIZED VIEW public.active_properties_canonical_mat_next
AS
SELECT *
FROM public.active_properties_canonical;

ALTER MATERIALIZED VIEW public.active_properties_canonical_mat_next OWNER TO postgres;

CREATE UNIQUE INDEX active_properties_canonical_mat_next_listing_id_uidx
  ON public.active_properties_canonical_mat_next (listing_id);

CREATE INDEX active_properties_canonical_mat_next_last_seen_idx
  ON public.active_properties_canonical_mat_next (last_seen_at DESC);

CREATE INDEX active_properties_canonical_mat_next_price_idx
  ON public.active_properties_canonical_mat_next (price);

CREATE INDEX active_properties_canonical_mat_next_postal_code_idx
  ON public.active_properties_canonical_mat_next (postal_code);

CREATE INDEX active_properties_canonical_mat_next_seller_score_idx
  ON public.active_properties_canonical_mat_next (seller_score DESC);

CREATE INDEX active_properties_canonical_mat_next_fsbo_true_idx
  ON public.active_properties_canonical_mat_next (is_fsbo)
  WHERE is_fsbo = true;

CREATE INDEX active_properties_canonical_mat_next_seller_segment_idx
  ON public.active_properties_canonical_mat_next (seller_segment);

CREATE INDEX active_properties_canonical_mat_next_search_trgm_idx
  ON public.active_properties_canonical_mat_next
  USING gin ((
    COALESCE(title_fr, '') || ' ' ||
    COALESCE(locality, '') || ' ' ||
    COALESCE(postal_code, '')
  ) gin_trgm_ops);

DO $$
DECLARE
  v_live_columns text[];
  v_mat_columns text[];
  v_only_live bigint;
  v_only_mat bigint;
  v_business_differences bigint;
BEGIN
  SELECT array_agg(attribute.attname || ':' || pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)
                   ORDER BY attribute.attnum)
  INTO v_live_columns
  FROM pg_catalog.pg_attribute attribute
  WHERE attribute.attrelid = 'public.active_properties_canonical'::regclass
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  SELECT array_agg(attribute.attname || ':' || pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)
                   ORDER BY attribute.attnum)
  INTO v_mat_columns
  FROM pg_catalog.pg_attribute attribute
  WHERE attribute.attrelid = 'public.active_properties_canonical_mat_next'::regclass
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  IF v_live_columns IS DISTINCT FROM v_mat_columns THEN
    RAISE EXCEPTION 'Canonical view/materialized-view column parity failed';
  END IF;

  SELECT
    count(*) FILTER (WHERE live.listing_id IS NULL),
    count(*) FILTER (WHERE materialized.listing_id IS NULL),
    count(*) FILTER (
      WHERE live.listing_id IS NOT NULL
        AND materialized.listing_id IS NOT NULL
        AND (to_jsonb(live) - 'days_online')
          IS DISTINCT FROM (to_jsonb(materialized) - 'days_online')
    )
  INTO v_only_mat, v_only_live, v_business_differences
  FROM public.active_properties_canonical live
  FULL JOIN public.active_properties_canonical_mat_next materialized USING (listing_id);

  IF v_only_live <> 0 OR v_only_mat <> 0 OR v_business_differences <> 0 THEN
    RAISE EXCEPTION
      'Canonical materialized-view parity failed (only_live %, only_mat %, business_differences %)',
      v_only_live, v_only_mat, v_business_differences;
  END IF;
END;
$$;

-- The expensive build and validation happen before this short transactional swap.
ALTER MATERIALIZED VIEW public.active_properties_canonical_mat
  RENAME TO active_properties_canonical_mat_previous;
ALTER MATERIALIZED VIEW public.active_properties_canonical_mat_next
  RENAME TO active_properties_canonical_mat;
DROP MATERIALIZED VIEW public.active_properties_canonical_mat_previous;

ALTER INDEX public.active_properties_canonical_mat_next_listing_id_uidx
  RENAME TO active_properties_canonical_mat_listing_id_uidx;
ALTER INDEX public.active_properties_canonical_mat_next_last_seen_idx
  RENAME TO active_properties_canonical_mat_last_seen_idx;
ALTER INDEX public.active_properties_canonical_mat_next_price_idx
  RENAME TO active_properties_canonical_mat_price_idx;
ALTER INDEX public.active_properties_canonical_mat_next_postal_code_idx
  RENAME TO active_properties_canonical_mat_postal_code_idx;
ALTER INDEX public.active_properties_canonical_mat_next_seller_score_idx
  RENAME TO active_properties_canonical_mat_seller_score_idx;
ALTER INDEX public.active_properties_canonical_mat_next_fsbo_true_idx
  RENAME TO active_properties_canonical_mat_fsbo_true_idx;
ALTER INDEX public.active_properties_canonical_mat_next_seller_segment_idx
  RENAME TO active_properties_canonical_mat_seller_segment_idx;
ALTER INDEX public.active_properties_canonical_mat_next_search_trgm_idx
  RENAME TO active_properties_canonical_mat_search_trgm_idx;

COMMENT ON MATERIALIZED VIEW public.active_properties_canonical_mat IS
  'Snapshot of active_properties_canonical. days_online is intentionally frozen at the latest materialized-view refresh; all other business fields must match the canonical view at refresh time.';

REVOKE ALL ON public.active_properties_canonical_mat FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.active_properties_canonical_mat TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_active_properties_canonical()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.active_properties_canonical_mat;
END;
$$;

ALTER FUNCTION public.refresh_active_properties_canonical() OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.refresh_active_properties_canonical()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_active_properties_canonical() TO service_role;

CREATE OR REPLACE FUNCTION public.get_dashboard_snapshot(p_opportunities_limit integer DEFAULT 8)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_opportunities_limit integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Acces Dashboard refuse: utilisateur non authentifie.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles profile
    WHERE profile.id = v_user_id
      AND profile.is_active = true
      AND profile.agency_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Acces Dashboard refuse: appartenance a une agence active requise.';
  END IF;

  v_opportunities_limit := LEAST(GREATEST(COALESCE(p_opportunities_limit, 8), 0), 24);

  RETURN (
    WITH active_properties AS MATERIALIZED (
      SELECT *
      FROM public.active_properties_canonical_mat
    ),
    scored_active_properties AS MATERIALIZED (
      SELECT
        score.property_id,
        score.score,
        score.band,
        score.confidence,
        score.breakdown,
        score.computed_at
      FROM public.listing_scores score
      JOIN active_properties property ON property.property_id = score.property_id
    ),
    score_stats AS (
      SELECT
        COUNT(*)::integer AS scored_properties_count,
        COALESCE(ROUND(AVG(score)::numeric, 1), 0)::numeric AS score_average,
        COALESCE(COUNT(*) FILTER (WHERE band = 'forte'), 0)::integer AS forte_count,
        COALESCE(COUNT(*) FILTER (WHERE band = 'surveiller'), 0)::integer AS surveiller_count,
        COALESCE(COUNT(*) FILTER (WHERE band = 'faible'), 0)::integer AS faible_count,
        MAX(computed_at) AS last_scores_computed_at
      FROM scored_active_properties
    ),
    canonical_signal_stats AS (
      SELECT COUNT(*)::integer AS active_signals_count
      FROM public.listing_signals signal
      JOIN active_properties property ON property.property_id = signal.property_id
      WHERE signal.is_active = true
    ),
    recent_price_drops AS (
      SELECT
        COUNT(*)::integer AS price_drop_count,
        COALESCE(SUM(ABS(COALESCE(history.change_amount, 0))), 0)::numeric AS price_drop_total
      FROM public.price_history history
      WHERE history.change_type IN ('decrease', 'price_drop')
        AND history.detected_at >= pg_catalog.now() - INTERVAL '7 days'
    ),
    freshness AS (
      SELECT
        (SELECT MAX(listing.last_seen_at)
         FROM public.listings listing
         WHERE listing.status = 'active') AS last_listing_seen_at,
        (SELECT stats.last_scores_computed_at FROM score_stats stats) AS last_scores_computed_at,
        (SELECT MAX(run.finished_at)
         FROM public.pipeline_runs run
         WHERE run.status = 'success') AS last_pipeline_success_at,
        (SELECT MAX(step.finished_at)
         FROM public.pipeline_run_steps step
         WHERE step.step_name = 'refresh_active_properties_canonical'
           AND step.status = 'success') AS canonical_refreshed_at
    ),
    opportunities AS (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'addedAt', ranked.computed_at,
          'band', ranked.band,
          'confidence', ranked.confidence,
          'id', ranked.property_id,
          'photo', ranked.primary_photo_url,
          'price', ranked.price,
          'propertyId', ranked.property_id,
          'score', ranked.score,
          'signal', COALESCE(
            ranked.breakdown->'reasons'->0->>'reason_fr',
            ranked.latest_signal_label,
            'Aucun signal score'
          ),
          'source', CASE lower(ranked.source)
            WHEN 'immoweb' THEN 'Immoweb'
            WHEN 'zimmo' THEN 'Zimmo'
            WHEN 'immovlan' THEN 'Immovlan'
            WHEN 'biddit' THEN 'Biddit'
            WHEN '2ememain' THEN '2ememain'
            WHEN 'immoffice' THEN 'Immoffice'
            ELSE ranked.source
          END,
          'subtitle', concat_ws(' - ', ranked.locality,
            CASE COALESCE(ranked.property_subtype, ranked.property_type)
              WHEN 'APARTMENT' THEN 'Appartement'
              WHEN 'APARTMENT_GROUP' THEN 'Projet appartements'
              WHEN 'HOUSE' THEN 'Maison'
              WHEN 'HOUSE_GROUP' THEN 'Projet maisons'
              WHEN 'LAND' THEN 'Terrain'
              WHEN 'BUILDING_LAND' THEN 'Terrain a batir'
              ELSE COALESCE(
                replace(lower(COALESCE(ranked.property_subtype, ranked.property_type)), '_', ' '),
                'Bien'
              )
            END,
            CASE lower(ranked.source)
              WHEN 'immoweb' THEN 'Immoweb'
              WHEN 'zimmo' THEN 'Zimmo'
              WHEN 'immovlan' THEN 'Immovlan'
              WHEN 'biddit' THEN 'Biddit'
              WHEN '2ememain' THEN '2ememain'
              WHEN 'immoffice' THEN 'Immoffice'
              ELSE ranked.source
            END
          ),
          'surface', ranked.surface_value,
          'title', COALESCE(
            NULLIF(ranked.title_fr, ''),
            NULLIF(ranked.title_nl, ''),
            concat_ws(' ', ranked.street, ranked.house_number),
            COALESCE(ranked.property_subtype, ranked.property_type, 'Bien')
          )
        ) ORDER BY ranked.score DESC, ranked.title
      ), '[]'::jsonb) AS items
      FROM (
        SELECT
          property.property_id,
          property.primary_photo_url,
          property.price,
          property.source,
          property.locality,
          property.property_subtype,
          property.property_type,
          property.surface_value,
          property.title_fr,
          property.title_nl,
          property.street,
          property.house_number,
          score.score,
          score.band,
          score.confidence,
          score.breakdown,
          score.computed_at,
          latest_signal.signal_type AS latest_signal_label,
          COALESCE(
            NULLIF(property.title_fr, ''),
            NULLIF(property.title_nl, ''),
            concat_ws(' ', property.street, property.house_number),
            COALESCE(property.property_subtype, property.property_type, 'Bien')
          ) AS title
        FROM scored_active_properties score
        JOIN active_properties property ON property.property_id = score.property_id
        LEFT JOIN LATERAL (
          SELECT signal.signal_type
          FROM public.listing_signals signal
          WHERE signal.property_id = property.property_id
            AND signal.is_active = true
          ORDER BY signal.detected_at DESC
          LIMIT 1
        ) latest_signal ON true
        ORDER BY score.score DESC, title
        LIMIT v_opportunities_limit
      ) ranked
    ),
    recent_signals AS (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'detected_at', signal.detected_at,
          'id', signal.id,
          'is_active', signal.is_active,
          'listing_id', signal.listing_id,
          'metadata', signal.metadata,
          'property_id', signal.property_id,
          'signal_type', signal.signal_type,
          'source', CASE lower(property.source)
            WHEN 'immoweb' THEN 'Immoweb'
            WHEN 'zimmo' THEN 'Zimmo'
            WHEN 'immovlan' THEN 'Immovlan'
            WHEN 'biddit' THEN 'Biddit'
            WHEN '2ememain' THEN '2ememain'
            WHEN 'immoffice' THEN 'Immoffice'
            ELSE property.source
          END
        ) ORDER BY signal.detected_at DESC
      ), '[]'::jsonb) AS items
      FROM (
        SELECT candidate.*
        FROM public.listing_signals candidate
        JOIN active_properties property ON property.property_id = candidate.property_id
        WHERE candidate.is_active = true
        ORDER BY candidate.detected_at DESC
        LIMIT 4
      ) signal
      JOIN active_properties property ON property.property_id = signal.property_id
    )
    SELECT jsonb_build_object(
      'active_listings_count', (
        SELECT COUNT(*)::integer FROM public.listings listing WHERE listing.status = 'active'
      ),
      'active_properties_count', (SELECT COUNT(*)::integer FROM active_properties),
      'active_signals_count', (SELECT stats.active_signals_count FROM canonical_signal_stats stats),
      'fsbo_count', (SELECT COUNT(*)::integer FROM active_properties WHERE is_fsbo = true),
      'hot_opportunities_count', (SELECT stats.forte_count FROM score_stats stats),
      'last_listing_seen_at', (SELECT value.last_listing_seen_at FROM freshness value),
      'last_scores_computed_at', (SELECT value.last_scores_computed_at FROM freshness value),
      'last_pipeline_success_at', (SELECT value.last_pipeline_success_at FROM freshness value),
      'canonical_refreshed_at', (SELECT value.canonical_refreshed_at FROM freshness value),
      'opportunities', (SELECT value.items FROM opportunities value),
      'price_drop_count', (SELECT stats.price_drop_count FROM recent_price_drops stats),
      'price_drop_total', (SELECT stats.price_drop_total FROM recent_price_drops stats),
      'score_average', (SELECT stats.score_average FROM score_stats stats),
      'score_distribution', jsonb_build_object(
        'faible', (SELECT stats.faible_count FROM score_stats stats),
        'forte', (SELECT stats.forte_count FROM score_stats stats),
        'surveiller', (SELECT stats.surveiller_count FROM score_stats stats)
      ),
      'scored_properties_count', (SELECT stats.scored_properties_count FROM score_stats stats),
      'signals', (SELECT value.items FROM recent_signals value)
    )
  );
END;
$$;

ALTER FUNCTION public.get_dashboard_snapshot(integer) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_snapshot(integer)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_dashboard_snapshot(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_active_properties(
  search_term text,
  result_limit integer DEFAULT 6
)
RETURNS TABLE (
  listing_id uuid,
  property_id uuid,
  title_fr text,
  locality text,
  postal_code text,
  price integer,
  primary_photo_url text,
  seller_score numeric,
  seller_segment text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_term text;
  v_pattern text;
  v_limit integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Recherche refusee: utilisateur non authentifie.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles profile
    WHERE profile.id = v_user_id
      AND profile.is_active = true
      AND profile.agency_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Recherche refusee: appartenance a une agence active requise.';
  END IF;

  v_term := pg_catalog.btrim(COALESCE(search_term, ''));
  IF pg_catalog.length(v_term) < 2 THEN
    RETURN;
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(result_limit, 6), 1), 20);
  v_pattern := '%' ||
    pg_catalog.replace(
      pg_catalog.replace(
        pg_catalog.replace(
          v_term,
          pg_catalog.chr(92),
          pg_catalog.chr(92) || pg_catalog.chr(92)
        ),
        '%',
        pg_catalog.chr(92) || '%'
      ),
      '_',
      pg_catalog.chr(92) || '_'
    ) || '%';

  RETURN QUERY
  SELECT
    property.listing_id,
    property.property_id,
    property.title_fr,
    property.locality,
    property.postal_code,
    property.price,
    property.primary_photo_url,
    property.seller_score,
    property.seller_segment
  FROM public.active_properties_canonical_mat property
  WHERE (
    COALESCE(property.title_fr, '') || ' ' ||
    COALESCE(property.locality, '') || ' ' ||
    COALESCE(property.postal_code, '')
  ) ILIKE v_pattern ESCAPE E'\\'
  ORDER BY property.last_seen_at DESC
  LIMIT v_limit;
END;
$$;

ALTER FUNCTION public.search_active_properties(text, integer) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.search_active_properties(text, integer)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.search_active_properties(text, integer) TO authenticated;

COMMENT ON FUNCTION public.get_dashboard_snapshot(integer) IS
  'Guarded Dashboard snapshot backed by active_properties_canonical_mat. Returns market aggregates only; no CRM rows.';
COMMENT ON FUNCTION public.search_active_properties(text, integer) IS
  'Guarded, server-limited property search backed by active_properties_canonical_mat. Returns no CRM data.';
