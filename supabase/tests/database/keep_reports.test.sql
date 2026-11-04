-- Reports survive deletion of the reporter's account. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
insert into public.profiles (id, username, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'Alice'),
  ('00000000-0000-0000-0000-00000000000b', 'bob',   'Bob');

insert into public.reports (reporter_id, target_type, target_id, reason)
values ('00000000-0000-0000-0000-00000000000a', 'user', '00000000-0000-0000-0000-00000000000b', 'spam');

delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';

select is((select count(*)::int from public.reports where target_id = '00000000-0000-0000-0000-00000000000b'), 1,
  'report survives deletion of its reporter');
select is((select reporter_id from public.reports where target_id = '00000000-0000-0000-0000-00000000000b'), null,
  'reporter_id is null after the reporter is deleted');

-- A client can't insert a null-reporter report.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.reports (reporter_id, target_type, target_id, reason)
    values (null, 'user', '00000000-0000-0000-0000-00000000000a', 'x')$$,
  '42501', null, 'null-reporter insert is rejected by RLS');

select * from finish();
rollback;
