-- Convert timestamp without time zone columns to timestamp with time zone (timestamptz)
-- Existing values in these columns were written as UTC by Postgres default now(),
-- so we cast them from UTC to timestamptz.

ALTER TABLE public.clients 
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.activities 
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.notes 
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.tasks 
  ALTER COLUMN due_date TYPE timestamptz USING due_date AT TIME ZONE 'UTC';
