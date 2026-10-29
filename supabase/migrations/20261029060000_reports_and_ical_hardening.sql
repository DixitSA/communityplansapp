-- Judge fixes: message reports only via report_message(); one cap for every insert path;
-- minimal grants; one report per target.

drop policy "file reports" on public.reports;
create policy "file reports" on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and target_type <> 'message');

revoke all on public.reports from authenticated, anon;
grant insert (reporter_id, target_type, target_id, reason) on public.reports to authenticated;
revoke all on public.event_sources from authenticated, anon;
grant select, insert, update on public.event_sources to authenticated;

create unique index reports_once_idx on public.reports (reporter_id, target_type, target_id);

-- 20 reports per reporter per day, whatever the insert path.
create function public.reports_rate_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.reports r
      where r.reporter_id = new.reporter_id and r.created_at > now() - interval '1 day') >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger reports_rate_limit before insert on public.reports
  for each row execute function public.reports_rate_limit();

create or replace function public.report_message(p_message_id bigint, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  m record;
begin
  if me is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select em.id, em.event_id, em.user_id, em.body into m
  from public.event_messages em where em.id = p_message_id and em.deleted_at is null;
  if not found
     or m.user_id = me
     or not private.is_going(me, m.event_id)
     or private.is_blocked_between(me, m.user_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  insert into public.reports (reporter_id, target_type, target_id, reason,
                              snapshot_body, snapshot_author_id, snapshot_event_id)
  values (me, 'message', p_message_id::text, left(coalesce(p_reason, ''), 1000),
          m.body, m.user_id, m.event_id)
  on conflict (reporter_id, target_type, target_id) do nothing;
end;
$$;
revoke execute on function public.report_message(bigint, text) from public, anon;
grant execute on function public.report_message(bigint, text) to authenticated;
