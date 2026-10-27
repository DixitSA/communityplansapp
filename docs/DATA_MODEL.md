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
| `reports` | Moderation queue | Insert-only for clients |

## Privacy matrix (enforced by RLS)

| Data | Owner | Friend | Fellow attendee (also Going) | Stranger | Blocked |
|---|---|---|---|---|---|
| Profile (name, photo, bio, interests) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Birthdate, phone | ✅ | ❌ | ❌ | ❌ | ❌ |
| RSVP: Interested | ✅ | ❌ | ❌ | ❌ | ❌ |
| RSVP: Down if friends go | ✅ | ❌ | ❌ | ❌ | ❌ |
| RSVP: Going | ✅ | ✅ | ✅ | ❌ (count only) | ❌ |
| Friend list | ✅ (own rows) | ❌ (mutual friends computed by RPC later) | ❌ | ❌ | ❌ |
| Event chat | members = Going users only (Stream, server-managed) |

## How clients write
- **Plans:** `rpc('set_rsvp', { p_event_id, p_status })`, where `p_status: null` clears the plan. Direct writes to `rsvps` are restricted to the `status` column, and `friend_alert_sent_at` is server-only.
- **Friend request:** insert into `friendships` with `user_a`/`user_b` ordered (smaller UUID first), `requested_by = me`. Accept: update `status = 'accepted'` (only the recipient can). Decline/unfriend: delete.
- **Feed and map:** `rpc('get_feed', { p_city_id, p_day, p_lat, p_lng, p_radius_m, p_interest_ids, p_price, p_mode })`. The day boundary uses the city's timezone.
- **Detail social context:** `rpc('get_event_social', { p_event_id })`.

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
