# Milestones: 12 weeks to a Charlotte launch

Solo developer on Windows, new to React Native, building with Claude Code and testing on an iPhone. Each week ends with something running **on your phone**. Thanksgiving and the winter holidays are scheduled as light weeks.

| Week | Dates (2026–27) | Deliverable | Done when |
|---|---|---|---|
| **0** | Oct 28 – Nov 1 | **Setup + basics** | `DEV_SETUP.md` §1–4 done. **Apple Developer enrollment submitted.** Expo app created in `mobile/` and running in Expo Go on your iPhone. Expo tutorial finished |
| **1** | Nov 2 – 8 | **Skeleton + design system** | NativeTabs shell (Feed/Chats/Profile + search), `src/design` tokens (light/dark), `EventCard`, `Chip`, `Facepile`, `DateStrip`, `Skeleton`, `(dev)/gallery`. First **development build** installed. Supabase `staging` live with migrations pushed; DB tests green in CI |
| **2** | Nov 9 – 15 | **Auth + onboarding** | Sign in with Apple + phone OTP; profile basics with an 18+ gate; interests; location priming. Profile row created. Generated DB types in use |
| **3** | Nov 16 – 22 | **Events in** | `ingest-ticketmaster` Edge Function on cron filling staging with real Charlotte events; first 20 curated events entered. Provider terms checklist done |
| **4** | Nov 23 – 29 *(light)* | **Feed** | Date strip + day paging + `get_feed` via TanStack Query + cards + Nearby mode + persisted cache + empty/loading states |
| **5** | Nov 30 – Dec 6 | **Event detail + plans** | `Link.AppleZoom` transition, hero, info rows, glass RSVP bar, `set_rsvp` with optimistic update, Going sheet with Add to Calendar and Share |
| **6** | Dec 7 – 13 | **Map + filters** | Apple Map with pins + persistent bottom sheet + carousel; filters form sheet shared with the feed; live count |
| **7** | Dec 14 – 20 | **Friends** | Username search, requests/accept, friends list, other profiles, contacts matching (`match-contacts`), Friends mode in the feed, facepiles with real friends |
| **8** | Dec 21 – 27 *(light)* | **Notifications** | `expo-notifications` + Expo Push Service, `send-push`, "Down if friends go" end to end on your phone, Activity screen |
| **9** | Dec 28 – Jan 3 | **Chat** | Stream Maker account, `stream-token` + `stream-membership`, Chats list + event chat themed to the design system, report/block, chat push, archive job |
| **10** | Jan 4 – 10 | **Trust + polish → TestFlight** | Settings, blocked users, delete account, reports alert, Sentry + PostHog, accessibility pass (large text, VoiceOver, contrast), app icon placeholder. `eas build --profile preview` + `eas submit` → **TestFlight beta to 30–50 Charlotte testers** |
| **11** | Jan 11 – 17 | **Beta iteration** | "Who did you meet?" loop, fixes from tester feedback shipped via **EAS Update** (no rebuild for JS fixes), curated events 2 weeks ahead, ~200 testers |
| **12** | Jan 18 – 24 | **Ship** | App Store assets (screenshots from your iPhone), privacy nutrition labels, guideline 1.2 / 5.1.1 checklist, `prod` project on Supabase Pro, production build + submit. Launch in Charlotte 🎉 |

## Cut list (if you fall behind, cut in this order)
1. SeatGeek ingestion (Ticketmaster + curated is enough)
2. Map carousel (keep pins + tap → mini card)
3. Long-press previews and dynamic image tint
4. Day paging by swipe (keep tap on the date strip)
5. "Who did you meet?" (move to v1.1; but it's the friendship loop, so fight for it)

**Never cut:** RLS tests, block/report, delete account, empty states.

## Weekly rhythm with Claude Code
1. **Monday:** pick the week's slice. Ask Claude to **plan first** (plan mode) and review the plan before any code.
2. **Daily:** small vertical slices. Claude writes code and runs typecheck, lint and tests. You check it on your iPhone and drag a screenshot back to Claude for UI review.
3. **Before each commit:** `/code-review`. For any migration or RLS change, also `/security-review`, and open a PR so CI runs the database tests.
4. **Batch native changes.** Group new native packages so you need one dev build that week, not five. Free tier: ~15 iOS builds a month.
5. **Friday:** from week 10, ship to TestFlight (or an EAS Update for JS-only fixes), update this file, and write down what you learned this week.
