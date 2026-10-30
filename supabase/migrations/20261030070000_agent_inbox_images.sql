-- Agent submissions may include an event-specific HTTPS image URL for moderation and publishing.
alter table public.event_submissions
  add column image_url text,
  add constraint event_submissions_image_url_check check (
    image_url is null or (
      char_length(image_url) <= 2048
      and image_url ~* '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*)(:((0|[1-9][0-9]{0,3})|([1-5][0-9]{4})|(6[0-4][0-9]{3})|(65[0-4][0-9]{2})|(655[0-2][0-9])|(6553[0-5])))?([/?#][^[:space:][:cntrl:]]*)?$'
      and char_length(substring(lower(image_url) from '^https://([^/:?#]+)')) <= 253
      and substring(lower(image_url) from '^https://([^/:?#]+)') ~* '[a-z]'
      and position(chr(92) in image_url) = 0
    )
  );
