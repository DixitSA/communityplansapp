-- The event page's tint: the flyer's most prominent vivid color, saved by the image-colors Edge Function.
-- image_color_checked_at marks an image as done (even when it has no usable color), so it isn't decoded twice.
alter table public.events
  add column image_color text check (image_color ~ '^#[0-9a-f]{6}$'),
  add column image_color_checked_at timestamptz;

-- A new picture needs a new color: clear both whenever image_url changes.
create function public.reset_image_color()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.image_url is distinct from old.image_url then
    new.image_color := null;
    new.image_color_checked_at := null;
  end if;
  return new;
end;
$$;

create trigger events_reset_image_color
  before update of image_url on public.events
  for each row execute function public.reset_image_color();
