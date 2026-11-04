-- list_my_blocks: you see only the people you blocked; blocked people do not see who blocked them.
-- Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'), ('00000000-0000-0000-0000-00000000000c');
insert into public.profiles (id, username, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'Alice'),
  ('00000000-0000-0000-0000-00000000000b', 'bob',   'Bob'),
  ('00000000-0000-0000-0000-00000000000c', 'cara',  'Cara');
insert into public.blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');

create function pg_temp.login(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

select ok(not has_function_privilege('anon', 'public.list_my_blocks()', 'execute'), 'anon cannot call list_my_blocks');

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.list_my_blocks()), 1, 'Alice sees her one block');
select is((select username from public.list_my_blocks()), 'bob', 'it is Bob');
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.list_my_blocks()), 0, 'Bob does not see who blocked him');
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.list_my_blocks()), 0, 'Cara sees nothing');
reset role;

select * from finish();
rollback;
