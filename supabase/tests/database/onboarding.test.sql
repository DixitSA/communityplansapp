-- Onboarding RPCs. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-0000000000c3'),
  ('00000000-0000-0000-0000-0000000000d4');

insert into public.profiles (id, username, display_name) values
  ('00000000-0000-0000-0000-0000000000c3', 'taken_name', 'Taken');

create function pg_temp.login(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end;
$$;

-- Three valid interest ids and the city, resolved once.
create temp table fx as
  select (select array_agg(id order by id) from (select id from public.interests order by id limit 3) s)::smallint[] as ints,
         (select id from public.cities where slug = 'charlotte') as city;
grant select on fx to anon, authenticated;

-- username_available ----------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select is(public.username_available('fresh_name'), true, 'free username is available');
select is(public.username_available('taken_name'), false, 'taken username is unavailable');
select is(public.username_available('TAKEN_Name'), false, 'taken check is case-insensitive');
select is(public.username_available('ab'), false, 'too short is unavailable');
select is(public.username_available('has space'), false, 'invalid chars are unavailable');
select is(public.username_available(repeat('a', 21)), false, 'too long is unavailable');

-- Errors, each with no partial rows ------------------------------------------------
select throws_ok($$ select public.complete_onboarding('ab', 'Al', date '1990-01-01', (select ints from fx), (select city from fx)) $$,
  null, 'username_invalid', 'invalid username');
select throws_ok($$ select public.complete_onboarding('TAKEN_name', 'Al', date '1990-01-01', (select ints from fx), (select city from fx)) $$,
  null, 'username_taken', 'taken username (any case)');
select throws_ok($$ select public.complete_onboarding('alice', '   ', date '1990-01-01', (select ints from fx), (select city from fx)) $$,
  null, 'display_name_invalid', 'blank display name');
select throws_ok($$ select public.complete_onboarding('alice', repeat('x', 51), date '1990-01-01', (select ints from fx), (select city from fx)) $$,
  null, 'display_name_invalid', 'display name too long');
select throws_ok($$ select public.complete_onboarding('alice', 'Al', (current_date - interval '17 years')::date, (select ints from fx), (select city from fx)) $$,
  null, 'must_be_18', 'under 18');
select throws_ok($$ select public.complete_onboarding('alice', 'Al', date '1990-01-01', (select ints[1:2] from fx), (select city from fx)) $$,
  null, 'too_few_interests', 'two interests');
select throws_ok($$ select public.complete_onboarding('alice', 'Al', date '1990-01-01', array[(select ints[1] from fx), (select ints[1] from fx), (select ints[2] from fx)], (select city from fx)) $$,
  null, 'too_few_interests', 'duplicate interests do not count');
select throws_ok($$ select public.complete_onboarding('alice', 'Al', date '1990-01-01', array[(select ints[1] from fx), (select ints[2] from fx), 32000::smallint], (select city from fx)) $$,
  null, 'too_few_interests', 'unknown interest id does not count');
select throws_ok($$ select public.complete_onboarding('alice', 'Al', date '1990-01-01', (select ints from fx), 32000::smallint) $$,
  null, 'city_invalid', 'unknown city');

reset role;
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000a1')::int, 0, 'failures leave no profile');
select is((select count(*) from public.profiles_private where id = '00000000-0000-0000-0000-0000000000a1')::int, 0, 'failures leave no private row');
select is((select count(*) from public.profile_interests where profile_id = '00000000-0000-0000-0000-0000000000a1')::int, 0, 'failures leave no interests');

-- Happy path ---------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.complete_onboarding('Alice_X', '  Alice  ', date '1990-01-01', (select ints from fx), (select city from fx)) $$,
  'onboarding succeeds');

reset role;
select is((select username from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'alice_x', 'username lowercased');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'Alice', 'display name trimmed');
select is((select home_city_id from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), (select city from fx), 'home city set');
select is((select birthdate from public.profiles_private where id = '00000000-0000-0000-0000-0000000000a1'), date '1990-01-01', 'birthdate stored');
select is((select count(*) from public.profile_interests where profile_id = '00000000-0000-0000-0000-0000000000a1')::int, 3, 'three interests stored');

