-- Push now goes through the Expo Push Service: device_tokens stores Expo push
-- tokens ("ExponentPushToken[...]"), and Expo picks the APNs environment itself.
-- Chat push is registered with Stream directly and is not stored here.
alter table public.device_tokens drop column environment;
alter table public.device_tokens
  add constraint device_tokens_expo_format check (token like 'ExponentPushToken[%]');
