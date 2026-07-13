# Archived Supabase migrations

These files are historical artifacts and must never be moved back into
`supabase/migrations` or applied to a database.

## Replaced

- `replaced/20260711031621_expose_all_property_photos.sql` was replaced by the
  byte-exact remote history copy
  `supabase/migrations/20260711031705_expose_all_property_photos.sql`. The
  version actually applied to ImmoPilot Pre-Alpha is `20260711031705`; the SQL
  behavior is identical after whitespace normalization.

## Obsolete

- `obsolete/20260710103000_matview_expose_is_under_option.sql` recreates an old
  materialized-view shape. Its useful `is_under_option` field is retained by the
  current remote view, which also includes full `photo_urls`, `customer_type`,
  and `seller_segment` plus the current indexes.
- `obsolete/20260710150000_matview_photos_and_reason_accents.sql` would regress
  the view to six photos and rerun scoring. The current remote view exposes the
  complete photo array, the corrected scoring reasons are already present, and
  later scoring migrations define the active scoring implementation.

Both obsolete files would regress the current schema or data if applied today.
