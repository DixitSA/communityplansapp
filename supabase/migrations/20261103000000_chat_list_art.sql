-- The chat list draws each event's picture like the rest of the app: flagged images stay blurred
-- (image_sensitive), and events without an image get their category's stock photo (interest_ids).
-- The return type grows, so the function is dropped and recreated with the same grants.
drop function public.get_my_chats();

create function public.get_my_chats() returns table (
  event_id uuid, title text, starts_at timestamptz, image_url text, going_count int,
  last_body text, last_author_name text, last_at timestamptz,
  unread_count int, is_open boolean,
  image_sensitive boolean, interest_ids smallint[]
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
    private.chat_open(e.id),
    e.image_sensitive,
    array(select ei.interest_id from public.event_interests ei where ei.event_id = e.id order by ei.interest_id)
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

revoke execute on function public.get_my_chats from public, anon;
grant execute on function public.get_my_chats to authenticated;
