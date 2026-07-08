CREATE OR REPLACE FUNCTION public.get_dashboard_snapshot(p_opportunities_limit int DEFAULT 8)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH active_properties AS (
    SELECT *
    FROM public.active_properties_canonical
  ),
  scored_active_properties AS (
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
      COUNT(*)::int AS scored_properties_count,
      COALESCE(ROUND(AVG(score)::numeric, 1), 0)::numeric AS score_average,
      COALESCE(COUNT(*) FILTER (WHERE band = 'forte'), 0)::int AS forte_count,
      COALESCE(COUNT(*) FILTER (WHERE band = 'surveiller'), 0)::int AS surveiller_count,
      COALESCE(COUNT(*) FILTER (WHERE band = 'faible'), 0)::int AS faible_count,
      MAX(computed_at) AS last_sync_at
    FROM scored_active_properties
  ),
  recent_price_drops AS (
    SELECT
      COUNT(*)::int AS price_drop_count,
      COALESCE(SUM(ABS(COALESCE(change_amount, 0))), 0)::numeric AS price_drop_total
    FROM public.price_history
    WHERE change_type IN ('decrease', 'price_drop')
      AND detected_at >= now() - INTERVAL '7 days'
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
        'subtitle', concat_ws(' - ', ranked.locality, CASE COALESCE(ranked.property_subtype, ranked.property_type)
          WHEN 'APARTMENT' THEN 'Appartement'
          WHEN 'APARTMENT_GROUP' THEN 'Projet appartements'
          WHEN 'HOUSE' THEN 'Maison'
          WHEN 'HOUSE_GROUP' THEN 'Projet maisons'
          WHEN 'LAND' THEN 'Terrain'
          WHEN 'BUILDING_LAND' THEN 'Terrain a batir'
          ELSE COALESCE(replace(lower(COALESCE(ranked.property_subtype, ranked.property_type)), '_', ' '), 'Bien')
        END, CASE lower(ranked.source)
          WHEN 'immoweb' THEN 'Immoweb'
          WHEN 'zimmo' THEN 'Zimmo'
          WHEN 'immovlan' THEN 'Immovlan'
          WHEN 'biddit' THEN 'Biddit'
          WHEN '2ememain' THEN '2ememain'
          WHEN 'immoffice' THEN 'Immoffice'
          ELSE ranked.source
        END),
        'surface', ranked.surface_value,
        'title', COALESCE(NULLIF(ranked.title_fr, ''), NULLIF(ranked.title_nl, ''), concat_ws(' ', ranked.street, ranked.house_number), COALESCE(ranked.property_subtype, ranked.property_type, 'Bien'))
      )
      ORDER BY ranked.score DESC, COALESCE(NULLIF(ranked.title_fr, ''), NULLIF(ranked.title_nl, ''), concat_ws(' ', ranked.street, ranked.house_number), COALESCE(ranked.property_subtype, ranked.property_type, 'Bien'))
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
        latest_signal.signal_type AS latest_signal_label
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
      ORDER BY score.score DESC, COALESCE(NULLIF(property.title_fr, ''), NULLIF(property.title_nl, ''), concat_ws(' ', property.street, property.house_number), COALESCE(property.property_subtype, property.property_type, 'Bien'))
      LIMIT GREATEST(COALESCE(p_opportunities_limit, 8), 0)
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
      )
      ORDER BY signal.detected_at DESC
    ), '[]'::jsonb) AS items
    FROM (
      SELECT signal.*
      FROM public.listing_signals signal
      JOIN active_properties property ON property.property_id = signal.property_id
      WHERE signal.is_active = true
      ORDER BY signal.detected_at DESC
      LIMIT 4
    ) signal
    JOIN active_properties property ON property.property_id = signal.property_id
  )
  SELECT jsonb_build_object(
    'active_listings_count', (SELECT COUNT(*)::int FROM public.listings WHERE status = 'active'),
    'active_properties_count', (SELECT COUNT(DISTINCT property_id)::int FROM active_properties),
    'active_signals_count', (SELECT COUNT(*)::int FROM public.listing_signals WHERE is_active = true),
    'fsbo_count', (SELECT COUNT(*)::int FROM active_properties WHERE is_fsbo = true),
    'hot_opportunities_count', (SELECT forte_count FROM score_stats),
    'last_sync_at', (SELECT last_sync_at FROM score_stats),
    'opportunities', (SELECT items FROM opportunities),
    'price_drop_count', (SELECT price_drop_count FROM recent_price_drops),
    'price_drop_total', (SELECT price_drop_total FROM recent_price_drops),
    'score_average', (SELECT score_average FROM score_stats),
    'score_distribution', jsonb_build_object(
      'faible', (SELECT faible_count FROM score_stats),
      'forte', (SELECT forte_count FROM score_stats),
      'surveiller', (SELECT surveiller_count FROM score_stats)
    ),
    'scored_properties_count', (SELECT scored_properties_count FROM score_stats),
    'signals', (SELECT items FROM recent_signals)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_dashboard_snapshot(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_snapshot(int) TO authenticated;
