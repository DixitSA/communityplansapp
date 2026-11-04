-- update_my_profile RPC. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2');

insert into public.profiles (id, username, display_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice', 'Alice'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob_b', 'Bob');

create function pg_temp.login(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create temp table fx as
  select (select array_agg(id order by id) from (select id from public.interests order by id limit 4) s)::smallint[] as ints;
grant select on fx to anon, authenticated;

insert into public.profile_interests (profile_id, interest_id)
select '00000000-0000-0000-0000-0000000000a1', unnest(ints[1:3]) from fx;

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');

-- Own update works ------------------------------------------------------------
select lives_ok($$ select public.update_my_profile('  Alice N  ', 'Alice.N', ' hi there ', (select ints[2:4] from fx)) $$,
  'own update works');

reset role;
select is((select username from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'alice.n', 'username lowercased');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'Alice N', 'name trimmed');
select is((select bio from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'hi there', 'bio saved');
select is((select array_agg(interest_id order by interest_id) from public.profile_interests where profile_id = '00000000-0000-0000-0000-0000000000a1'),
  (select ints[2:4] from fx), 'interests replaced');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'), 'Bob', 'other user untouched');

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');

-- Keeping your own username is fine; blank bio clears it.
select lives_ok($$ select public.update_my_profile('Alice', 'alice.n', '', (select ints[1:3] from fx)) $$, 'own username is not "taken"');

-- Rejections -----------------------------------------------------------------
select throws_ok($$ select public.update_my_profile('Alice', 'ab', null, (select ints from fx)) $$, null, 'username_invalid', 'bad username');
select throws_ok($$ select public.update_my_profile('Alice', '.dots', null, (select ints from fx)) $$, null, 'username_invalid', 'username must start alphanumeric');
select throws_ok($$ select public.update_my_profile('Alice', 'BOB_b', null, (select ints from fx)) $$, null, 'username_taken', 'taken username (any case)');
select throws_ok($$ select public.update_my_profile('  ', 'alice.n', null, (select ints from fx)) $$, null, 'display_name_invalid', 'blank name');
select throws_ok($$ select public.update_my_profile('Alice', 'alice.n', repeat('x', 161), (select ints from fx)) $$, null, 'bio_invalid', 'bio too long');
select throws_ok($$ select public.update_my_profile('Alice', 'alice.n', null, (select ints[1:2] from fx)) $$, null, 'too_few_interests', 'too few interests');

-- Only the caller's own row is ever touched --------------------------------------
reset role;
select is((select username from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'), 'bob_b', 'cannot change another user');
select is((select bio from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), null, 'blank bio cleared');

-- Signed out is refused ----------------------------------------------------------
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$ select public.update_my_profile('X', 'xxx', null, (select ints from fx)) $$, null, null, 'anon cannot call it');

select * from finish();
rollback;
