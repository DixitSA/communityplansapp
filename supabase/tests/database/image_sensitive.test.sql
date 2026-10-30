-- image_sensitive: flagged event images reach the feed RPCs; grants unchanged. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000a');
insert into public.profiles (id, username, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'Alice');

insert into public.events (id, source, city_id, title, starts_at, is_free, location) values
  ('11111111-1111-1111-1111-111111111111', 'curated', (select id from public.cities where slug = 'charlotte'),
   'Plain Flyer', timestamptz '2026-10-28 21:00 America/New_York', false,
   extensions.st_setsrid(extensions.st_makepoint(-80.85, 35.22), 4326)::extensions.geography),
  ('22222222-2222-2222-2222-222222222222', 'curated', (select id from public.cities where slug = 'charlotte'),
   'Racy Flyer', timestamptz '2026-10-28 22:00 America/New_York', false,
   extensions.st_setsrid(extensions.st_makepoint(-80.85, 35.22), 4326)::extensions.geography);

select is((select image_sensitive from public.events where id = '11111111-1111-1111-1111-111111111111'), false,
  'events default to not sensitive');
select is((select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'event_submissions' and column_name = 'image_sensitive'), 'false',
  'submissions default to not sensitive');

update public.events set image_sensitive = true where id = '22222222-2222-2222-2222-222222222222';

create function pg_temp.login(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');

select is((select array_agg(title || '=' || image_sensitive order by starts_at) from public.get_feed_range(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', 1, 35.2271, -80.8431)),
  array['Plain Flyer=false', 'Racy Flyer=true'], 'get_feed_range returns the flag per event');
select is((select array_agg(title || '=' || image_sensitive order by starts_at) from public.get_feed(
    (select id from public.cities where slug = 'charlotte'), date '2026-10-28', 35.2271, -80.8431)),
  array['Plain Flyer=false', 'Racy Flyer=true'], 'get_feed returns the flag per event');

-- Non-admins match no row under RLS, so the update is a silent no-op.
update public.events set image_sensitive = false where id = '22222222-2222-2222-2222-222222222222';
reset role;
select is((select image_sensitive from public.events where id = '22222222-2222-2222-2222-222222222222'), true,
  'signed-in users cannot clear the flag');

select ok(not has_function_privilege('anon', 'public.get_feed_range(smallint, date, integer, double precision, double precision, integer, smallint[], text, text)', 'execute'),
  'anon still cannot call get_feed_range');
select ok(not has_function_privilege('anon', 'public.get_feed(smallint, date, double precision, double precision, integer, smallint[], text, text)', 'execute'),
  'anon still cannot call get_feed');
select ok(has_function_privilege('authenticated', 'public.get_feed_range(smallint, date, integer, double precision, double precision, integer, smallint[], text, text)', 'execute'),
  'authenticated can call get_feed_range');

select * from finish();
rollback;
