CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_listings_title_fr_trgm
  ON public.listings USING gin (title_fr gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_properties_locality_trgm
  ON public.properties USING gin (locality gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_properties_street_trgm
  ON public.properties USING gin (street gin_trgm_ops);
