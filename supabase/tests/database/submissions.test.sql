-- "Suggest an event": submit_event RPC + event_submissions RLS. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'),
  ('00000000-0000-0000-0000-00000000000d');
insert into public.profiles (id, username, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'Alice'),
  ('00000000-0000-0000-0000-00000000000b', 'bob',   'Bob'),
  ('00000000-0000-0000-0000-00000000000c', 'carol', 'Carol');
-- dave has an auth account but never finished onboarding (no profile). carol is an admin.
insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000c');

create function pg_temp.login(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- 1. Happy path ---------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select isnt(public.submit_event(1::smallint, '  Night Market  ', ' https://instagram.com/p/abc ',
  now() + interval '3 days', '  ', ' '), null, 'submit returns an id');
select is((select title from public.event_submissions), 'Night Market', 'title trimmed');
select is((select link from public.event_submissions), 'https://instagram.com/p/abc', 'link trimmed');
select is((select venue from public.event_submissions), null, 'blank venue becomes null');
select is((select details from public.event_submissions), null, 'blank details becomes null');
select is((select status::text from public.event_submissions), 'pending', 'starts pending');
select is((select submitted_by from public.event_submissions), '00000000-0000-0000-0000-00000000000a'::uuid, 'submitter is the caller');
select lives_ok($$ select public.submit_event(1::smallint, 'No link', null, now() + interval '1 day', 'The Venue', 'Some details') $$,
  'link, venue and details are optional');
select lives_ok($$ select public.submit_event(1::smallint, 'Just started', null, now() - interval '30 minutes', null, null) $$,
  'an event that started under an hour ago is fine');

-- 2. Validation errors --------------------------------------------------------
select throws_ok($$ select public.submit_event(1::smallint, '   ', null, now() + interval '1 day', null, null) $$, 'P0001', 'title_invalid', 'blank title');
select throws_ok($$ select public.submit_event(1::smallint, null, null, now() + interval '1 day', null, null) $$, 'P0001', 'title_invalid', 'null title');
select throws_ok($$ select public.submit_event(1::smallint, repeat('x', 121), null, now() + interval '1 day', null, null) $$, 'P0001', 'title_invalid', 'title over 120');
select lives_ok($$ select public.submit_event(1::smallint, repeat('x', 120), null, now() + interval '1 day', null, null) $$, 'title of 120 is fine');
select throws_ok($$ select public.submit_event(1::smallint, 'T', 'http://example.com', now() + interval '1 day', null, null) $$, 'P0001', 'link_invalid', 'http link');
select throws_ok($$ select public.submit_event(1::smallint, 'T', 'javascript:alert(1)', now() + interval '1 day', null, null) $$, 'P0001', 'link_invalid', 'non-http link');
select throws_ok($$ select public.submit_event(1::smallint, 'T', 'https://a.com/x y', now() + interval '1 day', null, null) $$, 'P0001', 'link_invalid', 'link with whitespace');
select throws_ok($$ select public.submit_event(1::smallint, 'T', 'https://', now() + interval '1 day', null, null) $$, 'P0001', 'link_invalid', 'link with no host');
select throws_ok($$ select public.submit_event(1::smallint, 'T', 'https://a.com/' || repeat('x', 490), now() + interval '1 day', null, null) $$, 'P0001', 'link_invalid', 'link over 500');
select throws_ok($$ select public.submit_event(1::smallint, 'T', null, now() - interval '2 hours', null, null) $$, 'P0001', 'starts_at_invalid', 'too far in the past');
select throws_ok($$ select public.submit_event(1::smallint, 'T', null, now() + interval '366 days', null, null) $$, 'P0001', 'starts_at_invalid', 'too far in the future');
select throws_ok($$ select public.submit_event(1::smallint, 'T', null, null, null, null) $$, 'P0001', 'starts_at_invalid', 'null starts_at');
select throws_ok($$ select public.submit_event(9999::smallint, 'T', null, now() + interval '1 day', null, null) $$, 'P0001', 'city_invalid', 'unknown city');
select throws_ok($$ select public.submit_event(null, 'T', null, now() + interval '1 day', null, null) $$, 'P0001', 'city_invalid', 'null city');
select throws_ok($$ select public.submit_event(1::smallint, 'T', null, now() + interval '1 day', repeat('v', 121), null) $$, 'P0001', 'venue_invalid', 'venue over 120');
select throws_ok($$ select public.submit_event(1::smallint, 'T', null, now() + interval '1 day', null, repeat('d', 1001)) $$, 'P0001', 'details_invalid', 'details over 1000');

-- 3. Rate limit: 5 per rolling 24h (alice has 4 good rows so far: 3 happy-path + 120-char title) -
select is((select count(*) from public.event_submissions)::int, 4, 'sanity: alice has 4 submissions');
select lives_ok($$ select public.submit_event(1::smallint, 'Fifth', null, now() + interval '1 day', null, null) $$, '5th is allowed');
select throws_ok($$ select public.submit_event(1::smallint, 'Sixth', null, now() + interval '1 day', null, null) $$, 'P0001', 'rate_limited', '6th is rate limited');
reset role;
update public.event_submissions set created_at = now() - interval '25 hours'
  where id = (select id from public.event_submissions order by created_at, id limit 1);
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.submit_event(1::smallint, 'After window', null, now() + interval '1 day', null, null) $$, 'rolling window frees a slot');

