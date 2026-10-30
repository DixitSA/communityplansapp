-- Agent inbox image URL constraints, client privileges, and curated publication propagation.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

select ok(
  not has_column_privilege('authenticated', 'public.event_submissions', 'image_url', 'UPDATE'),
  'ordinary clients cannot edit submission images'
);

insert into public.event_submissions (submitted_by, origin, city_id, title, starts_at)
values (null, 'agent', 1, 'Image URL legacy row', now() + interval '1 day');
select is(
  (select image_url from public.event_submissions where title = 'Image URL legacy row'),
  null::text,
  'omitting image_url remains backward compatible'
);

insert into public.event_submissions (submitted_by, origin, city_id, title, starts_at, image_url)
values (null, 'agent', 1, 'Image URL publication row', now() + interval '1 day', 'https://cdn.example.com/events/launch.jpg');
select lives_ok($$ insert into public.event_submissions (submitted_by, origin, city_id, title, starts_at, image_url) values (null, 'agent', 1, 'Image URL port row', now() + interval '1 day', 'https://cdn.example.com:8443/events/launch.jpg') $$,
  'valid HTTPS URL with a numeric port is accepted');

select throws_ok($$ insert into public.event_submissions (submitted_by, origin, city_id, title, starts_at, image_url) values (null, 'agent', 1, 'image http', now(), 'http://cdn.example.com/event.jpg') $$, '23514', null, 'image URL requires HTTPS');
select throws_ok($$ insert into public.event_submissions (submitted_by, origin, city_id, title, starts_at, image_url) values (null, 'agent', 1, 'image malformed scheme', now(), 'https:cdn.example.com/event.jpg') $$, '23514', null, 'image URL requires HTTPS scheme delimiter');
select throws_ok($$ insert into public.event_submissions (submitted_by, origin, city_id, title, starts_at, image_url) values (null, 'agent', 1, 'image one slash', now(), 'https:/cdn.example.com/event.jpg') $$, '23514', null, 'image URL requires two scheme slashes');
select throws_ok($$ insert into public.event_submissions (submitted_by, origin, city_id, title, starts_at, image_url) values (null, 'agent', 1, 'image empty host', now(), 'https:///event.jpg') $$, '23514', null, 'image URL requires a host');
select throws_ok($$ insert into public.event_submissions (submitted_by, origin, city_id, title, starts_at, image_url) values (null, 'agent', 1, 'image credentials', now(), 'https://@cdn.example.com/event.jpg') $$, '23514', null, 'image URL disallows userinfo');
select throws_ok($$ insert into public.event_submissions (submitted_by, origin, city_id, title, starts_at, image_url) values (null, 'agent', 1, 'image invalid host', now(), 'https://bad_.example/event.jpg') $$, '23514', null, 'image URL requires a valid hostname');
select throws_ok($$ insert into public.event_submissions (submitted_by, origin, city_id, title, starts_at, image_url) values (null, 'agent', 1, 'image invalid port', now(), 'https://cdn.example.com:bad/event.jpg') $$, '23514', null, 'image URL port must be numeric');
select throws_ok($$ insert into public.event_submissions (submitted_by, origin, city_id, title, starts_at, image_url) values (null, 'agent', 1, 'image out of range port', now(), 'https://cdn.example.com:65536/event.jpg') $$, '23514', null, 'image URL port must be in range');
select throws_ok($$ insert into public.event_submissions (submitted_by, origin, city_id, title, starts_at, image_url) values (null, 'agent', 1, 'image whitespace', now(), 'https://cdn.example.com/event image.jpg') $$, '23514', null, 'image URL disallows whitespace');
select throws_ok($$ insert into public.event_submissions (submitted_by, origin, city_id, title, starts_at, image_url) values (null, 'agent', 1, 'image backslash', now(), 'https://cdn.example.com\event.jpg') $$, '23514', null, 'image URL disallows backslashes');
select throws_ok($$ insert into public.event_submissions (submitted_by, origin, city_id, title, starts_at, image_url) values (null, 'agent', 1, 'image long', now(), 'https://a.co/' || repeat('x', 2040)) $$, '23514', null, 'image URL over 2048');

insert into public.events (id, source, city_id, title, starts_at, venue_name, venue_address, ticket_url, image_url, description, location)
select '00000000-0000-0000-0000-0000000000e1', 'curated', s.city_id, s.title, s.starts_at, s.venue, s.address, s.link, s.image_url, s.details,
       extensions.st_setsrid(extensions.st_makepoint(-80.8431, 35.2271), 4326)::extensions.geography
from public.event_submissions s
where s.title = 'Image URL publication row';
select is(
  (select image_url from public.events where id = '00000000-0000-0000-0000-0000000000e1'::uuid),
  'https://cdn.example.com/events/launch.jpg',
  'curated event receives the submission image URL when published'
);

select * from finish();
rollback;
