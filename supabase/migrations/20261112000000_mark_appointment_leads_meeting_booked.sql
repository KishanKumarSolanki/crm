-- Existing leads with a future appointment request should appear in Meeting Booked.
-- Preserve leads that have already progressed to another CRM stage.
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
