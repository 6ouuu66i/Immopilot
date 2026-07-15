WITH target AS (
  SELECT to_regclass('public.scrape_runs') AS oid
), fn AS (
  SELECT n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS key,
         pg_get_functiondef(p.oid) ~* '(^|[^[:alnum:]_])(public[.])?scrape_runs([^[:alnum:]_]|$)' AS references_target,
         position('to_regclass' in pg_get_functiondef(p.oid)) > 0 AS guarded
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND pg_get_functiondef(p.oid) ~* '(^|[^[:alnum:]_])(public[.])?scrape_runs([^[:alnum:]_]|$)'
), vw AS (
  SELECT schemaname || '.' || viewname AS key FROM pg_views
  WHERE schemaname='public'
    AND definition ~* '(^|[^[:alnum:]_])(public[.])?scrape_runs([^[:alnum:]_]|$)'
), deps AS (
  SELECT DISTINCT pg_describe_object(d.classid,d.objid,d.objsubid) AS key
  FROM pg_depend d,target t WHERE t.oid IS NOT NULL AND d.refobjid=t.oid
    AND d.objid <> t.oid
), external_constraints AS (
  SELECT n.nspname || '.' || c.relname || '.' || x.conname AS key
  FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace JOIN target t ON true
  WHERE t.oid IS NOT NULL AND x.confrelid=t.oid AND x.conrelid<>t.oid
), external_policies AS (
  SELECT n.nspname || '.' || c.relname || '.' || p.polname AS key
  FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace JOIN target t ON true
  WHERE t.oid IS NOT NULL AND p.polrelid<>t.oid
    AND (COALESCE(pg_get_expr(p.polqual,p.polrelid),'') || ' ' || COALESCE(pg_get_expr(p.polwithcheck,p.polrelid),''))
      ~* '(^|[^[:alnum:]_])(public[.])?scrape_runs([^[:alnum:]_]|$)'
), summary AS (
  SELECT COALESCE((SELECT jsonb_agg(jsonb_build_object('key',key,'guarded',guarded) ORDER BY key) FROM fn),'[]'::jsonb) functions,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('key',key) ORDER BY key) FROM vw),'[]'::jsonb) views,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('key',key) ORDER BY key) FROM deps),'[]'::jsonb) catalog_dependencies,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('key',key) ORDER BY key) FROM external_constraints),'[]'::jsonb) external_constraints,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('key',key) ORDER BY key) FROM external_policies),'[]'::jsonb) external_policies,
         COALESCE((SELECT count(*) FROM fn WHERE NOT guarded),0)
           + COALESCE((SELECT count(*) FROM vw),0)
           + COALESCE((SELECT count(*) FROM external_constraints),0)
           + COALESCE((SELECT count(*) FROM external_policies),0) AS hard_count
)
SELECT jsonb_build_object('table_exists',(SELECT oid IS NOT NULL FROM target),
  'functions',functions,'views',views,'catalog_dependencies',catalog_dependencies,
  'external_constraints',external_constraints,'external_policies',external_policies,
  'hard_dependency_count',hard_count) FROM summary;
