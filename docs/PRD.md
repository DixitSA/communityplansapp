# Product Requirements: v1 (Charlotte launch)

*Product: **yard.** Tagline: "Find your people." Status: building. Last updated: 2026-10-27.*

## 1. Problem
Making friends as a young adult is hard:
- Events are scattered across Ticketmaster, Instagram, group chats and flyers.
- Existing friend groups feel closed.
- People want to go out but don't know who to go with.

Existing tools each solve one slice: Partiful does invites, Eventbrite does tickets, Instagram does the social graph. None connects **what's happening**, **who's going**, and **who you could meet there**.

## 2. Who it's for (v1)
**Charlotte, NC, ages 21–30**, and especially **transplants and recent grads**. Charlotte is one of the fastest-growing US metros, with a large share of people who moved there for work and have a thin local network. They have money and time on weekends but lack a crew.

Launch neighborhoods: **Uptown, South End, NoDa, Plaza Midwood, Camp North End / Optimist Park**.

## 3. Goals and success metrics
| Goal | Metric | v1 target (beta) |
|---|---|---|
| People find something to do | % of new users who tap **Going** within 7 days | ≥ 40% |
| Plans are social | % of Going RSVPs where ≥ 1 friend is also going | ≥ 30% by week 4 |
| Events become friendships | Friend requests sent to fellow attendees per event attended | ≥ 0.5 |
| Habit | Weekly active planners (users with ≥ 1 RSVP that week) / WAU | ≥ 50% |
| Retention | D30 retention | ≥ 25% |

**Non-goals for v1:** a posting feed, likes, follower counts, ticket sales, user-hosted events, recurring communities, Android, or any city other than Charlotte.

## 4. Core concepts

### Plan states (one per user per event, changeable anytime)
| State | Meaning | Who can see it | Side effects |
|---|---|---|---|
| **Interested ♡** | Saved for later | **Only me** | Appears in Profile › Saved |
| **Down if friends go ✦** | I'll go if a friend commits | **Only me** (a hidden trigger) | When the **first** friend taps Going: push notification and an Activity item, once |
| **Going ✓** | Committed | **My friends**, plus **other people who are Going** | Added to Plans; joins the event chat; can add to device calendar; friends who are "Down if" get alerted |

- Clearing your plan deletes the RSVP. Leaving **Going** removes you from the chat.
- Blocks override everything: blocked users never see each other anywhere.
- Event pages show the **total going count** to everyone. They show **friends by name**, and other attendees only as a blurred facepile until you're Going yourself.

### Friends
- **Mutual** friendships: request → accept. No followers.
- Discovery paths: contacts (hashed phone match, opt-in), username search, fellow attendees, and "Who did you meet?" after events.

## 5. v1 features and acceptance criteria

### 5.1 Onboarding
- Welcome → Sign in with Apple *or* phone number (SMS OTP; email OTP stands in during development) → profile basics (name, @username, photo optional, birthdate) → interests (pick 3+) → location (When In Use, or choose Charlotte manually) → find friends (optional, skippable).
- Users under 18 are blocked at the birthdate step, with a neutral message.
- Done when: a new user reaches a populated feed in **under 90 seconds**.

### 5.2 Feed (Nearby / Friends)
- Week date strip; the selected day's events as image-first cards, sorted by score. Score combines friends going, interest match, distance and overall popularity.
- **Nearby** shows everything within the radius. **Friends** shows only events where ≥ 1 friend is going.
- Filters: distance (1–50 mi), interests, price (any/free/paid). The filters are shared with the map.
- Card: image, title, time, venue/neighborhood, distance, interest tags, friends facepile with names, save heart.
- Done when: the feed loads from cache instantly, refreshes in under 1 s on LTE, and every list has empty, loading and error states.

### 5.3 Map
- Same data and filters as the feed for the selected day. Clustered pins; a sheet with peek, carousel and list detents.

### 5.4 Event detail
- Hero, title, time, venue with a mini-map and Directions (Apple Maps), price, description, source attribution and ticket link.
- Who's going, the RSVP bar, Share (link + system share sheet), Add to Calendar.

### 5.5 Event chat (Stream)
- One group chat per event. Members are exactly the users who are Going.
- Text, images, reactions, replies. Report and block from the message or user menu.
- The chat is archived (read-only) 48 h after the event ends.

