# Data model and privacy

Source of truth: `supabase/migrations/20261027000000_init.sql`. Tests: `supabase/tests/database/privacy.test.sql` (33 assertions, run in CI on every PR).

## Tables

| Table | Purpose | Notes |
|---|---|---|
| `cities` | Launch cities | Seeded with Charlotte (center, 50 mi radius, `America/New_York`) |
| `interests` | Interest catalog | `symbol` = SF Symbol name |
| `profiles` | Public profile | username, display_name, bio, avatar_path, home_city_id |
| `profiles_private` | Owner-only data | birthdate (18+ check), phone_hmac, discoverable_by_phone |
| `admins` | Curators | Service role / Studio only; no client policies |
| `profile_interests` | User ↔ interest | |
| `friendships` | Mutual friends | One row per pair (`user_a < user_b`); `pending` → `accepted`; delete = decline/unfriend |
| `blocks` | Blocks | Inserting a block deletes any friendship |
| `events` | All events | `source` + `external_id` unique; `location geography(point)`; `status` active/cancelled/hidden |
| `event_interests` | Event ↔ interest | |
| `rsvps` | One plan per user per event | `status` ∈ interested, down_if_friends, going |
| `notifications` | Activity feed + push source | friend_going, friend_request, friend_accepted, event_update |
| `device_tokens` | Expo push tokens | Only `ExponentPushToken[...]` accepted; chat push tokens are registered with Stream instead |
| `event_submissions` | "Suggest an event" queue (title, link, starts_at, ends_at, venue, address, details, `origin` user/agent/instagram, `source_handle`, `agent_fingerprint` unique for idempotent agent re-posts, status pending/approved/rejected, `event_id` once published). `submitted_by` is null for agent/instagram rows. 5 per person per day; no direct client writes, only `submit_event()` (user) and the `agent-inbox` function (service role) | Own rows readable by the submitter; agent rows readable by admins only; admins read and update all; reviewed in Studio |
| `reports` | Moderation queue. Message reports keep a private snapshot (body, author, event) made by `report_message()`; deleted after 90 days (`purge_old_reports()`). 20 per person per day, one per target. Studio-only access; the snapshot author is set to null if that account is deleted | Insert-only for clients (user/event types; messages only via the RPC) |

## Privacy matrix (enforced by RLS)

| Data | Owner | Friend | Fellow attendee (also Going) | Stranger | Blocked |
|---|---|---|---|---|---|
| Profile (name, photo, bio, interests) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Birthdate, phone | ✅ | ❌ | ❌ | ❌ | ❌ |
| RSVP: Interested | ✅ | ❌ | ❌ | ❌ | ❌ |
| RSVP: Down if friends go | ✅ | ❌ | ❌ | ❌ | ❌ |
| RSVP: Going | ✅ | ✅ | ✅ | ❌ (count only) | ❌ |
| Friend list | ✅ (own rows) | ❌ (mutual friends computed by RPC later) | ❌ | ❌ | ❌ |
| Friend search / profile (`search_profiles`, `get_profile`) | ✅ | ✅ (friend_count and mutual count only, never the list) | ✅ (plus past events you were both Going to) | ✅ | ❌ (looks like "not found") |
| Suggested events (`event_submissions`) | ✅ (own) | ❌ | ❌ | ❌ | ❌ (admins see all) |
| Event chat | members = Going users only (Supabase tables, see Chat) |

