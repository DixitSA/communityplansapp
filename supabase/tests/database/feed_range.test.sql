-- get_feed_range: multi-day agenda feed. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c');
insert into public.profiles (id, username, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'Alice'),
  ('00000000-0000-0000-0000-00000000000b', 'bob',   'Bob'),
  ('00000000-0000-0000-0000-00000000000c', 'carol', 'Carol');
-- alice <-> bob are friends; carol is a stranger to alice.
insert into public.friendships (user_a, user_b, requested_by, status) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b',
   '00000000-0000-0000-0000-00000000000a', 'accepted');

-- Oct 28 evening, Oct 29 at 11:30 PM Eastern (03:30 UTC on Oct 30), Oct 31 morning (free),
-- and one far out on Nov 20 (beyond a 14-day window from Oct 28).
insert into public.events (id, source, city_id, title, starts_at, is_free, location) values
  ('11111111-1111-1111-1111-111111111111', 'curated', (select id from public.cities where slug = 'charlotte'),
   'Day One', timestamptz '2026-10-28 21:00 America/New_York', false,
   extensions.st_setsrid(extensions.st_makepoint(-80.85, 35.22), 4326)::extensions.geography),
  ('22222222-2222-2222-2222-222222222222', 'curated', (select id from public.cities where slug = 'charlotte'),
   'Late Night', timestamptz '2026-10-29 23:30 America/New_York', false,
   extensions.st_setsrid(extensions.st_makepoint(-80.85, 35.22), 4326)::extensions.geography),
  ('33333333-3333-3333-3333-333333333333', 'curated', (select id from public.cities where slug = 'charlotte'),
   'Free Brunch', timestamptz '2026-10-31 10:00 America/New_York', true,
   extensions.st_setsrid(extensions.st_makepoint(-80.85, 35.22), 4326)::extensions.geography),
  ('44444444-4444-4444-4444-444444444444', 'curated', (select id from public.cities where slug = 'charlotte'),
   'Far Future', timestamptz '2026-11-20 12:00 America/New_York', false,
   extensions.st_setsrid(extensions.st_makepoint(-80.85, 35.22), 4326)::extensions.geography);

insert into public.event_interests (event_id, interest_id)
  select '11111111-1111-1111-1111-111111111111', id from public.interests where slug = 'music';

update public.events set ends_at = timestamptz '2026-10-29 01:00 America/New_York'
  where id = '11111111-1111-1111-1111-111111111111';

delete from public.notifications;

create function pg_temp.login(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- bob and carol go to Day One; carol also to Late Night.
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select public.set_rsvp('11111111-1111-1111-1111-111111111111', 'going');
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select public.set_rsvp('11111111-1111-1111-1111-111111111111', 'going');
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.set_rsvp('11111111-1111-1111-1111-111111111111', 'interested');

-- 1. Local days and ordering -------------------------------------------------
select is((select count(*) from public.get_feed_range(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', 4, 35.2271, -80.8431))::int, 3,
  'four-day range returns the three events in it');
select is((select array_agg(day order by starts_at) from public.get_feed_range(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', 4, 35.2271, -80.8431)),
  array[date '2026-10-28', date '2026-10-29', date '2026-10-31'],
  'events carry their local day, ordered by starts_at');
select is((select day from public.get_feed_range(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', 4, 35.2271, -80.8431)
    where title = 'Late Night'), date '2026-10-29',
  '11:30 PM Eastern is still that local day (though it is the next day in UTC)');
select is((select (starts_at at time zone 'UTC')::date from public.get_feed_range(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', 4, 35.2271, -80.8431)
    where title = 'Late Night'), date '2026-10-30', 'sanity: that event is Oct 30 in UTC');
select is((select count(*) from public.get_feed_range(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-30', 1, 35.2271, -80.8431))::int, 0,
  'a one-day window on Oct 30 local excludes the 11:30 PM Oct 29 event');

-- 2. p_days clamp --------------------------------------------------------------
select is((select count(*) from public.get_feed_range(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', 0, 35.2271, -80.8431))::int, 1,
  'p_days = 0 is clamped up to 1 day');
select is((select count(*) from public.get_feed_range(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', -5, 35.2271, -80.8431))::int, 1,
  'negative p_days is clamped up to 1 day');
select is((select count(*) from public.get_feed_range(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', 100, 35.2271, -80.8431))::int, 3,
  'p_days = 100 is clamped to 14 days (Nov 20 event excluded)');
select is((select count(*) from public.get_feed_range(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', 14, 35.2271, -80.8431))::int, 3,
  'p_days = 14 covers Oct 28 - Nov 10 only');

-- 3. Filters still apply -----------------------------------------------------
select is((select array_agg(title) from public.get_feed_range(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', 4, 35.2271, -80.8431,
    p_price => 'free')), array['Free Brunch'], 'price filter: free');
select is((select array_agg(title) from public.get_feed_range(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', 4, 35.2271, -80.8431,
    p_interest_ids => array[(select id from public.interests where slug = 'music')])),
  array['Day One'], 'interest filter');
select is((select count(*) from public.get_feed_range(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', 4, 36.5, -80.8431,
    p_radius_m => 1000))::int, 0, 'radius filter excludes events outside the radius');
select is((select array_agg(title) from public.get_feed_range(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', 4, 35.2271, -80.8431,
    p_mode => 'friends')), array['Day One'], 'friends mode: only events with a friend going');

-- 4. Privacy matches get_feed ------------------------------------------------
select is((select going_count from public.get_feed_range(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', 1, 35.2271, -80.8431)), 2::bigint,
  'going_count is an aggregate of everyone going');
select is((select jsonb_array_length(friends_going) from public.get_feed_range(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', 1, 35.2271, -80.8431)), 1,
  'friends_going lists only friends (bob, not carol)');
select is((select friends_going from public.get_feed_range(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', 1, 35.2271, -80.8431)),
  (select friends_going from public.get_feed(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', 35.2271, -80.8431)),
  'friends_going equals get_feed');
select is((select my_status::text from public.get_feed_range(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', 1, 35.2271, -80.8431)),
  'interested', 'my_status is the caller''s own');

reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select is((select jsonb_array_length(friends_going) from public.get_feed_range(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', 1, 35.2271, -80.8431)), 0,
  'a stranger sees no friends_going');
select is((select my_status::text from public.get_feed_range(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-29', 1, 35.2271, -80.8431)),
  null, 'my_status is null where the caller has no RSVP');

-- 4b. ends_at comes through ------------------------------------------------------
select is((select ends_at from public.get_feed_range(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', 4, 35.2271, -80.8431)
    where title = 'Day One'), timestamptz '2026-10-29 01:00 America/New_York', 'get_feed_range returns ends_at');
select is((select ends_at from public.get_feed_range(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', 4, 35.2271, -80.8431)
    where title = 'Late Night'), null, 'ends_at is null when unset');
select is((select ends_at from public.get_feed(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', 35.2271, -80.8431)
    where title = 'Day One'), timestamptz '2026-10-29 01:00 America/New_York', 'get_feed returns ends_at');
select is((select count(*) from public.get_feed(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', 35.2271, -80.8431)
    where ends_at is null)::int, 0, 'get_feed: ends_at null only when unset');

-- 5. Anonymous users get nothing ---------------------------------------------
reset role;
set local role anon;
select throws_ok($$ select * from public.get_feed_range(1::smallint, date '2026-10-28', 3, 35.2, -80.8) $$,
  '42501', null, 'anon cannot call get_feed_range');

reset role;
select * from finish();
rollback;
