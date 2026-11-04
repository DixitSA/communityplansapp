-- set_my_avatar RPC. Run with: supabase test db
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

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');

select lives_ok($$ select public.set_my_avatar('00000000-0000-0000-0000-0000000000a1/avatar-1.jpg') $$, 'own folder ok');
reset role;
select is((select avatar_path from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  '00000000-0000-0000-0000-0000000000a1/avatar-1.jpg', 'path saved');

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.set_my_avatar('00000000-0000-0000-0000-0000000000b2/avatar-1.jpg') $$, null, 'avatar_path_invalid', 'someone else''s folder rejected');
select throws_ok($$ select public.set_my_avatar('elsewhere/avatar-1.jpg') $$, null, 'avatar_path_invalid', 'foreign folder rejected');
select throws_ok($$ select public.set_my_avatar('00000000-0000-0000-0000-0000000000a1/../00000000-0000-0000-0000-0000000000b2/x.jpg') $$, null, 'avatar_path_invalid', 'path traversal rejected');

select lives_ok($$ select public.set_my_avatar(null) $$, 'null clears the photo');
reset role;
select is((select avatar_path from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), null, 'photo cleared');
select is((select avatar_path from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'), null, 'other user untouched');

-- Anonymous callers are turned away ---------------------------------------------
reset role;
set local role anon;
select throws_ok($$ select public.set_my_avatar(null) $$, '42501', null, 'anon cannot execute');

select * from finish();
rollback;
