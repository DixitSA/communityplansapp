-- Friends RPCs: search, requests, lists, profile. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

insert into auth.users (id) select id from (values
  ('00000000-0000-0000-0000-000000000001'::uuid),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003'),('00000000-0000-0000-0000-000000000004'),('00000000-0000-0000-0000-000000000005'),('00000000-0000-0000-0000-000000000006'),('00000000-0000-0000-0000-000000000007'),('00000000-0000-0000-0000-000000000008'),('00000000-0000-0000-0000-000000000009'),('00000000-0000-0000-0000-000000000010'),('00000000-0000-0000-0000-000000000011'),('00000000-0000-0000-0000-000000000012')) v(id);
insert into auth.users (id)
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid from generate_series(100, 130) n;
insert into public.profiles (id, username, display_name, bio) values
  ('00000000-0000-0000-0000-000000000001', 'alice', 'Alice Smith', 'hi there'),
  ('00000000-0000-0000-0000-000000000002',   'bob',   'Bob Jones', null),
  ('00000000-0000-0000-0000-000000000003', 'carol', 'Carol Percent', null),
  ('00000000-0000-0000-0000-000000000004',  'dave',  'Dave', null),
  ('00000000-0000-0000-0000-000000000005',   'eve',   'Eve', null),
  ('00000000-0000-0000-0000-000000000006', 'davey', 'Davey', null),
  ('00000000-0000-0000-0000-000000000007',   'fay',   'Fay', null),
  ('00000000-0000-0000-0000-000000000008',   'gus',   'Gus', null),
  ('00000000-0000-0000-0000-000000000009',   'hal',   'Hal', null),
  ('00000000-0000-0000-0000-000000000010',   'ivy',   'Ivy', null),
  ('00000000-0000-0000-0000-000000000011', 'bobby', 'Bobby', null),
  ('00000000-0000-0000-0000-000000000012',   'zed',   'Zed', null);
insert into public.profiles (id, username, display_name)
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'rl' || n, 'RL ' || n from generate_series(100, 130) n;

-- alice-bob, bob-carol, alice-davey are friends. alice blocks eve and ivy.
insert into public.friendships (user_a, user_b, requested_by, status) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'accepted'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'accepted'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'accepted');
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005'), ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010');

-- Past event both alice and bob went to; one where bob was only interested; one in the future.
insert into public.events (id, source, city_id, title, starts_at, location) values
  ('11111111-1111-1111-1111-111111111111', 'curated', (select id from public.cities where slug = 'charlotte'),
   'Past Both', now() - interval '3 days', extensions.st_setsrid(extensions.st_makepoint(-80.85, 35.22), 4326)::extensions.geography),
  ('22222222-2222-2222-2222-222222222222', 'curated', (select id from public.cities where slug = 'charlotte'),
   'Past Interested', now() - interval '2 days', extensions.st_setsrid(extensions.st_makepoint(-80.85, 35.22), 4326)::extensions.geography),
  ('33333333-3333-3333-3333-333333333333', 'curated', (select id from public.cities where slug = 'charlotte'),
   'Future Both', now() + interval '2 days', extensions.st_setsrid(extensions.st_makepoint(-80.85, 35.22), 4326)::extensions.geography);
