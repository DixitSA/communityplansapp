# Architecture

```
iOS app (SwiftUI) ──supabase-swift──▶ Supabase
   │                                   ├─ Postgres + PostGIS + RLS   (source of truth, privacy rules)
   │                                   ├─ Auth (Apple, phone OTP)
   │                                   ├─ Storage (avatars)
   │                                   ├─ Edge Functions (Deno/TypeScript)
   │                                   └─ Cron (pg_cron → Edge Functions)
   │
   └──stream-chat-swiftui──▶ Stream Chat   (event group chats; tokens minted by our Edge Function)

External: Ticketmaster / SeatGeek APIs (ingestion) · APNs (push) · PostHog (analytics) · Sentry (crashes)
```

## iOS app

**Targets:** iOS 26.0+, Swift 6 language mode (strict concurrency), SwiftUI-only (UIKit only through interop when unavoidable).

**Pattern: feature folders + `@Observable` stores + protocol-backed services.** There is no TCA or VIPER. A beginner should be able to read any file top to bottom.

```
ios/
  App/
    PlansApp.swift            # @main, builds AppEnvironment, root TabView
    AppEnvironment.swift      # holds services; injected via .environment
    DesignSystem/             # Colors, Typography, Spacing, components (Chip, Facepile, GlassBar, EventCard…)
    Core/
      Models/                 # Event, Profile, RSVPStatus, Friendship… (Codable, Sendable)
      Services/
        SupabaseClient.swift
        EventService.swift    # protocol + live impl: feed(day:filters:), event(id:), setRSVP(...)
        SocialService.swift   # friends, requests, blocks, contacts match
        ChatService.swift     # protocol over Stream so the vendor can be swapped
        LocationService.swift # CoreLocation, When In Use
        CalendarService.swift # EventKit write-only access
        PushService.swift     # APNs registration → device_tokens
      Cache/                  # FeedCache: Codable JSON in Caches dir, per day
    Features/
      Onboarding/  Feed/  Map/  EventDetail/  Chats/  Profile/  Friends/  Activity/  Settings/
        <Feature>View.swift, <Feature>Store.swift (@Observable @MainActor), subviews
  AppTests/                   # Swift Testing: stores with fake services
  AppUITests/                 # 1–2 smoke flows (onboarding → going)
```

Rules:
- **Navigation:** one `NavigationStack` per tab, with a typed `enum Route: Hashable`. Sheets are driven by optional `@State` items.
- **State:** each screen owns one store. Stores call services. Views never call Supabase directly.
- **Concurrency:** `async/await` everywhere, with `@MainActor` stores. Services are `Sendable` and do work off the main actor. No Combine for new code.
- **Images:** NukeUI `LazyImage` with Supabase image transforms for sized thumbnails.
- **Previews:** every view has a `#Preview` using `PreviewData` fakes. No network in previews.
- **Xcode project:** created in Xcode 26 with **synchronized folders** (the default). Adding files doesn't touch `project.pbxproj`, which keeps agent diffs clean.

**Swift packages (keep this list short; ask before adding):**
- `supabase-swift`
- `stream-chat-swiftui`
- `Nuke`
- `sentry-cocoa`
- `posthog-ios`

## Backend (Supabase)

**Database.** See `DATA_MODEL.md` and `supabase/migrations/`. All privacy rules live in RLS and `security definer` RPCs, and the pgTAP tests in `supabase/tests/` pin them down.

**Edge Functions** (`supabase/functions/`):

| Function | Trigger | Does |
|---|---|---|
| `ingest-ticketmaster` | Cron, daily 06:15 ET | Fetches the next 30 days within 50 mi of Charlotte, upserts `events` on `(source, external_id)`, maps segments to interests, picks the widest 16:9 image |
| `ingest-seatgeek` | Cron (stretch) | Same; dedupes against Ticketmaster |
| `stream-token` | Client call | Verifies the Supabase JWT, upserts the Stream user, returns a Stream user token |
| `stream-membership` | DB webhook on `rsvps` | Going → create channel `event-<id>` if needed and add member. Leaving Going → remove member |
| `send-push` | DB webhook on `notifications` insert | Sends APNs (token-based .p8 auth) to the user's `device_tokens`; prunes dead tokens |
| `match-contacts` | Client call | Takes ≤ 2,000 SHA-256 hashes of E.164 numbers, applies a server-side HMAC with a secret pepper, returns matching discoverable profiles. Rate-limited. Also stores the caller's own `phone_hmac` after phone verification |
| `delete-account` | Client call | Deletes the Stream user and the auth user; cascades remove everything else |
| `archive-chats` | Cron, hourly | Freezes channels 48 h after events end |
| `who-did-you-meet` | Cron, daily 10:00 ET | Creates Activity items for yesterday's attendees |

**Environments:** local (`supabase start`, needs Docker), plus two hosted free-tier projects: `staging` (TestFlight) and `prod` (App Store). The iOS app picks one via `.xcconfig` build configurations.

**Secrets** live only in Supabase secrets and never in git:
- Stream API secret
- APNs .p8 key
- Ticketmaster key
- Contact pepper

Client config (Supabase URL and anon key, Stream API key) goes in `Config.xcconfig`, which is gitignored; `Config.sample.xcconfig` is committed.

## Chat (Stream)
- Stream user ID = Supabase user UUID. Stream channel = `messaging:event-<event_uuid>`.
- Membership is **server-controlled** by `stream-membership`. The client can never join a channel itself.
- Chat push is configured in the Stream dashboard with the same APNs key.
- Blocks are mirrored to Stream's block API so blocked users' messages are hidden.
- Theme the Stream SwiftUI components through its `Appearance` / `ViewFactory` to match `DESIGN.md`.

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

## Testing
- **Database:** pgTAP via `supabase test db`. This is mandatory for any migration touching RLS.
- **Swift:** Swift Testing for stores (fake services), date/day-boundary logic and ranking display.
- **UI:** one XCUITest smoke flow; Claude uses XcodeBuildMCP to build, run, screenshot and check flows.
- **CI** (week 10+): a GitHub Actions macOS runner, or Xcode Cloud's free hours, for build and tests on each PR.
