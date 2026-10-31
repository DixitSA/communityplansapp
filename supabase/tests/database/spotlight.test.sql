-- get_spotlight: picks first, then events with enough Going; private plans never count. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'),
  ('00000000-0000-0000-0000-00000000000d'),
  ('00000000-0000-0000-0000-00000000000e');
insert into public.profiles (id, username, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'Alice'),
  ('00000000-0000-0000-0000-00000000000b', 'bob',   'Bob'),
  ('00000000-0000-0000-0000-00000000000c', 'carol', 'Carol'),
  ('00000000-0000-0000-0000-00000000000d', 'dave',  'Dave'),
  ('00000000-0000-0000-0000-00000000000e', 'erin',  'Erin');
-- alice <-> bob are friends; the rest are strangers to alice.
insert into public.friendships (user_a, user_b, requested_by, status) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b',
   '00000000-0000-0000-0000-00000000000a', 'accepted');

create function pg_temp.ev(id uuid, title text, starts timestamptz, pick timestamptz default null) returns void
language sql as $$
  insert into public.events (id, source, city_id, title, starts_at, location, spotlight_until)
  values (id, 'curated', (select c.id from public.cities c where c.slug = 'charlotte'), title, starts,
    extensions.st_setsrid(extensions.st_makepoint(-80.85, 35.22), 4326)::extensions.geography, pick);
$$;

select pg_temp.ev('11111111-1111-1111-1111-111111111111', 'Picked Show', now() + interval '2 days', now() + interval '3 days');
select pg_temp.ev('22222222-2222-2222-2222-222222222222', 'Crowded Party', now() + interval '1 day');
select pg_temp.ev('33333333-3333-3333-3333-333333333333', 'Two Going', now() + interval '1 day');
select pg_temp.ev('44444444-4444-4444-4444-444444444444', 'Expired Pick', now() + interval '1 day', now() - interval '1 hour');
select pg_temp.ev('55555555-5555-5555-5555-555555555555', 'Already Over', now() - interval '5 hours', now() + interval '1 day');
select pg_temp.ev('66666666-6666-6666-6666-666666666666', 'Only Interested', now() + interval '1 day');
select pg_temp.ev('77777777-7777-7777-7777-777777777777', 'Far Future Pick', now() + interval '20 days', now() + interval '30 days');

create function pg_temp.login(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;
create function pg_temp.rsvp(u uuid, e uuid, s public.rsvp_status) returns void language plpgsql as $$
begin
  perform pg_temp.login(u);
  perform public.set_rsvp(e, s);
  reset role;
end;
$$;

-- Crowded Party: bob (alice's friend), carol, dave going. Two Going: carol, dave.
-- Only Interested: four people interested or "down if friends go", nobody going.
select pg_temp.rsvp('00000000-0000-0000-0000-00000000000b', '22222222-2222-2222-2222-222222222222', 'going');
select pg_temp.rsvp('00000000-0000-0000-0000-00000000000c', '22222222-2222-2222-2222-222222222222', 'going');
select pg_temp.rsvp('00000000-0000-0000-0000-00000000000d', '22222222-2222-2222-2222-222222222222', 'going');
select pg_temp.rsvp('00000000-0000-0000-0000-00000000000c', '33333333-3333-3333-3333-333333333333', 'going');
select pg_temp.rsvp('00000000-0000-0000-0000-00000000000d', '33333333-3333-3333-3333-333333333333', 'going');
select pg_temp.rsvp('00000000-0000-0000-0000-00000000000b', '66666666-6666-6666-6666-666666666666', 'interested');
select pg_temp.rsvp('00000000-0000-0000-0000-00000000000c', '66666666-6666-6666-6666-666666666666', 'interested');
select pg_temp.rsvp('00000000-0000-0000-0000-00000000000d', '66666666-6666-6666-6666-666666666666', 'down_if_friends');
select pg_temp.rsvp('00000000-0000-0000-0000-00000000000e', '66666666-6666-6666-6666-666666666666', 'interested');
delete from public.notifications;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');

select is((select array_agg(title order by score desc, starts_at) from public.get_spotlight(
    (select id from public.cities where slug = 'charlotte'), 35.2271, -80.8431)),
  array['Picked Show', 'Crowded Party'],
  'picks lead, then events with at least three Going; expired picks, ended events and far-off events are out');
select is((select picked from public.get_spotlight((select id from public.cities where slug = 'charlotte'), 35.2271, -80.8431)
    where title = 'Picked Show'), true, 'a pick is marked as picked');
select is((select going_count from public.get_spotlight((select id from public.cities where slug = 'charlotte'), 35.2271, -80.8431)
    where title = 'Crowded Party'), 3::bigint, 'going_count is the total Going');
select is((select jsonb_path_query_array(friends_going, '$[*].display_name') from public.get_spotlight(
    (select id from public.cities where slug = 'charlotte'), 35.2271, -80.8431) where title = 'Crowded Party'),
  '["Bob"]'::jsonb, 'friends_going names only friends, never strangers');
select ok(not exists (select 1 from public.get_spotlight((select id from public.cities where slug = 'charlotte'), 35.2271, -80.8431)
    where title = 'Only Interested'), 'Interested and "Down if friends go" never make an event popping');
select is((select count(*) from public.get_spotlight((select id from public.cities where slug = 'charlotte'), 35.2271, -80.8431,
    p_days => 30))::int, 3, 'a wider window takes in the far-off pick');
select is((select count(*) from public.get_spotlight((select id from public.cities where slug = 'charlotte'), 35.2271, -80.8431,
    p_limit => 1))::int, 1, 'p_limit caps the row');

-- Non-admins match no row under RLS, so trying to pick an event is a silent no-op.
update public.events set spotlight_until = now() + interval '1 day' where id = '33333333-3333-3333-3333-333333333333';
reset role;
select is((select spotlight_until from public.events where id = '33333333-3333-3333-3333-333333333333'), null,
  'signed-in users cannot pick events');

select ok(not has_function_privilege('anon', 'public.get_spotlight(smallint, double precision, double precision, integer, integer)', 'execute'),
  'anon cannot call get_spotlight');
select ok(has_function_privilege('authenticated', 'public.get_spotlight(smallint, double precision, double precision, integer, integer)', 'execute'),
  'authenticated can call get_spotlight');

select * from finish();
rollback;
