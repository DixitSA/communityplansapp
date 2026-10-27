-- Initial schema: cities, interests, profiles, friendships, blocks, events,
-- RSVPs, notifications, device tokens, reports, plus the RLS privacy rules.
--
-- Privacy invariants (see docs/DATA_MODEL.md):
--   * "interested" and "down_if_friends" RSVPs are visible only to their owner.
--   * "going" RSVPs are visible to the owner's friends and to other people who
--     are also going to the same event. Blocks override both.
--   * Aggregates (going counts) are exposed only through RPCs.

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.rsvp_status as enum ('interested', 'down_if_friends', 'going');
create type public.event_source as enum ('ticketmaster', 'seatgeek', 'curated');
create type public.friendship_status as enum ('pending', 'accepted');

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

create table public.cities (
  id smallint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  timezone text not null,
  center extensions.geography(point, 4326) not null,
  radius_m integer not null
);

insert into public.cities (slug, name, timezone, center, radius_m) values
  ('charlotte', 'Charlotte, NC', 'America/New_York',
   extensions.st_setsrid(extensions.st_makepoint(-80.8431, 35.2271), 4326)::extensions.geography,
   80467); -- 50 mi

create table public.interests (
  id smallint generated always as identity primary key,
  slug text not null unique,
  label text not null,
  symbol text not null, -- SF Symbol name used by the iOS client
  sort smallint not null default 0
);

insert into public.interests (slug, label, symbol, sort) values
  ('nightlife',    'Nightlife',      'moon.stars.fill',          1),
  ('music',        'Music',          'music.note',               2),
  ('food_drinks',  'Food & Drinks',  'fork.knife',               3),
  ('fitness',      'Fitness',        'figure.run',               4),
  ('arts_culture', 'Arts & Culture', 'paintpalette.fill',        5),
  ('sports',       'Sports',         'sportscourt.fill',         6),
  ('wellness',     'Wellness',       'leaf.fill',                7),
  ('outdoor',      'Outdoor',        'sun.max.fill',             8),
  ('community',    'Community',      'person.3.fill',            9),
  ('tech',         'Tech',           'laptopcomputer',          10),
  ('fashion',      'Fashion',        'tshirt.fill',             11),
  ('comedy',       'Comedy',         'theatermasks.fill',       12);

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 50),
  bio text check (char_length(bio) <= 160),
  avatar_path text,
  home_city_id smallint references public.cities (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Never readable by other users.
create table public.profiles_private (
  id uuid primary key references public.profiles (id) on delete cascade,
  birthdate date not null check (birthdate <= (current_date - interval '18 years')),
  phone_hmac text unique, -- HMAC(pepper, sha256(E.164 phone)); written by the match-contacts function only
  discoverable_by_phone boolean not null default true,
  created_at timestamptz not null default now()
);

-- Managed from Supabase Studio / service role only. No client policies.
create table public.admins (
  user_id uuid primary key references public.profiles (id) on delete cascade
);

create table public.profile_interests (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  interest_id smallint not null references public.interests (id) on delete cascade,
  primary key (profile_id, interest_id)
);

-- One row per pair, stored with user_a < user_b.
create table public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (user_a, user_b),
  check (user_a < user_b),
  check (requested_by in (user_a, user_b))
);
create index friendships_user_b_idx on public.friendships (user_b);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  source public.event_source not null,
  external_id text,
  city_id smallint not null references public.cities (id),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue_name text,
  venue_address text,
  neighborhood text,
  location extensions.geography(point, 4326) not null,
  image_url text,
  is_free boolean not null default false,
  price_min numeric(10, 2),
  price_max numeric(10, 2),
  currency text not null default 'USD',
  ticket_url text,
  attribution text, -- e.g. "Tickets on Ticketmaster"; required by some providers
  status text not null default 'active' check (status in ('active', 'cancelled', 'hidden')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);
create index events_location_idx on public.events using gist (location);
create index events_city_starts_idx on public.events (city_id, starts_at);

