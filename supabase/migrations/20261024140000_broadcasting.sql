-- Admin-only campaign, recipient, consent, and delivery records.
alter table public.clients
  add column if not exists email_marketing_opt_in boolean not null default false,
  add column if not exists email_unsubscribed_at timestamptz,
  add column if not exists whatsapp_opt_in boolean not null default false;

create table if not exists public.broadcast_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null check (channel in ('email', 'whatsapp')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'queued', 'processing', 'sent', 'partial', 'failed', 'cancelled')),
  subject text,
  body_html text,
  body_text text,
  message_kind text not null default 'text' check (message_kind in ('text', 'template', 'media')),
  template_name text,
  template_language text,
  template_parameters jsonb not null default '[]'::jsonb,
  filters jsonb not null default '{}'::jsonb,
  dedupe_key text,
  attachment_paths jsonb not null default '[]'::jsonb,
  recipient_count integer not null default 0 check (recipient_count >= 0),
  scheduled_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists broadcast_campaigns_status_schedule_idx
  on public.broadcast_campaigns (status, scheduled_at, created_at);
create index if not exists broadcast_campaigns_dedupe_idx
  on public.broadcast_campaigns (dedupe_key, created_at desc)
  where dedupe_key is not null;

create table if not exists public.broadcast_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.broadcast_campaigns(id) on delete cascade,
  -- Keep the CRM's existing client key as text; its base-table type is project-defined.
  client_id text not null,
  client_name text not null,
  company text,
  email text,
  phone text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'delivered', 'read', 'failed', 'skipped')),
  attempts integer not null default 0,
  next_attempt_at timestamptz,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  email_opened_at timestamptz,
  email_clicked_at timestamptz,
  status_updated_at timestamptz,
  provider_message_id text,
  error_message text,
  unsubscribe_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (campaign_id, client_id)
);

create index if not exists broadcast_recipients_queue_idx
  on public.broadcast_recipients (status, next_attempt_at, created_at);
create index if not exists broadcast_recipients_campaign_idx
  on public.broadcast_recipients (campaign_id, status, created_at);
create index if not exists broadcast_recipients_provider_idx
  on public.broadcast_recipients (provider_message_id)
  where provider_message_id is not null;

alter table public.broadcast_campaigns enable row level security;
alter table public.broadcast_recipients enable row level security;

drop policy if exists "broadcast_campaigns_admin_select" on public.broadcast_campaigns;
create policy "broadcast_campaigns_admin_select" on public.broadcast_campaigns
  for select to authenticated using ((select public.current_crm_role()) = 'admin');
drop policy if exists "broadcast_campaigns_admin_insert" on public.broadcast_campaigns;
create policy "broadcast_campaigns_admin_insert" on public.broadcast_campaigns
  for insert to authenticated with check (
    (select public.current_crm_role()) = 'admin' and created_by = (select auth.uid())
  );
drop policy if exists "broadcast_campaigns_admin_update" on public.broadcast_campaigns;
create policy "broadcast_campaigns_admin_update" on public.broadcast_campaigns
  for update to authenticated using ((select public.current_crm_role()) = 'admin')
  with check ((select public.current_crm_role()) = 'admin');
drop policy if exists "broadcast_campaigns_admin_delete" on public.broadcast_campaigns;
create policy "broadcast_campaigns_admin_delete" on public.broadcast_campaigns
  for delete to authenticated using ((select public.current_crm_role()) = 'admin' and status = 'draft');

drop policy if exists "broadcast_recipients_admin_select" on public.broadcast_recipients;
create policy "broadcast_recipients_admin_select" on public.broadcast_recipients
  for select to authenticated using ((select public.current_crm_role()) = 'admin');
drop policy if exists "broadcast_recipients_admin_insert" on public.broadcast_recipients;
create policy "broadcast_recipients_admin_insert" on public.broadcast_recipients
  for insert to authenticated with check (
    (select public.current_crm_role()) = 'admin'
    and exists (
      select 1 from public.broadcast_campaigns campaign
      where campaign.id = campaign_id and campaign.created_by = (select auth.uid())
    )
  );
