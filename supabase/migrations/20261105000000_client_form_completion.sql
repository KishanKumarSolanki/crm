alter table public.clients
  add column if not exists form_completed_at timestamptz;

update public.clients as client
set form_completed_at = (
  select min(activity.created_at)
  from public.activities as activity
  where activity.client_id = client.id
    and activity.type = 'updated'
    and activity.description = 'Lead completed the admission goals form'
)
where client.form_completed_at is null
  and exists (
    select 1
    from public.activities as activity
    where activity.client_id = client.id
      and activity.type = 'updated'
      and activity.description = 'Lead completed the admission goals form'
  );