create table public.event_interests (
  event_id uuid not null references public.events (id) on delete cascade,
  interest_id smallint not null references public.interests (id) on delete cascade,
  primary key (event_id, interest_id)
);
create index event_interests_interest_idx on public.event_interests (interest_id);

-- One plan per user per event; "change anytime" means status is updated in place.
create table public.rsvps (
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  status public.rsvp_status not null,
  friend_alert_sent_at timestamptz, -- set when a "down if friends go" alert fired
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
create index rsvps_event_status_idx on public.rsvps (event_id, status);

-- ---------------------------------------------------------------------------
-- Notifications, push, moderation
-- ---------------------------------------------------------------------------

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('friend_going', 'friend_request', 'friend_accepted', 'event_update')),
  event_id uuid references public.events (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete cascade,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.device_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  environment text not null check (environment in ('sandbox', 'production')),
  updated_at timestamptz not null default now()
);

create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('user', 'event', 'message')),
  target_id text not null,
  reason text not null check (char_length(reason) <= 1000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so RLS policies can call them without recursion)
-- ---------------------------------------------------------------------------

create function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships
    where user_a = least(a, b) and user_b = greatest(a, b) and status = 'accepted'
  );
$$;

create function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

create function public.is_going(u uuid, e uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.rsvps where user_id = u and event_id = e and status = 'going'
  );
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();
create trigger rsvps_touch before update on public.rsvps
  for each row execute function public.touch_updated_at();

-- "Down if friends go": the first friend who commits fires one alert per waiting user.
create function public.handle_rsvp_going() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'going' and (tg_op = 'INSERT' or old.status is distinct from 'going') then
    with alerted as (
      update public.rsvps r
      set friend_alert_sent_at = now()
      where r.event_id = new.event_id
        and r.status = 'down_if_friends'
        and r.friend_alert_sent_at is null
        and r.user_id <> new.user_id
        and public.are_friends(r.user_id, new.user_id)
      returning r.user_id
    )
    insert into public.notifications (user_id, type, event_id, actor_id)
    select user_id, 'friend_going', new.event_id, new.user_id from alerted;
  end if;
  return new;
end;
$$;

create trigger rsvps_going after insert or update of status on public.rsvps
  for each row execute function public.handle_rsvp_going();

-- Re-arm the alert whenever someone switches (back) to "down if friends go".
create function public.rearm_friend_alert() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'down_if_friends' and old.status is distinct from 'down_if_friends' then
    new.friend_alert_sent_at = null;
  end if;
  return new;
end;
$$;

create trigger rsvps_rearm before update of status on public.rsvps
  for each row execute function public.rearm_friend_alert();

create function public.handle_friendship_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  other uuid;
begin
  if tg_op = 'INSERT' then
    other := case when new.requested_by = new.user_a then new.user_b else new.user_a end;
    insert into public.notifications (user_id, type, actor_id)
    values (other, 'friend_request', new.requested_by);
  elsif new.status = 'accepted' and old.status = 'pending' then
    other := case when new.requested_by = new.user_a then new.user_b else new.user_a end;
    insert into public.notifications (user_id, type, actor_id)
    values (new.requested_by, 'friend_accepted', other);
  end if;
  return new;
end;
$$;

create trigger friendships_notify after insert or update of status on public.friendships
  for each row execute function public.handle_friendship_change();

-- Accepting stamps accepted_at; clients only send status.
create function public.stamp_friendship_accept() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'accepted' and old.status = 'pending' then
    new.accepted_at = now();
  end if;
  return new;
end;
$$;

create trigger friendships_stamp before update of status on public.friendships
  for each row execute function public.stamp_friendship_accept();

-- Blocking someone removes any friendship between the two users.
create function public.handle_block() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.friendships
  where user_a = least(new.blocker_id, new.blocked_id)
    and user_b = greatest(new.blocker_id, new.blocked_id);
  return new;
end;
$$;

create trigger blocks_unfriend after insert on public.blocks
  for each row execute function public.handle_block();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.cities enable row level security;
