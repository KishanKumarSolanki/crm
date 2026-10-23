alter table public.clients
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists fbclid text,
  add column if not exists fbc text,
  add column if not exists fbp text,
  add column if not exists landing_page_url text,
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists revenue_amount numeric(12, 2),
  add column if not exists first_contact_at timestamptz;

create index if not exists clients_utm_campaign_idx
  on public.clients (utm_campaign)
  where utm_campaign is not null;
create index if not exists clients_created_at_idx
  on public.clients (created_at);

create table if not exists public.campaign_spend (
  id uuid primary key default gen_random_uuid(),
  campaign_name text not null,
  spend_date date not null default current_date,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'INR',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists campaign_spend_date_campaign_idx
  on public.campaign_spend (spend_date, campaign_name);

alter table public.campaign_spend enable row level security;
grant select, insert, update, delete on public.campaign_spend to authenticated;
drop policy if exists campaign_spend_admin_access on public.campaign_spend;
create policy campaign_spend_admin_access on public.campaign_spend
  for all to authenticated
  using ((select public.current_crm_role()) = 'admin')
  with check ((select public.current_crm_role()) = 'admin');

create table if not exists public.meta_event_queue (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_name text not null,
  client_id text not null,
  event_time timestamptz not null default now(),
  event_source_url text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists meta_event_queue_retry_idx
  on public.meta_event_queue (status, next_attempt_at)
  where status in ('pending', 'failed');
create index if not exists meta_event_queue_client_idx
  on public.meta_event_queue (client_id, created_at desc);

alter table public.meta_event_queue enable row level security;
grant select on public.meta_event_queue to authenticated;
grant all on public.meta_event_queue to service_role;
drop policy if exists meta_event_queue_admin_read on public.meta_event_queue;
create policy meta_event_queue_admin_read on public.meta_event_queue
  for select to authenticated
  using ((select public.current_crm_role()) = 'admin');

create or replace function public.queue_marketing_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mapped_event text;
begin
  if tg_op = 'INSERT' then
    if new.marketing_consent is true then
      insert into public.meta_event_queue (event_id, event_name, client_id, event_source_url)
      values (gen_random_uuid()::text, 'Lead', new.id::text, new.landing_page_url);
    end if;
    return new;
  end if;

  if new.stage is distinct from old.stage and new.marketing_consent is true then
    mapped_event := case new.stage
      when 'qualified' then 'QualifiedLead'
      when 'meeting_booked' then 'Schedule'
      when 'signed' then 'Purchase'
      else null
    end;
    if mapped_event is not null then
      insert into public.meta_event_queue (event_id, event_name, client_id, event_source_url)
      values (gen_random_uuid()::text, mapped_event, new.id::text, new.landing_page_url);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists clients_queue_marketing_event_insert on public.clients;
drop trigger if exists clients_queue_marketing_event_stage on public.clients;
create trigger clients_queue_marketing_event_insert
  after insert on public.clients
  for each row execute function public.queue_marketing_event();
create trigger clients_queue_marketing_event_stage
  after update of stage on public.clients
  for each row execute function public.queue_marketing_event();
revoke all on function public.queue_marketing_event() from public, anon, authenticated;

create or replace function public.set_client_first_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type = 'conversation' then
    update public.clients
    set first_contact_at = coalesce(first_contact_at, new.created_at)
    where id::text = new.client_id::text;
  end if;
  return new;
end;
$$;

drop trigger if exists activities_set_client_first_contact on public.activities;
create trigger activities_set_client_first_contact
  after insert on public.activities
  for each row execute function public.set_client_first_contact();
revoke all on function public.set_client_first_contact() from public, anon, authenticated;

create table if not exists public.lead_capture_rate_limits (
  ip_hash text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists lead_capture_rate_limits_updated_idx
  on public.lead_capture_rate_limits (updated_at);
alter table public.lead_capture_rate_limits enable row level security;
revoke all on public.lead_capture_rate_limits from public, anon, authenticated;
grant all on public.lead_capture_rate_limits to service_role;

create or replace function public.consume_public_lead_capture(
  p_ip_hash text,
  p_max_requests integer default 8,
  p_window_seconds integer default 600
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_attempts integer;
begin
  delete from public.lead_capture_rate_limits
  where updated_at < now() - interval '24 hours';

  insert into public.lead_capture_rate_limits (ip_hash, window_started_at, attempts, updated_at)
  values (p_ip_hash, now(), 1, now())
  on conflict (ip_hash) do update set
    window_started_at = case
      when public.lead_capture_rate_limits.window_started_at < now() - make_interval(secs => p_window_seconds) then now()
      else public.lead_capture_rate_limits.window_started_at
    end,
    attempts = case
      when public.lead_capture_rate_limits.window_started_at < now() - make_interval(secs => p_window_seconds) then 1
      else public.lead_capture_rate_limits.attempts + 1
    end,
    updated_at = now()
  returning attempts into current_attempts;

  return current_attempts <= p_max_requests;
end;
$$;
revoke all on function public.consume_public_lead_capture(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_public_lead_capture(text, integer, integer) to service_role;