-- 4. Onboarding and auth ----------------------------------------------------------
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select throws_ok($$ select public.submit_event(1::smallint, 'T', null, now() + interval '1 day', null, null) $$, 'P0001', 'not_onboarded', 'needs a profile');
reset role;
select set_config('request.jwt.claims', '', true);
set local role authenticated;
select throws_ok($$ select public.submit_event(1::smallint, 'T', null, now() + interval '1 day', null, null) $$, 'P0001', 'not_authenticated', 'no uid');

-- 5. RLS -------------------------------------------------------------------------------
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select is((select count(*) from public.event_submissions)::int, 0, 'bob cannot see alice''s submissions');
select lives_ok($$ select public.submit_event(1::smallint, 'Bob''s event', null, now() + interval '1 day', null, null) $$, 'bob submits');
select is((select count(*) from public.event_submissions)::int, 1, 'bob sees only his own');
select throws_ok($$ insert into public.event_submissions (city_id, title, starts_at) values (1, 'direct', now() + interval '1 day') $$,
  '42501', null, 'direct insert is denied');
select throws_ok($$ delete from public.event_submissions $$, '42501', null, 'direct delete is denied');
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
update public.event_submissions set admin_note = 'hax' where submitted_by = '00000000-0000-0000-0000-00000000000a';
select is((select count(*) from public.event_submissions where admin_note = 'hax')::int, 0, 'non-admin update affects nothing (RLS)');
update public.event_submissions set status = 'approved', admin_note = 'self-approved';
reset role;
select is((select count(*) from public.event_submissions where status = 'approved')::int, 0, 'non-admin cannot approve even their own');

select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select ok((select count(*) from public.event_submissions) >= 6, 'admin sees everyone''s submissions');
update public.event_submissions set status = 'rejected', admin_note = 'spam', reviewed_at = now()
  where title = 'Fifth';
select is((select status::text from public.event_submissions where title = 'Fifth'), 'rejected', 'admin can update');
select throws_ok($$ update public.event_submissions set title = 'edited' $$, '42501', null, 'admin cannot edit submitted content via the API');
select throws_ok($$ insert into public.event_submissions (city_id, title, starts_at) values (1, 'direct', now() + interval '1 day') $$,
  '42501', null, 'admin cannot insert directly either');

-- 6. Anon -------------------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok($$ select public.submit_event(1::smallint, 'T', null, now() + interval '1 day', null, null) $$, '42501', null, 'anon cannot submit');
select throws_ok($$ select * from public.event_submissions $$, '42501', null, 'anon cannot read submissions');

reset role;
select * from finish();
rollback;
