# Milestones: 12 weeks to a Charlotte launch

Solo developer, new to Swift, building with Claude Code. Each week ends with something you can **run on your phone**. Thanksgiving and the winter holidays are scheduled as light weeks.

| Week | Dates (2026–27) | Deliverable | Done when |
|---|---|---|---|
| **0** | Oct 28 – Nov 1 | **Setup + Swift crash course** | `MAC_SETUP.md` complete. Xcode project builds and runs in the simulator via XcodeBuildMCP. You've finished the first 2 chapters of Apple's SwiftUI tutorials |
| **1** | Nov 2 – 8 | **Skeleton + design system** | TabView shell (Feed/Chats/Profile + search), DesignSystem tokens (light/dark), `EventCard`, `Chip`, `Facepile` with previews. Local Supabase running with the migration applied; `supabase test db` green |
| **2** | Nov 9 – 15 | **Auth + onboarding** | Sign in with Apple + phone OTP; profile basics with an 18+ gate; interests; location priming. Profile row created. Hosted `staging` project live |
| **3** | Nov 16 – 22 | **Events in** | `ingest-ticketmaster` Edge Function on cron filling staging with real Charlotte events; first 20 curated events entered. Provider terms checklist done |
| **4** | Nov 23 – 29 *(light)* | **Feed** | Date strip + day paging + `get_feed` + cards + Nearby mode + cache + empty/loading states |
| **5** | Nov 30 – Dec 6 | **Event detail + plans** | Zoom transition, hero, info rows, bottom RSVP bar, `set_rsvp`, Going sheet with EventKit "Add to Calendar" and the share sheet |
| **6** | Dec 7 – 13 | **Map + filters** | Map with clustered pins + sheet detents + carousel; filter sheet shared with the feed; live count |
| **7** | Dec 14 – 20 | **Friends** | Username search, requests/accept, friends list, other profiles, contacts matching (`match-contacts`), Friends mode in the feed, facepiles with real friends |
| **8** | Dec 21 – 27 *(light)* | **Notifications** | APNs set up, `send-push`, "Down if friends go" end to end on a real device, Activity screen |
| **9** | Dec 28 – Jan 3 | **Chat** | Stream Maker account, `stream-token` + `stream-membership`, Chats list + event chat themed to the design system, report/block, archive job |
| **10** | Jan 4 – 10 | **Trust + polish → TestFlight** | Settings, blocked users, delete account, reports alert, Sentry + PostHog, accessibility pass (AX sizes, VoiceOver, contrast), app icon placeholder. **TestFlight beta to 30–50 Charlotte testers** |
| **11** | Jan 11 – 17 | **Beta iteration** | "Who did you meet?" loop, fixes from tester feedback, performance pass, curated events 2 weeks ahead, grow to ~200 testers |
| **12** | Jan 18 – 24 | **Ship** | App Store assets, privacy nutrition labels, guideline 1.2 / 5.1.1 checklist, `prod` project on Supabase Pro, submit for review. Launch in Charlotte 🎉 |

## Cut list (if you fall behind, cut in this order)
1. SeatGeek ingestion (Ticketmaster + curated is enough)
2. Map carousel (keep pins + tap → mini card)
3. Long-press previews and dynamic image tint
4. Day paging by swipe (keep tap on the date strip)
5. "Who did you meet?" (move to v1.1; but it's the friendship loop, so fight for it)

**Never cut:** RLS tests, block/report, delete account, empty states.

## Weekly rhythm with Claude Code
1. **Monday:** pick the week's slice. Ask Claude to **plan first** (plan mode) and review the plan before any code.
2. **Daily:** small vertical slices (one screen or one function). Claude builds, runs and screenshots via XcodeBuildMCP. You tap through it on your phone.
3. **Before each commit:** `/code-review`. For any migration or RLS change, also `/security-review` + `supabase test db`.
4. **Friday:** TestFlight build (from week 10), update this file, write down what you learned about Swift this week.
