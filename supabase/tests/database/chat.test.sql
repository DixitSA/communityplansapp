-- Event chat: membership = Going, blocks, soft delete, windows, unread. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

-- Cast: a, b, f are Going; c Interested; d Down-if; e stranger. a blocks f.
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'), ('00000000-0000-0000-0000-00000000000d'),
  ('00000000-0000-0000-0000-00000000000e'), ('00000000-0000-0000-0000-00000000000f');
insert into public.profiles (id, username, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'Alice'),
  ('00000000-0000-0000-0000-00000000000b', 'bob',   'Bob'),
  ('00000000-0000-0000-0000-00000000000c', 'carol', 'Carol'),
  ('00000000-0000-0000-0000-00000000000d', 'dave',  'Dave'),
  ('00000000-0000-0000-0000-00000000000e', 'eve',   'Eve'),
  ('00000000-0000-0000-0000-00000000000f', 'finn',  'Finn');
delete from public.notifications;

-- Event 1 is open (ended 47 h ago); event 2 is closed (ended 49 h ago).
insert into public.events (id, source, city_id, title, starts_at, ends_at, location)
select v.id, 'curated', (select id from public.cities where slug = 'charlotte'), v.title,
       now() - interval '50 hours', now() - v.ago,
       extensions.st_setsrid(extensions.st_makepoint(-80.85, 35.22), 4326)::extensions.geography
from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'Open Night', interval '47 hours'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Old Night',  interval '49 hours')) v(id, title, ago);

insert into public.rsvps (user_id, event_id, status)
select u, e, s::public.rsvp_status from (values
  ('00000000-0000-0000-0000-00000000000a'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'going'),
  ('00000000-0000-0000-0000-00000000000b'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'going'),
  ('00000000-0000-0000-0000-00000000000f'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'going'),
  ('00000000-0000-0000-0000-00000000000c'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'interested'),
  ('00000000-0000-0000-0000-00000000000d'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'down_if_friends'),
  ('00000000-0000-0000-0000-00000000000a'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'going'),
  ('00000000-0000-0000-0000-00000000000b'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'going')
) t(u, e, s);

insert into public.blocks (blocker_id, blocked_id)
values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000f');

-- Fixed-time seed messages (as superuser).
insert into public.event_messages (event_id, user_id, body, created_at) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000b', 'bob one',   timestamptz '2026-01-01 10:00Z'),
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a', 'alice one', timestamptz '2026-01-01 11:00Z'),
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000f', 'finn one',  timestamptz '2026-01-01 12:00Z');

