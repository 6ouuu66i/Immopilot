CREATE TABLE IF NOT EXISTS public.scoring_families (
  family_key text PRIMARY KEY,
  family_cap numeric NOT NULL,
  label_fr text NOT NULL,
  display_rank int NOT NULL
);

CREATE TABLE IF NOT EXISTS public.scoring_config (
  signal_key text PRIMARY KEY,
  family_key text NOT NULL REFERENCES public.scoring_families(family_key),
  signal_kind text NOT NULL CHECK (signal_kind IN ('event', 'state')),
  max_points numeric NOT NULL,
  half_life_days numeric,
  mult_fsbo numeric NOT NULL DEFAULT 1.0,
  mult_agency numeric NOT NULL DEFAULT 1.0,
  exclusive_group text,
  reason_template_fr text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (signal_kind = 'event' OR half_life_days IS NULL)
);

CREATE TABLE IF NOT EXISTS public.scoring_versions (
  score_version int PRIMARY KEY,
  effective_from timestamptz NOT NULL DEFAULT now(),
  changelog text NOT NULL
);

INSERT INTO public.scoring_families (family_key, family_cap, label_fr, display_rank)
VALUES
  ('prix', 38, 'Prix', 10),
  ('temps', 25, 'Temps', 20),
  ('friction', 26, 'Friction', 30),
  ('concurrence', 10, 'Concurrence', 40),
  ('diffusion', 6, 'Diffusion', 50),
  ('marketing', 5, 'Marketing', 60)
ON CONFLICT (family_key) DO UPDATE SET
  family_cap = EXCLUDED.family_cap,
  label_fr = EXCLUDED.label_fr,
  display_rank = EXCLUDED.display_rank;

-- Seed only signal keys that already exist in the listing_signals CHECK.
-- marketing_underexposed is intentionally not seeded yet: it is planned in the
-- scorecard, but no durable signal exists for it.
INSERT INTO public.scoring_config (
  signal_key,
  family_key,
  signal_kind,
  max_points,
  half_life_days,
  mult_fsbo,
  mult_agency,
  exclusive_group,
  reason_template_fr,
  is_active
)
VALUES
  (
    'below_market',
    'prix',
    'state',
    28,
    NULL,
    1.2,
    0.5,
    'prix_niveau',
    'Prix sous la reference locale du marche',
    true
  ),
  (
    'overpriced',
    'prix',
    'state',
    28,
    NULL,
    1.0,
    1.0,
    'prix_niveau',
    'Prix au-dessus de la reference locale du marche',
    true
  ),
  (
    'price_drop',
    'prix',
    'event',
    14,
    21,
    1.0,
    1.0,
    NULL,
    'Baisse de prix detectee recemment',
    true
  ),
  (
    'stale_dom_relative',
    'temps',
    'state',
    22,
    NULL,
    1.0,
    1.0,
    NULL,
    'Temps en ligne eleve pour le segment local',
    true
  ),
  (
    'failed_launch',
    'temps',
    'event',
    15,
    30,
    1.0,
    1.0,
    NULL,
    'Lancement sans traction commerciale visible',
    true
  ),
  (
    'back_to_market',
    'friction',
    'event',
    26,
    45,
    1.0,
    1.0,
    NULL,
    'Retour sur le marche apres option ou retrait',
    true
  ),
  (
    'competition_shock',
    'concurrence',
    'state',
    10,
    NULL,
    1.0,
    1.0,
    NULL,
    'Nouvelle concurrence locale autour du bien',
    true
  ),
  (
    'multi_source',
    'diffusion',
    'state',
    4,
    NULL,
    1.0,
    1.0,
    NULL,
    'Bien diffuse sur plusieurs sources',
    true
  ),
  (
    'republished',
    'diffusion',
    'event',
    4,
    30,
    1.0,
    1.0,
    NULL,
    'Annonce republiee recemment',
    true
  )
ON CONFLICT (signal_key) DO UPDATE SET
  family_key = EXCLUDED.family_key,
  signal_kind = EXCLUDED.signal_kind,
  max_points = EXCLUDED.max_points,
  half_life_days = EXCLUDED.half_life_days,
  mult_fsbo = EXCLUDED.mult_fsbo,
  mult_agency = EXCLUDED.mult_agency,
  exclusive_group = EXCLUDED.exclusive_group,
  reason_template_fr = EXCLUDED.reason_template_fr,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO public.scoring_versions (score_version, changelog)
VALUES (1, 'Bareme initial, smoke-teste en Phase 0, non calibre empiriquement')
ON CONFLICT (score_version) DO UPDATE SET
  changelog = EXCLUDED.changelog;
