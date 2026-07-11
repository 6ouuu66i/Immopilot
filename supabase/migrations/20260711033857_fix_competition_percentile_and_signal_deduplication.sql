-- Correct competition_shock to use a property-specific relative local-segment rank.
-- Deduplicate every signal type per property before applying family caps.

CREATE OR REPLACE FUNCTION public.sync_competition_shock_signal_batch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  WITH active_listings AS (
    SELECT l.id AS listing_id, l.property_id, l.transaction_type, l.published_at, l.price,
           p.postal_code, p.property_type
    FROM public.listings l
    JOIN public.properties p ON p.id = l.property_id
    WHERE l.status = 'active'
      AND l.published_at IS NOT NULL
      AND p.postal_code IS NOT NULL
      AND p.property_type IS NOT NULL
      AND l.transaction_type IS NOT NULL
      AND l.price IS NOT NULL
      AND l.price > 0
  ),
  competition_counts AS (
    SELECT target.listing_id, target.property_id, target.postal_code, target.property_type,
           COUNT(DISTINCT competitor.property_id) AS new_competitor_count
    FROM active_listings target
    LEFT JOIN active_listings competitor
      ON competitor.postal_code = target.postal_code
     AND competitor.property_type = target.property_type
     AND competitor.transaction_type = target.transaction_type
     AND competitor.price BETWEEN target.price * 0.80 AND target.price * 1.20
     AND competitor.property_id <> target.property_id
     AND competitor.published_at >= now() - INTERVAL '14 days'
    WHERE target.published_at < now() - INTERVAL '14 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.price_history ph
        WHERE ph.listing_id = target.listing_id
          AND ph.detected_at >= now() - INTERVAL '14 days'
          AND ph.change_type IN ('decrease','price_drop','increase','price_increase')
      )
    GROUP BY target.listing_id, target.property_id, target.postal_code, target.property_type
  ),
  ranked AS (
    SELECT *,
      COUNT(*) OVER (PARTITION BY postal_code, property_type) AS comparable_count,
      PERCENT_RANK() OVER (
        PARTITION BY postal_code, property_type
        ORDER BY new_competitor_count
      ) AS competition_percentile
    FROM competition_counts
  ),
  candidates AS (
    SELECT * FROM ranked
    WHERE comparable_count >= 5
      AND competition_percentile >= 0.85
  )
  INSERT INTO public.listing_signals (property_id, listing_id, signal_type, metadata)
  SELECT c.property_id, c.listing_id, 'competition_shock',
    jsonb_build_object(
      'new_competitor_count', c.new_competitor_count,
      'competition_percentile', ROUND(c.competition_percentile::numeric, 3),
      'comparable_count', c.comparable_count,
      'window_days', 14,
      'price_band_pct', 20,
      'detected_via', 'daily_market_batch'
    )
  FROM candidates c
  ON CONFLICT (listing_id, signal_type) WHERE is_active = true
  DO UPDATE SET metadata = EXCLUDED.metadata, detected_at = now();

  WITH active_listings AS (
    SELECT l.id AS listing_id, l.property_id, l.transaction_type, l.published_at, l.price,
           p.postal_code, p.property_type
    FROM public.listings l
    JOIN public.properties p ON p.id = l.property_id
    WHERE l.status = 'active'
      AND l.published_at IS NOT NULL
      AND p.postal_code IS NOT NULL
      AND p.property_type IS NOT NULL
      AND l.transaction_type IS NOT NULL
      AND l.price IS NOT NULL
      AND l.price > 0
  ),
  competition_counts AS (
    SELECT target.listing_id, target.property_id, target.postal_code, target.property_type,
           COUNT(DISTINCT competitor.property_id) AS new_competitor_count
    FROM active_listings target
    LEFT JOIN active_listings competitor
      ON competitor.postal_code = target.postal_code
     AND competitor.property_type = target.property_type
     AND competitor.transaction_type = target.transaction_type
     AND competitor.price BETWEEN target.price * 0.80 AND target.price * 1.20
     AND competitor.property_id <> target.property_id
     AND competitor.published_at >= now() - INTERVAL '14 days'
    WHERE target.published_at < now() - INTERVAL '14 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.price_history ph
        WHERE ph.listing_id = target.listing_id
          AND ph.detected_at >= now() - INTERVAL '14 days'
          AND ph.change_type IN ('decrease','price_drop','increase','price_increase')
      )
    GROUP BY target.listing_id, target.property_id, target.postal_code, target.property_type
  ),
  ranked AS (
    SELECT *,
      COUNT(*) OVER (PARTITION BY postal_code, property_type) AS comparable_count,
      PERCENT_RANK() OVER (
        PARTITION BY postal_code, property_type
        ORDER BY new_competitor_count
      ) AS competition_percentile
    FROM competition_counts
  ),
  candidates AS (
    SELECT listing_id FROM ranked
    WHERE comparable_count >= 5
      AND competition_percentile >= 0.85
  )
  UPDATE public.listing_signals ls
  SET is_active = false, resolved_at = now()
  WHERE ls.signal_type = 'competition_shock'
    AND ls.is_active = true
    AND NOT EXISTS (SELECT 1 FROM candidates c WHERE c.listing_id = ls.listing_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.compute_listing_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_history_count int;
BEGIN
  WITH active_listings AS (
    SELECT l.*
    FROM public.listings l
    WHERE l.status = 'active'
      AND l.property_id IS NOT NULL
  ),
  active_properties AS (
    SELECT
      al.property_id,
      BOOL_OR(COALESCE(al.is_fsbo, false)) AS has_fsbo,
      BOOL_OR(NOT COALESCE(al.is_fsbo, false)) AS has_agency_listing,
      COUNT(*) AS active_listing_count
    FROM active_listings al
    GROUP BY al.property_id
  ),
  active_property_signals AS (
    SELECT
      ls.id AS signal_id,
      ls.property_id,
      ls.listing_id,
      ls.signal_type,
      ls.metadata,
      COALESCE((ls.metadata->>'event_at')::timestamptz, ls.detected_at) AS event_at,
      sc.family_key,
      sf.label_fr AS family_label_fr,
      sf.family_cap,
      sf.display_rank,
      sc.signal_kind,
      sc.max_points,
      sc.half_life_days,
      sc.mult_fsbo,
      sc.mult_agency,
      sc.exclusive_group,
      sc.reason_template_fr,
      ap.has_fsbo,
      ap.has_agency_listing
    FROM public.listing_signals ls
    JOIN active_listings al ON al.id = ls.listing_id
    JOIN active_properties ap ON ap.property_id = ls.property_id
    JOIN public.scoring_config sc
      ON sc.signal_key = ls.signal_type
     AND sc.is_active = true
    JOIN public.scoring_families sf ON sf.family_key = sc.family_key
    WHERE ls.is_active = true
  ),
  decayed AS (
    SELECT
      aps.*,
      ROUND(
        (
          aps.max_points
          * CASE
              WHEN aps.has_fsbo THEN aps.mult_fsbo
              ELSE aps.mult_agency
            END
          * CASE
              WHEN aps.signal_kind = 'state' THEN 1
              ELSE exp(
                (-ln(2) * GREATEST(EXTRACT(EPOCH FROM (now() - aps.event_at)) / 86400, 0))
                / NULLIF(aps.half_life_days, 0)
              )
            END
        )::numeric,
        4
      ) AS contribution
    FROM active_property_signals aps
  ),
  deduped AS (
    SELECT *
    FROM (
      SELECT
        d.*,
        ROW_NUMBER() OVER (
          PARTITION BY d.property_id, d.family_key, COALESCE(d.exclusive_group, d.signal_type)
          ORDER BY d.contribution DESC, d.event_at DESC
        ) AS contribution_rank
      FROM decayed d
    ) ranked
    WHERE contribution_rank = 1
      AND contribution > 0
  ),
  reason_items AS (
    SELECT
      d.property_id,
      d.contribution,
      d.event_at,
      jsonb_build_object(
        'signal', d.signal_type,
        'family', d.family_key,
        'family_label_fr', d.family_label_fr,
        'listing_id', d.listing_id,
        'contribution', ROUND(d.contribution, 2),
        'max_points', d.max_points,
        'signal_kind', d.signal_kind,
        'event_at', d.event_at,
        'reason_fr', d.reason_template_fr,
        'facts', to_jsonb(array_remove(ARRAY[
          CASE
            WHEN (d.metadata->>'diff_percentage') ~ '^-?[0-9]+(\.[0-9]+)?$'
              AND (d.metadata->>'diff_percentage')::numeric <> 0
              THEN concat(
                CASE WHEN (d.metadata->>'diff_percentage')::numeric > 0 THEN '+' ELSE '' END,
                ROUND((d.metadata->>'diff_percentage')::numeric, 1)::text,
                '%'
              )
            ELSE NULL
          END,
          CASE
            WHEN (d.metadata->>'days_on_market') ~ '^[0-9]+(\.[0-9]+)?$'
              AND (d.metadata->>'days_on_market')::numeric > 0
              THEN concat(ROUND((d.metadata->>'days_on_market')::numeric)::text, ' j')
            ELSE NULL
          END,
          CASE
            WHEN (d.metadata->>'new_competitor_count') ~ '^[0-9]+(\.[0-9]+)?$'
              AND (d.metadata->>'new_competitor_count')::numeric > 0
              THEN concat(ROUND((d.metadata->>'new_competitor_count')::numeric)::text, ' concurrents')
            ELSE NULL
          END,
          CASE
            WHEN (d.metadata->>'source_count') ~ '^[0-9]+(\.[0-9]+)?$'
              AND (d.metadata->>'source_count')::numeric > 0
              THEN concat(ROUND((d.metadata->>'source_count')::numeric)::text, ' sources')
            ELSE NULL
          END,
          CASE
            WHEN d.signal_type IN ('below_market', 'overpriced')
              AND (d.metadata->>'price_per_m2') ~ '^[0-9]+(\.[0-9]+)?$'
              AND (d.metadata->>'price_per_m2')::numeric > 0
              THEN concat(ROUND((d.metadata->>'price_per_m2')::numeric)::text, ' EUR/m2')
            ELSE NULL
          END
        ]::text[], NULL)),
        'metadata', d.metadata
      ) AS reason
    FROM deduped d
  ),
  per_family AS (
    SELECT
      d.property_id,
      d.family_key,
      LEAST(MAX(d.family_cap), SUM(d.contribution)) AS family_score,
      COUNT(*) AS signals_count
    FROM deduped d
    GROUP BY d.property_id, d.family_key
  ),
  totals AS (
    SELECT
      ap.property_id,
      COALESCE(SUM(pf.family_score), 0)::numeric AS raw_score,
      COUNT(*) FILTER (WHERE pf.family_score > 0)::int AS families_count,
      COALESCE(SUM(pf.signals_count), 0)::int AS signals_count,
      COALESCE(
        (
          SELECT jsonb_agg(ri.reason ORDER BY ri.contribution DESC, ri.event_at DESC)
          FROM reason_items ri
          WHERE ri.property_id = ap.property_id
        ),
        '[]'::jsonb
      ) AS reasons_breakdown
    FROM active_properties ap
    LEFT JOIN per_family pf ON pf.property_id = ap.property_id
    GROUP BY ap.property_id
  ),
  existing_scores AS (
    SELECT ls.property_id, ls.band AS previous_band
    FROM public.listing_scores ls
  ),
  scored AS (
    SELECT
      t.property_id,
      ROUND(LEAST(100, t.raw_score), 2) AS raw_score,
      ROUND(LEAST(100, t.raw_score), 2) AS score,
      t.families_count,
      t.signals_count,
      t.reasons_breakdown,
      CASE
        WHEN t.raw_score >= 75 AND t.families_count >= 2 THEN 'forte'
        WHEN t.raw_score >= 52 THEN 'surveiller'
        ELSE 'faible'
      END AS candidate_band,
      es.previous_band
    FROM totals t
    LEFT JOIN existing_scores es ON es.property_id = t.property_id
  ),
  banded AS (
    SELECT
      s.*,
      CASE
        WHEN s.previous_band = 'forte'
          AND s.raw_score >= 72
          AND s.families_count >= 2
          THEN 'forte'
        WHEN s.previous_band = 'surveiller'
          AND s.candidate_band = 'forte'
          AND s.raw_score < 78
          THEN 'surveiller'
        WHEN s.previous_band = 'surveiller'
          AND s.candidate_band = 'faible'
          AND s.raw_score >= 49
          THEN 'surveiller'
        WHEN s.previous_band = 'faible'
          AND s.candidate_band = 'surveiller'
          AND s.raw_score < 55
          THEN 'faible'
        WHEN s.previous_band = 'faible'
          AND s.candidate_band = 'forte'
          AND s.raw_score < 78
          THEN 'surveiller'
        ELSE s.candidate_band
      END AS band
    FROM scored s
  ),
  with_confidence AS (
    SELECT
      b.property_id,
      b.score,
      b.raw_score,
      b.band,
      c.confidence,
      c.confidence_score,
      c.detail AS confidence_detail,
      jsonb_build_object(
        'score_name', 'Indice de tension vendeur',
        'reasons', b.reasons_breakdown,
        'informational', '[]'::jsonb,
        'excluded', jsonb_build_array('Sous-exposition marketing prevue au bareme, signal non implemente.'),
        'rules', jsonb_build_object(
          'unit', 'property_id',
          'strong_requires_min_families', 2,
          'hysteresis_points', 3,
          'marketing_underexposed', 'planned_not_implemented',
          'peb_scored', false
        )
      ) AS breakdown,
      b.families_count,
      b.signals_count,
      1 AS score_version
    FROM banded b
    CROSS JOIN LATERAL public.compute_listing_confidence(b.property_id) c
  ),
  upserted AS (
    INSERT INTO public.listing_scores (
      property_id,
      score,
      raw_score,
      band,
      confidence,
      confidence_score,
      confidence_detail,
      breakdown,
      families_count,
      signals_count,
      score_version,
      computed_at
    )
    SELECT
      property_id,
      score,
      raw_score,
      band,
      confidence,
      confidence_score,
      confidence_detail,
      breakdown,
      families_count,
      signals_count,
      score_version,
      now()
    FROM with_confidence
    ON CONFLICT (property_id) DO UPDATE SET
      score = EXCLUDED.score,
      raw_score = EXCLUDED.raw_score,
      band = EXCLUDED.band,
      confidence = EXCLUDED.confidence,
      confidence_score = EXCLUDED.confidence_score,
      confidence_detail = EXCLUDED.confidence_detail,
      breakdown = EXCLUDED.breakdown,
      families_count = EXCLUDED.families_count,
      signals_count = EXCLUDED.signals_count,
      score_version = EXCLUDED.score_version,
      computed_at = now()
    RETURNING
      property_id,
      score,
      band,
      confidence,
      breakdown,
      score_version,
      computed_at
  ),
  history_insert AS (
    INSERT INTO public.listing_score_history (
      property_id,
      score,
      band,
      confidence,
      breakdown,
      score_version,
      computed_at
    )
    SELECT
      u.property_id,
      u.score,
      u.band,
      u.confidence,
      u.breakdown,
      u.score_version,
      u.computed_at
    FROM upserted u
    LEFT JOIN LATERAL (
      SELECT h.score
      FROM public.listing_score_history h
      WHERE h.property_id = u.property_id
      ORDER BY h.computed_at DESC
      LIMIT 1
    ) latest ON true
    WHERE latest.score IS NULL
       OR ABS(u.score - latest.score) >= 1
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted_history_count
  FROM history_insert;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.compute_listing_scores()
  FROM PUBLIC, anon, authenticated;

-- Refresh derived signals and scores immediately after installing the corrected functions.
SELECT public.sync_competition_shock_signal_batch();
SELECT public.compute_listing_scores();

