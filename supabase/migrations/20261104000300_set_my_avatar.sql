-- Profile photo: the app uploads to avatars/<uid>/<file> (storage RLS allows only that folder),
-- then calls this to point profiles.avatar_path at it. Taking the path through an RPC means nobody can
-- point their avatar at another person's file.

create or replace function public.set_my_avatar(p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_path is not null and (
    p_path not like v_uid::text || '/%'
    or char_length(p_path) > 200
    or p_path like '%..%'
    or p_path like v_uid::text || '/%/%'
  ) then
    raise exception 'avatar_path_invalid';
  end if;

  update public.profiles set avatar_path = p_path where id = v_uid;
  if not found then
    raise exception 'not_onboarded';
  end if;
end;
$$;

revoke execute on function public.set_my_avatar from public, anon;
grant execute on function public.set_my_avatar to authenticated;
