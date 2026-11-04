-- Settings > Blocked people. The "profiles visible unless blocked" policy hides people you blocked,
-- so the caller's own block list needs a definer function. It only ever returns the caller's blocks.
create function public.list_my_blocks()
returns table (id uuid, username text, display_name text, avatar_path text, blocked_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  return query
    select p.id, p.username, p.display_name, p.avatar_path, b.created_at
    from public.blocks b
    join public.profiles p on p.id = b.blocked_id
    where b.blocker_id = auth.uid()
    order by b.created_at desc;
end;
$$;
revoke execute on function public.list_my_blocks from public, anon;
grant execute on function public.list_my_blocks to authenticated;