alter table public.interests enable row level security;
alter table public.profiles enable row level security;
alter table public.profiles_private enable row level security;
alter table public.admins enable row level security;
alter table public.profile_interests enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.events enable row level security;
alter table public.event_interests enable row level security;
alter table public.rsvps enable row level security;
alter table public.notifications enable row level security;
alter table public.device_tokens enable row level security;
alter table public.reports enable row level security;

create policy "cities are public" on public.cities for select to anon, authenticated using (true);
create policy "interests are public" on public.interests for select to anon, authenticated using (true);

create policy "profiles visible unless blocked" on public.profiles for select to authenticated
  using (not public.is_blocked_between((select auth.uid()), id));
create policy "create own profile" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy "update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "own private profile" on public.profiles_private for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- phone_hmac is written by the match-contacts Edge Function (service role) only.
revoke insert, update on public.profiles_private from authenticated;
grant insert (id, birthdate, discoverable_by_phone) on public.profiles_private to authenticated;
grant update (discoverable_by_phone) on public.profiles_private to authenticated;

create policy "interests visible unless blocked" on public.profile_interests for select to authenticated
  using (not public.is_blocked_between((select auth.uid()), profile_id));
create policy "manage own interests" on public.profile_interests for insert to authenticated
  with check (profile_id = (select auth.uid()));
create policy "remove own interests" on public.profile_interests for delete to authenticated
  using (profile_id = (select auth.uid()));

create policy "see own friendships" on public.friendships for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));
create policy "send friend request" on public.friendships for insert to authenticated
  with check (
    requested_by = (select auth.uid())
    and status = 'pending'
    and not public.is_blocked_between(user_a, user_b)
  );
create policy "accept friend request" on public.friendships for update to authenticated
  using ((select auth.uid()) in (user_a, user_b) and requested_by <> (select auth.uid()) and status = 'pending')
  with check (status = 'accepted');
create policy "remove friendship" on public.friendships for delete to authenticated
  using ((select auth.uid()) in (user_a, user_b));
revoke update on public.friendships from authenticated;
grant update (status) on public.friendships to authenticated;

create policy "see own blocks" on public.blocks for select to authenticated
  using (blocker_id = (select auth.uid()));
create policy "block" on public.blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));
create policy "unblock" on public.blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

create policy "active events are visible" on public.events for select to authenticated
  using (status = 'active' or public.is_admin());
create policy "admins manage events" on public.events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "event interests are visible" on public.event_interests for select to authenticated using (true);
create policy "admins manage event interests" on public.event_interests for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- The core privacy rule.
create policy "rsvp visibility" on public.rsvps for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      status = 'going'
      and not public.is_blocked_between((select auth.uid()), user_id)
      and (
        public.are_friends((select auth.uid()), user_id)
        or public.is_going((select auth.uid()), event_id)
      )
    )
  );
create policy "create own rsvp" on public.rsvps for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "update own rsvp" on public.rsvps for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete own rsvp" on public.rsvps for delete to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update on public.rsvps from authenticated;
grant insert (user_id, event_id, status) on public.rsvps to authenticated;
grant update (status) on public.rsvps to authenticated;

