-- Edit profile: one RPC changes the caller's own name, username, bio and interests atomically.
-- Photos are not handled here (avatar_path is untouched).

create or replace function public.update_my_profile(
  p_display_name text,
  p_username text,
  p_bio text,
  p_interest_ids smallint[]
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
  v_bio text := nullif(btrim(coalesce(p_bio, '')), '');
  v_interests smallint[];
  v_c text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'not_onboarded';
  end if;
  if v_username is null or v_username !~ '^[a-z0-9][a-z0-9_.]{2,19}$' then
    raise exception 'username_invalid';
  end if;
  if exists (select 1 from public.profiles where username = v_username and id <> v_uid) then
    raise exception 'username_taken';
  end if;
  if v_name is null or char_length(v_name) not between 1 and 50 then
    raise exception 'display_name_invalid';
  end if;
  if v_bio is not null and char_length(v_bio) > 160 then
    raise exception 'bio_invalid';
  end if;

  select coalesce(array_agg(i.id), '{}') into v_interests
  from public.interests i
  where i.id = any (coalesce(p_interest_ids, '{}'));
  if cardinality(v_interests) < 3 then
    raise exception 'too_few_interests';
  end if;

  begin
    update public.profiles
       set username = v_username, display_name = v_name, bio = v_bio
     where id = v_uid;
  exception when unique_violation then
    get stacked diagnostics v_c = constraint_name;
    if v_c = 'profiles_username_key' then
      raise exception 'username_taken';
    end if;
    raise;
  end;

  delete from public.profile_interests
   where profile_id = v_uid and interest_id <> all (v_interests);
  insert into public.profile_interests (profile_id, interest_id)
  select v_uid, unnest(v_interests)
  on conflict do nothing;
end;
$$;

revoke execute on function public.update_my_profile from public, anon;
grant execute on function public.update_my_profile to authenticated;
