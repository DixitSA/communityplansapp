-- Report snapshots: keep a private copy of a reported chat message for 90 days, so it
-- survives the author's soft delete. Clients can never read reports.

alter table public.reports
  add column snapshot_body text,
  add column snapshot_author_id uuid references public.profiles (id) on delete set null,
  add column snapshot_event_id uuid;

-- Clients may only write the plain columns; snapshots come from report_message().
revoke insert, update, select on public.reports from authenticated, anon;
grant insert (reporter_id, target_type, target_id, reason) on public.reports to authenticated;

create index reports_reporter_created_idx on public.reports (reporter_id, created_at);

create function public.report_message(p_message_id bigint, p_reason text) returns void
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
  if (select count(*) from public.reports r
      where r.reporter_id = me and r.created_at > now() - interval '1 day') >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.reports (reporter_id, target_type, target_id, reason,
                              snapshot_body, snapshot_author_id, snapshot_event_id)
  values (me, 'message', p_message_id::text, left(coalesce(p_reason, ''), 1000),
          m.body, m.user_id, m.event_id);
end;
$$;
revoke execute on function public.report_message(bigint, text) from public, anon;
grant execute on function public.report_message(bigint, text) to authenticated;

-- Service role only (owner schedules it daily via dashboard Cron).
create function public.purge_old_reports() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.reports where created_at < now() - interval '90 days';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.purge_old_reports() from public, anon, authenticated;
grant execute on function public.purge_old_reports() to service_role;