create function pg_temp.login(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- 1. Membership --------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select is((select count(*) from public.event_messages where event_id = '11111111-1111-1111-1111-111111111111')::int, 3,
  'a Going user (not blocking anyone) reads all messages');
select lives_ok($$ insert into public.event_messages (event_id, user_id, body)
  values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000b', 'hello') $$,
  'a Going user can post');
select throws_ok($$ insert into public.event_messages (event_id, user_id, body)
  values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a', 'spoof') $$,
  '42501', null, 'cannot post as someone else');
select throws_ok($$ insert into public.event_messages (event_id, user_id, body, created_at)
  values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000b', 'x', now()) $$,
  '42501', null, 'cannot set created_at');

reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select is((select count(*) from public.event_messages)::int, 0, 'Interested user reads nothing');
select throws_ok($$ insert into public.event_messages (event_id, user_id, body)
  values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000c', 'hi') $$,
  '42501', null, 'Interested user cannot post');
select is((select count(*) from public.get_chat_messages('11111111-1111-1111-1111-111111111111'))::int, 0,
  'Interested user gets nothing from get_chat_messages');

reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select is((select count(*) from public.event_messages)::int, 0, 'Down-if user reads nothing');
select throws_ok($$ insert into public.event_messages (event_id, user_id, body)
  values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000d', 'hi') $$,
  '42501', null, 'Down-if user cannot post');

reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select is((select count(*) from public.event_messages)::int, 0, 'stranger reads nothing');
select throws_ok($$ insert into public.event_messages (event_id, user_id, body)
  values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000e', 'hi') $$,
  '42501', null, 'stranger cannot post');
select is((select count(*) from public.get_my_chats())::int, 0, 'stranger has no chats');

-- 2. Leaving Going ------------------------------------------------------------
reset role;
update public.rsvps set status = 'interested'
 where user_id = '00000000-0000-0000-0000-00000000000b' and event_id = '11111111-1111-1111-1111-111111111111';
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select is((select count(*) from public.event_messages)::int, 0, 'after leaving Going: cannot read');
select throws_ok($$ insert into public.event_messages (event_id, user_id, body)
  values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000b', 'back?') $$,
  '42501', null, 'after leaving Going: cannot post');
reset role;
update public.rsvps set status = 'going'
 where user_id = '00000000-0000-0000-0000-00000000000b' and event_id = '11111111-1111-1111-1111-111111111111';

-- 3. Blocks (alice blocked finn) ---------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is((select count(*) from public.event_messages where user_id = '00000000-0000-0000-0000-00000000000f')::int, 0,
  'blocker cannot see the blocked author''s messages');
select is((select count(*) from public.get_chat_messages('11111111-1111-1111-1111-111111111111')
          where user_id = '00000000-0000-0000-0000-00000000000f')::int, 0,
  'get_chat_messages hides the blocked author');
select is((select last_body from public.get_my_chats() where event_id = '11111111-1111-1111-1111-111111111111'),
  'hello', 'get_my_chats last message skips the blocked author');

reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select is((select count(*) from public.event_messages where user_id = '00000000-0000-0000-0000-00000000000a')::int, 0,
  'blocked user cannot see the blocker''s messages');
select is((select count(*) from public.event_messages where user_id = '00000000-0000-0000-0000-00000000000b')::int, 2,
  'blocked user still sees other members');

-- 4. Soft delete ---------------------------------------------------------------
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select throws_ok($$ delete from public.event_messages $$, '42501', null, 'no client deletes');
update public.event_messages set deleted_at = now() where body = 'bob one';
reset role;
select is((select deleted_at from public.event_messages where body = 'bob one'), null,
  'others cannot soft-delete someone else''s message');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select throws_ok($$ update public.event_messages set body = 'edited' where body = 'alice one' $$,
  '42501', null, 'cannot edit body');
select lives_ok($$ update public.event_messages set deleted_at = now() where body = 'alice one' $$,
  'author can soft-delete');
select is((select deleted_at from public.event_messages where user_id = '00000000-0000-0000-0000-00000000000a' and deleted_at is not null), now(),
  'deleted_at is stamped server-side');
select throws_ok($$ update public.event_messages set deleted_at = null where user_id = '00000000-0000-0000-0000-00000000000a' and deleted_at is not null $$,
  '42501', null, 'cannot un-delete');
select is((select body from public.event_messages where user_id = '00000000-0000-0000-0000-00000000000a'
           and deleted_at is not null), null, 'direct select shows null body after delete');
select is((select body from public.get_chat_messages('11111111-1111-1111-1111-111111111111')
           where user_id = '00000000-0000-0000-0000-00000000000a'), null,
  'deleted message body is null in get_chat_messages');
select is((select count(*) from public.get_chat_messages('11111111-1111-1111-1111-111111111111'))::int, 3,
  'deleted message row is still listed (tombstone)');
select is((select last_body from public.get_my_chats() where event_id = '11111111-1111-1111-1111-111111111111'),
  'hello', 'get_my_chats ignores deleted messages');

-- 5. Closed window -----------------------------------------------------------
reset role;
select is(private.chat_open('11111111-1111-1111-1111-111111111111'), true, 'chat_open true 47 h after end');
select is(private.chat_open('22222222-2222-2222-2222-222222222222'), false, 'chat_open false 49 h after end');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select throws_ok($$ insert into public.event_messages (event_id, user_id, body)
  values ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-00000000000a', 'late') $$,
  '42501', null, 'cannot post after the window');
select is((select is_open from public.get_my_chats() where event_id = '22222222-2222-2222-2222-222222222222'), false,
  'get_my_chats flags the closed chat');
select is((select event_id from public.get_my_chats() limit 1), '11111111-1111-1111-1111-111111111111'::uuid,
  'open chats sort first');

-- 6. Unread + mark_chat_read -------------------------------------------------
-- alice sees (non-deleted, not mine, not finn's): bob one, hello => 2
select is((select unread_count from public.get_my_chats() where event_id = '11111111-1111-1111-1111-111111111111'), 2,
  'unread counts others'' messages, excluding mine, deleted and blocked');
select lives_ok($$ select public.mark_chat_read('11111111-1111-1111-1111-111111111111') $$, 'mark_chat_read works');
select is((select unread_count from public.get_my_chats() where event_id = '11111111-1111-1111-1111-111111111111'), 0,
  'unread is 0 after mark_chat_read');
select is((select going_count from public.get_my_chats() where event_id = '11111111-1111-1111-1111-111111111111'), 2,
  'going_count excludes the blocked member');
reset role;
-- now() is frozen inside the transaction, so move the marker into the past first.
update public.event_chat_reads set last_read_at = now() - interval '1 hour';
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select lives_ok($$ insert into public.event_messages (event_id, user_id, body)
  values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000b', 'new one') $$,
  'bob posts again');
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is((select unread_count from public.get_my_chats() where event_id = '11111111-1111-1111-1111-111111111111'), 2,
  'messages after the read marker (hello, new one) count as unread');
select is((select count(*) from public.event_chat_reads)::int, 1, 'reads table shows only my row');
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select is((select count(*) from public.event_chat_reads)::int, 0, 'other users cannot see my read markers');

-- 7. Limits --------------------------------------------------------------------
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select throws_ok($$ insert into public.event_messages (event_id, user_id, body)
  values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000b', '   ') $$,
  '23514', null, 'blank body rejected');
select throws_ok($$ insert into public.event_messages (event_id, user_id, body)
  values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000b', repeat('x', 2001)) $$,
  '23514', null, 'body over 2000 rejected');
select lives_ok($$ insert into public.event_messages (event_id, user_id, body)
  values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000b', repeat('x', 2000)) $$,
  'body of 2000 accepted');
select is((select count(*) from public.get_chat_messages('11111111-1111-1111-1111-111111111111', null, 2))::int, 2,
  'limit is honoured');
select is((select count(*) from public.get_chat_messages('11111111-1111-1111-1111-111111111111', null, 0))::int, 1,
  'limit is clamped up to 1');
select is((select count(*) from public.get_chat_messages('11111111-1111-1111-1111-111111111111',
    (select id from public.event_messages where user_id = '00000000-0000-0000-0000-00000000000f')))::int, 2,
  'p_before_id pages backwards (bob one + alice tombstone, before finn''s message)');
select is((select body from public.get_chat_messages('11111111-1111-1111-1111-111111111111', null, 1)), repeat('x', 2000),
  'newest first');

select throws_ok($$ insert into public.event_messages (event_id, user_id, body)
  values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000b', E'\n\n') $$,
  '23514', null, 'newline-only body rejected');
select throws_ok($$ insert into public.event_messages (event_id, user_id, body)
  values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000b', 'x' || repeat(' ', 10000000)) $$,
  '23514', null, 'padded oversized body rejected (no btrim bypass)');

-- 7b. Flood throttle (finn: 30 per minute per event)
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select throws_ok($$ insert into public.event_messages (event_id, user_id, body)
  select '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000f', 'spam ' || g
  from generate_series(1, 40) g $$, 'P0001', 'rate_limited', 'more than 30 messages a minute is rate limited');
select lives_ok($$ insert into public.event_messages (event_id, user_id, body)
  select '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000f', 'ok ' || g
  from generate_series(1, 30) g $$, '30 messages in a minute are fine');
select throws_ok($$ insert into public.event_messages (event_id, user_id, body)
  values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000f', 'one too many') $$,
  'P0001', 'rate_limited', 'the 31st message in a minute is blocked');

-- 7c. Helpers are not callable from the API roles
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.is_going('00000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111') $$, '42501', null, 'authenticated cannot call public.is_going');
select throws_ok($$ select public.are_friends('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b') $$, '42501', null, 'authenticated cannot call public.are_friends');
select throws_ok($$ select public.is_blocked_between('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b') $$, '42501', null, 'authenticated cannot call public.is_blocked_between');
select throws_ok($$ select public.is_admin() $$, '42501', null, 'authenticated cannot call public.is_admin');
select throws_ok($$ select public.chat_open('11111111-1111-1111-1111-111111111111') $$, '42501', null, 'authenticated cannot call public.chat_open');
reset role;
set local role anon;
select throws_ok($$ select public.is_going('00000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111') $$, '42501', null, 'anon cannot call public.is_going');
select throws_ok($$ select public.are_friends('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b') $$, '42501', null, 'anon cannot call public.are_friends');
select throws_ok($$ select public.is_blocked_between('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b') $$, '42501', null, 'anon cannot call public.is_blocked_between');
select throws_ok($$ select public.is_admin() $$, '42501', null, 'anon cannot call public.is_admin');
select throws_ok($$ select private.is_going('00000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111') $$, '42501', null, 'anon cannot call private.is_going');

reset role;
-- 8. Anon denied ---------------------------------------------------------------
reset role;
set local role anon;
select throws_ok($$ select * from public.event_messages $$, '42501', null, 'anon cannot read messages');
select throws_ok($$ insert into public.event_messages (event_id, user_id, body)
  values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000b', 'x') $$,
  '42501', null, 'anon cannot post');
select throws_ok($$ select * from public.event_chat_reads $$, '42501', null, 'anon cannot read markers');
select throws_ok($$ select * from public.get_chat_messages('11111111-1111-1111-1111-111111111111') $$,
  '42501', null, 'anon cannot call get_chat_messages');
select throws_ok($$ select * from public.get_my_chats() $$, '42501', null, 'anon cannot call get_my_chats');
select throws_ok($$ select public.mark_chat_read('11111111-1111-1111-1111-111111111111') $$,
  '42501', null, 'anon cannot call mark_chat_read');
select throws_ok($$ select private.chat_open('11111111-1111-1111-1111-111111111111') $$,
  '42501', null, 'anon cannot call chat_open');

select * from finish();
rollback;
