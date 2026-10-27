# Architecture

```
iPhone app (Expo / React Native, TypeScript) ──supabase-js──▶ Supabase
   │                                                   ├─ Postgres + PostGIS + RLS   (source of truth, privacy rules)
   │                                                   ├─ Auth (Apple, phone OTP)
   │                                                   ├─ Storage (avatars)
   │                                                   ├─ Edge Functions (Deno/TypeScript)
   │                                                   └─ Cron (pg_cron → Edge Functions)
   │
   └──stream-chat-expo──▶ Stream Chat   (event group chats; tokens minted by our Edge Function)

Build & ship: EAS Build (cloud macOS) → EAS Submit → TestFlight / App Store · EAS Update (over-the-air JS fixes)
External: Ticketmaster / SeatGeek APIs (ingestion) · Expo Push Service → APNs · PostHog · Sentry
```

**Expo Go first:** weeks 0–7 run entirely in Expo Go (free, no Apple account); the first custom development build arrives in week 8 for push notifications. Until then, only use packages that ship in Expo Go.

**Why Expo:** development happens on Windows. Expo's cloud (EAS) does the macOS-only steps: native builds, signing, and App Store upload. Day to day, code changes appear on your iPhone in about a second through a **development build**. Expo UI, native tabs and `expo-glass-effect` render real iOS components (Liquid Glass included), so the app stays native-feeling. Android is a later option from the same code.

## Mobile app

**Targets:** iOS 26+ for v1 (Liquid Glass), Expo SDK 58, TypeScript `strict`, Expo Router (file-based navigation).

**Pattern: route screens + feature hooks + typed API layer.** No Redux. A beginner should be able to read any file top to bottom.

```
mobile/
  app.config.ts               # Expo config: bundle id, plugins, iOS permissions strings
  eas.json                    # build profiles: development, preview (TestFlight), production
  src/
    app/                      # Expo Router routes (each file = a screen)
      _layout.tsx             # providers: QueryClient, Supabase session, theme, Stream
      (onboarding)/           # welcome, sign-in, profile, interests, location, find-friends
      (tabs)/_layout.tsx      # NativeTabs: Feed · Chats · Profile + search role
      (tabs)/feed/index.tsx   # date strip + day feed
      (tabs)/feed/map.tsx
      event/[id].tsx          # event detail (zoom transition target)
      event/[id]/going.tsx    # Going sheet (formSheet presentation)
      filters.tsx             # filter sheet (formSheet with detents)
      (tabs)/chats/...  (tabs)/profile/...  user/[id].tsx  friends.tsx  activity.tsx  settings/...
      (dev)/gallery.tsx       # dev-only component gallery (light/dark/large text) — replaces SwiftUI previews
    design/                   # tokens (colors, type, spacing, radii), useTheme(), components:
                              # EventCard, Chip, Facepile, DateStrip, RSVPBar, GlassBar, Skeleton, MeshArt
    features/                 # one folder per feature: hooks + components
      feed/  event/  map/  chat/  profile/  friends/  activity/  onboarding/
    lib/
      supabase.ts             # client (session persisted via expo-sqlite localStorage)
      api/                    # typed functions: getFeed(), setRsvp(), getEventSocial()… (only place that calls Supabase)
      chat.ts                 # ChatService over Stream so the vendor can be swapped
      push.ts  location.ts  calendar.ts  contacts.ts  analytics.ts
      database.types.ts       # generated: `supabase gen types typescript`
  __tests__/                  # Jest (jest-expo) + React Native Testing Library
```

Rules:
- **Data flow:** Screen → feature hook (`useFeed`, `useEvent`, `useSetRsvp`) → `lib/api` → Supabase. Screens never import `supabase` directly.
- **Server state:** TanStack Query handles caching, retries and optimistic RSVP updates. The query cache is persisted so the feed shows instantly on launch.
- **UI state:** Zustand, only for state shared across screens: filters (shared by feed and map) and the selected day.
- **Types:** generated from the database (`database.types.ts`). Don't hand-write table types.
- **Navigation:** Expo Router.
  - Tabs use **`NativeTabs`** (`expo-router/native-tabs`), which gives the real iOS 26 Liquid Glass tab bar.
  - Sheets use `presentation: 'formSheet'` with detents.
  - Card → detail uses `Link.AppleZoom`.
  - Long-press previews use `Link.Preview` / `Link.Menu`.
- **Styling:** `StyleSheet` + tokens from `src/design` via `useTheme()`. No inline hex values.
- **Lists:** `FlatList` (switch to FlashList only if profiling shows a need).

**Packages** (all checked to exist at these major versions on 2026-10-27; ask before adding anything else):

