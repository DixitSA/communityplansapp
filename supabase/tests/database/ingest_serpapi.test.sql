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

-- Lockdown
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