-- Second call --------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.complete_onboarding('another', 'Al', date '1990-01-01', (select ints from fx), (select city from fx)) $$,
  null, 'already_onboarded', 'second call fails');
select is(public.username_available('ALICE_x'), false, 'newly created username is taken');

-- Always acts as auth.uid() ---------------------------------------------------------
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000b2');
select lives_ok($$ select public.complete_onboarding('bobby', 'Bob', date '1990-01-01', (select ints from fx), (select city from fx)) $$,
  'bob onboards himself');
reset role;
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000b2' and username = 'bobby')::int, 1, 'row belongs to caller');
select is((select username from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'alice_x', 'alice untouched by bob');


-- Hardening ---------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select is(public.username_available('...'), false, '"..." is invalid');
select is(public.username_available('_ab'), false, 'leading underscore is invalid');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000d4');
select throws_ok($$ select public.complete_onboarding('_abc', 'Z', date '1990-01-01', (select ints from fx), (select city from fx)) $$,
  null, 'username_invalid', 'RPC rejects leading underscore');
select throws_ok($$ select public.complete_onboarding('dd1', 'D', date '1990-01-01', null, (select city from fx)) $$,
  null, 'too_few_interests', 'null interests');
select throws_ok($$ select public.complete_onboarding('dd1', 'D', null, (select ints from fx), (select city from fx)) $$,
  null, 'must_be_18', 'null birthdate');
select throws_ok($$ select public.complete_onboarding('dd1', 'D', date '1899-12-31', (select ints from fx), (select city from fx)) $$,
  null, 'must_be_18', 'ancient birthdate');
select throws_ok($$ select public.complete_onboarding('dd1', 'D', (current_date - interval '18 years')::date + 1, (select ints from fx), (select city from fx)) $$,
  null, 'must_be_18', 'day before 18th birthday');
select lives_ok($$ select public.complete_onboarding('dd1', 'D', (current_date - interval '18 years')::date, (select ints from fx), (select city from fx)) $$,
  'exact 18th birthday passes');
select throws_ok($$ insert into public.profiles (id, username, display_name) values ('00000000-0000-0000-0000-0000000000d4', 'sneaky', 'S') $$,
  '42501', null, 'direct profiles insert denied');
select throws_ok($$ insert into public.profiles_private (id, birthdate) values ('00000000-0000-0000-0000-0000000000d4', date '1990-01-01') $$,
  '42501', null, 'direct profiles_private insert denied');
select lives_ok($$ update public.profiles_private set discoverable_by_phone = false where id = '00000000-0000-0000-0000-0000000000d4' $$,
  'own discoverable_by_phone still updatable');
select is((select discoverable_by_phone from public.profiles_private where id = '00000000-0000-0000-0000-0000000000d4'),
  false, 'the discoverable_by_phone update actually landed');
select throws_ok($$ update public.profiles_private set phone_hmac = 'x' where id = '00000000-0000-0000-0000-0000000000d4' $$,
  '42501', null, 'phone_hmac is server-only');
reset role;

-- anon / no session ----------------------------------------------------------------------
select pg_temp.logout();
select throws_ok($$ select public.username_available('zzzz') $$, '42501', null, 'anon cannot call username_available');
select throws_ok($$ select public.complete_onboarding('zzzz', 'Z', date '1990-01-01', (select ints from fx), (select city from fx)) $$,
  '42501', null, 'anon cannot call complete_onboarding');

-- Signed-in role with no uid claim
reset role;
select set_config('request.jwt.claims', '', true);
set local role authenticated;
select throws_ok($$ select public.complete_onboarding('zzzz', 'Z', date '1990-01-01', (select ints from fx), (select city from fx)) $$,
  null, 'not_authenticated', 'no uid raises not_authenticated');

reset role;
select * from finish();
rollback;
