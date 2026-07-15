WITH relations AS (
  SELECT jsonb_agg(jsonb_build_object(
    'key', n.nspname || '.' || c.relname,
    'kind', c.relkind,
    'owner', pg_get_userbyid(c.relowner),
    'rls', c.relrowsecurity,
    'force_rls', c.relforcerowsecurity,
    'persistence', c.relpersistence,
    'acl', COALESCE(to_jsonb(c.relacl), '[]'::jsonb),
    'options', COALESCE(to_jsonb(c.reloptions), '[]'::jsonb),
    'comment', obj_description(c.oid, 'pg_class')
  ) ORDER BY n.nspname, c.relname) value
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','S','f')
), columns AS (
  SELECT jsonb_agg(jsonb_build_object(
    'key', n.nspname || '.' || c.relname || '.' || a.attname,
    'ordinal', a.attnum, 'type', format_type(a.atttypid, a.atttypmod),
    'not_null', a.attnotnull, 'default', pg_get_expr(d.adbin, d.adrelid),
    'identity', a.attidentity, 'generated', a.attgenerated,
    'acl', COALESCE(to_jsonb(a.attacl), '[]'::jsonb),
    'collation', CASE WHEN a.attcollation <> t.typcollation THEN co.collname END
  ) ORDER BY n.nspname, c.relname, a.attnum) value
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_type t ON t.oid = a.atttypid
  LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
  LEFT JOIN pg_collation co ON co.oid = a.attcollation
  WHERE n.nspname = 'public' AND a.attnum > 0 AND NOT a.attisdropped
    AND c.relkind IN ('r','p','v','m','f')
), types AS (
  SELECT jsonb_agg(jsonb_build_object(
    'key', n.nspname || '.' || t.typname, 'kind', t.typtype,
    'owner', pg_get_userbyid(t.typowner), 'not_null', t.typnotnull,
    'default', t.typdefault, 'base_type', format_type(t.typbasetype,t.typtypmod),
    'enum_labels', COALESCE((SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid=t.oid),'[]'::jsonb),
    'constraints', COALESCE((SELECT jsonb_agg(pg_get_constraintdef(c.oid,true) ORDER BY c.conname) FROM pg_constraint c WHERE c.contypid=t.oid),'[]'::jsonb)
  ) ORDER BY n.nspname,t.typname) value
  FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
  LEFT JOIN pg_class c ON c.oid=t.typrelid
  WHERE n.nspname='public' AND t.typtype IN ('e','d')
), sequences AS (
  SELECT jsonb_agg(jsonb_build_object(
    'key', n.nspname || '.' || c.relname, 'data_type', format_type(s.seqtypid,NULL),
    'start', s.seqstart, 'increment', s.seqincrement, 'min', s.seqmin,
    'max', s.seqmax, 'cache', s.seqcache, 'cycle', s.seqcycle
  ) ORDER BY n.nspname,c.relname) value
  FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
), views AS (
  SELECT jsonb_agg(jsonb_build_object(
    'key', n.nspname || '.' || c.relname, 'kind', c.relkind,
    'definition_md5', md5(pg_get_viewdef(c.oid,false)),
    'populated', CASE WHEN c.relkind='m' THEN c.relispopulated ELSE NULL END
  ) ORDER BY n.nspname,c.relname) value
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('v','m')
), constraints AS (
  SELECT jsonb_agg(jsonb_build_object(
    'key', n.nspname || '.' || c.relname || '.' || x.conname,
    'type', x.contype, 'deferrable', x.condeferrable,
    'deferred', x.condeferred, 'validated', x.convalidated,
    'definition', pg_get_constraintdef(x.oid, true)
  ) ORDER BY n.nspname, c.relname, x.conname) value
  FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
), indexes AS (
  SELECT jsonb_agg(jsonb_build_object(
    'key', ns.nspname || '.' || ic.relname,
    'table', tn.nspname || '.' || tc.relname,
    'unique', i.indisunique, 'primary', i.indisprimary,
    'valid', i.indisvalid, 'definition', pg_get_indexdef(i.indexrelid)
  ) ORDER BY ns.nspname, ic.relname) value
  FROM pg_index i JOIN pg_class ic ON ic.oid=i.indexrelid
  JOIN pg_namespace ns ON ns.oid=ic.relnamespace
  JOIN pg_class tc ON tc.oid=i.indrelid JOIN pg_namespace tn ON tn.oid=tc.relnamespace
  WHERE tn.nspname='public'
), functions AS (
  SELECT jsonb_agg(jsonb_build_object(
    'key', n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
    'result', pg_get_function_result(p.oid), 'language', l.lanname,
    'owner', pg_get_userbyid(p.proowner), 'security_definer', p.prosecdef,
    'volatility', p.provolatile, 'parallel', p.proparallel, 'strict', p.proisstrict,
    'search_path', COALESCE((SELECT jsonb_agg(cfg ORDER BY cfg) FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'),'[]'::jsonb),
    'acl', COALESCE(to_jsonb(p.proacl), '[]'::jsonb),
    'definition_md5', md5(pg_get_functiondef(p.oid)),
    'extension_owner', e.extname
  ) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) value
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  JOIN pg_language l ON l.oid=p.prolang
  LEFT JOIN pg_depend d ON d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e'
  LEFT JOIN pg_extension e ON e.oid=d.refobjid WHERE n.nspname='public'
), triggers AS (
  SELECT jsonb_agg(jsonb_build_object(
    'key', n.nspname || '.' || c.relname || '.' || t.tgname,
    'definition', pg_get_triggerdef(t.oid, true), 'enabled', t.tgenabled
  ) ORDER BY n.nspname,c.relname,t.tgname) value
  FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND NOT t.tgisinternal
), policies AS (
  SELECT jsonb_agg(jsonb_build_object(
    'key', schemaname || '.' || tablename || '.' || policyname,
    'permissive', permissive, 'roles', roles, 'command', cmd,
    'using', qual, 'check', with_check
  ) ORDER BY schemaname,tablename,policyname) value
  FROM pg_policies WHERE schemaname='public'
), extensions AS (
  SELECT jsonb_agg(jsonb_build_object(
    'key', e.extname, 'version', e.extversion, 'schema', n.nspname
  ) ORDER BY e.extname) value FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
), publications AS (
  SELECT jsonb_agg(jsonb_build_object(
    'key', p.pubname || '.' || pt.schemaname || '.' || pt.tablename,
    'insert', p.pubinsert, 'update', p.pubupdate, 'delete', p.pubdelete, 'truncate', p.pubtruncate
  ) ORDER BY p.pubname,pt.schemaname,pt.tablename) value
  FROM pg_publication_tables pt JOIN pg_publication p ON p.pubname=pt.pubname
  WHERE pt.schemaname='public'
), default_acls AS (
  SELECT jsonb_agg(jsonb_build_object(
    'key', pg_get_userbyid(d.defaclrole) || '.' || n.nspname || '.' || d.defaclobjtype,
    'acl', COALESCE(to_jsonb(d.defaclacl), '[]'::jsonb)
  ) ORDER BY pg_get_userbyid(d.defaclrole),n.nspname,d.defaclobjtype) value
  FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE n.nspname='public'
), role_privileges AS (
  SELECT jsonb_agg(item ORDER BY item->>'key') value
  FROM (
    SELECT jsonb_build_object(
      'key', 'role:' || r.rolname || ':schema:public',
      'usage', has_schema_privilege(r.rolname,'public','USAGE'),
      'create', has_schema_privilege(r.rolname,'public','CREATE')
    ) item
    FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role')
    UNION ALL
    SELECT jsonb_build_object(
      'key', 'role:' || r.rolname || ':relation:public.' || c.relname,
      'select', has_table_privilege(r.rolname,c.oid,'SELECT'),
      'insert', has_table_privilege(r.rolname,c.oid,'INSERT'),
      'update', has_table_privilege(r.rolname,c.oid,'UPDATE'),
      'delete', has_table_privilege(r.rolname,c.oid,'DELETE'),
      'truncate', has_table_privilege(r.rolname,c.oid,'TRUNCATE'),
      'references', has_table_privilege(r.rolname,c.oid,'REFERENCES'),
      'trigger', has_table_privilege(r.rolname,c.oid,'TRIGGER')
    ) item
    FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE r.rolname IN ('anon','authenticated','service_role')
      AND n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
    UNION ALL
    SELECT jsonb_build_object(
      'key', 'role:' || r.rolname || ':sequence:public.' || c.relname,
      'select', has_sequence_privilege(r.rolname,c.oid,'SELECT'),
      'usage', has_sequence_privilege(r.rolname,c.oid,'USAGE'),
      'update', has_sequence_privilege(r.rolname,c.oid,'UPDATE')
    ) item
    FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE r.rolname IN ('anon','authenticated','service_role')
      AND n.nspname='public' AND c.relkind='S'
    UNION ALL
    SELECT jsonb_build_object(
      'key', 'role:' || r.rolname || ':function:public.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
      'execute', has_function_privilege(r.rolname,p.oid,'EXECUTE')
    ) item
    FROM pg_roles r CROSS JOIN pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE r.rolname IN ('anon','authenticated','service_role') AND n.nspname='public'
  ) privileges
), managed_inventory AS (
  SELECT jsonb_build_object(
    'auth_schema', to_regnamespace('auth') IS NOT NULL,
    'auth_users_table', to_regclass('auth.users') IS NOT NULL,
    'auth_user_triggers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name',t.tgname,'definition_md5',md5(pg_get_triggerdef(t.oid,true))) ORDER BY t.tgname)
      FROM pg_trigger t WHERE t.tgrelid=to_regclass('auth.users') AND NOT t.tgisinternal
    ),'[]'::jsonb),
    'storage_schema', to_regnamespace('storage') IS NOT NULL,
    'storage_buckets_table', to_regclass('storage.buckets') IS NOT NULL,
    'storage_objects_table', to_regclass('storage.objects') IS NOT NULL,
    'storage_policies', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key',schemaname || '.' || tablename || '.' || policyname,'command',cmd,'roles',roles) ORDER BY schemaname,tablename,policyname)
      FROM pg_policies WHERE schemaname='storage'
    ),'[]'::jsonb),
    'realtime_publications', COALESCE((SELECT jsonb_agg(pubname ORDER BY pubname) FROM pg_publication),'[]'::jsonb),
    'cron_extension', EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron'),
    'cron_jobs_table', to_regclass('cron.job') IS NOT NULL,
    'vault_extension', EXISTS (SELECT 1 FROM pg_extension WHERE extname IN ('supabase_vault','vault')),
    'vault_secrets_table', to_regclass('vault.secrets') IS NOT NULL
  ) value
)
SELECT jsonb_build_object(
  'meta', jsonb_build_object('server_version', current_setting('server_version')),
  'relations', COALESCE(relations.value,'[]'::jsonb),
  'columns', COALESCE(columns.value,'[]'::jsonb),
  'types', COALESCE(types.value,'[]'::jsonb),
  'sequences', COALESCE(sequences.value,'[]'::jsonb),
  'views', COALESCE(views.value,'[]'::jsonb),
  'constraints', COALESCE(constraints.value,'[]'::jsonb),
  'indexes', COALESCE(indexes.value,'[]'::jsonb),
  'functions', COALESCE(functions.value,'[]'::jsonb),
  'triggers', COALESCE(triggers.value,'[]'::jsonb),
  'policies', COALESCE(policies.value,'[]'::jsonb),
  'extensions', COALESCE(extensions.value,'[]'::jsonb),
  'publications', COALESCE(publications.value,'[]'::jsonb),
  'default_acls', COALESCE(default_acls.value,'[]'::jsonb),
  'role_privileges', COALESCE(role_privileges.value,'[]'::jsonb),
  'managed_inventory', managed_inventory.value
)
FROM relations,columns,types,sequences,views,constraints,indexes,functions,triggers,policies,extensions,publications,default_acls,role_privileges,managed_inventory;
