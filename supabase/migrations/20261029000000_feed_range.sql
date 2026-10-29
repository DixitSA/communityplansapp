-- Scrollable agenda feed: events over a range of local days, ordered by time.
-- Same filters, scoring and privacy as get_feed, plus the event's local `day`.
-- p_days is clamped to 1..14.
create function public.get_feed_range(
  p_city_id smallint,
  p_start date,
  p_days integer,
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 16093,
  p_interest_ids smallint[] default null,
  p_price text default 'any',
  p_mode text default 'nearby'
)
returns table (
  id uuid,
  title text,
  starts_at timestamptz,
  venue_name text,
  neighborhood text,
  image_url text,
  is_free boolean,
  price_min numeric,
  lat double precision,
  lng double precision,
  distance_m double precision,
  interest_ids smallint[],
  going_count bigint,
  friends_going jsonb,
  my_status public.rsvp_status,
  score double precision,
  day date
)
language sql stable security definer set search_path = '' as $$
  with
  params as (
    select
      auth.uid() as uid,
      extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as origin,
      c.timezone as tz,
      (p_start::timestamp at time zone c.timezone) as range_start,
      ((p_start + greatest(1, least(coalesce(p_days, 1), 14)))::timestamp at time zone c.timezone) as range_end
    from public.cities c
    where c.id = p_city_id
  ),
  base as (
    select
      e.*,
      extensions.st_distance(e.location, p.origin) as dist,
      (e.starts_at at time zone p.tz)::date as local_day,
      array(select ei.interest_id from public.event_interests ei where ei.event_id = e.id) as ints
    from public.events e, params p
    where e.city_id = p_city_id
      and e.status = 'active'
      and e.starts_at >= p.range_start
      and e.starts_at < p.range_end
      and extensions.st_dwithin(e.location, p.origin, p_radius_m)
      and (p_price = 'any' or (p_price = 'free' and e.is_free) or (p_price = 'paid' and not e.is_free))
      and (
        p_interest_ids is null
        or exists (
          select 1 from public.event_interests ei
          where ei.event_id = e.id and ei.interest_id = any (p_interest_ids)
        )
      )
  ),
  social as (
    select
      b.*,
      (select count(*) from public.rsvps r where r.event_id = b.id and r.status = 'going') as going,
      (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', pr.id, 'display_name', pr.display_name, 'avatar_path', pr.avatar_path)), '[]'::jsonb)
        from public.rsvps r
        join public.profiles pr on pr.id = r.user_id
        where r.event_id = b.id
          and r.status = 'going'
          and public.are_friends((select uid from params), r.user_id)
      ) as friends,
      (select r.status from public.rsvps r where r.event_id = b.id and r.user_id = (select uid from params)) as mine,
      exists (
        select 1 from public.profile_interests pi
        where pi.profile_id = (select uid from params) and pi.interest_id = any (b.ints)
      ) as matches_interest
    from base b
  )
  select
    s.id, s.title, s.starts_at, s.venue_name, s.neighborhood, s.image_url, s.is_free, s.price_min,
    extensions.st_y(s.location::extensions.geometry), extensions.st_x(s.location::extensions.geometry),
    s.dist, s.ints, s.going, s.friends, s.mine,
    3.0 * ln(1 + jsonb_array_length(s.friends))
      + 2.0 * (case when s.matches_interest then 1 else 0 end)
      + 1.0 * (1 - least(s.dist / greatest(p_radius_m, 1), 1))
      + 0.5 * ln(1 + s.going)
      as score,
    s.local_day
  from social s
  where p_mode = 'nearby' or jsonb_array_length(s.friends) > 0
  order by s.starts_at, s.id;
$$;

revoke execute on function public.get_feed_range from public, anon;
grant execute on function public.get_feed_range to authenticated;