| Need | Package |
|---|---|
| Core | `expo@58`, `expo-router`, `react-native-reanimated@4`, TypeScript |
| Native UI | `expo-glass-effect`, `@expo/ui` (SwiftUI-backed components), `expo-symbols` (SF Symbols), `expo-mesh-gradient`, `expo-image`, `expo-haptics` |
| Data | `@supabase/supabase-js`, `@tanstack/react-query`, `zustand`, `expo-sqlite` (session + cache storage) |
| Device | `expo-location`, `expo-calendar`, `expo-contacts`, `expo-notifications`, `expo-apple-authentication`, `expo-image-picker`, `expo-maps` (Apple Maps; was alpha in recent docs, so fall back to `react-native-maps` if it's not stable enough) |
| Map sheet | `@gorhom/bottom-sheet` (persistent, non-modal sheet over the map) |
| Chat | `stream-chat-expo` |
| Ops | `@sentry/react-native`, `posthog-react-native` |

## Backend (Supabase)

**Database.** See `DATA_MODEL.md` and `supabase/migrations/`. All privacy rules live in RLS and `security definer` RPCs, and the pgTAP tests in `supabase/tests/` pin them down. **CI runs them on every PR** (`.github/workflows/db-tests.yml`), so you don't need Docker on Windows.

**Edge Functions** (`supabase/functions/`):

| Function | Trigger | Does |
|---|---|---|
| `ingest-ticketmaster` | Cron, daily 06:15 ET | Fetches the next 30 days within 50 mi of Charlotte, upserts `events` on `(source, external_id)`, maps segments to interests, picks the widest 16:9 image |
| `ingest-seatgeek` | Cron (stretch) | Same; dedupes against Ticketmaster |
| `stream-token` | Client call | Verifies the Supabase JWT, upserts the Stream user, returns a Stream user token |
| `stream-membership` | DB webhook on `rsvps` | Going → create channel `event-<id>` if needed and add member. Leaving Going → remove member |
| `send-push` | DB webhook on `notifications` insert | Sends via the **Expo Push Service** (`exp.host/--/api/v2/push/send`) to the user's `device_tokens`; removes tokens Expo reports as `DeviceNotRegistered` |
| `match-contacts` | Client call | Takes ≤ 2,000 SHA-256 hashes of E.164 numbers, applies a server-side HMAC with a secret pepper, returns matching discoverable profiles. Rate-limited. Also stores the caller's own `phone_hmac` after phone verification |
| `delete-account` | Client call | Deletes the Stream user and the auth user; cascades remove everything else |
| `archive-chats` | Cron, hourly | Freezes channels 48 h after events end |
| `who-did-you-meet` | Cron, daily 10:00 ET | Creates Activity items for yesterday's attendees |

**Environments:** two hosted free-tier projects: `staging` (development builds + TestFlight) and `prod` (App Store). Local Supabase (`supabase start`) is optional and needs Docker Desktop. The app reads `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` from `.env` locally and from EAS environment variables in builds.

**Secrets** live only in Supabase secrets and EAS secrets, never in git:
- Stream API secret
- Ticketmaster key
- Contact pepper
- Expo access token for push

The anon key and Stream API key are public by design.

## Chat (Stream)
- Stream user ID = Supabase user UUID. Stream channel = `messaging:event-<event_uuid>`.
- Membership is **server-controlled** by `stream-membership`. The client never joins channels itself.
- Chat push: register the device's native APNs token (`getDevicePushTokenAsync`) with Stream as an `apn` device, and upload the APNs key in the Stream dashboard. Verify this against Stream's Expo docs in week 9.
- Blocks are mirrored to Stream's block API.
- Theme `stream-chat-expo` components through its theme object to match `DESIGN.md`.

## Analytics (PostHog)
Track a short list of events and no PII:
- `onboarding_completed`
- `feed_viewed` (mode, day offset)
- `event_opened` (source)
- `rsvp_set` (status, had_friends_going)
- `chat_message_sent`
- `friend_request_sent` (origin: contacts / attendees / search / who_did_you_meet)
- `friend_request_accepted`
- `going_moment_action` (chat / calendar / invite)

## Testing and checks
- **Database:** pgTAP via `supabase test db`, run automatically in CI. This is mandatory for any migration touching RLS.
- **App logic:** Jest + React Native Testing Library for hooks (`useFeed` with a mocked API), date/day-boundary helpers and key components.
- **Every change:** `npx tsc --noEmit`, `npx expo lint`, `npx jest`. Claude runs these before saying anything is done.
- **Visual:** on your iPhone via the development build. Send Claude screenshots for UI review. The dev gallery route shows every component in light, dark and large text.
- **CI later (week 10):** add typecheck + lint + jest to GitHub Actions; EAS Workflows can build and submit to TestFlight on merge to `main`.
