# CLAUDE.md

iOS-first social discovery app: find events in Charlotte, see which friends are going, meet people there. Name is TBD; use "PlansApp" as the placeholder in code.

**Read before working:** `docs/PRD.md` (what/why), `docs/DESIGN.md` (UI bar), `docs/ARCHITECTURE.md` (how), `docs/DATA_MODEL.md` (privacy rules), `docs/MILESTONES.md` (what's next).

## Who you're working with
A solo developer who is **new to Swift**. When you introduce a Swift or SwiftUI concept for the first time in a session (property wrappers, `@Observable`, actors, `async let`, `matchedTransitionSource`…), explain it in 1–2 plain sentences. Prefer the simplest idiomatic solution over clever ones.

## Stack
- **iOS:** SwiftUI, iOS 26+, Swift 6 strict concurrency, `@Observable` stores, NavigationStack, MapKit, EventKit.
- **Backend:** Supabase (Postgres + PostGIS + RLS, Auth, Storage, Edge Functions in TypeScript/Deno).
- **Chat:** Stream Chat SwiftUI, behind `ChatService`.
- **Packages:** supabase-swift, stream-chat-swiftui, Nuke, sentry-cocoa, posthog-ios. **Ask before adding any dependency.**

## Repo map
```
ios/                  Xcode project (synchronized folders; add files on disk, no pbxproj edits)
supabase/migrations/  SQL migrations (never edit an applied one; add a new file)
supabase/tests/       pgTAP tests for RLS and triggers
supabase/functions/   Edge Functions
docs/                 PRD, design, architecture, data model, milestones, setup
design/reference/     v1 mockups (tone reference only, see DESIGN.md)
```

## Commands
- Build, run, test, screenshot: use **XcodeBuildMCP** tools (scheme `PlansApp`, simulator iPhone 17). Use the **xcode** MCP for previews and Apple docs.
- Backend: `supabase start`, `supabase db reset`, `supabase test db`, `supabase functions serve`.

## How to work
1. **Plan first** for anything bigger than a one-file change. State assumptions, and ask when the PRD or DESIGN is ambiguous.
2. Make **small vertical slices**: one screen or one function, built and running.
3. **Verify visually.** After UI changes, build, run, and screenshot in the simulator (light and dark) and compare against DESIGN.md before saying it's done.
4. Keep diffs surgical. Don't refactor unrelated code, and don't add speculative abstractions.

## iOS rules
- Views never call Supabase or Stream directly. View → `@MainActor @Observable` Store → Service protocol.
- All colors, fonts, spacing and radii come from `DesignSystem/`. No hex literals or magic numbers in feature code.
- Use system components first (TabView, sheets, menus, context menus, Liquid Glass via `glassEffect`). Build custom components only when DESIGN.md calls for it.
- Every view gets a `#Preview` with fake data (light, dark, and one accessibility text size).
- Dynamic Type text styles only; VoiceOver labels on custom controls; honor Reduce Motion and Reduce Transparency.
- No force unwraps (`!`) outside previews and tests. Use `async/await`, not Combine or completion handlers.
- Haptics via `.sensoryFeedback`. Follow the haptics map in DESIGN.md §4.

## Backend rules: privacy is the product
- **Invariants** (tested in `supabase/tests/database/privacy.test.sql`):
  - "Interested" and "Down if friends go" are visible only to their owner.
  - "Going" is visible to friends and fellow Going attendees.
  - Blocks override everything.
  - Never expose `profiles_private`.
  - Never store user location server-side.
- Every new table has RLS enabled in the same migration. Every `security definer` function sets `search_path = ''`.
- Any change to RLS, grants or definer functions: add/extend pgTAP tests, run `supabase test db`, then run `/security-review`.
- Secrets live only in Supabase secrets or a gitignored `Config.xcconfig`. Never commit keys.

## Don'ts
- Don't build features not in the current milestone without asking.
- Don't copy layouts from `design/reference/mockups-v1.html` verbatim. DESIGN.md supersedes them.
- Don't add analytics events beyond the list in ARCHITECTURE.md, and never send PII to analytics.
