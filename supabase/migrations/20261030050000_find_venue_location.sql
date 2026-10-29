-- Free venue lookup: reuse coordinates from events other sources already gave us.
-- Only Ticketmaster and curated events: iCal events without GEO carry the feed's default coordinates.
-- Names are normalized (lowercase, punctuation, "the", "charlotte", "nc" removed). Ambiguous answers
-- (generic names, chains with far-apart branches) return nothing.
create function public.find_venue_location(p_city_id smallint, p_venue text)
returns table (lat double precision, lng double precision)
language sql stable security definer set search_path = ''
as $$
  with q as (
    select btrim(regexp_replace(regexp_replace(regexp_replace(lower(p_venue), '[^[:alnum:]]+', ' ', 'g'), '\m(the|charlotte|nc)\M', ' ', 'g'), '\s+', ' ', 'g')) as n
  ), c as (
    select e.starts_at, e.location, btrim(regexp_replace(regexp_replace(regexp_replace(lower(e.venue_name), '[^[:alnum:]]+', ' ', 'g'), '\m(the|charlotte|nc)\M', ' ', 'g'), '\s+', ' ', 'g')) as n
    from public.events e
    where e.city_id = p_city_id and e.source in ('ticketmaster', 'curated')
      and e.status <> 'hidden' and e.venue_name is not null
  ), m as (
    select c.location, c.starts_at, extensions.similarity(c.n, q.n) as s
    from c, q
    where length(q.n) >= 4
      and q.n not in ('downtown', 'uptown', 'south end', 'noda', 'plaza midwood', 'online', 'tba', 'tbd')
      and c.n <> '' and (c.n = q.n or extensions.similarity(c.n, q.n) >= 0.6)
  ), best as (
    select * from m order by s desc, starts_at desc limit 1
  )
  select extensions.st_y(best.location::extensions.geometry), extensions.st_x(best.location::extensions.geometry)
  from best
  where not exists (
    select 1 from m
    where m.s >= best.s - 0.05 and not extensions.st_dwithin(m.location, best.location, 300)
  );
$$;

revoke execute on function public.find_venue_location from public, anon, authenticated;
grant execute on function public.find_venue_location to service_role;
