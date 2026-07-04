drop policy if exists "Admins insert audit logs" on public.audit_logs;
create policy "Admins insert audit logs"
on public.audit_logs
for insert
to authenticated
with check (
  agency_id = current_agency_id()
  and is_admin()
);
create unique index if not exists idx_pipeline_stages_one_won_per_agency
on public.pipeline_stages (agency_id)
where is_won = true;
create unique index if not exists idx_pipeline_stages_one_lost_per_agency
on public.pipeline_stages (agency_id)
where is_lost = true;
