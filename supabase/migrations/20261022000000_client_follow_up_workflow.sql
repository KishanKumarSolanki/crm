alter table public.clients
  add column if not exists phone text,
  add column if not exists service_name text,
  add column if not exists lead_source text,
  add column if not exists next_follow_up timestamptz;

alter table public.tasks
  add column if not exists instructions text;

alter table public.activities
  add column if not exists contact_method text,
  add column if not exists outcome text;

create index if not exists clients_next_follow_up_idx
  on public.clients (next_follow_up)
  where next_follow_up is not null;

create index if not exists tasks_assigned_due_date_idx
  on public.tasks (assigned_to, due_date);

-- Link CRM team records to authenticated users through their existing email.
alter table public.team_members
  add column if not exists profile_id uuid references public.profiles(id) on delete set null;

update public.team_members as member
set profile_id = profile.id
from public.profiles as profile
where member.profile_id is null
  and member.email is not null
  and lower(member.email) = lower(profile.email);

create index if not exists team_members_profile_id_idx
  on public.team_members (profile_id)
  where profile_id is not null;

create or replace function public.sync_team_member_profile_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.team_members as member
  set profile_id = new.id
  where member.profile_id is null
    and lower(member.email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists profiles_sync_team_member_link on public.profiles;
create trigger profiles_sync_team_member_link
  after insert or update of email on public.profiles
  for each row execute function public.sync_team_member_profile_link();
revoke all on function public.sync_team_member_profile_link() from public, anon, authenticated;

create or replace function public.current_crm_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select member.id
  from public.team_members as member
  where member.profile_id = (select auth.uid())
  limit 1;
$$;

revoke all on function public.current_crm_member_id() from public;
grant execute on function public.current_crm_member_id() to authenticated;

-- Replace the broad authenticated policies with owner/admin scoped access.
drop policy if exists "clients_select_authenticated" on public.clients;
drop policy if exists "clients_insert_authenticated" on public.clients;
drop policy if exists "clients_update_authenticated" on public.clients;
drop policy if exists "clients_delete_authenticated" on public.clients;
create policy "clients_select_assigned_or_admin" on public.clients
  for select to authenticated
  using (
    (select public.current_crm_role()) = 'admin'
    or assigned_to = (select public.current_crm_member_id())::text
  );
create policy "clients_insert_assigned_or_admin" on public.clients
  for insert to authenticated
  with check (
    (select public.current_crm_role()) = 'admin'
    or assigned_to = (select public.current_crm_member_id())::text
  );
create policy "clients_update_assigned_or_admin" on public.clients
  for update to authenticated
  using (
    (select public.current_crm_role()) = 'admin'
    or assigned_to = (select public.current_crm_member_id())::text
  )
  with check (
    (select public.current_crm_role()) = 'admin'
    or assigned_to = (select public.current_crm_member_id())::text
  );
create policy "clients_delete_admin" on public.clients
  for delete to authenticated
  using ((select public.current_crm_role()) = 'admin');

drop policy if exists "tasks_select_authenticated" on public.tasks;
drop policy if exists "tasks_insert_authenticated" on public.tasks;
drop policy if exists "tasks_update_authenticated" on public.tasks;
drop policy if exists "tasks_delete_authenticated" on public.tasks;
create policy "tasks_select_assigned_or_admin" on public.tasks
  for select to authenticated
  using (
    (select public.current_crm_role()) = 'admin'
    or assigned_to = (select public.current_crm_member_id())::text
    or exists (
      select 1 from public.clients as client
      where client.id = tasks.client_id
        and client.assigned_to = (select public.current_crm_member_id())::text
    )
  );
create policy "tasks_insert_assigned_or_admin" on public.tasks
  for insert to authenticated
  with check (
    (select public.current_crm_role()) = 'admin'
    or assigned_to = (select public.current_crm_member_id())::text
    or exists (
      select 1 from public.clients as client
      where client.id = tasks.client_id
        and client.assigned_to = (select public.current_crm_member_id())::text
    )
  );
create policy "tasks_update_assigned_or_admin" on public.tasks
  for update to authenticated
  using (
    (select public.current_crm_role()) = 'admin'
    or assigned_to = (select public.current_crm_member_id())::text
    or exists (
      select 1 from public.clients as client
      where client.id = tasks.client_id
        and client.assigned_to = (select public.current_crm_member_id())::text
    )
  )
  with check (
    (select public.current_crm_role()) = 'admin'
    or assigned_to = (select public.current_crm_member_id())::text
    or exists (
      select 1 from public.clients as client
      where client.id = tasks.client_id
        and client.assigned_to = (select public.current_crm_member_id())::text
    )
  );
create policy "tasks_delete_admin_or_assignee" on public.tasks
  for delete to authenticated
  using (
    (select public.current_crm_role()) = 'admin'
    or assigned_to = (select public.current_crm_member_id())::text
  );

drop policy if exists "activities_select_authenticated" on public.activities;
drop policy if exists "activities_insert_authenticated" on public.activities;
drop policy if exists "activities_update_authenticated" on public.activities;
drop policy if exists "activities_delete_authenticated" on public.activities;
create policy "activities_select_assigned_or_admin" on public.activities
  for select to authenticated
  using (
    (select public.current_crm_role()) = 'admin'
    or exists (
      select 1 from public.clients as client
      where client.id = activities.client_id
        and client.assigned_to = (select public.current_crm_member_id())::text
    )
  );
create policy "activities_insert_assigned_or_admin" on public.activities
  for insert to authenticated
  with check (
    (select public.current_crm_role()) = 'admin'
    or exists (
      select 1 from public.clients as client
      where client.id = activities.client_id
        and client.assigned_to = (select public.current_crm_member_id())::text
    )
  );
create policy "activities_update_admin" on public.activities
  for update to authenticated
  using ((select public.current_crm_role()) = 'admin')
  with check ((select public.current_crm_role()) = 'admin');
create policy "activities_delete_admin" on public.activities
  for delete to authenticated
  using ((select public.current_crm_role()) = 'admin');

drop policy if exists "notes_select_authenticated" on public.notes;
drop policy if exists "notes_insert_authenticated" on public.notes;
drop policy if exists "notes_update_authenticated" on public.notes;
drop policy if exists "notes_delete_authenticated" on public.notes;
create policy "notes_select_assigned_or_admin" on public.notes
  for select to authenticated
  using (
    (select public.current_crm_role()) = 'admin'
    or exists (
      select 1 from public.clients as client
      where client.id = notes.client_id
        and client.assigned_to = (select public.current_crm_member_id())::text
    )
  );
create policy "notes_insert_assigned_or_admin" on public.notes
  for insert to authenticated
  with check (
    (select public.current_crm_role()) = 'admin'
    or exists (
      select 1 from public.clients as client
      where client.id = notes.client_id
        and client.assigned_to = (select public.current_crm_member_id())::text
    )
  );
create policy "notes_update_admin" on public.notes
  for update to authenticated
  using ((select public.current_crm_role()) = 'admin')
  with check ((select public.current_crm_role()) = 'admin');
create policy "notes_delete_admin" on public.notes
  for delete to authenticated
  using ((select public.current_crm_role()) = 'admin');
