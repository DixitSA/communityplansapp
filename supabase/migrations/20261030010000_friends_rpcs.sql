-- Friends: search, request/accept/decline/remove, lists and a privacy-safe profile view.
-- All writes go through these definer RPCs; the table policies stay as the second line of defense.
-- Nothing here reads profiles_private or any non-Going RSVP.

-- Friendship state between the caller and another user, as the client sees it.
-- (Inlined in each function below; documented here once.)
--   none | friends | outgoing (caller sent) | incoming (they sent) | self (get_profile only)

-- Rate limits for new friend requests live in a trigger so direct table inserts are covered too.
-- Counted from friend_request notifications (actor = requester, user = recipient), which survive
-- cancel/decline deleting the friendship row.
create index notifications_friend_request_actor_idx on public.notifications (actor_id, created_at)
  where type = 'friend_request';

create function public.friendships_rate_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_other uuid := case when new.requested_by = new.user_a then new.user_b else new.user_a end;
begin
  if (select count(*) from public.notifications
      where type = 'friend_request' and actor_id = new.requested_by
        and created_at > now() - interval '24 hours') >= 30
     or (select count(*) from public.notifications
      where type = 'friend_request' and actor_id = new.requested_by and user_id = v_other
        and created_at > now() - interval '7 days') >= 3 then
    raise exception 'rate_limited';
  end if;
  return new;
end;
$$;
revoke execute on function public.friendships_rate_limit from public, anon, authenticated;

create trigger friendships_rate_limit before insert on public.friendships
  for each row execute function public.friendships_rate_limit();

