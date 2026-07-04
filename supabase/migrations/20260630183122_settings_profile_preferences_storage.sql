alter table public.profiles
add column if not exists notification_preferences jsonb not null default '{
  "all": true,
  "transfers": true,
  "tasks": true,
  "deals": true,
  "commissions": true,
  "mentions": true
}'::jsonb;
update public.profiles
set notification_preferences = '{
  "all": true,
  "transfers": true,
  "tasks": true,
  "deals": true,
  "commissions": true,
  "mentions": true
}'::jsonb
where notification_preferences is null;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('agency-logos', 'agency-logos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Public read avatars" on storage.objects;
create policy "Public read avatars"
on storage.objects
for select
using (bucket_id = 'avatars');
drop policy if exists "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists "Users delete own avatar" on storage.objects;
create policy "Users delete own avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists "Public read agency logos" on storage.objects;
create policy "Public read agency logos"
on storage.objects
for select
using (bucket_id = 'agency-logos');
drop policy if exists "Admins upload own agency logo" on storage.objects;
create policy "Admins upload own agency logo"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'agency-logos'
  and is_admin()
  and (storage.foldername(name))[1] = current_agency_id()::text
);
drop policy if exists "Admins update own agency logo" on storage.objects;
create policy "Admins update own agency logo"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'agency-logos'
  and is_admin()
  and (storage.foldername(name))[1] = current_agency_id()::text
)
with check (
  bucket_id = 'agency-logos'
  and is_admin()
  and (storage.foldername(name))[1] = current_agency_id()::text
);
drop policy if exists "Admins delete own agency logo" on storage.objects;
create policy "Admins delete own agency logo"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'agency-logos'
  and is_admin()
  and (storage.foldername(name))[1] = current_agency_id()::text
);
