-- IGS records appointment notes as "Appointment: ... (IST) (India Standard Time)".
-- Keep that format in sync with the CRM stage and appointment timestamp.
create or replace function public.mark_appointment_lead_meeting_booked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  appointment_parts text[];
  month_number integer;
  hour_24 integer;
  appointment_at timestamptz;
begin
  appointment_parts := regexp_match(
    new.note,
    '(?:Appointment Requested|Appointment):[[:space:]]*(?:[A-Za-z]+,[[:space:]]*)?([0-9]{1,2})[[:space:]]+([A-Za-z]+)[[:space:]]+([0-9]{4})[[:space:]]+at[[:space:]]+([0-9]{1,2}):([0-9]{2})[[:space:]]*(AM|PM)',
    'i'
  );
  if appointment_parts is null then
    return new;
  end if;

  month_number := case lower(appointment_parts[2])
    when 'january' then 1 when 'february' then 2 when 'march' then 3
    when 'april' then 4 when 'may' then 5 when 'june' then 6
    when 'july' then 7 when 'august' then 8 when 'september' then 9
    when 'october' then 10 when 'november' then 11 when 'december' then 12
    else null
  end;
  if month_number is null then
    return new;
  end if;

  hour_24 := (appointment_parts[4]::integer % 12)
    + case when upper(appointment_parts[6]) = 'PM' then 12 else 0 end;
  appointment_at := make_timestamptz(
    appointment_parts[3]::integer,
    month_number,
    appointment_parts[1]::integer,
    hour_24,
    appointment_parts[5]::integer,
    0,
    'Asia/Kolkata'
  );

  update public.clients as client
  set next_follow_up = appointment_at,
      stage = 'meeting_booked'
  where client.id = new.client_id
    and client.stage in ('discovery', 'meeting_booked');

  return new;
end;
$$;

revoke all on function public.mark_appointment_lead_meeting_booked() from public, anon, authenticated;

drop trigger if exists notes_mark_appointment_lead_meeting_booked on public.notes;
create trigger notes_mark_appointment_lead_meeting_booked
  after insert or update on public.notes
  for each row
  execute function public.mark_appointment_lead_meeting_booked();

-- Backfill future appointments already captured by IGS before this parser fix.
with parsed_notes as (
  select
    note.client_id,
    make_timestamptz(
      parts[3]::integer,
      case lower(parts[2])
        when 'january' then 1 when 'february' then 2 when 'march' then 3
        when 'april' then 4 when 'may' then 5 when 'june' then 6
        when 'july' then 7 when 'august' then 8 when 'september' then 9
        when 'october' then 10 when 'november' then 11 when 'december' then 12
      end,
      parts[1]::integer,
      (parts[4]::integer % 12) + case when upper(parts[6]) = 'PM' then 12 else 0 end,
      parts[5]::integer,
      0,
      'Asia/Kolkata'
    ) as appointment_at,
    row_number() over (partition by note.client_id order by note.created_at desc) as recency
  from public.notes as note
  cross join lateral regexp_match(
    note.note,
    '(?:Appointment Requested|Appointment):[[:space:]]*(?:[A-Za-z]+,[[:space:]]*)?([0-9]{1,2})[[:space:]]+([A-Za-z]+)[[:space:]]+([0-9]{4})[[:space:]]+at[[:space:]]+([0-9]{1,2}):([0-9]{2})[[:space:]]*(AM|PM)',
    'i'
  ) as matches(parts)
), latest_appointments as (
  select client_id, appointment_at
  from parsed_notes
  where recency = 1
    and appointment_at > now()
)
update public.clients as client
set next_follow_up = appointment.appointment_at,
    stage = 'meeting_booked'
from latest_appointments as appointment
where client.id = appointment.client_id
  and client.stage in ('discovery', 'meeting_booked');

-- Normalize the label so existing CRM appointment views can display IGS notes.
update public.notes
set note = regexp_replace(note, 'Appointment:', 'Appointment Requested:', 'i')
where note ~* 'Appointment:'
  and note !~* 'Appointment Requested:';
