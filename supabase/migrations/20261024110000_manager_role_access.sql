-- Three CRM roles: admin, manager, and staff/team_member.
-- Managers handle the shared lead queue and assign work. Members see their own work.

-- Accommodate installations where profiles.role is a PostgreSQL enum.
do $$
declare
  enum_details record;
begin
  select type_ns.nspname as schema_name, enum_catalog_type.typname as type_name
  into enum_details
  from pg_attribute as column_info
  join pg_type as enum_catalog_type on enum_catalog_type.oid = column_info.atttypid
  join pg_namespace as type_ns on type_ns.oid = enum_catalog_type.typnamespace
  where column_info.attrelid = 'public.profiles'::regclass
    and column_info.attname = 'role'
    and not column_info.attisdropped
    and enum_catalog_type.typtype = 'e';

  if found then
    execute format('alter type %I.%I add value if not exists %L', enum_details.schema_name, enum_details.type_name, 'manager');
  end if;
end;
$$;

grant update on public.profiles to authenticated;

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.current_crm_role()) = 'admin');
drop policy if exists "profiles_access_guard" on public.profiles;
create policy "profiles_access_guard" on public.profiles as restrictive
  for all to public
  using (id = (select auth.uid()) or (select public.current_crm_role()) = 'admin')
  with check (id = (select auth.uid()) or (select public.current_crm_role()) = 'admin');
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using ((select public.current_crm_role()) = 'admin')
  with check ((select public.current_crm_role()) = 'admin');

-- Leads: admins retain full control, managers can manage the shared lead queue,
-- and members have read-only access to leads assigned to them.
drop policy if exists "clients_select_assigned_or_admin" on public.clients;
drop policy if exists "clients_insert_assigned_or_admin" on public.clients;
drop policy if exists "clients_update_assigned_or_admin" on public.clients;
drop policy if exists "clients_delete_admin" on public.clients;
create policy "clients_select_by_role" on public.clients
  for select to authenticated
  using ((select public.current_crm_role()) in ('admin', 'manager')
    or assigned_to = (select public.current_crm_member_id())::text);
create policy "clients_insert_admin_or_manager" on public.clients
  for insert to authenticated
  with check ((select public.current_crm_role()) in ('admin', 'manager'));
create policy "clients_update_admin_or_manager" on public.clients
  for update to authenticated
  using ((select public.current_crm_role()) in ('admin', 'manager'))
  with check ((select public.current_crm_role()) in ('admin', 'manager'));
create policy "clients_delete_admin" on public.clients
  for delete to authenticated using ((select public.current_crm_role()) = 'admin');

-- Managers can create, assign, update, and remove tasks. Members can only read
-- and update tasks assigned directly to their linked team-member record.
drop policy if exists "tasks_select_assigned_or_admin" on public.tasks;
drop policy if exists "tasks_insert_assigned_or_admin" on public.tasks;
drop policy if exists "tasks_update_assigned_or_admin" on public.tasks;
drop policy if exists "tasks_delete_admin_or_assignee" on public.tasks;
create policy "tasks_select_by_role" on public.tasks
  for select to authenticated
  using ((select public.current_crm_role()) in ('admin', 'manager')
    or assigned_to::text = (select public.current_crm_member_id())::text);
create policy "tasks_insert_admin_or_manager" on public.tasks
  for insert to authenticated
  with check ((select public.current_crm_role()) in ('admin', 'manager'));
create policy "tasks_update_admin_manager_or_assignee" on public.tasks
  for update to authenticated
  using ((select public.current_crm_role()) in ('admin', 'manager')
    or assigned_to::text = (select public.current_crm_member_id())::text)
  with check ((select public.current_crm_role()) in ('admin', 'manager')
    or assigned_to::text = (select public.current_crm_member_id())::text);
create policy "tasks_delete_admin_or_manager" on public.tasks
  for delete to authenticated
  using ((select public.current_crm_role()) in ('admin', 'manager'));

-- Managers can read and add lead conversation/activity notes; members can only
-- add activity against their own assigned leads, and cannot edit/delete history.
drop policy if exists "activities_select_assigned_or_admin" on public.activities;
drop policy if exists "activities_insert_assigned_or_admin" on public.activities;
drop policy if exists "activities_update_admin" on public.activities;
drop policy if exists "activities_delete_admin" on public.activities;
create policy "activities_select_by_role" on public.activities
  for select to authenticated
  using ((select public.current_crm_role()) in ('admin', 'manager') or exists (
    select 1 from public.clients as client
    where client.id = activities.client_id
      and client.assigned_to = (select public.current_crm_member_id())::text));
create policy "activities_insert_by_role" on public.activities
  for insert to authenticated
  with check ((select public.current_crm_role()) in ('admin', 'manager') or exists (
    select 1 from public.clients as client
    where client.id = activities.client_id
      and client.assigned_to = (select public.current_crm_member_id())::text));
create policy "activities_update_admin" on public.activities
  for update to authenticated using ((select public.current_crm_role()) = 'admin')
  with check ((select public.current_crm_role()) = 'admin');
create policy "activities_delete_admin" on public.activities
  for delete to authenticated using ((select public.current_crm_role()) = 'admin');

drop policy if exists "notes_select_assigned_or_admin" on public.notes;
drop policy if exists "notes_insert_assigned_or_admin" on public.notes;
drop policy if exists "notes_update_admin" on public.notes;
drop policy if exists "notes_delete_admin" on public.notes;
create policy "notes_select_by_role" on public.notes
  for select to authenticated
  using ((select public.current_crm_role()) in ('admin', 'manager') or exists (
    select 1 from public.clients as client
    where client.id = notes.client_id
      and client.assigned_to = (select public.current_crm_member_id())::text));
create policy "notes_insert_by_role" on public.notes
  for insert to authenticated
  with check ((select public.current_crm_role()) in ('admin', 'manager') or exists (
    select 1 from public.clients as client
    where client.id = notes.client_id
      and client.assigned_to = (select public.current_crm_member_id())::text));
create policy "notes_update_admin" on public.notes
  for update to authenticated using ((select public.current_crm_role()) = 'admin')
  with check ((select public.current_crm_role()) = 'admin');
create policy "notes_delete_admin" on public.notes
  for delete to authenticated using ((select public.current_crm_role()) = 'admin');
