create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  report_date date not null default current_date,
  work_summary text not null,
  accomplishments text not null default '',
  blockers text not null default '',
  next_day_plan text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_reports_one_per_user_per_day unique (user_id, report_date)
);

create index if not exists daily_reports_report_date_idx
  on public.daily_reports (report_date desc, created_at desc);

alter table public.daily_reports enable row level security;

grant select, insert, update on public.daily_reports to authenticated;
revoke delete on public.daily_reports from public, anon, authenticated;

create policy "daily_reports_select_own_or_admin" on public.daily_reports
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.current_crm_role()) = 'admin'
  );

create policy "daily_reports_insert_own" on public.daily_reports
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.current_crm_role()) in ('manager', 'staff', 'team_member')
  );

create policy "daily_reports_update_own" on public.daily_reports
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and (select public.current_crm_role()) in ('manager', 'staff', 'team_member')
  )
  with check (
    user_id = (select auth.uid())
    and (select public.current_crm_role()) in ('manager', 'staff', 'team_member')
  );
