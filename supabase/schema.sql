create extension if not exists "pgcrypto";

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.day_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date date not null,
  day_type text not null default 'working_day',
  out_of_office_hours numeric not null default 0,
  note text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint day_records_day_type_check
    check (day_type in ('working_day', 'vacation', 'sick_leave', 'holiday', 'weekend')),
  constraint day_records_out_of_office_hours_nonnegative_check
    check (out_of_office_hours >= 0)
);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date date not null,
  project_id uuid references public.projects(id) on delete set null,
  hours numeric not null check (hours > 0),
  note text,
  created_at timestamp with time zone not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_day_records_updated_at on public.day_records;
create trigger set_day_records_updated_at
before update on public.day_records
for each row
execute function public.set_updated_at();

create index if not exists projects_active_idx on public.projects(active);
create index if not exists projects_name_idx on public.projects(name);
create index if not exists projects_created_at_idx on public.projects(created_at desc);
create index if not exists projects_user_id_idx on public.projects(user_id);
create index if not exists day_records_date_idx on public.day_records(date desc);
create index if not exists day_records_day_type_idx on public.day_records(day_type);
create index if not exists day_records_user_id_idx on public.day_records(user_id);
create unique index if not exists day_records_user_id_date_key on public.day_records(user_id, date);
create index if not exists time_entries_date_idx on public.time_entries(date desc);
create index if not exists time_entries_project_id_idx on public.time_entries(project_id);
create index if not exists time_entries_date_project_id_idx on public.time_entries(date desc, project_id);
create index if not exists time_entries_user_id_idx on public.time_entries(user_id);
create index if not exists time_entries_user_id_date_idx on public.time_entries(user_id, date desc);

alter table public.projects enable row level security;
alter table public.day_records enable row level security;
alter table public.time_entries enable row level security;

drop policy if exists "Public read/write projects" on public.projects;
drop policy if exists "Authenticated read/write projects" on public.projects;
drop policy if exists "Users manage own projects" on public.projects;
create policy "Users manage own projects"
on public.projects
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Public read/write day records" on public.day_records;
drop policy if exists "Authenticated read/write day records" on public.day_records;
drop policy if exists "Users manage own day records" on public.day_records;
create policy "Users manage own day records"
on public.day_records
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Public read/write time entries" on public.time_entries;
drop policy if exists "Authenticated read/write time entries" on public.time_entries;
drop policy if exists "Users manage own time entries" on public.time_entries;
create policy "Users manage own time entries"
on public.time_entries
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

revoke all on public.projects from anon;
revoke all on public.day_records from anon;
revoke all on public.time_entries from anon;

grant usage on schema public to authenticated;
grant all on public.projects to authenticated;
grant all on public.day_records to authenticated;
grant all on public.time_entries to authenticated;

drop view if exists public.daily_overtime;

create view public.daily_overtime
with (security_invoker = true) as
select
  user_id,
  date,
  sum(hours)::numeric as total_hours,
  greatest(sum(hours) - 8, 0)::numeric as overtime_hours
from public.time_entries
group by user_id, date
having sum(hours) > 8;

grant select on public.daily_overtime to authenticated;
revoke select on public.daily_overtime from anon;
