alter table public.clients
  add column if not exists external_lead_id text;

create unique index if not exists clients_external_lead_id_unique_idx
  on public.clients (external_lead_id)
  where external_lead_id is not null;
