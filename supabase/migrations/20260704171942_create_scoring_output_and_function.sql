CREATE TABLE IF NOT EXISTS public.listing_scores (
  property_id uuid PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
  score numeric NOT NULL,
  raw_score numeric NOT NULL,
  band text NOT NULL CHECK (band IN ('forte', 'surveiller', 'faible')),
  confidence text NOT NULL CHECK (confidence IN ('haute', 'moyenne', 'faible')),
  confidence_score numeric NOT NULL,
  confidence_detail jsonb NOT NULL,
  breakdown jsonb NOT NULL,
  families_count int NOT NULL,
  signals_count int NOT NULL,
  score_version int NOT NULL REFERENCES public.scoring_versions(score_version),
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.listing_score_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  score numeric NOT NULL,
  band text NOT NULL,
  confidence text NOT NULL,
  breakdown jsonb NOT NULL,
  score_version int NOT NULL REFERENCES public.scoring_versions(score_version),
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listing_score_history_property_computed_idx
  ON public.listing_score_history (property_id, computed_at DESC);

CREATE TABLE IF NOT EXISTS public.listing_outcomes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  outcome text NOT NULL CHECK (
    outcome IN (
      'delisted_unknown',
      'sold_estimated',
      'withdrawn',
      'mandate_won',
      'mandate_lost',
      'relisted_other_agency',
      'contacted_no_deal'
    )
  ),
  score_at_outcome numeric,
  band_at_outcome text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  meta jsonb
);

CREATE INDEX IF NOT EXISTS listing_outcomes_property_occurred_idx
  ON public.listing_outcomes (property_id, occurred_at DESC);

ALTER TABLE public.listing_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing_scores_read_all_authenticated" ON public.listing_scores;
CREATE POLICY "listing_scores_read_all_authenticated"
  ON public.listing_scores FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "listing_score_history_read_all_authenticated" ON public.listing_score_history;
CREATE POLICY "listing_score_history_read_all_authenticated"
  ON public.listing_score_history FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "listing_outcomes_read_all_authenticated" ON public.listing_outcomes;
CREATE POLICY "listing_outcomes_read_all_authenticated"
  ON public.listing_outcomes FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.compute_listing_confidence(p_property_id uuid)
RETURNS TABLE (
  confidence text,
  confidence_score numeric,
  detail jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH property_row AS (
    SELECT p.*
    FROM public.properties p
    WHERE p.id = p_property_id
  ),
  active_listings AS (
    SELECT l.*
    FROM public.listings l
    WHERE l.property_id = p_property_id
      AND l.status = 'active'
  ),
  market_reference_check AS (
    SELECT EXISTS (
      SELECT 1
      FROM active_listings l
      JOIN property_row p ON true
      JOIN public.market_reference mr
        ON mr.postal_code = p.postal_code
       AND mr.property_type = p.property_type
       AND mr.transaction_type = l.transaction_type
      WHERE mr.median_price_per_m2 IS NOT NULL
        AND mr.median_price_per_m2 > 0
    ) AS has_market_reference
  ),
  price_history_depth AS (
    SELECT COUNT(*) AS points_count
    FROM public.price_history ph
    WHERE ph.property_id = p_property_id
  ),
  completeness AS (
    SELECT
      ((p.living_area IS NOT NULL AND p.living_area > 0)::int
       + (p.bedroom_count IS NOT NULL)::int
       + (p.property_type IS NOT NULL)::int) AS present_count
    FROM property_row p
  ),
  epc_check AS (
    SELECT EXISTS (
      SELECT 1
      FROM active_listings l
      WHERE l.epc_score IS NOT NULL
         OR l.epc_consumption IS NOT NULL
    ) AS has_epc
  ),
  scored AS (
    SELECT
      CASE WHEN m.has_market_reference THEN 0.40 ELSE 0 END
      + CASE WHEN ph.points_count >= 3 THEN 0.25 ELSE 0 END
      + (COALESCE(c.present_count, 0)::numeric / 3) * 0.20
      + CASE WHEN e.has_epc THEN 0.15 ELSE 0 END AS score,
      m.has_market_reference,
      ph.points_count,
      COALESCE(c.present_count, 0) AS completeness_fields,
      e.has_epc
    FROM market_reference_check m
    CROSS JOIN price_history_depth ph
    CROSS JOIN completeness c
    CROSS JOIN epc_check e
  )
  SELECT
    CASE
      WHEN score >= 0.75 THEN 'haute'
      WHEN score >= 0.45 THEN 'moyenne'
      ELSE 'faible'
    END AS confidence,
    ROUND(score, 4) AS confidence_score,
    jsonb_build_object(
      'has_market_reference', has_market_reference,
      'market_reference_weight', 0.40,
      'price_history_points', points_count,
      'price_history_threshold', 3,
      'price_history_weight', 0.25,
      'completeness_fields', completeness_fields,
      'completeness_total_fields', 3,
      'completeness_weight', 0.20,
      'has_peb', has_epc,
      'peb_weight', 0.15
    ) AS detail
  FROM scored;
$$;

REVOKE EXECUTE ON FUNCTION public.compute_listing_confidence(uuid)
  FROM PUBLIC, anon, authenticated;

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
          PARTITION BY d.property_id, d.family_key, COALESCE(d.exclusive_group, d.signal_id::text)
          ORDER BY d.contribution DESC, d.event_at DESC
        ) AS contribution_rank
      FROM decayed d
    ) ranked
    WHERE contribution_rank = 1
      AND contribution > 0
  ),
  per_family AS (
    SELECT
      d.property_id,
      d.family_key,
      MAX(d.family_label_fr) AS family_label_fr,
      MAX(d.display_rank) AS display_rank,
      LEAST(MAX(d.family_cap), SUM(d.contribution)) AS family_score,
      COUNT(*) AS signals_count,
      jsonb_agg(
        jsonb_build_object(
          'signal_key', d.signal_type,
          'listing_id', d.listing_id,
          'contribution', ROUND(d.contribution, 2),
          'max_points', d.max_points,
          'signal_kind', d.signal_kind,
          'event_at', d.event_at,
          'reason', d.reason_template_fr,
          'metadata', d.metadata
        )
        ORDER BY d.contribution DESC, d.event_at DESC
      ) AS signals
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
        jsonb_agg(
          jsonb_build_object(
            'family_key', pf.family_key,
            'label_fr', pf.family_label_fr,
            'score', ROUND(pf.family_score, 2),
            'signals_count', pf.signals_count,
            'signals', pf.signals
          )
          ORDER BY pf.family_score DESC, pf.display_rank
        ) FILTER (WHERE pf.family_key IS NOT NULL),
        '[]'::jsonb
      ) AS families_breakdown
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
      t.families_breakdown,
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
        'families', b.families_breakdown,
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
