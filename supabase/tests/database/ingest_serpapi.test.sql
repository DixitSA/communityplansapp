-- SerpApi ingestion: find_duplicate_event + geocode_cache lockdown. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

-- Existing Ticketmaster event at 2026-11-07 20:00 UTC, uptown Charlotte.
insert into public.events (id, source, external_id, city_id, title, starts_at, location)
values ('11111111-1111-1111-1111-111111111111', 'ticketmaster', 'tm1',
        (select id from public.cities where slug = 'charlotte'), 'Hornets vs. Lakers!',
        '2026-11-07 20:00:00+00',
        extensions.st_setsrid(extensions.st_makepoint(-80.8400, 35.2250), 4326)::extensions.geography);

create function pg_temp.dup(p_title text, p_at timestamptz, p_lat double precision, p_lng double precision,
                            p_src public.event_source default 'serpapi') returns uuid
language sql as $$
  select public.find_duplicate_event((select id from public.cities where slug = 'charlotte'),
                                     p_title, p_at, p_lat, p_lng, p_src);
$$;

select is(pg_temp.dup('Hornets vs. Lakers!', '2026-11-07 20:00+00', 35.2250, -80.8400),
  '11111111-1111-1111-1111-111111111111'::uuid, 'same title matches');
select is(pg_temp.dup('hornets vs lakers', '2026-11-07 20:30+00', 35.2250, -80.8400),
  '11111111-1111-1111-1111-111111111111'::uuid, 'punctuation and case ignored, 30 minutes apart matches');
select is(pg_temp.dup('Charlotte Hornets vs Lakers', '2026-11-07 20:00+00', 35.2250, -80.8400),
  '11111111-1111-1111-1111-111111111111'::uuid, 'similar title matches');
select is(pg_temp.dup('Hornets vs. Lakers!', '2026-11-07 20:00+00', 35.2259, -80.8400),
  '11111111-1111-1111-1111-111111111111'::uuid, '100 m apart matches');
select is(pg_temp.dup('Hornets vs. Lakers!', '2026-11-07 20:00+00', null, null),
  '11111111-1111-1111-1111-111111111111'::uuid, 'no coordinates: distance ignored');

select is(pg_temp.dup('Hornets vs. Lakers!', '2026-11-07 23:00+00', 35.2250, -80.8400), null, '3 hours apart: no match');
select is(pg_temp.dup('Salsa Night', '2026-11-07 20:00+00', 35.2250, -80.8400), null, 'different title: no match');
select is(pg_temp.dup('Hornets vs. Lakers!', '2026-11-07 20:00+00', 35.2430, -80.8400), null, '2 km apart: no match');
select is(pg_temp.dup('Hornets vs. Lakers!', '2026-11-07 20:00+00', 35.2250, -80.8400, 'ticketmaster'), null,
  'same source excluded');

update public.events set status = 'cancelled' where id = '11111111-1111-1111-1111-111111111111';
select is(pg_temp.dup('Hornets vs. Lakers!', '2026-11-07 20:00+00', 35.2250, -80.8400), null, 'inactive events ignored');

