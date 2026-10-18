alter table public.tasks
  add column if not exists assigned_to text,
  add column if not exists priority text not null default 'normal';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_priority_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_priority_check
      check (priority in ('low', 'normal', 'high', 'urgent'));
  end if;
end;
$$;
