-- "Suggest an event": users submit events (e.g. spotted on Instagram) for admin review in Studio.
-- Clients can only read their own submissions; inserts go through submit_event().

create type public.submission_status as enum ('pending', 'approved', 'rejected');

create table public.event_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  city_id smallint not null references public.cities (id),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  link text check (link ~ '^https://[^[:space:]]+$' and char_length(link) <= 500),
  starts_at timestamptz not null,
  venue text check (char_length(venue) <= 120),
  details text check (char_length(details) <= 1000),
  status public.submission_status not null default 'pending',
  admin_note text,
  reviewed_at timestamptz,
  event_id uuid references public.events (id) on delete set null, -- filled when an admin publishes it
  created_at timestamptz not null default now()
);
create index event_submissions_user_idx on public.event_submissions (submitted_by, created_at);

alter table public.event_submissions enable row level security;

create policy "see own submissions" on public.event_submissions for select to authenticated
  using (submitted_by = (select auth.uid()));
create policy "admins see submissions" on public.event_submissions for select to authenticated
  using (private.is_admin());
create policy "admins review submissions" on public.event_submissions for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

revoke all on public.event_submissions from anon, authenticated;
grant select on public.event_submissions to authenticated;
grant update (status, admin_note, reviewed_at, event_id) on public.event_submissions to authenticated;

create function public.submit_event(
  p_city_id smallint,
  p_title text,
  p_link text,
  p_starts_at timestamptz,
  p_venue text,
  p_details text
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_link text := nullif(btrim(coalesce(p_link, '')), '');
  v_venue text := nullif(btrim(coalesce(p_venue, '')), '');
  v_details text := nullif(btrim(coalesce(p_details, '')), '');
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'not_onboarded';
  end if;
  if char_length(v_title) not between 1 and 120 then
    raise exception 'title_invalid';
  end if;
  if v_link is not null and (v_link !~ '^https://[^[:space:]]+$' or char_length(v_link) > 500) then
    raise exception 'link_invalid';
  end if;
  if p_starts_at is null or p_starts_at <= now() - interval '1 hour' or p_starts_at >= now() + interval '365 days' then
    raise exception 'starts_at_invalid';
  end if;
  if p_city_id is null or not exists (select 1 from public.cities where id = p_city_id) then
    raise exception 'city_invalid';
  end if;
  if char_length(v_venue) > 120 then
    raise exception 'venue_invalid';
  end if;
  if char_length(v_details) > 1000 then
    raise exception 'details_invalid';
  end if;
  if (select count(*) from public.event_submissions
      where submitted_by = v_uid and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'rate_limited';
  end if;

  insert into public.event_submissions (submitted_by, city_id, title, link, starts_at, venue, details)
  values (v_uid, p_city_id, v_title, v_link, p_starts_at, v_venue, v_details)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.submit_event from public, anon;
grant execute on function public.submit_event to authenticated;
