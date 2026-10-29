-- Event group chat v1: members are the people who are Going. Replaces Stream for v1.

create table public.event_messages (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (
    (deleted_at is null and char_length(btrim(body)) between 1 and 2000)
    or (deleted_at is not null and body is null)
  )
);
create index event_messages_event_created_idx on public.event_messages (event_id, created_at desc);
alter table public.event_messages enable row level security;

create table public.event_chat_reads (
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
alter table public.event_chat_reads enable row level security;

-- The chat is open while the event is active and until 48 h after it ends.
create function public.chat_open(e uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events ev
    where ev.id = e
      and ev.status = 'active'
      and now() < coalesce(ev.ends_at, ev.starts_at + interval '6 hours') + interval '48 hours'
  );
$$;

-- Soft delete erases the body at the source; deleted_at can never be cleared.
create function public.event_messages_on_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then
    raise exception 'message_deleted' using errcode = '42501';
  end if;
  if new.deleted_at is not null then
    new.body = null;
  end if;
  return new;
end;
$$;
create trigger event_messages_before_update before update on public.event_messages
  for each row execute function public.event_messages_on_update();

-- Messages: only Going members, never across a block (either direction).
create policy "chat read" on public.event_messages for select to authenticated
  using (
    public.is_going((select auth.uid()), event_id)
    and not public.is_blocked_between((select auth.uid()), user_id)
  );
create policy "chat post" on public.event_messages for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_going((select auth.uid()), event_id)
    and public.chat_open(event_id)
  );
-- Soft delete only: own rows, and deleted_at must end up set.
create policy "chat soft delete" on public.event_messages for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and deleted_at is not null);

revoke all on public.event_messages from anon, authenticated;
grant select on public.event_messages to authenticated;
grant insert (event_id, user_id, body) on public.event_messages to authenticated;
grant update (deleted_at) on public.event_messages to authenticated;

create policy "own chat reads select" on public.event_chat_reads for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own chat reads insert" on public.event_chat_reads for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "own chat reads update" on public.event_chat_reads for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.event_chat_reads from anon, authenticated;
grant select on public.event_chat_reads to authenticated;
grant insert (user_id, event_id, last_read_at) on public.event_chat_reads to authenticated;
grant update (last_read_at) on public.event_chat_reads to authenticated;

create function public.mark_chat_read(p_event_id uuid) returns void
language sql security invoker set search_path = '' as $$
  insert into public.event_chat_reads (user_id, event_id, last_read_at)
  select (select auth.uid()), p_event_id, now()
  where (select auth.uid()) is not null
  on conflict (user_id, event_id) do update set last_read_at = excluded.last_read_at;
$$;

-- Newest first. security invoker, so the select policy hides non-members and blocked authors.
create function public.get_chat_messages(
  p_event_id uuid, p_before timestamptz default null, p_limit int default 50
) returns table (
  id bigint, user_id uuid, display_name text, avatar_path text,
  body text, created_at timestamptz, is_mine boolean
)
language sql stable security invoker set search_path = '' as $$
  select m.id, m.user_id, p.display_name, p.avatar_path,
         case when m.deleted_at is null then m.body end,
         m.created_at, m.user_id = (select auth.uid())
  from public.event_messages m
  join public.profiles p on p.id = m.user_id
  where m.event_id = p_event_id
    and (p_before is null or m.created_at < p_before)
  order by m.created_at desc, m.id desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

create function public.get_my_chats() returns table (
  event_id uuid, title text, starts_at timestamptz, image_url text, going_count int,
  last_body text, last_author_name text, last_at timestamptz,
  unread_count int, is_open boolean
)
language sql stable security definer set search_path = '' as $$
  with me as (select (select auth.uid()) as uid)
  select
    e.id, e.title, e.starts_at, e.image_url,
    (select count(*)::int from public.rsvps g where g.event_id = e.id and g.status = 'going'
       and not public.is_blocked_between((select uid from me), g.user_id)),
    lm.body, lm.display_name, lm.created_at,
    (select count(*)::int from public.event_messages m
      where m.event_id = e.id
        and m.deleted_at is null
        and m.user_id <> (select uid from me)
        and not public.is_blocked_between((select uid from me), m.user_id)
        and m.created_at > coalesce(cr.last_read_at, '-infinity'::timestamptz)),
    public.chat_open(e.id)
  from public.rsvps r
  join public.events e on e.id = r.event_id and e.status = 'active'
  left join public.event_chat_reads cr on cr.event_id = e.id and cr.user_id = r.user_id
  left join lateral (
    select m.body, p.display_name, m.created_at
    from public.event_messages m
    join public.profiles p on p.id = m.user_id
    where m.event_id = e.id
      and m.deleted_at is null
      and not public.is_blocked_between((select uid from me), m.user_id)
    order by m.created_at desc, m.id desc
    limit 1
  ) lm on true
  where r.user_id = (select uid from me) and r.status = 'going'
  order by public.chat_open(e.id) desc, coalesce(lm.created_at, e.starts_at) desc;
$$;

revoke execute on function public.chat_open from public, anon;
revoke execute on function public.mark_chat_read from public, anon;
revoke execute on function public.get_chat_messages from public, anon;
revoke execute on function public.get_my_chats from public, anon;
grant execute on function public.chat_open to authenticated;
grant execute on function public.mark_chat_read to authenticated;
grant execute on function public.get_chat_messages to authenticated;
grant execute on function public.get_my_chats to authenticated;

-- Realtime applies RLS to postgres_changes subscribers. The local shim has no publication.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.event_messages;
  end if;
end $$;
