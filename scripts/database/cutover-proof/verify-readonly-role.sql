WITH login_role AS (
  SELECT * FROM pg_roles WHERE rolname = current_user
), privileged_set_paths AS (
  SELECT target.oid
  FROM pg_roles target
  WHERE target.oid <> (SELECT oid FROM login_role)
    AND (
      target.rolsuper OR target.rolcreaterole OR target.rolcreatedb
      OR target.rolreplication OR target.rolbypassrls
      OR target.rolname IN ('postgres', 'anon', 'authenticated', 'service_role')
    )
    AND pg_has_role(current_user, target.oid, 'SET')
), owned_objects AS (
  SELECT 1 FROM pg_class WHERE relowner = (SELECT oid FROM login_role)
  UNION ALL SELECT 1 FROM pg_proc WHERE proowner = (SELECT oid FROM login_role)
  UNION ALL SELECT 1 FROM pg_namespace WHERE nspowner = (SELECT oid FROM login_role)
  UNION ALL SELECT 1 FROM pg_type WHERE typowner = (SELECT oid FROM login_role)
  UNION ALL SELECT 1 FROM pg_database WHERE datdba = (SELECT oid FROM login_role)
  UNION ALL SELECT 1 FROM pg_extension WHERE extowner = (SELECT oid FROM login_role)
), relation_write_paths AS (
  SELECT c.oid
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
    AND has_table_privilege(current_user, c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
), sequence_write_paths AS (
  SELECT c.oid
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'S'
    AND has_sequence_privilege(current_user, c.oid, 'USAGE,UPDATE')
), privileged_function_write_paths AS (
  SELECT p.oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind IN ('f', 'p')
    AND p.prosecdef
    AND has_function_privilege(current_user, p.oid, 'EXECUTE')
    AND (
      p.provolatile = 'v'
      OR regexp_replace(pg_get_functiondef(p.oid), '^.*?\n', '')
        ~* '\m(INSERT|UPDATE|DELETE|TRUNCATE|MERGE|CREATE|ALTER|DROP|REFRESH|NEXTVAL|SET_CONFIG|PG_[A-Z_]*ADMIN)\M'
    )
)
SELECT current_user || '|' || (
  current_user = session_user
  AND current_user <> 'postgres'
  AND current_setting('default_transaction_read_only') = 'on'
  AND current_setting('transaction_read_only') = 'on'
  AND NOT (SELECT rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls FROM login_role)
  AND NOT EXISTS (SELECT 1 FROM pg_auth_members WHERE member = (SELECT oid FROM login_role))
  AND NOT EXISTS (SELECT 1 FROM privileged_set_paths)
  AND NOT EXISTS (SELECT 1 FROM owned_objects)
  AND NOT has_database_privilege(current_user, current_database(), 'CREATE')
  AND NOT has_schema_privilege(current_user, 'public', 'CREATE')
  AND NOT EXISTS (SELECT 1 FROM relation_write_paths)
  AND NOT EXISTS (SELECT 1 FROM sequence_write_paths)
  AND NOT EXISTS (SELECT 1 FROM privileged_function_write_paths)
)::text;
