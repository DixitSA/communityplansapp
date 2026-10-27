-- Privacy matrix + "down if friends go" behaviour. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

-- Cast: alice <-> bob and alice <-> carol are friends; eve is bob's friend;
-- dave is a stranger to everyone; alice blocks eve.
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'),
  ('00000000-0000-0000-0000-00000000000d'),
  ('00000000-0000-0000-0000-00000000000e');

insert into public.profiles (id, username, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'Alice'),
  ('00000000-0000-0000-0000-00000000000b', 'bob',   'Bob'),
  ('00000000-0000-0000-0000-00000000000c', 'carol', 'Carol'),
  ('00000000-0000-0000-0000-00000000000d', 'dave',  'Dave'),
  ('00000000-0000-0000-0000-00000000000e', 'eve',   'Eve');

insert into public.friendships (user_a, user_b, requested_by, status) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', 'accepted'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000a', 'accepted'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000b', 'accepted');

insert into public.events (id, source, city_id, title, starts_at, location) values
  ('11111111-1111-1111-1111-111111111111', 'curated',
   (select id from public.cities where slug = 'charlotte'), 'Warehouse Party',
   timestamptz '2026-10-28 21:00 America/New_York',
   extensions.st_setsrid(extensions.st_makepoint(-80.85, 35.22), 4326)::extensions.geography);

delete from public.notifications; -- drop the friend-request noise from the seed

create function pg_temp.login(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- 1. "Interested" is private -------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select lives_ok($$ select public.set_rsvp('11111111-1111-1111-1111-111111111111', 'interested') $$,
  'bob can mark interested');

reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is((select count(*) from public.rsvps where user_id = '00000000-0000-0000-0000-00000000000b')::int, 0,
  'a friend cannot see an "interested" RSVP');

-- 2. "Down if friends go" fires once, on the first friend ---------------------
select lives_ok($$ select public.set_rsvp('11111111-1111-1111-1111-111111111111', 'down_if_friends') $$,
  'alice is down if friends go');

reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select is((select count(*) from public.rsvps where user_id = '00000000-0000-0000-0000-00000000000a')::int, 0,
  'a friend cannot see a "down if friends go" RSVP');
select lives_ok($$ select public.set_rsvp('11111111-1111-1111-1111-111111111111', 'going') $$,
  'bob commits');

reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select lives_ok($$ select public.set_rsvp('11111111-1111-1111-1111-111111111111', 'going') $$,
  'carol commits');

reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is((select count(*) from public.notifications where type = 'friend_going')::int, 1,
  'alice gets exactly one friend_going alert');
select is((select actor_id from public.notifications where type = 'friend_going'),
  '00000000-0000-0000-0000-00000000000b'::uuid, 'the alert names the first friend (bob)');

-- 3. "Going" is visible to friends ------------------------------------------
select is((select count(*) from public.rsvps where status = 'going')::int, 2,
  'alice sees both friends going');

-- 4. ...and to fellow attendees, but not to strangers who are not going ------
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select is((select count(*) from public.rsvps)::int, 0,
  'a stranger who is not going sees no RSVPs');
select lives_ok($$ select public.set_rsvp('11111111-1111-1111-1111-111111111111', 'going') $$,
  'dave commits');
select is((select count(*) from public.rsvps where status = 'going')::int, 3,
  'once going, dave sees the other attendees');
select is((select count(*) from public.rsvps where user_id = '00000000-0000-0000-0000-00000000000a')::int, 0,
  'dave still cannot see alice''s "down if" RSVP');

-- 5. Blocks override attendee visibility -------------------------------------
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into public.blocks (blocker_id, blocked_id)
  values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000e');
select lives_ok($$ select public.set_rsvp('11111111-1111-1111-1111-111111111111', 'going') $$,
  'alice commits');

reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select lives_ok($$ select public.set_rsvp('11111111-1111-1111-1111-111111111111', 'going') $$,
  'eve commits');
select is((select count(*) from public.rsvps where user_id = '00000000-0000-0000-0000-00000000000a')::int, 0,
  'eve cannot see alice even though both are going');
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000a')::int, 0,
  'eve cannot see alice''s profile');

reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is((select count(*) from public.rsvps where user_id = '00000000-0000-0000-0000-00000000000e')::int, 0,
  'alice cannot see eve either');

-- 6. Feed exposes counts and friends only -----------------------------------
select is((select going_count from public.get_feed(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', 35.2271, -80.8431)), 5::bigint,
  'feed going_count includes everyone going');
select is((select jsonb_array_length(friends_going) from public.get_feed(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', 35.2271, -80.8431)), 2,
  'feed friends_going lists only friends (bob, carol)');
select is((select count(*) from public.get_feed(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-29', 35.2271, -80.8431))::int, 0,
  'feed respects the selected day in city time');

-- 7. Clients cannot forge or tamper ------------------------------------------
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select throws_ok($$ insert into public.rsvps (user_id, event_id, status)
  values ('00000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', 'going') $$,
  '42501', null, 'cannot RSVP as someone else');
select throws_ok($$ update public.rsvps set friend_alert_sent_at = null $$,
  '42501', null, 'cannot touch friend_alert_sent_at');
select throws_ok($$ insert into public.admins values ('00000000-0000-0000-0000-00000000000d') $$,
  '42501', null, 'cannot make yourself admin');
select throws_ok($$ insert into public.events (source, city_id, title, starts_at, location)
  values ('curated', 1, 'Fake', now(), extensions.st_makepoint(0, 0)::extensions.geography) $$,
  '42501', null, 'non-admins cannot create events');
select throws_ok($$ insert into public.device_tokens (token, user_id)
  values ('ExponentPushToken[abc]', '00000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'cannot register a push token for someone else');
select throws_ok($$ insert into public.device_tokens (token, user_id)
  values ('raw-apns-token', '00000000-0000-0000-0000-00000000000d') $$,
  '23514', null, 'only Expo push tokens are accepted');

-- 8. Friend requests ---------------------------------------------------------
select lives_ok($$ insert into public.friendships (user_a, user_b, requested_by)
  values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000d',
          '00000000-0000-0000-0000-00000000000d') $$, 'dave sends alice a request');
select is((select count(*) from public.friendships
  where user_b = '00000000-0000-0000-0000-00000000000d' and status = 'pending')::int, 1, 'request is pending');
update public.friendships set status = 'accepted' where user_b = '00000000-0000-0000-0000-00000000000d';
select is((select status::text from public.friendships where user_b = '00000000-0000-0000-0000-00000000000d'),
  'pending', 'the requester cannot accept their own request');

reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update public.friendships set status = 'accepted' where user_b = '00000000-0000-0000-0000-00000000000d';
select is((select status::text from public.friendships where user_b = '00000000-0000-0000-0000-00000000000d'),
  'accepted', 'the recipient can accept');

reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select is((select count(*) from public.notifications where type = 'friend_accepted')::int, 1,
  'requester is notified on accept');

-- 9. Anonymous users get nothing ---------------------------------------------
reset role;
set local role anon;
select throws_ok($$ select * from public.get_feed(1::smallint, date '2026-10-28', 35.2, -80.8) $$,
  '42501', null, 'anon cannot call get_feed');

reset role;
select * from finish();
rollback;
