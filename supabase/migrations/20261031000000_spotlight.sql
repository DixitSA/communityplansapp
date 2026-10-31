-- "Popping this week": the spotlight row at the top of the feed.
-- Hybrid: a pick (made by the daily review or by hand) keeps an event in the row until spotlight_until;
-- otherwise an event earns its place with Going RSVPs (friends going, Going in the last 48 hours, total Going).
-- Only Going counts feed the score, and every viewer can already see those. Interested and
-- "Down if friends go" are private and never read here.
alter table public.events add column spotlight_until timestamptz;

-- p_days: how far ahead to look (1-14, default 7). p_limit: how many cards (1-20, default 8).
create function public.get_spotlight(
  p_city_id smallint,
  p_lat double precision,
  p_lng double precision,
  p_days integer default 7,
  p_limit integer default 8
)
returns table (
  id uuid,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  venue_name text,
  neighborhood text,
  image_url text,
  image_sensitive boolean,
  is_free boolean,
  price_min numeric,
  lat double precision,
  lng double precision,
  distance_m double precision,
  interest_ids smallint[],
  going_count bigint,
  friends_going jsonb,
  my_status public.rsvp_status,
  picked boolean,
  score double precision
)
language sql stable security definer set search_path = '' as $$
  with
  params as (
    select
      auth.uid() as uid,
      extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as origin
  ),
  base as (
    select
      e.*,
      extensions.st_distance(e.location, p.origin) as dist,
      array(select ei.interest_id from public.event_interests ei where ei.event_id = e.id) as ints,
      coalesce(e.spotlight_until > now(), false) as is_pick
    from public.events e, params p
    where e.city_id = p_city_id
      and e.status = 'active'
      -- Not over yet (events without an end count as three hours long), and starting within the window.
      and coalesce(e.ends_at, e.starts_at + interval '3 hours') > now()
      and e.starts_at < now() + make_interval(days => greatest(1, least(coalesce(p_days, 7), 14)))
  ),
  social as (
    select
      b.*,
      (select count(*) from public.rsvps r where r.event_id = b.id and r.status = 'going') as going,
      (
        select count(*) from public.rsvps r
        where r.event_id = b.id and r.status = 'going' and r.updated_at > now() - interval '48 hours'
      ) as going_recent,
      (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', pr.id, 'display_name', pr.display_name, 'avatar_path', pr.avatar_path)), '[]'::jsonb)
        from public.rsvps r
        join public.profiles pr on pr.id = r.user_id
        where r.event_id = b.id
          and r.status = 'going'
          and public.are_friends((select uid from params), r.user_id)
      ) as friends,
      (select r.status from public.rsvps r where r.event_id = b.id and r.user_id = (select uid from params)) as mine
    from base b
  )
  select
    s.id, s.title, s.starts_at, s.ends_at, s.venue_name, s.neighborhood, s.image_url, s.image_sensitive,
    s.is_free, s.price_min,
    extensions.st_y(s.location::extensions.geometry), extensions.st_x(s.location::extensions.geometry),
    s.dist, s.ints, s.going, s.friends, s.mine, s.is_pick,
    -- Picks lead; then friends going > momentum (Going in the last 48 h) > total Going.
    (case when s.is_pick then 100.0 else 0.0 end)
      + 3.0 * ln(1 + jsonb_array_length(s.friends))
      + 2.0 * ln(1 + s.going_recent)
      + 1.0 * ln(1 + s.going)
      as score
  from social s
  -- Without a pick an event needs at least three Going, so one or two RSVPs don't make "popping".
  where s.is_pick or s.going >= 3
  order by score desc, s.starts_at, s.id
  limit greatest(1, least(coalesce(p_limit, 8), 20));
$$;

revoke execute on function public.get_spotlight from public, anon;
grant execute on function public.get_spotlight to authenticated;