create function public.search_profiles(p_query text, p_limit integer default 20)
returns table (id uuid, username text, display_name text, avatar_path text, friendship text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_q text;
  v_esc text;
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 20));
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  v_q := btrim(coalesce(p_query, ''));
  if left(v_q, 1) = '@' then
    v_q := btrim(substr(v_q, 2));
  end if;
  if char_length(v_q) > 30 then
    raise exception 'query_invalid';
  end if;
  if char_length(v_q) < 2 then
    return;
  end if;
  -- Escape LIKE wildcards so '%' and '_' are matched literally.
  v_esc := replace(replace(replace(lower(v_q), '\', '\\'), '%', '\%'), '_', '\_');

  return query
  select p.id, p.username, p.display_name, p.avatar_path,
    case
      when f.user_a is null then 'none'
      when f.status = 'accepted' then 'friends'
      when f.requested_by = v_uid then 'outgoing'
      else 'incoming'
    end
  from public.profiles p
  left join public.friendships f
    on f.user_a = least(v_uid, p.id) and f.user_b = greatest(v_uid, p.id)
  where p.id <> v_uid
    and not private.is_blocked_between(v_uid, p.id)
    and (p.username like v_esc || '%' escape '\' or lower(p.display_name) like '%' || v_esc || '%' escape '\')
  order by (p.username = lower(v_q)) desc, (f.status = 'accepted') desc nulls last, p.username
  limit v_limit;
end;
$$;

create function public.send_friend_request(p_user uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_a uuid;
  v_b uuid;
  v_f public.friendships;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'not_onboarded';
  end if;
  if p_user is null or p_user = v_uid then
    raise exception 'cannot_friend_self';
  end if;
  -- Same error for "no such user" and "blocked either way": don't reveal blocks.
  if not exists (select 1 from public.profiles where id = p_user)
     or private.is_blocked_between(v_uid, p_user) then
    raise exception 'user_not_found';
  end if;
  v_a := least(v_uid, p_user);
  v_b := greatest(v_uid, p_user);

  select * into v_f from public.friendships where user_a = v_a and user_b = v_b;
  if found then
    if v_f.status = 'accepted' then
      raise exception 'already_friends';
    elsif v_f.requested_by = v_uid then
      raise exception 'request_pending';
    end if;
    -- They already asked us: accepting is the obvious intent.
    update public.friendships set status = 'accepted' where user_a = v_a and user_b = v_b;
    return 'friends';
  end if;

  begin
    insert into public.friendships (user_a, user_b, requested_by, status)
    values (v_a, v_b, v_uid, 'pending');
  exception when unique_violation then
    -- Two users requested each other at the same moment: re-read and take the existing-row path.
    select * into v_f from public.friendships where user_a = v_a and user_b = v_b;
    if v_f.status = 'accepted' then
      return 'friends';
    elsif v_f.requested_by = v_uid then
      return 'outgoing';
    end if;
    update public.friendships set status = 'accepted' where user_a = v_a and user_b = v_b;
    return 'friends';
  end;
  return 'outgoing';
end;
$$;

create function public.respond_friend_request(p_user uuid, p_accept boolean)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_a uuid;
  v_b uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_user is null or p_accept is null then
    raise exception 'request_not_found';
  end if;
  v_a := least(v_uid, p_user);
  v_b := greatest(v_uid, p_user);
  -- Only the recipient (not the requester) of a pending request may respond.
  if not exists (
    select 1 from public.friendships
    where user_a = v_a and user_b = v_b and status = 'pending' and requested_by = p_user
  ) then
    raise exception 'request_not_found';
  end if;
  if p_accept then
    update public.friendships set status = 'accepted' where user_a = v_a and user_b = v_b;
    return 'friends';
  end if;
  delete from public.friendships where user_a = v_a and user_b = v_b;
  return 'none';
end;
$$;

-- Unfriend, or cancel an outgoing request. (Declining an incoming one is respond_friend_request.)
create function public.remove_friend(p_user uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  delete from public.friendships
  where user_a = least(v_uid, p_user) and user_b = greatest(v_uid, p_user);
end;
$$;

create function public.list_friends()
returns table (id uuid, username text, display_name text, avatar_path text, since timestamptz)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  return query
  select p.id, p.username, p.display_name, p.avatar_path, coalesce(f.accepted_at, f.created_at)
  from public.friendships f
  join public.profiles p on p.id = case when f.user_a = v_uid then f.user_b else f.user_a end
  where v_uid in (f.user_a, f.user_b)
    and f.status = 'accepted'
    and not private.is_blocked_between(v_uid, p.id)
  order by lower(p.display_name), p.username;
end;
$$;

create function public.list_friend_requests()
returns table (id uuid, username text, display_name text, avatar_path text, direction text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  return query
  select p.id, p.username, p.display_name, p.avatar_path,
    case when f.requested_by = v_uid then 'outgoing' else 'incoming' end,
    f.created_at
  from public.friendships f
  join public.profiles p on p.id = case when f.user_a = v_uid then f.user_b else f.user_a end
  where v_uid in (f.user_a, f.user_b)
    and f.status = 'pending'
    and not private.is_blocked_between(v_uid, p.id)
  order by f.created_at desc;
end;
$$;

-- Profile page: public profile fields plus counts and past events you both went to.
-- Friend lists are never returned, only counts. friend_count has no block filter on purpose:
-- filtering would let a second account infer a block by comparing counts.
create function public.get_profile(p_user uuid)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  bio text,
  friendship text,
  friend_count integer,
  mutual_friend_count integer,
  shared_events jsonb
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_user is null or (p_user <> v_uid and private.is_blocked_between(v_uid, p_user)) then
    return;
  end if;
  return query
  select p.id, p.username, p.display_name, p.avatar_path, p.bio,
    case
      when p.id = v_uid then 'self'
      when f.user_a is null then 'none'
      when f.status = 'accepted' then 'friends'
      when f.requested_by = v_uid then 'outgoing'
      else 'incoming'
    end,
    (
      select count(*)::integer
      from public.friendships ff
      where p.id in (ff.user_a, ff.user_b) and ff.status = 'accepted'
    ),
    case when p.id = v_uid then 0 else (
      select count(*)::integer
      from public.friendships f1
      join public.friendships f2
        on case when f1.user_a = v_uid then f1.user_b else f1.user_a end
         = case when f2.user_a = p.id then f2.user_b else f2.user_a end
      where v_uid in (f1.user_a, f1.user_b) and f1.status = 'accepted'
        and p.id in (f2.user_a, f2.user_b) and f2.status = 'accepted'
        and not private.is_blocked_between(v_uid, case when f1.user_a = v_uid then f1.user_b else f1.user_a end)
    ) end,
    case when p.id = v_uid then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'starts_at', x.starts_at)
        order by x.starts_at desc), '[]'::jsonb)
      from (
        select e.id, e.title, e.starts_at
        from public.events e
        join public.rsvps r1 on r1.event_id = e.id and r1.user_id = v_uid and r1.status = 'going'
        join public.rsvps r2 on r2.event_id = e.id and r2.user_id = p.id and r2.status = 'going'
        where e.starts_at < now() and e.status = 'active'
        order by e.starts_at desc
        limit 10
      ) x
    ) end
  from public.profiles p
  left join public.friendships f
    on f.user_a = least(v_uid, p.id) and f.user_b = greatest(v_uid, p.id)
  where p.id = p_user;
end;
$$;

revoke execute on function public.search_profiles from public, anon;
revoke execute on function public.send_friend_request from public, anon;
revoke execute on function public.respond_friend_request from public, anon;
revoke execute on function public.remove_friend from public, anon;
revoke execute on function public.list_friends from public, anon;
revoke execute on function public.list_friend_requests from public, anon;
revoke execute on function public.get_profile from public, anon;
grant execute on function public.search_profiles to authenticated;
grant execute on function public.send_friend_request to authenticated;
grant execute on function public.respond_friend_request to authenticated;
grant execute on function public.remove_friend to authenticated;
grant execute on function public.list_friends to authenticated;
grant execute on function public.list_friend_requests to authenticated;
grant execute on function public.get_profile to authenticated;
