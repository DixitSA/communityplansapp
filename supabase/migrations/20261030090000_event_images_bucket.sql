-- Permanent copies of agent-submitted event images (Instagram/CDN links expire).
-- Public bucket = public reads. There are deliberately NO policies on storage.objects for this bucket:
-- anon and authenticated cannot write; only the service role (the agent-inbox function) uploads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('event-images', 'event-images', true, 5242880, '{image/jpeg,image/png,image/webp,image/gif}')
  on conflict (id) do nothing; -- the size/type limits are a second line of defence behind the function's own checks
