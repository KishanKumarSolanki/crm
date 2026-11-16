alter table public.clients
  add column if not exists appointment_whatsapp_confirmed_for timestamptz;

-- Existing non-IGS appointment leads were handled by the original landing flow.
-- Leave IGS bookings unmarked so their confirmation can be sent on the next form
-- submission after the IGS appointment parser has been fixed.
update public.clients
set appointment_whatsapp_confirmed_for = next_follow_up
where stage = 'meeting_booked'
  and next_follow_up is not null
  and lower(btrim(coalesce(lead_source, ''))) not in ('igs', 'institute growth system');
