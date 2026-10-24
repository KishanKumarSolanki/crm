-- Restrict CRM sign-in to Admin and Manager dashboards and scope each Manager
-- to one configured service/source on leads and lead-linked records.
alter table public.profiles
  add column if not exists manager_service text;

create or replace function public.current_crm_manager_service()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(lower(btrim(profile.manager_service)), '')
  from public.profiles as profile
  where profile.id = (select auth.uid())
  limit 1;
$$;

revoke all on function public.current_crm_manager_service() from public, anon;
grant execute on function public.current_crm_manager_service() to authenticated;

create or replace function public.current_crm_can_access_lead(service_value text, source_value text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select public.current_crm_role()) = 'admin' then true
    when (select public.current_crm_role()) = 'manager'
      and (select public.current_crm_manager_service()) is not null
      then lower(btrim(coalesce(service_value, ''))) = (select public.current_crm_manager_service())
        or lower(btrim(coalesce(source_value, ''))) = (select public.current_crm_manager_service())
    else false
  end;
$$;

revoke all on function public.current_crm_can_access_lead(text, text) from public, anon;
grant execute on function public.current_crm_can_access_lead(text, text) to authenticated;

-- Only admins and managers may use the CRM data APIs. Team-member records
-- remain available for task assignment, but there is no Team Member login panel.
drop policy if exists "team_members_select_authenticated" on public.team_members;
create policy "team_members_select_admin_manager" on public.team_members
  for select to authenticated
  using ((select public.current_crm_role()) in ('admin', 'manager'));

drop policy if exists "clients_select_by_role" on public.clients;
create policy "clients_select_by_role" on public.clients
  for select to authenticated
  using (public.current_crm_can_access_lead(service_name, lead_source));
drop policy if exists "clients_insert_admin_or_manager" on public.clients;
create policy "clients_insert_admin_or_manager" on public.clients
  for insert to authenticated
  with check (public.current_crm_can_access_lead(service_name, lead_source));
drop policy if exists "clients_update_admin_or_manager" on public.clients;
create policy "clients_update_admin_or_manager" on public.clients
  for update to authenticated
  using (public.current_crm_can_access_lead(service_name, lead_source))
  with check (public.current_crm_can_access_lead(service_name, lead_source));

-- Managers only see/manage tasks linked to a lead in their configured scope.
drop policy if exists "tasks_select_by_role" on public.tasks;
create policy "tasks_select_by_role" on public.tasks
  for select to authenticated
  using (
    (select public.current_crm_role()) = 'admin'
    or ((select public.current_crm_role()) = 'manager' and exists (
      select 1 from public.clients as client
      where client.id = tasks.client_id
        and public.current_crm_can_access_lead(client.service_name, client.lead_source)
    ))
  );
drop policy if exists "tasks_insert_admin_or_manager" on public.tasks;
create policy "tasks_insert_admin_or_manager" on public.tasks
  for insert to authenticated
  with check (
    (select public.current_crm_role()) = 'admin'
    or ((select public.current_crm_role()) = 'manager' and exists (
      select 1 from public.clients as client
      where client.id = tasks.client_id
        and public.current_crm_can_access_lead(client.service_name, client.lead_source)
    ))
  );
drop policy if exists "tasks_update_admin_manager_or_assignee" on public.tasks;
create policy "tasks_update_admin_manager_or_assignee" on public.tasks
  for update to authenticated
  using (
    (select public.current_crm_role()) = 'admin'
    or ((select public.current_crm_role()) = 'manager' and exists (
      select 1 from public.clients as client
      where client.id = tasks.client_id
        and public.current_crm_can_access_lead(client.service_name, client.lead_source)
    ))
  )
  with check (
    (select public.current_crm_role()) = 'admin'
    or ((select public.current_crm_role()) = 'manager' and exists (
      select 1 from public.clients as client
      where client.id = tasks.client_id
        and public.current_crm_can_access_lead(client.service_name, client.lead_source)
    ))
  );
drop policy if exists "tasks_delete_admin_or_manager" on public.tasks;
create policy "tasks_delete_admin_or_manager" on public.tasks
  for delete to authenticated
  using (
    (select public.current_crm_role()) = 'admin'
    or ((select public.current_crm_role()) = 'manager' and exists (
      select 1 from public.clients as client
      where client.id = tasks.client_id
        and public.current_crm_can_access_lead(client.service_name, client.lead_source)
    ))
  );

drop policy if exists "activities_select_by_role" on public.activities;
create policy "activities_select_by_role" on public.activities
  for select to authenticated
  using (
    (select public.current_crm_role()) = 'admin'
    or ((select public.current_crm_role()) = 'manager' and exists (
      select 1 from public.clients as client
      where client.id = activities.client_id
        and public.current_crm_can_access_lead(client.service_name, client.lead_source)
    ))
  );
drop policy if exists "activities_insert_by_role" on public.activities;
create policy "activities_insert_by_role" on public.activities
  for insert to authenticated
  with check (
    (select public.current_crm_role()) = 'admin'
    or ((select public.current_crm_role()) = 'manager' and exists (
      select 1 from public.clients as client
      where client.id = activities.client_id
        and public.current_crm_can_access_lead(client.service_name, client.lead_source)
    ))
  );

drop policy if exists "notes_select_by_role" on public.notes;
create policy "notes_select_by_role" on public.notes
  for select to authenticated
  using (
    (select public.current_crm_role()) = 'admin'
    or ((select public.current_crm_role()) = 'manager' and exists (
      select 1 from public.clients as client
      where client.id = notes.client_id
        and public.current_crm_can_access_lead(client.service_name, client.lead_source)
    ))
  );
drop policy if exists "notes_insert_by_role" on public.notes;
create policy "notes_insert_by_role" on public.notes
  for insert to authenticated
  with check (
    (select public.current_crm_role()) = 'admin'
    or ((select public.current_crm_role()) = 'manager' and exists (
      select 1 from public.clients as client
      where client.id = notes.client_id
        and public.current_crm_can_access_lead(client.service_name, client.lead_source)
    ))
  );