insert into public.rsvps (user_id, event_id, status) values
  ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'going'),
  ('00000000-0000-0000-0000-000000000002',   '11111111-1111-1111-1111-111111111111', 'going'),
  ('00000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'going'),
  ('00000000-0000-0000-0000-000000000002',   '22222222-2222-2222-2222-222222222222', 'interested'),
  ('00000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'going'),
  ('00000000-0000-0000-0000-000000000002',   '33333333-3333-3333-3333-333333333333', 'going');
delete from public.notifications;

create function pg_temp.login(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- 1. search_profiles -----------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-000000000001');
select is((select array_agg(username) from public.search_profiles('bo')), array['bob', 'bobby'],
  'prefix search: exact-ish order, bob (friend) before bobby');
select is((select friendship from public.search_profiles('bo') where username = 'bob'), 'friends', 'friendship state: friends');
select is((select friendship from public.search_profiles('bo') where username = 'bobby'), 'none', 'friendship state: none');
select is((select array_agg(username) from public.search_profiles('@BOB')), array['bob', 'bobby'],
  'leading @ stripped, case-insensitive, exact match first');
select is((select array_agg(username) from public.search_profiles('  bob  ')), array['bob', 'bobby'], 'query is trimmed');
select is((select array_agg(username) from public.search_profiles('dav')), array['davey', 'dave'],
  'friends sort before non-friends');
select is((select array_agg(username) from public.search_profiles('arol pe')), array['carol'], 'display_name contains match');
select is((select count(*) from public.search_profiles('a'))::int, 0, 'query shorter than 2 returns nothing');
select is((select count(*) from public.search_profiles('@a'))::int, 0, '@ then 1 char returns nothing');
select is((select count(*) from public.search_profiles(null))::int, 0, 'null query returns nothing');
select throws_ok($$ select * from public.search_profiles(repeat('a', 31)) $$, 'P0001', 'query_invalid', 'over 30 chars is invalid');
select is((select count(*) from public.search_profiles('%%'))::int, 0, '% is escaped, does not match everyone');
select is((select count(*) from public.search_profiles('b_'))::int, 0, '_ is escaped, not a single-char wildcard');
select is((select count(*) from public.search_profiles('\\'))::int, 0, 'backslash handled literally');
select is((select count(*) from public.search_profiles('alice'))::int, 0, 'self is excluded');
select is((select count(*) from public.search_profiles('eve'))::int, 0, 'blocked user is hidden from search');
select is((select count(*) from public.search_profiles('rl1', 100))::int, 20, 'limit clamped to 20');
select is((select count(*) from public.search_profiles('rl1', 0))::int, 1, 'limit clamped up to 1');
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000005');
select is((select count(*) from public.search_profiles('alice'))::int, 0, 'blocker is hidden from the blocked user too');

-- 2. send_friend_request -----------------------------------------------------------
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.send_friend_request('00000000-0000-0000-0000-000000000001') $$, 'P0001', 'cannot_friend_self', 'cannot friend self');
select throws_ok($$ select public.send_friend_request('00000000-0000-0000-0000-000000000999') $$, 'P0001', 'user_not_found', 'unknown user');
select throws_ok($$ select public.send_friend_request('00000000-0000-0000-0000-000000000005') $$, 'P0001', 'user_not_found', 'blocked user looks like not found');
select throws_ok($$ select public.send_friend_request('00000000-0000-0000-0000-000000000002') $$, 'P0001', 'already_friends', 'already friends');
select is((select public.send_friend_request('00000000-0000-0000-0000-000000000004')), 'outgoing', 'new request is outgoing');
select throws_ok($$ select public.send_friend_request('00000000-0000-0000-0000-000000000004') $$, 'P0001', 'request_pending', 'duplicate request');
select is((select requested_by from public.friendships where user_b = '00000000-0000-0000-0000-000000000004'), '00000000-0000-0000-0000-000000000001'::uuid, 'requester recorded (user_a < user_b ordering respected)');
reset role;
select is((select count(*) from public.notifications where type = 'friend_request' and user_id = '00000000-0000-0000-0000-000000000004' and actor_id = '00000000-0000-0000-0000-000000000001')::int, 1,
  'friends_notify trigger: friend_request notification via the RPC');
select pg_temp.login('00000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.send_friend_request('00000000-0000-0000-0000-000000000001') $$, 'P0001', 'user_not_found', 'blocked sender gets user_not_found');

-- 3. respond_friend_request ------------------------------------------------------------
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000003');
select throws_ok($$ select public.respond_friend_request('00000000-0000-0000-0000-000000000001', true) $$, 'P0001', 'request_not_found',
  'a third user cannot respond to someone else''s request');
select throws_ok($$ select public.respond_friend_request('00000000-0000-0000-0000-000000000004', true) $$, 'P0001', 'request_not_found',
  'no request between carol and dave');
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.respond_friend_request('00000000-0000-0000-0000-000000000004', true) $$, 'P0001', 'request_not_found',
  'the requester cannot accept their own request');
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000004');
select is((select public.respond_friend_request('00000000-0000-0000-0000-000000000001', true)), 'friends', 'recipient accepts');
select is((select status::text from public.friendships where user_a = '00000000-0000-0000-0000-000000000001' and user_b = '00000000-0000-0000-0000-000000000004'), 'accepted', 'row is accepted');
select isnt((select accepted_at from public.friendships where user_a = '00000000-0000-0000-0000-000000000001' and user_b = '00000000-0000-0000-0000-000000000004'), null, 'accepted_at stamped');
reset role;
select is((select count(*) from public.notifications where type = 'friend_accepted' and user_id = '00000000-0000-0000-0000-000000000001' and actor_id = '00000000-0000-0000-0000-000000000004')::int, 1,
  'friend_accepted notification via the RPC');
select pg_temp.login('00000000-0000-0000-0000-000000000003');
select is((select public.send_friend_request('00000000-0000-0000-0000-000000000004')), 'outgoing', 'carol requests dave');
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000004');
select is((select public.respond_friend_request('00000000-0000-0000-0000-000000000003', false)), 'none', 'decline returns none');
select is((select count(*) from public.friendships where user_a = '00000000-0000-0000-0000-000000000003' and user_b = '00000000-0000-0000-0000-000000000004')::int, 0, 'declined request row deleted');
select throws_ok($$ select public.respond_friend_request('00000000-0000-0000-0000-000000000003', true) $$, 'P0001', 'request_not_found',
  'responding to a missing request');

-- crossing requests auto-accept
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000007');
select is((select public.send_friend_request('00000000-0000-0000-0000-000000000008')), 'outgoing', 'fay requests gus');
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000008');
select is((select public.send_friend_request('00000000-0000-0000-0000-000000000007')), 'friends', 'incoming request is accepted instead');
select is((select status::text from public.friendships where user_a = '00000000-0000-0000-0000-000000000007' and user_b = '00000000-0000-0000-0000-000000000008'), 'accepted', 'crossing request ends accepted');
reset role;
select is((select count(*) from public.notifications where type = 'friend_accepted' and user_id = '00000000-0000-0000-0000-000000000007')::int, 1, 'requester notified on auto-accept');

-- 4. remove_friend -----------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.remove_friend('00000000-0000-0000-0000-000000000004') $$, 'unfriend');
select is((select count(*) from public.friendships where user_a = '00000000-0000-0000-0000-000000000001' and user_b = '00000000-0000-0000-0000-000000000004')::int, 0, 'friendship removed');
select is((select public.send_friend_request('00000000-0000-0000-0000-000000000007')), 'outgoing', 'alice requests fay');
select lives_ok($$ select public.remove_friend('00000000-0000-0000-0000-000000000007') $$, 'cancel an outgoing request');
select is((select count(*) from public.friendships where user_a = '00000000-0000-0000-0000-000000000001' and user_b = '00000000-0000-0000-0000-000000000007')::int, 0, 'request removed');
select lives_ok($$ select public.remove_friend('00000000-0000-0000-0000-000000000007') $$, 'no-op when nothing exists');
select lives_ok($$ select public.remove_friend(null) $$, 'null user is a no-op');
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000003');
select lives_ok($$ select public.remove_friend('00000000-0000-0000-0000-000000000001') $$, 'unrelated remove is a no-op');
reset role;
select is((select count(*) from public.friendships where user_a = '00000000-0000-0000-0000-000000000001' and user_b = '00000000-0000-0000-0000-000000000002')::int, 1, 'third party cannot remove others'' friendships');

-- 5. lists (with blocked rows planted by service role) ------------------------------------
reset role;
insert into public.friendships (user_a, user_b, requested_by, status) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'accepted'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000010', 'pending');
select pg_temp.login('00000000-0000-0000-0000-000000000001');
select is((select array_agg(username) from public.list_friends()), array['bob', 'davey'],
  'list_friends: accepted friends by display_name, blocked friend hidden');
select isnt((select since from public.list_friends() where username = 'bob'), null, 'since is set');
select is((select count(*) from public.list_friend_requests())::int, 0, 'no pending requests; blocked pending hidden');
select public.send_friend_request('00000000-0000-0000-0000-000000000009');
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000008');
select public.send_friend_request('00000000-0000-0000-0000-000000000001');
reset role;
update public.friendships set created_at = now() - interval '1 hour' where user_a = '00000000-0000-0000-0000-000000000001' and user_b = '00000000-0000-0000-0000-000000000009';
select pg_temp.login('00000000-0000-0000-0000-000000000001');
select is((select array_agg(username || ':' || direction) from public.list_friend_requests()), array['gus:incoming', 'hal:outgoing'],
  'list_friend_requests: directions, newest first');
select is((select count(*) from public.list_friend_requests() where username = 'ivy')::int, 0, 'blocked request hidden');
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000009');
select is((select array_agg(username || ':' || direction) from public.list_friend_requests()), array['alice:incoming'], 'recipient view');

-- 6. get_profile -----------------------------------------------------------------------------
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000001');
select is((select friendship from public.get_profile('00000000-0000-0000-0000-000000000002')), 'friends', 'profile: friends');
select is((select friend_count from public.get_profile('00000000-0000-0000-0000-000000000002')), 2, 'bob has 2 friends (alice, carol)');
select is((select mutual_friend_count from public.get_profile('00000000-0000-0000-0000-000000000003')), 1, 'alice and carol share bob');
select is((select friendship from public.get_profile('00000000-0000-0000-0000-000000000003')), 'none', 'profile: none');
select is((select friendship from public.get_profile('00000000-0000-0000-0000-000000000009')), 'outgoing', 'profile: outgoing');
select is((select friendship from public.get_profile('00000000-0000-0000-0000-000000000008')), 'incoming', 'profile: incoming');
select is((select friendship from public.get_profile('00000000-0000-0000-0000-000000000001')), 'self', 'profile: self');
select is((select bio from public.get_profile('00000000-0000-0000-0000-000000000001')), 'hi there', 'bio returned');
select is((select shared_events from public.get_profile('00000000-0000-0000-0000-000000000002')),
  (select jsonb_build_array(jsonb_build_object('id', e.id, 'title', e.title, 'starts_at', e.starts_at))
     from public.events e where e.id = '11111111-1111-1111-1111-111111111111'),
  'shared_events: only past events both were Going to (not interested, not future)');
select is((select shared_events from public.get_profile('00000000-0000-0000-0000-000000000003')), '[]'::jsonb, 'no shared events with carol');
select is((select count(*) from public.get_profile('00000000-0000-0000-0000-000000000005'))::int, 0, 'blocked user: no profile');
select is((select count(*) from public.get_profile('00000000-0000-0000-0000-000000000999'))::int, 0, 'unknown user: no profile');
select is((select count(*) from public.get_profile(null))::int, 0, 'null: no profile');
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000005');
select is((select count(*) from public.get_profile('00000000-0000-0000-0000-000000000001'))::int, 0, 'blocked user cannot see blocker''s profile');
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000002');
select is((select count(*) from public.get_profile('00000000-0000-0000-0000-000000000001'))::int, 1, 'bob sees alice');
select is((select friend_count from public.get_profile('00000000-0000-0000-0000-000000000001')), 3, 'alice friend_count counts accepted friends only (bob, davey, eve), not pending');

-- 7. Rate limit -----------------------------------------------------------------------------------
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000012');
do $$ begin
  for n in 100..129 loop
    perform public.send_friend_request(('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid);
  end loop;
end $$;
select is((select count(*) from public.friendships where requested_by = '00000000-0000-0000-0000-000000000012')::int, 30, '30 requests allowed');
select throws_ok($$ select public.send_friend_request('00000000-0000-0000-0000-000000000130') $$, 'P0001', 'rate_limited', '31st request in 24h is rate limited');
reset role;
update public.notifications set created_at = now() - interval '25 hours' where actor_id = '00000000-0000-0000-0000-000000000012' and user_id = '00000000-0000-0000-0000-000000000100';
select pg_temp.login('00000000-0000-0000-0000-000000000012');
select is((select public.send_friend_request('00000000-0000-0000-0000-000000000130')), 'outgoing', 'window is rolling');

-- repeated send/cancel to the same person: 3 per 7 days
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000009');
do $$ begin
  for i in 1..3 loop
    perform public.send_friend_request('00000000-0000-0000-0000-000000000011');
    perform public.remove_friend('00000000-0000-0000-0000-000000000011');
  end loop;
end $$;
select throws_ok($$ select public.send_friend_request('00000000-0000-0000-0000-000000000011') $$, 'P0001', 'rate_limited',
  '4th send to the same user in 7 days is rate limited even after cancels');
-- direct table insert past the cap is also limited (zed already sent 31 requests today)
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000012');
select throws_ok($$ insert into public.friendships (user_a, user_b, requested_by, status)
  values ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000131', '00000000-0000-0000-0000-000000000012', 'pending') $$, 'P0001', 'rate_limited',
  'direct insert past the daily cap is rate limited');

-- 8. Not authenticated / anon ---------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', true);
set local role authenticated;
select throws_ok($$ select public.send_friend_request('00000000-0000-0000-0000-000000000001') $$, 'P0001', 'not_authenticated', 'no uid: send');
select throws_ok($$ select * from public.list_friends() $$, 'P0001', 'not_authenticated', 'no uid: list_friends');
reset role;
set local role anon;
select throws_ok($$ select * from public.search_profiles('alice') $$, '42501', null, 'anon: search_profiles');
select throws_ok($$ select public.send_friend_request('00000000-0000-0000-0000-000000000001') $$, '42501', null, 'anon: send_friend_request');
select throws_ok($$ select public.respond_friend_request('00000000-0000-0000-0000-000000000001', true) $$, '42501', null, 'anon: respond_friend_request');
select throws_ok($$ select public.remove_friend('00000000-0000-0000-0000-000000000001') $$, '42501', null, 'anon: remove_friend');
select throws_ok($$ select * from public.list_friends() $$, '42501', null, 'anon: list_friends');
select throws_ok($$ select * from public.list_friend_requests() $$, '42501', null, 'anon: list_friend_requests');
select throws_ok($$ select * from public.get_profile('00000000-0000-0000-0000-000000000001') $$, '42501', null, 'anon: get_profile');

reset role;
select * from finish();
rollback;
