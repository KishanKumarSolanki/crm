create or replace function public.mark_appointment_lead_meeting_booked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.note ilike '%Appointment Requested:%' then
    update public.clients as client
    set stage = 'meeting_booked'
    where client.id = new.client_id
      and client.stage = 'discovery'
      and client.next_follow_up > now();
  end if;

  return new;
end;
$$;

revoke all on function public.mark_appointment_lead_meeting_booked() from public, anon, authenticated;

drop trigger if exists notes_mark_appointment_lead_meeting_booked on public.notes;
create trigger notes_mark_appointment_lead_meeting_booked
  after insert or update on public.notes
  for each row
  execute function public.mark_appointment_lead_meeting_booked();

update public.clients as client
set stage = 'meeting_booked'
where client.stage = 'discovery'
  and client.next_follow_up > now()
  and exists (
    select 1
    from public.notes as note
    where note.client_id = client.id
      and note.note ilike '%Appointment Requested:%'
  );