create policy "own notifications" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "mark own notifications read" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "own device tokens" on public.device_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "file reports" on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Shared by the feed list and the map ("Feed and map use the same filters").
-- p_mode: 'nearby' (everything in range) or 'friends' (only events with a friend going).
-- p_price: 'any' | 'free' | 'paid'.
create function public.get_feed(
  p_city_id smallint,
  p_day date,
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 16093,
  p_interest_ids smallint[] default null,
  p_price text default 'any',
  p_mode text default 'nearby'
)
returns table (
  id uuid,
  title text,
  starts_at timestamptz,
  venue_name text,
  neighborhood text,
  image_url text,
  is_free boolean,
  price_min numeric,
  lat double precision,
  lng double precision,
  distance_m double precision,
  interest_ids smallint[],
  going_count bigint,
  friends_going jsonb,
  my_status public.rsvp_status,
  score double precision
)
language sql stable security definer set search_path = '' as $$
  with
  params as (
    select
      auth.uid() as uid,
      extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as origin,
      (p_day::timestamp at time zone c.timezone) as day_start,
      ((p_day + 1)::timestamp at time zone c.timezone) as day_end
    from public.cities c
    where c.id = p_city_id
  ),
  base as (
    select
      e.*,
      extensions.st_distance(e.location, p.origin) as dist,
      array(select ei.interest_id from public.event_interests ei where ei.event_id = e.id) as ints
    from public.events e, params p
    where e.city_id = p_city_id
      and e.status = 'active'
      and e.starts_at >= p.day_start
      and e.starts_at < p.day_end
      and extensions.st_dwithin(e.location, p.origin, p_radius_m)
      and (p_price = 'any' or (p_price = 'free' and e.is_free) or (p_price = 'paid' and not e.is_free))
      and (
        p_interest_ids is null
        or exists (
          select 1 from public.event_interests ei
          where ei.event_id = e.id and ei.interest_id = any (p_interest_ids)
        )
      )
  ),
  social as (
    select
      b.*,
      (select count(*) from public.rsvps r where r.event_id = b.id and r.status = 'going') as going,
      (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', pr.id, 'display_name', pr.display_name, 'avatar_path', pr.avatar_path)), '[]'::jsonb)
        from public.rsvps r
        join public.profiles pr on pr.id = r.user_id
        where r.event_id = b.id
          and r.status = 'going'
          and public.are_friends((select uid from params), r.user_id)
      ) as friends,
      (select r.status from public.rsvps r where r.event_id = b.id and r.user_id = (select uid from params)) as mine,
      exists (
        select 1 from public.profile_interests pi
        where pi.profile_id = (select uid from params) and pi.interest_id = any (b.ints)
      ) as matches_interest
    from base b
  )
  select
    s.id, s.title, s.starts_at, s.venue_name, s.neighborhood, s.image_url, s.is_free, s.price_min,
    extensions.st_y(s.location::extensions.geometry), extensions.st_x(s.location::extensions.geometry),
    s.dist, s.ints, s.going, s.friends, s.mine,
    -- v1 ranking: friends going > interest match > proximity > social proof.
    3.0 * ln(1 + jsonb_array_length(s.friends))
      + 2.0 * (case when s.matches_interest then 1 else 0 end)
      + 1.0 * (1 - least(s.dist / greatest(p_radius_m, 1), 1))
      + 0.5 * ln(1 + s.going)
      as score
  from social s
  where p_mode = 'nearby' or jsonb_array_length(s.friends) > 0
  order by score desc, s.starts_at;
$$;

-- Social context for the event detail page.
create function public.get_event_social(p_event_id uuid)
returns table (going_count bigint, friends_going jsonb, my_status public.rsvp_status)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.rsvps r where r.event_id = p_event_id and r.status = 'going'),
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', pr.id, 'display_name', pr.display_name, 'avatar_path', pr.avatar_path)), '[]'::jsonb)
      from public.rsvps r
      join public.profiles pr on pr.id = r.user_id
      where r.event_id = p_event_id and r.status = 'going' and public.are_friends(auth.uid(), r.user_id)
    ),
    (select r.status from public.rsvps r where r.event_id = p_event_id and r.user_id = auth.uid());
$$;

-- The one way clients change their plan. p_status = null clears it.
create function public.set_rsvp(p_event_id uuid, p_status public.rsvp_status)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_status is null then
    delete from public.rsvps where user_id = auth.uid() and event_id = p_event_id;
  else
    if not exists (select 1 from public.events where id = p_event_id and status = 'active') then
      raise exception 'event not available';
    end if;
    insert into public.rsvps (user_id, event_id, status)
    values (auth.uid(), p_event_id, p_status)
    on conflict (user_id, event_id) do update set status = excluded.status
    where public.rsvps.status is distinct from excluded.status;
  end if;
end;
$$;

revoke execute on function public.get_feed from public, anon;
revoke execute on function public.get_event_social from public, anon;
revoke execute on function public.set_rsvp from public, anon;
grant execute on function public.get_feed to authenticated;
grant execute on function public.get_event_social to authenticated;
grant execute on function public.set_rsvp to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: avatars/<user_id>/<file>
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

create policy "upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "replace own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "delete own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