drop policy if exists "broadcast_recipients_admin_delete_draft" on public.broadcast_recipients;
create policy "broadcast_recipients_admin_delete_draft" on public.broadcast_recipients
  for delete to authenticated using (
    (select public.current_crm_role()) = 'admin'
    and exists (
      select 1 from public.broadcast_campaigns campaign
      where campaign.id = campaign_id and campaign.status = 'draft'
    )
  );

grant select, insert, update, delete on public.broadcast_campaigns to authenticated;
grant select, insert, delete on public.broadcast_recipients to authenticated;
grant all on public.broadcast_campaigns, public.broadcast_recipients to service_role;

-- Workers claim batches atomically, so concurrent invocations cannot send the same row.
create or replace function public.claim_broadcast_recipients(p_limit integer default 25)
returns table (
  id uuid,
  campaign_id uuid,
  client_id text,
  channel text,
  client_name text,
  company text,
  email text,
  phone text,
  unsubscribe_token uuid,
  attempts integer,
  subject text,
  body_html text,
  body_text text,
  message_kind text,
  template_name text,
  template_language text,
  template_parameters jsonb,
  attachment_paths jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select recipient.id
    from public.broadcast_recipients as recipient
    join public.broadcast_campaigns as campaign on campaign.id = recipient.campaign_id
    where recipient.status = 'pending'
      and (recipient.next_attempt_at is null or recipient.next_attempt_at <= now())
      and campaign.status in ('scheduled', 'queued', 'processing')
      and (campaign.scheduled_at is null or campaign.scheduled_at <= now())
    order by campaign.scheduled_at nulls first, recipient.created_at
    for update of recipient skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  ), claimed as (
    update public.broadcast_recipients as recipient
    set status = 'processing',
        attempts = recipient.attempts + 1,
        last_attempt_at = now(),
        error_message = null
    from candidates
    where recipient.id = candidates.id
    returning recipient.*
  )
  select claimed.id, claimed.campaign_id, claimed.client_id, campaign.channel,
    claimed.client_name, claimed.company, claimed.email, claimed.phone,
    claimed.unsubscribe_token, claimed.attempts, campaign.subject,
    campaign.body_html, campaign.body_text, campaign.message_kind,
    campaign.template_name, campaign.template_language,
    campaign.template_parameters, campaign.attachment_paths
  from claimed
  join public.broadcast_campaigns as campaign on campaign.id = claimed.campaign_id;

  update public.broadcast_campaigns as campaign
  set status = 'processing', started_at = coalesce(started_at, now()), updated_at = now()
  where campaign.id in (
    select recipient.campaign_id from public.broadcast_recipients as recipient
    where recipient.status = 'processing'
  ) and campaign.status in ('scheduled', 'queued');
end;
$$;

revoke all on function public.claim_broadcast_recipients(integer) from public, anon, authenticated;
grant execute on function public.claim_broadcast_recipients(integer) to service_role;

-- Honor common WhatsApp opt-out replies from a verified provider webhook.
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
  set whatsapp_opt_in = false
  where whatsapp_opt_in is true
    and regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = normalized_phone;
  get diagnostics changed_rows = row_count;
  return changed_rows;
end;
$$;

revoke all on function public.revoke_whatsapp_opt_in(text) from public, anon, authenticated;
grant execute on function public.revoke_whatsapp_opt_in(text) to service_role;

-- Private attachments can only be uploaded by admins and downloaded by the service worker.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'broadcast-attachments',
  'broadcast-attachments',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "broadcast_attachments_admin_upload" on storage.objects;
create policy "broadcast_attachments_admin_upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'broadcast-attachments' and (select public.current_crm_role()) = 'admin'
  );
drop policy if exists "broadcast_attachments_admin_read" on storage.objects;
create policy "broadcast_attachments_admin_read" on storage.objects
  for select to authenticated using (
    bucket_id = 'broadcast-attachments' and (select public.current_crm_role()) = 'admin'
  );
drop policy if exists "broadcast_attachments_admin_delete" on storage.objects;
create policy "broadcast_attachments_admin_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'broadcast-attachments' and (select public.current_crm_role()) = 'admin'
  );
