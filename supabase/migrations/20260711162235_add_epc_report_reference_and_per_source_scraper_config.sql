-- 1. Nouveau champ pour la clé de jointure PEB (nullable, backfillé en tâche suivante)
alter table listings add column if not exists epc_report_reference text;

-- 2. UNIQUE(source, source_id) déjà présente en base (listings_source_source_id_unique), rien à faire.

-- 3. Kill switch par source : scraper_config passe d'un singleton (id boolean, une seule
--    ligne possible) à une ligne par source, identifiée par source text.
alter table scraper_config drop constraint scraper_config_pkey;
alter table scraper_config drop constraint scraper_config_id_check;
alter table scraper_config add column source text;
update scraper_config set source = 'immoweb';
alter table scraper_config alter column source set not null;
alter table scraper_config add primary key (source);
alter table scraper_config drop column id;

-- Seed la ligne Zimmo, désactivée par défaut tant que le scraper Zimmo n'est pas prêt.
insert into scraper_config (source, enabled, updated_at)
values ('zimmo', false, now())
on conflict (source) do nothing;
