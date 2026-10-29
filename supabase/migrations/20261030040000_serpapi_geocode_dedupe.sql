-- SerpApi ingestion support: geocode cache + cross-source duplicate lookup.
create extension if not exists pg_trgm with schema extensions;

-- Service-role only: RLS on, no policies, no grants. Misses are cached with null coords.
create table public.geocode_cache (
  address_key text primary key, -- lowercased, whitespace-collapsed address
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  created_at timestamptz not null default now()
);
alter table public.geocode_cache enable row level security;
revoke all on public.geocode_cache from anon, authenticated;

create index events_title_trgm_idx on public.events using gin (title extensions.gin_trgm_ops);

-- Id of an existing active event (other source, same city) that looks like the same happening.
create function public.find_duplicate_event(
  p_city_id smallint,
  p_title text,
  p_starts_at timestamptz,
  p_lat double precision,
  p_lng double precision,
  p_exclude_source public.event_source
) returns uuid
language sql stable security definer set search_path = ''
as $$
  select e.id
  from public.events e
  where e.city_id = p_city_id
    and e.status = 'active'
    and e.source <> p_exclude_source
    and e.starts_at between p_starts_at - interval '60 minutes' and p_starts_at + interval '60 minutes'
    and (
      btrim(regexp_replace(lower(e.title), '[^[:alnum:]]+', ' ', 'g')) = btrim(regexp_replace(lower(p_title), '[^[:alnum:]]+', ' ', 'g'))
      or extensions.similarity(e.title, p_title) >= 0.5
    )
    and (
      p_lat is null or p_lng is null
      or extensions.st_dwithin(
        e.location,
        extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
        400
      )
    )
  order by e.starts_at
  limit 1;
$$;

revoke execute on function public.find_duplicate_event from public, anon, authenticated;
grant execute on function public.find_duplicate_event to service_role;
