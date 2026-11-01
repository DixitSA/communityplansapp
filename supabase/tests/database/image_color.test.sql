-- image_color: only well-formed colors, cleared when the picture changes, read-only to users. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000a');
insert into public.profiles (id, username, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'Alice');

insert into public.events (id, source, city_id, title, starts_at, image_url, location) values
  ('11111111-1111-1111-1111-111111111111', 'curated', (select id from public.cities where slug = 'charlotte'),
   'Colorful Flyer', now() + interval '1 day', 'https://example.com/a.jpg',
   extensions.st_setsrid(extensions.st_makepoint(-80.85, 35.22), 4326)::extensions.geography);

select is((select image_color from public.events where id = '11111111-1111-1111-1111-111111111111'), null,
  'new events have no color yet');

update public.events set image_color = '#a34929', image_color_checked_at = now()
  where id = '11111111-1111-1111-1111-111111111111';
select is((select image_color from public.events where id = '11111111-1111-1111-1111-111111111111'), '#a34929',
  'a lowercase hex color is accepted');

select throws_ok(
  $$update public.events set image_color = 'red' where id = '11111111-1111-1111-1111-111111111111'$$,
  '23514', null, 'anything but #rrggbb is rejected');

update public.events set title = 'Renamed Flyer' where id = '11111111-1111-1111-1111-111111111111';
select is((select image_color from public.events where id = '11111111-1111-1111-1111-111111111111'), '#a34929',
  'other edits keep the color');

update public.events set image_url = 'https://example.com/b.jpg' where id = '11111111-1111-1111-1111-111111111111';
select is((select image_color from public.events where id = '11111111-1111-1111-1111-111111111111'), null,
  'a new picture clears the color');
select is((select image_color_checked_at from public.events where id = '11111111-1111-1111-1111-111111111111'), null,
  'a new picture is checked again');

-- Signed-in users can read the color with the event, but can't set it (no matching row under RLS).
update public.events set image_color = '#a34929' where id = '11111111-1111-1111-1111-111111111111';
create function pg_temp.login(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is((select image_color from public.events where id = '11111111-1111-1111-1111-111111111111'), '#a34929',
  'signed-in users can read the color');
update public.events set image_color = '#000000' where id = '11111111-1111-1111-1111-111111111111';
reset role;
select is((select image_color from public.events where id = '11111111-1111-1111-1111-111111111111'), '#a34929',
  'signed-in users cannot change the color');

select * from finish();
rollback;
