# Yard social setup — 29 October 2026

## Verified live observations

- Instagram in the existing Zen browser session is signed in as [@joinapexevents](https://www.instagram.com/joinapexevents/).
- Owner confirmed: “Yes—rebrand @joinapexevents.” Username remains unchanged.
- Display name changed from ApexEvents to **Yard | Find your people.** Verified in Accounts Center and a refreshed live profile. Observed counts remain 1,667 followers, 331 following, 2 posts.
- New avatar `brand/yard-avatar.png` uploaded and visually verified on the live profile.
- Bio saved and verified: “Find your people. / Local plans. Real-life friends. / Building a more social Charlotte. / Follow along as yard. grows.” (slashes represent line breaks).
- Link: beacons.ai/joinapexevents. This is an existing ApexEvents link, not a verified Yard waitlist.
- One visible highlight: “us”, containing a 2024 nightlife Reel share. Two visible nightlife Reels: `DBzBfh3uFwj` and `DBrxSEiOxDl`. No pin controls were exposed in the inspected web Reel menu; pin status remains unverified. No content deleted or archived.
- Existing professional account exposes Business tools. Category changed from Party Entertainment Service to Software, submitted and verified after reload. Category/contact labels remain hidden.
- Owner signed into Facebook. Managed Pages list contains **PushfulMedia** and **Change**, no Yard. Business Suite selector shows Sahil Dixit portfolio (one PushfulMedia asset), fax.no.printer (zero assets), and personal Sahil Dixit scope (one asset). No Yard portfolio observed.
- Created and verified [Yard App](https://www.facebook.com/profile.php?id=61595776091835) under Sahil Dixit after owner accepted Page policies. Meta rejected the broader name Yard. Category App page; matching avatar, cover and bio; Instagram website link; Send message CTA. Promotional emails disabled. No contacts invited. Public profile ID 61595776091835; Meta business asset ID observed in linking flow 1451469751381015 (API identity still to verify).
- Facebook Settings now verifies Connected Instagram: @joinapexevents / Yard | Find your people. Owner confirmed cross-account access and Meta terms. Evidence: evidence/facebook-instagram-linked.png. No campaign publishing or scheduling has occurred; profile/cover updates were authorized branding actions.

## Current handoffs

1. Meta developer app **yard**, ID **1171521182497672**, was created under the Sahil Dixit portfolio. The app ID and secret are stored in the authorized ignored local configuration; publishing remains disabled. The loopback OAuth callback has not been verified. The owner authorized adding instagram_manage_insights and storing tokens locally. Explorer granted the permission; the one-shot importer validated the token against Meta, exchanged it, and encrypted only the selected Yard Page/linked Instagram connection. The plaintext staging file was removed. Local collection is now working without relying on the incomplete callback setup.
2. Instagram web explicitly restricts link editing to mobile. Remove the obsolete Beacons link via mobile Edit profile → Links, or replace it with an owner-verified Yard URL. No verified Yard website/waitlist exists in the repository.
3. The inspected web Reel menu offers Delete but no Archive. Archive the two obsolete nightlife Reels in Instagram mobile when available; never substitute deletion.
4. Five new Highlight covers are ready. New Yard Highlights need relevant approved Stories; do not relabel the old nightlife material as Yard product information or publish Stories without approval.

## Brand source of truth

`../docs/DESIGN.md`, `../mobile/src/design/tokens.ts`, and `../design/reference/mockups-v2-yard.webp`: lowercase **yard.**, **Find your people.**, cream/forest palette. The app remains in development and starts in Charlotte. Repository examples of events/people are fictional fixtures and must not be advertised as real activity. Recurring communities and user-hosted events are later scope.

## Editorial research

- [Partiful](https://partiful.com/): occasion-led, conversational social-life messaging. Yard can borrow the focus on the social situation without copying its language/assets. This is a qualitative brand reference, not evidence of conversion performance.
- [Timeleft dinners](https://timeleft.com/dinners/): explains a tangible social activity and how people meet. Yard should similarly show the small step from an idea to a plan.
- [Bumble friendship guide](https://bumble.com/bff/friendship/amp/make-new-friends): useful friendship content can stand alone without an app pitch.
- Direct Instagram profile fetching for these brands was unavailable; no competitor engagement audit has been completed.

## API and implementation status

Official Meta documentation was verified through the browser after direct web fetching returned 429. The service pins Graph v26.0. `automation/` contains a local dashboard, exact-content approval snapshots, encrypted token storage, OAuth, scheduling and publishing adapters. App credentials and the local account-token vault are connected. Publishing remains disabled. No publication tests have run. Insights reporting is not implemented.

Initial Graph API Explorer checks on 29 October 2026 confirmed Yard App Page **1451469751381015** is linked to Instagram **17841456875103236**. `ig_hashtag_search?user_id=17841456875103236&q=cltevents` returned OAuthException **#10**, explicitly requiring review and approval for Instagram Public Content Access. No hashtag ID was returned, so recent_media was not called. Business Discovery for `campnorthend` initially returned **#10: Application does not have permission for this action**. That earlier token lacked instagram_manage_insights; the refreshed token now has it. These failures were access failures, not evidence the venue is a personal account.

After adding instagram_manage_insights to the use case and reauthorizing, the granted permissions were verified and Business Discovery succeeded. On 29 October 2026 at approximately 15:53 Eastern, explicit local collection returned **25 posts each** from `campnorthend`, `fillmorenc`, and `cltshout`: **75 stored candidates**, no invalid records or duplicates in those initial calls. The first page is not an exhaustive archive. Hashtag Public Content Access approval is still outstanding; the earlier hashtag error was not an account-eligibility failure. No event has been inserted into Yard from these posts.

Following-export import and explicit hashtag collection have been added locally. Imported handles remain unverified leads. Hashtag collection is limited to the first 25 results and tracks a conservative local rolling-seven-day quota; requests from Explorer or other tools are not included in this local counter. API access still depends on Meta approval. A local event-review flow now creates blank editable drafts from Instagram source posts and exports only complete, non-rejected records to the exact `events.json` inbox schema. It validates Eastern offset/DST and dates in the next 30 days, preserves the source permalink and Instagram handle, and never copies the social caption into event details. The owner must inspect and submit the downloaded file; the inbox creates pending submissions that remain private until an owner approves them in Studio. The local server does not read `YARD_AGENT_SECRET`, call the inbox, or write events. Inbox endpoint check returned 404; no submission or live event write was attempted. Mocked tests: **26/26**, including source candidate import, exact inbox keys, revision checks, date/DST validation, export deduplication and no live writes.

The owner clarified the priority: discover event-advertising posts from Charlotte venues and organizers for Yard event ingestion. See `discovery/README.md` for the current requirements. Official Instagram Business Discovery supports other professional accounts by known username, with a Facebook User token and `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`. The OAuth vault retains that token. Live collection works for the three tested sources: explicit collect, at most 25 first-page posts, deduped local candidates, no event date inference or live Yard writes. Facebook public-post collection is not implemented. Hashtag Search requires Instagram Public Content Access review and has a 30-unique-hashtag rolling seven-day limit. Facebook Page Public Content Access requires App Review and business verification for Pages not managed by the app user. Linking Yard accounts alone does not grant this access.

Prepared one unreviewed event draft, **Festival Día de Muertos**, for 1 November 2026, noon–6 p.m. Eastern, at Camp North End. The original post supplies the times; the organizer's https://diademuertosclt.org/ supplies the 2026 context, free entry, address and event areas. Root `events.json` contains this one record (669 UTF-8 bytes) and passed Claude's actual `agent-inbox/validate.ts` from remote commit 5e382e6. The local draft remains `draft`, revision 2; nothing was submitted or approved. The inbox code was read from the fetched remote branch, without pulling or deploying over Claude's work.

## Publishing boundary

The nine feed drafts, five silent typography Reel concept storyboards, and 30-day calendar are local drafts. They are not approved or uploaded Meta drafts. The dashboard is at http://127.0.0.1:4317/ while the local server runs; `preview/index.html` is the offline preview. Every new campaign post requires the owner's explicit approval of final media, caption, destination, action and time; changes invalidate approval. No agent may supply approval. Keep marketing infrastructure separate from the mobile app and paid generation disabled until explicitly configured with cost limits.

