-- get_my_chats: the chat list gets image_sensitive and interest_ids, and still only lists your own Going chats.
-- Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
insert into public.profiles (id, username, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'Alice'),
  ('00000000-0000-0000-0000-00000000000b', 'bob',   'Bob');

insert into public.events (id, source, city_id, title, starts_at, image_url, image_sensitive, location)
select v.id, 'curated', (select id from public.cities where slug = 'charlotte'), v.title, now() + interval '1 day',
       v.img, v.sens, extensions.st_setsrid(extensions.st_makepoint(-80.85, 35.22), 4326)::extensions.geography
from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'Racy Flyer Night', 'https://example.com/a.jpg', true),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'No Picture Show', null, false)) v(id, title, img, sens);
insert into public.event_interests (event_id, interest_id)
select '22222222-2222-2222-2222-222222222222', id from public.interests where slug in ('music', 'nightlife');

create function pg_temp.login(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- Alice is Going to both; Bob is only Interested in the racy one.
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.set_rsvp('11111111-1111-1111-1111-111111111111', 'going');
select public.set_rsvp('22222222-2222-2222-2222-222222222222', 'going');
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select public.set_rsvp('11111111-1111-1111-1111-111111111111', 'interested');
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is((select image_sensitive from public.get_my_chats() where event_id = '11111111-1111-1111-1111-111111111111'),
  true, 'a flagged image is marked sensitive in the chat list');
select is((select image_sensitive from public.get_my_chats() where event_id = '22222222-2222-2222-2222-222222222222'),
  false, 'other events are not');
select is((select interest_ids from public.get_my_chats() where event_id = '22222222-2222-2222-2222-222222222222'),
  (select array_agg(id order by id) from public.interests where slug in ('music', 'nightlife')),
  'interest_ids lists the event''s interests, in id order');
select is((select interest_ids from public.get_my_chats() where event_id = '11111111-1111-1111-1111-111111111111'),
  '{}'::smallint[], 'an event without interests gets an empty array');
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select is((select count(*) from public.get_my_chats())::int, 0, 'Interested is not Going: no chats for Bob');
reset role;

select ok(not has_function_privilege('anon', 'public.get_my_chats()', 'execute'), 'anon cannot call get_my_chats');
select ok(has_function_privilege('authenticated', 'public.get_my_chats()', 'execute'), 'authenticated can call get_my_chats');

select * from finish();
rollback;