-- find_venue_location
insert into public.events (source, external_id, city_id, title, venue_name, starts_at, location) values
  ('ticketmaster', 'v1', (select id from public.cities where slug = 'charlotte'), 'A', 'The Fillmore Charlotte', '2026-11-08 20:00+00',
   extensions.st_setsrid(extensions.st_makepoint(-80.8400, 35.2250), 4326)::extensions.geography),
  ('curated', 'v2', (select id from public.cities where slug = 'charlotte'), 'B', 'Evening Muse', '2026-11-09 20:00+00',
   extensions.st_setsrid(extensions.st_makepoint(-80.8000, 35.2500), 4326)::extensions.geography),
  ('ical', 'v4', (select id from public.cities where slug = 'charlotte'), 'D', 'Optimist Hall', '2026-11-09 20:00+00',
   extensions.st_setsrid(extensions.st_makepoint(-80.9000, 35.3500), 4326)::extensions.geography),
  ('ticketmaster', 'v5', (select id from public.cities where slug = 'charlotte'), 'E', 'Starbucks', '2026-11-09 20:00+00',
   extensions.st_setsrid(extensions.st_makepoint(-80.8000, 35.2000), 4326)::extensions.geography),
  ('curated', 'v6', (select id from public.cities where slug = 'charlotte'), 'F', 'Starbucks', '2026-11-09 20:00+00',
   extensions.st_setsrid(extensions.st_makepoint(-80.8000, 35.2180), 4326)::extensions.geography),
  ('curated', 'v7', (select id from public.cities where slug = 'charlotte'), 'G', 'Charlotte Museum of Art', '2026-11-09 20:00+00',
   extensions.st_setsrid(extensions.st_makepoint(-80.7800, 35.1900), 4326)::extensions.geography),
  ('serpapi', 'v3', (select id from public.cities where slug = 'charlotte'), 'C', 'Ghost Venue', '2026-11-09 20:00+00',
   extensions.st_setsrid(extensions.st_makepoint(-80.7000, 35.3000), 4326)::extensions.geography);

create function pg_temp.venue(p text) returns text language sql as $$
  select (select lat || ',' || lng from public.find_venue_location((select id from public.cities where slug = 'charlotte'), p));
$$;
select diag('similarity(fillmore, fillmore) after normalizing = ' || extensions.similarity('fillmore', 'fillmore'));
select is(pg_temp.venue('evening muse'), '35.25,-80.8', 'exact venue match (case-insensitive)');
select is(pg_temp.venue('The Evening Muse!'), '35.25,-80.8', 'leading "the" and punctuation ignored');
select is(pg_temp.venue('Fillmore Charlotte'), '35.225,-80.84', 'near-exact match');
select is(pg_temp.venue('The Fillmore'), '35.225,-80.84', '"The Fillmore" matches "The Fillmore Charlotte" (similarity 1 after normalizing)');
select is(pg_temp.venue('Optimist Hall'), null, 'ical-source rows ignored');
select is(pg_temp.venue('Charlotte'), null, 'bare "Charlotte" returns nothing');
select is(pg_temp.venue('Downtown'), null, '"Downtown" returns nothing');
select is(pg_temp.venue('Starbucks'), null, 'chain with branches 2 km apart returns nothing');
select is(pg_temp.venue('Charlotte Museum of History'), null, 'Museum of History does not match Museum of Art');
select is(pg_temp.venue('Tiny Unrelated Bakery'), null, 'unrelated name: no match');
select is(pg_temp.venue('Ghost Venue'), null, 'serpapi-source venues ignored');

-- Lockdown
set local role anon;
select throws_ok($$select * from public.find_venue_location(1::smallint, 'x')$$, '42501', null, 'anon cannot execute find_venue_location');
set local role authenticated;
select throws_ok($$select * from public.find_venue_location(1::smallint, 'x')$$, '42501', null, 'authenticated cannot execute find_venue_location');
reset role;

-- Lockdown (dedupe + cache)
set local role anon;
select throws_ok($$select public.find_duplicate_event(1::smallint, 'x', now(), 35.2, -80.8, 'serpapi')$$,
  '42501', null, 'anon cannot execute find_duplicate_event');
set local role authenticated;
select throws_ok($$select public.find_duplicate_event(1::smallint, 'x', now(), 35.2, -80.8, 'serpapi')$$,
  '42501', null, 'authenticated cannot execute find_duplicate_event');
select throws_ok($$select * from public.geocode_cache$$, '42501', null, 'authenticated cannot read geocode_cache');
set local role anon;
select throws_ok($$select * from public.geocode_cache$$, '42501', null, 'anon cannot read geocode_cache');
reset role;

select * from finish();
rollback;
