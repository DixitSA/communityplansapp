-- 1. Move policy helpers out of the exposed API schema. Public definer helpers with PUBLIC
--    execute let anyone with the anon key probe who is Going / friends / blocked.
create schema private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create function private.is_going(u uuid, e uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.rsvps where user_id = u and event_id = e and status = 'going');
$$;
create function private.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships
    where user_a = least(a, b) and user_b = greatest(a, b) and status = 'accepted'
  );
$$;
create function private.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;
create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
create function private.chat_open(e uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events ev
    where ev.id = e
      and ev.status = 'active'
      and now() < coalesce(ev.ends_at, ev.starts_at + interval '6 hours') + interval '48 hours'
  );
$$;
revoke execute on function private.is_going, private.are_friends, private.is_blocked_between,
  private.is_admin, private.chat_open from public, anon;
grant execute on function private.is_going, private.are_friends, private.is_blocked_between,
  private.is_admin, private.chat_open to authenticated, service_role;

-- Recreate every policy that used a public helper.
drop policy "profiles visible unless blocked" on public.profiles;
create policy "profiles visible unless blocked" on public.profiles for select to authenticated
  using (not private.is_blocked_between((select auth.uid()), id));

drop policy "interests visible unless blocked" on public.profile_interests;
create policy "interests visible unless blocked" on public.profile_interests for select to authenticated
  using (not private.is_blocked_between((select auth.uid()), profile_id));

drop policy "send friend request" on public.friendships;
create policy "send friend request" on public.friendships for insert to authenticated
  with check (
    requested_by = (select auth.uid())
    and status = 'pending'
    and not private.is_blocked_between(user_a, user_b)
  );

drop policy "active events are visible" on public.events;
drop policy "admins manage events" on public.events;
drop policy "admins manage event interests" on public.event_interests;
create policy "active events are visible" on public.events for select to authenticated
  using (status = 'active' or private.is_admin());
create policy "admins manage events" on public.events for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy "admins manage event interests" on public.event_interests for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

drop policy "rsvp visibility" on public.rsvps;
create policy "rsvp visibility" on public.rsvps for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      status = 'going'
      and not private.is_blocked_between((select auth.uid()), user_id)
      and (
        private.are_friends((select auth.uid()), user_id)
        or private.is_going((select auth.uid()), event_id)
      )
    )
  );

drop policy "chat read" on public.event_messages;
drop policy "chat post" on public.event_messages;
create policy "chat read" on public.event_messages for select to authenticated
  using (
    private.is_going((select auth.uid()), event_id)
    and not private.is_blocked_between((select auth.uid()), user_id)
  );
create policy "chat post" on public.event_messages for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and private.is_going((select auth.uid()), event_id)
    and private.chat_open(event_id)
  );

-- get_my_chats referenced public.chat_open; recreate it against private.*.
create or replace function public.get_my_chats() returns table (
  event_id uuid, title text, starts_at timestamptz, image_url text, going_count int,
  last_body text, last_author_name text, last_at timestamptz,
  unread_count int, is_open boolean
)
language sql stable security definer set search_path = '' as $$
  with me as (select (select auth.uid()) as uid)
  select
    e.id, e.title, e.starts_at, e.image_url,
    (select count(*)::int from public.rsvps g where g.event_id = e.id and g.status = 'going'
       and not private.is_blocked_between((select uid from me), g.user_id)),
    lm.body, lm.display_name, lm.created_at,
    (select count(*)::int from public.event_messages m
      where m.event_id = e.id
        and m.deleted_at is null
        and m.user_id <> (select uid from me)
        and not private.is_blocked_between((select uid from me), m.user_id)
        and m.created_at > coalesce(cr.last_read_at, '-infinity'::timestamptz)),
    private.chat_open(e.id)
  from public.rsvps r
  join public.events e on e.id = r.event_id and e.status = 'active'
  left join public.event_chat_reads cr on cr.event_id = e.id and cr.user_id = r.user_id
  left join lateral (
    select m.body, p.display_name, m.created_at
    from public.event_messages m
    join public.profiles p on p.id = m.user_id
    where m.event_id = e.id
      and m.deleted_at is null
      and not private.is_blocked_between((select uid from me), m.user_id)
    order by m.created_at desc, m.id desc
    limit 1
  ) lm on true
  where r.user_id = (select uid from me) and r.status = 'going'
  order by private.chat_open(e.id) desc, coalesce(lm.created_at, e.starts_at) desc;
$$;

-- Nothing public depends on the old helpers any more (definer RPCs/triggers still call
-- the public are_friends internally, which the owner can still execute).
revoke execute on function public.is_going(uuid, uuid), public.are_friends(uuid, uuid),
  public.is_blocked_between(uuid, uuid), public.is_admin(), public.chat_open(uuid)
  from public, anon, authenticated;

-- 2. Body rule: whitespace-only (incl. newlines) rejected, hard 2000-char cap.
alter table public.event_messages drop constraint event_messages_check;
alter table public.event_messages add constraint event_messages_body_check check (
  (deleted_at is null and char_length(body) <= 2000 and body ~ '\S')
  or (deleted_at is not null and body is null)
);

-- Soft delete stamps the time server-side (no backdating).
create or replace function public.event_messages_on_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then
    raise exception 'message_deleted' using errcode = '42501';
  end if;
  if new.deleted_at is not null and old.deleted_at is null then
    new.deleted_at := now();
  end if;
  if new.deleted_at is not null then
    new.body = null;
  end if;
  return new;
end;
$$;

-- Flood throttle: at most 30 messages per user per event per minute.
create index event_messages_user_created_idx on public.event_messages (user_id, created_at);
create function public.event_messages_rate_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.event_messages m
      where m.user_id = new.user_id and m.event_id = new.event_id
        and m.created_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger event_messages_rate_limit before insert on public.event_messages
  for each row execute function public.event_messages_rate_limit();

-- Keyset pagination by id.
drop function public.get_chat_messages(uuid, timestamptz, int);
create function public.get_chat_messages(
  p_event_id uuid, p_before_id bigint default null, p_limit int default 50
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
    and (p_before_id is null or m.id < p_before_id)
  order by m.id desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;
revoke execute on function public.get_chat_messages from public, anon;
grant execute on function public.get_chat_messages to authenticated;
