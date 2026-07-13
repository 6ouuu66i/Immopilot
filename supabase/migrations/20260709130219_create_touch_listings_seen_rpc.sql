create or replace function touch_listings_seen(p_listing_ids uuid[])
returns void
language sql
as $$
  update listings set last_seen_at = now() where id = any(p_listing_ids);
$$;

revoke execute on function touch_listings_seen(uuid[]) from public, anon, authenticated;