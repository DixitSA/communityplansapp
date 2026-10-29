-- Report snapshots: capture, access rules, rate limit, purge. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

-- a, b, f Going; c stranger. a blocks f. Bob authors message 1 (seeded below).
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'), ('00000000-0000-0000-0000-00000000000f');
insert into public.profiles (id, username, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'Alice'),
  ('00000000-0000-0000-0000-00000000000b', 'bob',   'Bob'),
  ('00000000-0000-0000-0000-00000000000c', 'carol', 'Carol'),
  ('00000000-0000-0000-0000-00000000000f', 'finn',  'Finn');
delete from public.notifications;

insert into public.events (id, source, city_id, title, starts_at, ends_at, location)
values ('11111111-1111-1111-1111-111111111111', 'curated',
        (select id from public.cities where slug = 'charlotte'), 'Open Night',
        now() - interval '2 hours', now() + interval '2 hours',
        extensions.st_setsrid(extensions.st_makepoint(-80.85, 35.22), 4326)::extensions.geography);
insert into public.rsvps (user_id, event_id, status) values
  ('00000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'going'),
  ('00000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', 'going'),
  ('00000000-0000-0000-0000-00000000000f', '11111111-1111-1111-1111-111111111111', 'going');
insert into public.blocks (blocker_id, blocked_id)
values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000f');

insert into public.event_messages (id, event_id, user_id, body) overriding system value values
  (9001, '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000b', 'bad words'),
  (9002, '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000f', 'finn msg'),
  (9003, '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000f', 'finn msg 2');

create function pg_temp.login(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- 1. Snapshot capture ---------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.report_message(9001, 'abuse') $$, 'a Going member can report a message');
reset role;
select is((select snapshot_body from public.reports where target_id = '9001'), 'bad words', 'body snapshotted');
select is((select snapshot_author_id from public.reports where target_id = '9001'),
  '00000000-0000-0000-0000-00000000000b'::uuid, 'author snapshotted');
select is((select snapshot_event_id from public.reports where target_id = '9001'),
  '11111111-1111-1111-1111-111111111111'::uuid, 'event snapshotted');

-- Author soft-deletes; the snapshot survives.
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
update public.event_messages set deleted_at = now() where id = 9001;
reset role;
select is((select body from public.event_messages where id = 9001), null, 'message body erased at source');
select is((select snapshot_body from public.reports where target_id = '9001'), 'bad words',
  'snapshot survives the soft delete');

-- 2. Who cannot report -------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select throws_ok($$ select public.report_message(9002, 'x') $$, '42501', 'not_allowed', 'non-member cannot report');
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select throws_ok($$ select public.report_message(9002, 'x') $$, '42501', 'not_allowed', 'blocker cannot report blocked user');
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select throws_ok($$ select public.report_message(9002, 'x') $$, '42501', 'not_allowed', 'author cannot report own message');
select throws_ok($$ select public.report_message(1234567, 'x') $$, '42501', 'not_allowed', 'unknown message');

-- 3. Direct snapshot writes and reads are denied --------------------------------
select throws_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason, snapshot_body)
  values ('00000000-0000-0000-0000-00000000000f', 'message', '1', 'x', 'forged') $$,
  '42501', null, 'cannot write snapshot_body directly');
select lives_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason)
  values ('00000000-0000-0000-0000-00000000000f', 'user', 'abc', 'x') $$, 'plain report insert still works');
select throws_ok($$ select * from public.reports $$, '42501', null, 'clients cannot read reports');
select throws_ok($$ select public.purge_old_reports() $$, '42501', null, 'clients cannot purge');
reset role;

-- 4. Direct message reports are blocked; cap is 20 per day on every path -------------
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select throws_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason)
  values ('00000000-0000-0000-0000-00000000000b', 'message', '9002', 'x') $$,
  '42501', null, 'direct message-type report is denied');
select throws_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason)
  values ('00000000-0000-0000-0000-00000000000b', 'user', 'x', 'x'), ('00000000-0000-0000-0000-00000000000b', 'user', 'x', 'y') $$,
  '23505', null, 'the same target is reported once');
select lives_ok($$ select public.report_message(9002, 'once') $$, 'report via the RPC');
select lives_ok($$ select public.report_message(9002, 'again') $$, 'duplicate message report is a no-op');
select lives_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason)
  select '00000000-0000-0000-0000-00000000000b', 'user', 'u' || g, 'x' from generate_series(1, 19) g $$,
  'direct reports up to 20 in total are allowed');
select throws_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason)
  values ('00000000-0000-0000-0000-00000000000b', 'event', 'e', 'x') $$,
  'P0001', 'rate_limited', '21st direct report is rate limited');
select throws_ok($$ select public.report_message(9003, 'too many') $$, 'P0001', 'rate_limited', 'the RPC is capped too');
reset role;

-- 5. Purge ---------------------------------------------------------------------
insert into public.reports (reporter_id, target_type, target_id, reason, created_at) values
  ('00000000-0000-0000-0000-00000000000c', 'user', 'old', 'x', now() - interval '91 days'),
  ('00000000-0000-0000-0000-00000000000c', 'user', 'new', 'x', now() - interval '89 days');
set local role service_role;
select is(public.purge_old_reports(), 1, 'purge deletes exactly the old row');
reset role;
select is((select count(*) from public.reports where target_id = 'new')::int, 1, 'recent row kept');
select is((select count(*) from public.reports where target_id = 'old')::int, 0, 'old row gone');

select * from finish();
rollback;
