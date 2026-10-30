-- Inbox autopilot: event-images bucket, no client writes, 'agent' event source.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

select is((select public from storage.buckets where id = 'event-images'), true, 'event-images bucket exists and is public');

select ok('agent' = any (enum_range(null::public.event_source)::text[]), '''agent'' is an event_source value');

-- Every client write policy on storage.objects must be scoped to the avatars bucket, so none can reach
-- event-images (this also catches a broad policy that never names a bucket).
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and (coalesce(with_check, '') || coalesce(qual, '')) not like '%bucket_id = ''avatars''%'),
  0, 'no storage write policy reaches beyond the avatars bucket'
);

select is((select file_size_limit from storage.buckets where id = 'event-images'), 5242880::bigint, 'event-images capped at 5 MB');

set local role authenticated;
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('event-images', 'inbox/x.png') $$,
  '42501', null, 'authenticated users cannot upload to event-images'
);
reset role;

select * from finish();
rollback;
