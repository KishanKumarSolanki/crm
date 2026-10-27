alter table public.activities
  add column if not exists follow_up_at timestamptz;
