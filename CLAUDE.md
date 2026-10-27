# CLAUDE.md

iOS-first social discovery app: find events in Charlotte, see which friends are going, meet people there. Name is TBD; use "PlansApp" as the placeholder in code.

**Read before working:** `docs/PRD.md` (what/why), `docs/DESIGN.md` (UI bar + Expo implementation map), `docs/ARCHITECTURE.md` (how), `docs/DATA_MODEL.md` (privacy rules), `docs/MILESTONES.md` (what's next).

## Who you're working with
A solo developer who is **new to mobile development and React Native**, working on **Windows** and testing on an **iPhone (iOS 26)**. There is no Mac and no iOS simulator.
- When you introduce a concept for the first time in a session (hooks, TanStack Query, Expo Router layouts, Reanimated shared values, EAS builds…), explain it in 1–2 plain sentences.
- Prefer the simplest idiomatic solution over clever ones.
- Commands you give the user must work in **PowerShell** on Windows.

## Stack
- **App:** Expo SDK 58, React Native, TypeScript (strict), Expo Router, NativeTabs, Reanimated 4, TanStack Query, Zustand.
- **Native iOS UI via Expo:** `expo-glass-effect`, `@expo/ui`, `expo-symbols`, `expo-maps`, `expo-mesh-gradient`, `expo-image`, `expo-haptics`.
- **Backend:** Supabase (Postgres + PostGIS + RLS, Auth, Storage, Edge Functions in TypeScript/Deno).
- **Chat:** `stream-chat-expo`, behind `src/lib/chat.ts`.
- **Builds:** EAS Build / Submit / Update.
- The approved package list is in `docs/ARCHITECTURE.md`. **Ask before adding any dependency**, and install with `npx expo install` so versions match the SDK.

## Repo map
```
mobile/               Expo app (src/app = routes, src/design = tokens + components, src/features, src/lib)
supabase/migrations/  SQL migrations (never edit an applied one; add a new file)
supabase/tests/       pgTAP tests for RLS and triggers (run in CI on every PR)
supabase/functions/   Edge Functions
docs/                 PRD, design, architecture, data model, milestones, setup
design/reference/     v1 mockups (tone reference only, see DESIGN.md)
```

## Commands (from `mobile/`)
- Dev server: `npx expo start`. The user's iPhone connects through **Expo Go** until week 8, then through the development build.
- Checks before saying anything is done: `npx tsc --noEmit`, `npx expo lint`, `npx jest`.
- **Until week 8, everything must run in Expo Go.** Don't add packages Expo Go doesn't include, or config plugins that need a custom build. If a feature can't work in Expo Go, say so and ask before proceeding.
- From week 8, a native change needs a new dev build: `eas build --profile development --platform ios`. Tell the user when a change needs one (a new native package, or a config plugin / `app.config.ts` change). JS-only changes never do.
- Backend: `npx supabase db push`, `npx supabase gen types typescript --linked > src/lib/database.types.ts`, `npx supabase functions deploy <name>`.

## How to work
1. **Plan first** for anything bigger than a one-file change. State assumptions, and ask when the PRD or DESIGN is ambiguous.
2. Make **small vertical slices**: one screen or one function, working end to end.
3. **Verify.**
   - Typecheck, lint and test must pass.
   - For UI, ask the user for an iPhone screenshot (light and dark when relevant) and compare it against DESIGN.md before calling it done.
   - You can't see the phone yourself, so never claim a visual result you haven't seen.
4. Keep diffs surgical. Don't refactor unrelated code, and don't add speculative abstractions.

## App rules
- Screens never import the Supabase or Stream clients. Screen → feature hook → `src/lib/api` → Supabase.
- Server state lives in TanStack Query. Only cross-screen UI state (filters, selected day) goes in Zustand.
- Database types come from generated `database.types.ts`. Don't hand-write table types.
- All colors, type, spacing and radii come from `src/design` via `useTheme()`. No hex literals or magic numbers in screens.
- Native first: NativeTabs, formSheet routes, `Link.AppleZoom`, `Link.Preview` / `Link.Menu`, GlassView, `@expo/ui`, SF Symbols. Build JS imitations only when DESIGN.md §9 says so.
- Accessibility:
  - Keep `allowFontScaling` on.
  - Add `accessibilityLabel` / `accessibilityRole` on custom controls.
  - Honor Reduce Motion and Reduce Transparency.
- Every design-system component appears in the `(dev)/gallery` route.
- No `any` and no `@ts-ignore` without a comment explaining why.
- Haptics via `expo-haptics`, following DESIGN.md §4.

## Backend rules: privacy is the product
- **Invariants** (tested in `supabase/tests/database/privacy.test.sql`):
  - "Interested" and "Down if friends go" are visible only to their owner.
  - "Going" is visible to friends and fellow Going attendees.
  - Blocks override everything.
  - Never expose `profiles_private`.
  - Never store user location server-side.
- Every new table has RLS enabled in the same migration. Every `security definer` function sets `search_path = ''`.
- Any change to RLS, grants or definer functions: add/extend pgTAP tests (CI runs them), then run `/security-review`.
- Secrets live only in Supabase secrets, EAS environment variables, or a gitignored `.env`. Only `EXPO_PUBLIC_*` values may reach the app, and they must be public-safe.

## Don'ts
- Don't build features not in the current milestone without asking.
- Don't copy layouts from `design/reference/mockups-v1.html` verbatim. DESIGN.md supersedes them.
- Don't commit the generated `mobile/ios` or `mobile/android` folders. Native config lives in `app.config.ts` and config plugins.
- Don't add analytics events beyond the list in ARCHITECTURE.md, and never send PII to analytics.
