-- Enforce EmailJS's per-account request pacing across concurrent Edge Function workers.
create table if not exists public.broadcast_provider_rate_limits (
  provider text primary key,
  next_allowed_at timestamptz not null
);

alter table public.broadcast_provider_rate_limits enable row level security;
revoke all on table public.broadcast_provider_rate_limits from public, anon, authenticated;
grant all on table public.broadcast_provider_rate_limits to service_role;

create or replace function public.claim_emailjs_send_slot()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  send_at timestamptz;
begin
  insert into public.broadcast_provider_rate_limits as rate_limit (provider, next_allowed_at)
  values ('emailjs', now() + interval '1100 milliseconds')
  on conflict (provider) do update
    set next_allowed_at = greatest(rate_limit.next_allowed_at, now()) + interval '1100 milliseconds'
  returning next_allowed_at - interval '1100 milliseconds' into send_at;

  return send_at;
end;
$$;

revoke all on function public.claim_emailjs_send_slot() from public, anon, authenticated;
grant execute on function public.claim_emailjs_send_slot() to service_role;
