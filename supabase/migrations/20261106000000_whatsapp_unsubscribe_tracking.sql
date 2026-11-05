alter table public.clients
  add column if not exists whatsapp_unsubscribed_at timestamptz;

create or replace function public.revoke_whatsapp_opt_in(p_phone text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_phone text;
  changed_rows integer;
begin
  normalized_phone := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  if length(normalized_phone) < 8 or length(normalized_phone) > 15 then
    return 0;
  end if;

  update public.clients
  set whatsapp_opt_in = false,
      whatsapp_unsubscribed_at = coalesce(whatsapp_unsubscribed_at, now())
  where regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = normalized_phone;
  get diagnostics changed_rows = row_count;
  return changed_rows;
end;
$$;

revoke all on function public.revoke_whatsapp_opt_in(text) from public, anon, authenticated;
grant execute on function public.revoke_whatsapp_opt_in(text) to service_role;
