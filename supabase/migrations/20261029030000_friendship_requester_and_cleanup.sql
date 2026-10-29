-- Defense in depth for friend requests: the policy itself now requires the requester to be one of
-- the two users (the table's CHECK already enforced this; policies shouldn't rely on it).
drop policy "send friend request" on public.friendships;
create policy "send friend request" on public.friendships for insert to authenticated
  with check (
    requested_by = (select auth.uid())
    and requested_by in (user_a, user_b)
    and status = 'pending'
    and not private.is_blocked_between(user_a, user_b)
  );

-- The public copies of these helpers were revoked in 20261029020000 and nothing calls them any more
-- (policies use private.*). public.are_friends stays: definer RPCs and the RSVP trigger use it.
drop function public.is_going(uuid, uuid);
drop function public.is_blocked_between(uuid, uuid);
drop function public.is_admin();
drop function public.chat_open(uuid);
