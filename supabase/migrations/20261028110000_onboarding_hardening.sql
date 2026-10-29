-- Onboarding hardening: RPC is the only way to create profiles; stricter username rule.

-- 1. Close the direct-insert bypass of the 18+ gate.
drop policy "create own profile" on public.profiles;
revoke insert on public.profiles from authenticated;

drop policy "own private profile" on public.profiles_private;
create policy "read own private profile" on public.profiles_private for select to authenticated
  using (id = (select auth.uid()));
create policy "update own private profile" on public.profiles_private for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert on public.profiles_private from authenticated;

-- 2. Username must start with [a-z0-9].
alter table public.profiles drop constraint profiles_username_check;
alter table public.profiles add constraint profiles_username_check
  check (username ~ '^[a-z0-9][a-z0-9_.]{2,19}$');

create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(lower(p_username) ~ '^[a-z0-9][a-z0-9_.]{2,19}$', false)
    and not exists (
      select 1 from public.profiles p where p.username = lower(p_username)
    );
$$;

create or replace function public.complete_onboarding(
  p_username text,
  p_display_name text,
  p_birthdate date,
  p_interest_ids smallint[],
  p_home_city_id smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_username text := lower(p_username);
  v_name text := btrim(p_display_name);
  v_interests smallint[];
  v_c text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'already_onboarded';
  end if;
  if v_username is null or v_username !~ '^[a-z0-9][a-z0-9_.]{2,19}$' then
    raise exception 'username_invalid';
  end if;
  if exists (select 1 from public.profiles where username = v_username) then
    raise exception 'username_taken';
  end if;
  if v_name is null or char_length(v_name) not between 1 and 50 then
    raise exception 'display_name_invalid';
  end if;
  if p_birthdate is null
     or p_birthdate < date '1900-01-01'
     or p_birthdate > (current_date - interval '18 years') then
    raise exception 'must_be_18';
  end if;

  select coalesce(array_agg(i.id), '{}') into v_interests
  from public.interests i
  where i.id = any (coalesce(p_interest_ids, '{}'));
  if cardinality(v_interests) < 3 then
    raise exception 'too_few_interests';
  end if;

  if p_home_city_id is null
     or not exists (select 1 from public.cities where id = p_home_city_id) then
    raise exception 'city_invalid';
  end if;

  begin
    insert into public.profiles (id, username, display_name, home_city_id)
    values (v_uid, v_username, v_name, p_home_city_id);

    insert into public.profiles_private (id, birthdate)
    values (v_uid, p_birthdate);

    insert into public.profile_interests (profile_id, interest_id)
    select v_uid, unnest(v_interests);
  exception when unique_violation then
    get stacked diagnostics v_c = constraint_name;
    if v_c = 'profiles_username_key' then
      raise exception 'username_taken';
    end if;
    raise exception 'already_onboarded';
  end;
end;
$$;
