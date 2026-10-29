-- event_sources: admin only. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
insert into public.profiles (id, username, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'Alice'),
  ('00000000-0000-0000-0000-00000000000b', 'bob',   'Bob');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a');
insert into public.event_sources (id, name, url, city_id)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Seed', 'https://example.com/a.ics',
        (select id from public.cities where slug = 'charlotte'));

create function pg_temp.login(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select is((select count(*) from public.event_sources)::int, 0, 'non-admin reads nothing');
select throws_ok($$ insert into public.event_sources (name, url, city_id) values ('X', 'https://x.test/a.ics', 1) $$,
  '42501', null, 'non-admin cannot insert');
update public.event_sources set name = 'Hacked';
reset role;
select is((select name from public.event_sources), 'Seed', 'non-admin update changes nothing');

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is((select count(*) from public.event_sources)::int, 1, 'admin reads sources');
select lives_ok($$ insert into public.event_sources (name, url, city_id)
  values ('Luma', 'https://api.lu.ma/ics/get?entity=calendar&id=x', (select id from public.cities where slug = 'charlotte')) $$,
  'admin can insert');
select throws_ok($$ insert into public.event_sources (name, url, city_id)
  values ('Bad', 'http://insecure.test/a.ics', 1) $$, '23514', null, 'http urls rejected');
update public.event_sources set name = 'Renamed' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
reset role;
select is((select name from public.event_sources where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 'Renamed', 'admin can update');

set local role anon;
select throws_ok($$ select * from public.event_sources $$, '42501', null, 'anon cannot read');
reset role;

select * from finish();
rollback;