## How clients write
- **Plans:** `rpc('set_rsvp', { p_event_id, p_status })`, where `p_status: null` clears the plan. Direct writes to `rsvps` are restricted to the `status` column, and `friend_alert_sent_at` is server-only.
- **Friends (use these):** `rpc('search_profiles', { p_query, p_limit })`, `send_friend_request({ p_user })` (returns `outgoing`, or `friends` if they had already asked you), `respond_friend_request({ p_user, p_accept })`, `remove_friend({ p_user })` (unfriend or cancel), `list_friends()`, `list_friend_requests()`, `get_profile({ p_user })`. Errors: `cannot_friend_self`, `user_not_found` (also when blocked), `already_friends`, `request_pending`, `request_not_found`, `query_invalid`, `rate_limited` (30 new requests per 24 h, and 3 to the same person per 7 days; enforced by a trigger on `friendships`, so direct inserts are limited too), `not_onboarded`.
- **Suggest an event:** `rpc('submit_event', { p_city_id, p_title, p_link, p_starts_at, p_venue, p_details })` returns the submission id. Errors: `title_invalid`, `link_invalid`, `starts_at_invalid`, `city_invalid`, `venue_invalid`, `details_invalid`, `rate_limited` (5 per 24 h), `not_onboarded`.
- **Friend request (table-level, superseded by the RPCs above):** insert into `friendships` with `user_a`/`user_b` ordered (smaller UUID first), `requested_by = me`. Accept: update `status = 'accepted'` (only the recipient can). Decline/unfriend: delete.
- **Feed and map:** `rpc('get_feed', { p_city_id, p_day, p_lat, p_lng, p_radius_m, p_interest_ids, p_price, p_mode })`. The day boundary uses the city's timezone.
- **Detail social context:** `rpc('get_event_social', { p_event_id })`.
- **Onboarding:** `rpc('username_available', { p_username })` returns a boolean (false when invalid or taken, case-insensitive). `rpc('complete_onboarding', { p_username, p_display_name, p_birthdate, p_interest_ids, p_home_city_id })` atomically creates `profiles`, `profiles_private` and `profile_interests` for `auth.uid()`; clients never insert `profiles` / `profiles_private` directly (insert is revoked), so onboarding goes only through this RPC. Usernames match `^[a-z0-9][a-z0-9_.]{2,19}$`.
- Errors are raised as exact messages: `not_authenticated`, `already_onboarded`, `username_invalid`, `username_taken`, `display_name_invalid`, `must_be_18`, `too_few_interests`, `city_invalid`.

## Chat
Event group chat v1 lives in Supabase (`event_messages`, `event_chat_reads`), not Stream.
- **Who:** only users currently Going can read or post. Leaving Going removes access at once. Interested, Down-if and strangers get nothing.
- **Blocks:** messages between users with a block in either direction are hidden both ways, including in last-message previews and unread counts.
- **Window:** `chat_open(event)` is true while the event is active and until 48 h after it ends (`ends_at`, else `starts_at` + 6 h). Posting is refused after that; reading stays allowed.
- **Delete:** authors soft-delete by setting `deleted_at` (the only updatable column). There are no client deletes. A trigger erases `body` on delete (it becomes null everywhere, including realtime payloads) and `deleted_at` can't be cleared.
- **Read:** `rpc('get_chat_messages', { p_event_id, p_before_id, p_limit })` (newest first by id; pass the oldest id you have as `p_before_id`; limit 1..100) and `rpc('get_my_chats')` for the chat list (last message, unread count, `is_open`).
- **Write:** insert `{ event_id, user_id: me, body }` (max 2000 chars, must contain a non-whitespace character; at most 30 messages per user per event per minute, otherwise `rate_limited`) into `event_messages`; `rpc('mark_chat_read', { p_event_id })` stamps the read marker.
- **Live:** subscribe to `postgres_changes` on `event_messages` filtered by `event_id`. Realtime applies the select policy, so only members receive rows. Deleted rows arrive as updates with a null body.

## Policy helpers live in `private`
`is_going`, `are_friends`, `is_blocked_between`, `is_admin` and `chat_open` are `security definer` helpers used by RLS policies. They live in the `private` schema (usage granted to `authenticated` and `service_role` only) so they are not exposed through the API; the old `public.*` copies are revoked from `anon`/`authenticated`, because callable helpers would let anyone probe who is Going, who is friends, or who is blocked. New policy helpers go in `private`.

## Server-side behavior
- **Down if friends go:** an `after insert/update of status` trigger on `rsvps`. When a user becomes Going, every friend who is `down_if_friends` on that event and hasn't been alerted gets one `friend_going` notification, and `friend_alert_sent_at` is stamped. Switching back to "Down if" re-arms the alert.
- **Friend notifications:** a trigger on `friendships` creates `friend_request` / `friend_accepted` rows.
- **Push:** a Database Webhook on `notifications` insert calls the `send-push` Edge Function, which sends via the Expo Push Service.

## Rules for changing the schema
1. Never edit an applied migration. Add a new file (`supabase migration new <name>`).
2. Every table gets RLS enabled in the same migration that creates it.
3. Any change touching RLS, grants or `security definer` functions needs a pgTAP test and a `/security-review` run.
4. `security definer` functions always `set search_path = ''` and fully qualify names.

## Provider terms checklist (fill in during week 3)
- [ ] Ticketmaster: attribution text, image usage, caching duration, link-out requirements, rate limits
- [ ] SeatGeek: same
- [ ] Curated: source link stored in `ticket_url`; images owned or generated
