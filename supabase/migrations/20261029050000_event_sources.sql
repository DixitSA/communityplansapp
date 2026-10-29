-- Calendar feeds (iCal) the ingest-ical function pulls from. Admin-managed.
create table public.event_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'ical' check (kind = 'ical'),
  url text not null check (url ~* '^https://'),
  city_id smallint not null references public.cities (id),
  default_interest_slugs text[] not null default '{}',
  default_lat double precision check (default_lat between -90 and 90),
  default_lng double precision check (default_lng between -180 and 180),
  default_venue_name text,
  active boolean not null default true,
  last_run_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
alter table public.event_sources enable row level security;

create policy "admins read sources" on public.event_sources for select to authenticated
  using ((select private.is_admin()));
create policy "admins add sources" on public.event_sources for insert to authenticated
  with check ((select private.is_admin()));
create policy "admins edit sources" on public.event_sources for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

revoke all on public.event_sources from anon;
grant select, insert, update on public.event_sources to authenticated;
