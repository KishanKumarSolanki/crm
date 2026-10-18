create or replace function public.current_crm_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role::text
  from public.profiles as p
  where p.id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_crm_role() from public;
grant execute on function public.current_crm_role() to authenticated;

grant select on public.profiles to authenticated;
revoke insert, update, delete on public.profiles from public, anon, authenticated;

grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.team_members to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.activities to authenticated;
grant select, insert, update, delete on public.notes to authenticated;

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.team_members enable row level security;
alter table public.tasks enable row level security;
alter table public.activities enable row level security;
alter table public.notes enable row level security;

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));
drop policy if exists "profiles_access_guard" on public.profiles;
create policy "profiles_access_guard"
  on public.profiles as restrictive for all to public
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "clients_select_authenticated" on public.clients;
create policy "clients_select_authenticated"
  on public.clients for select to authenticated using (true);
drop policy if exists "clients_authenticated_guard" on public.clients;
create policy "clients_authenticated_guard"
  on public.clients as restrictive for all to public
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);
drop policy if exists "clients_insert_authenticated" on public.clients;
create policy "clients_insert_authenticated"
  on public.clients for insert to authenticated with check (true);
drop policy if exists "clients_update_authenticated" on public.clients;
create policy "clients_update_authenticated"
  on public.clients for update to authenticated using (true) with check (true);
drop policy if exists "clients_delete_authenticated" on public.clients;
create policy "clients_delete_authenticated"
  on public.clients for delete to authenticated using (true);

drop policy if exists "team_members_select_authenticated" on public.team_members;
create policy "team_members_select_authenticated"
  on public.team_members for select to authenticated using (true);
drop policy if exists "team_members_authenticated_guard" on public.team_members;
create policy "team_members_authenticated_guard"
  on public.team_members as restrictive for all to public
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);
drop policy if exists "team_members_insert_admin" on public.team_members;
create policy "team_members_insert_admin"
  on public.team_members for insert to authenticated
  with check ((select public.current_crm_role()) = 'admin');
drop policy if exists "team_members_admin_insert_guard" on public.team_members;
create policy "team_members_admin_insert_guard"
  on public.team_members as restrictive for insert to public
  with check ((select public.current_crm_role()) = 'admin');
drop policy if exists "team_members_update_admin" on public.team_members;
create policy "team_members_update_admin"
  on public.team_members for update to authenticated
  using ((select public.current_crm_role()) = 'admin')
  with check ((select public.current_crm_role()) = 'admin');
drop policy if exists "team_members_admin_update_guard" on public.team_members;
create policy "team_members_admin_update_guard"
  on public.team_members as restrictive for update to public
  using ((select public.current_crm_role()) = 'admin')
  with check ((select public.current_crm_role()) = 'admin');
drop policy if exists "team_members_delete_admin" on public.team_members;
create policy "team_members_delete_admin"
  on public.team_members for delete to authenticated
  using ((select public.current_crm_role()) = 'admin');
drop policy if exists "team_members_admin_delete_guard" on public.team_members;
create policy "team_members_admin_delete_guard"
  on public.team_members as restrictive for delete to public
  using ((select public.current_crm_role()) = 'admin');

drop policy if exists "tasks_select_authenticated" on public.tasks;
create policy "tasks_select_authenticated"
  on public.tasks for select to authenticated using (true);
drop policy if exists "tasks_authenticated_guard" on public.tasks;
create policy "tasks_authenticated_guard"
  on public.tasks as restrictive for all to public
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);
drop policy if exists "tasks_insert_authenticated" on public.tasks;
create policy "tasks_insert_authenticated"
  on public.tasks for insert to authenticated with check (true);
drop policy if exists "tasks_update_authenticated" on public.tasks;
create policy "tasks_update_authenticated"
  on public.tasks for update to authenticated using (true) with check (true);
drop policy if exists "tasks_delete_authenticated" on public.tasks;
create policy "tasks_delete_authenticated"
  on public.tasks for delete to authenticated using (true);

drop policy if exists "activities_select_authenticated" on public.activities;
create policy "activities_select_authenticated"
  on public.activities for select to authenticated using (true);
drop policy if exists "activities_authenticated_guard" on public.activities;
create policy "activities_authenticated_guard"
  on public.activities as restrictive for all to public
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);
drop policy if exists "activities_insert_authenticated" on public.activities;
create policy "activities_insert_authenticated"
  on public.activities for insert to authenticated with check (true);
drop policy if exists "activities_update_authenticated" on public.activities;
create policy "activities_update_authenticated"
  on public.activities for update to authenticated using (true) with check (true);
drop policy if exists "activities_delete_authenticated" on public.activities;
create policy "activities_delete_authenticated"
  on public.activities for delete to authenticated using (true);

drop policy if exists "notes_select_authenticated" on public.notes;
create policy "notes_select_authenticated"
  on public.notes for select to authenticated using (true);
drop policy if exists "notes_authenticated_guard" on public.notes;
create policy "notes_authenticated_guard"
  on public.notes as restrictive for all to public
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);
drop policy if exists "notes_insert_authenticated" on public.notes;
create policy "notes_insert_authenticated"
  on public.notes for insert to authenticated with check (true);
drop policy if exists "notes_update_authenticated" on public.notes;
create policy "notes_update_authenticated"
  on public.notes for update to authenticated using (true) with check (true);
drop policy if exists "notes_delete_authenticated" on public.notes;
create policy "notes_delete_authenticated"
  on public.notes for delete to authenticated using (true);