### 5.6 Profile, friends, activity, settings
- Own profile: photo, name, bio, interests, upcoming plans, saved, friends count.
- Other user's profile: mutual friends, shared past events, Add Friend.
- Friends list and requests. Activity: friend going, requests, accepts, "Who did you meet?".
- Settings: discoverable by phone, notification toggles, blocked users, sign out, **delete account** (App Store guideline 5.1.1(v)).

### 5.7 "Who did you meet?" (the friendship loop)
- The morning after an event you were Going to, an Activity card lists the other attendees, with friends excluded, as one-tap friend requests.

### 5.8 Notifications (APNs)
| Trigger | Copy (draft) |
|---|---|
| Friend commits to an event you're "Down if" on | "Maya is going to Warehouse Party ✦ Still down?" with actions **Going** / **Not now** |
| Friend request / accepted | "Jordan wants to be friends" / "You and Jordan are now friends" |
| Chat message | Handled by Stream push; mutable per chat |
| Event day reminder (Going) | "Tonight: Warehouse Party at 9 PM · 4 friends going" |
| Who did you meet? | "Meet anyone at Warehouse Party last night?" |

## 6. Event supply
1. **Ticketmaster Discovery API.** This is the baseline: concerts, sports, comedy, theatre within 50 mi of Charlotte. The job runs daily and ingests the next 30 days.
2. **SeatGeek.** A second baseline source. It's a stretch goal for v1; dedupe against Ticketmaster by title, venue and start time (±1 h).
3. **Curated.** About **20–40 hand-picked local events a week**: run clubs, brewery events, markets, pop-ups, trivia, gallery nights, day parties. This is what makes the feed feel like Charlotte instead of Ticketmaster.
   - Scout from local outlets (Axios Charlotte, CLTtoday, Queen City Nerve), venue Instagram accounts and community organizers.
   - Rules: write descriptions in your own words, use images you have rights to (or the generated placeholder art), and always link to the original source.
   - Tooling in v1: Supabase Studio table editor plus a small `admins` table. An in-app admin form comes later.
4. **Provider terms.** Before launch, review each provider's display, attribution, caching and image rules and record them in `docs/DATA_MODEL.md`.

## 7. Safety and trust
- 18+ only (self-declared birthdate, phone or Apple-verified account).
- Block and report everywhere a person or message appears. Reports land in the `reports` table and send an email/Slack alert to the admin.
- Stream moderation is on for chat: profanity filter and image moderation.
- No live location sharing, ever. The feed uses your location only to rank and filter, and it is never stored server-side.
- App Store guideline 1.2 checklist: filter objectionable content, a reporting mechanism, blocking, and published contact info. All four are in v1.

## 8. Launch plan
- **Weeks 1–9:** build (see `MILESTONES.md`).
- **Week 10:** TestFlight closed beta with **30–50 people** in Charlotte. Recruit through friends of friends, a couple of run clubs and social clubs, and new-grad cohorts at large Charlotte employers.
- **Week 11:** iterate on the beta; grow to about 200 testers.
- **Week 12:** App Store submission; public launch in Charlotte.
- Before beta, seed curated events 2 weeks ahead, so the first open always shows a full weekend.

## 9. Risks
| Risk | Mitigation |
|---|---|
| Empty feed / cold start | Ticketmaster baseline + curated weekly + the Nearby mode works with zero friends |
| A solo developer new to mobile, on Windows, on a 12-week clock | Strict v1 scope, a cut list in MILESTONES, Expo + EAS (no Mac needed), Claude Code with Expo skills, native components over custom ones |
| Stream free tier capped at 2,000 MAU | Chat sits behind a `ChatService` protocol; upgrade or migrate if we hit it (a good problem) |
| Supabase free tier pauses after inactivity | Fine for development; upgrade to Pro ($25/mo) at public launch |
| Strangers in chats → safety incidents | 18+, block/report, moderation, chat only for people who are Going, archive after the event |
| API terms violations | Review terms in week 3; attribution and link-outs built into the card and detail |

## 10. Later (v1.1+)
- Live Activity on event day, plus "Tonight" home screen widget
- User-hosted events and invites
- Recurring groups and communities
- A second city
- Embeddings-based recommendations (pgvector)
- Android
