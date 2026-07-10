-- 1) La matview expose photo_urls (jusqu'à 6 photos) pour ranimer le carrousel
--    des cartes Biens : depuis le passage aux données réelles, chaque carte
--    n'avait qu'une seule photo (primary_photo_url) et les flèches avaient
--    légitimement disparu.
-- 2) Accents français dans scoring_config.reason_template_fr (affichés tels
--    quels dans les cartes, fiches et le dashboard), puis recalcul des scores
--    pour régénérer les breakdowns avec les textes corrigés.

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
  l.photo_urls[1:6] AS photo_urls,
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

-- 2) Accents français des raisons de score
UPDATE scoring_config SET reason_template_fr = 'Retour sur le marché après option ou retrait' WHERE signal_key = 'back_to_market';
UPDATE scoring_config SET reason_template_fr = 'Prix sous la référence locale du marché' WHERE signal_key = 'below_market';
UPDATE scoring_config SET reason_template_fr = 'Bien diffusé sur plusieurs sources' WHERE signal_key = 'multi_source';
UPDATE scoring_config SET reason_template_fr = 'Prix au-dessus de la référence locale du marché' WHERE signal_key = 'overpriced';
UPDATE scoring_config SET reason_template_fr = 'Baisse de prix détectée récemment' WHERE signal_key = 'price_drop';
UPDATE scoring_config SET reason_template_fr = 'Annonce republiée récemment' WHERE signal_key = 'republished';
UPDATE scoring_config SET reason_template_fr = 'Temps en ligne élevé pour le segment local' WHERE signal_key = 'stale_dom_relative';

-- Les breakdowns existants (listing_scores.breakdown) contiennent les anciens
-- textes : on recalcule pour tout régénérer avec les accents.
SELECT compute_listing_scores();
