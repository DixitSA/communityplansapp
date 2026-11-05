# yard full flow sweep

Started November 4, 2026 (America/New_York). Work in progress; this is not release sign-off.

## Evidence rules

- PASS requires an observed assertion; code review alone is REVIEWED.
- WEB means the Expo web fallback with isolated in-memory demo data, not native iOS.
- UNIT means automated logic/component tests, not a full device flow.
- BLOCKED records a concrete environment/access limitation. UNTESTED remains work to do.
- Existing uncommitted lockfile, generated database types, events and marketing work are preserved.

## Baseline

| Check | Status | Evidence |
|---|---|---|
| TypeScript | PASS | `npm run typecheck`, exit 0 |
| ESLint | PASS | `npm run lint`, exit 0 |
| Jest suites after fixes | PASS; open-handle warning remains | Latest normal serial run after the auth and chat fixes: 61/61 suites and 407/407 tests passed in 85.361 seconds after auth and chat catch-up fixes. Auth-focused tests pass 2/2; chat/friend-action tests pass 12/12 and exit naturally after test-local query/mutation GC cleanup. Typecheck/lint pass. Jest still reports open async operations after its successful summary; only the confirmed test process was stopped after 10 seconds. Earlier targeted QueryClient GC fixes pass focused handle checks, but the remaining full-run handle is unidentified. |
| Database privacy/RLS | PASS (isolated CI database) | Fresh rerun at exact HEAD `5d36ac3f4e5b3559875f5262b777d6807f06d4ff`: 17 files, 459 tests passed. [GitHub Actions](https://github.com/DixitSA/communityplansapp/actions/runs/41935314556). Hosted staging execution still unverified. |
| Hosted auth, persistence and chat | PASS (API-level, staging) | Guarded `mobile/scripts/qa-staging.cjs --run --chat` passed 30/30 checks on two consecutive runs. Covers OTP verification without sending email, onboarding, persisted profile edits, friendship/block flows, RSVP-gated chat, recipient Realtime INSERT, saved history, body erasure on deletion, and chat access removal after leaving Going. Each run used two disposable accounts and one exact-ID event dated 2099, then verified cleanup. An initial attempt timed out on live delivery; no app/backend change was made, and later passes do not erase that intermittent result. Native provider login/email delivery remain unverified. |
| Edge functions | PASS | `npx --yes deno test --allow-read=supabase/functions supabase/functions`: 82 passed, 0 failed across 10 files. |
| Final fixture / calendar / coordinates check | PASS | After neighborhood fix: 3 suites, 15 tests passed (`fixtureNeighborhoods fixtures.test coords.test`). |
| Additional demo block/unblock and hint checks | PASS | Demo friends/chat: 22 tests passed after regression fixes; first-use hint: 2 tests passed. Subsequent typecheck, lint, runner syntax check and diff whitespace check pass. |
| Native iOS | PARTIAL | EAS run 10 map/location flow passed; individual RSVP/chat send/search/friend acceptance/OTP/birthday/Settings header/block/unblock checks passed across runs 8–11. Filters and profile Save fixes still await recheck. GitHub run 3 proved the driver works but all eleven flows stopped at reset because tracked dotenv configuration selected real sign-in; cold bundling also exceeded the reset wait. Run 41985757879 confirms isolated demo startup; smoke and chat-actions pass, while other flows have partial or blocked results detailed below. The prior preflight rejected Expo CLI converting localhost to 127.0.0.1; the corrected parser accepts loopback only and passed five local boundary checks. |

## Screen and menu coverage

PARTIAL means some individual assertions passed; remaining assertions still require work. WEB is not an iOS pass. Source route inventory reviewed.

| Area / routes | Required flow assertions | Status |
|---|---|---|
| Welcome `/welcome` | Apple sign-in success/cancel/error; email navigation | PARTIAL WEB / UNIT |
| Email `/email`, `/verify` | Invalid/valid address; code paste/autofill; wrong/expired code; resend countdown and rapid taps; back/change email | PARTIAL WEB / UNIT / NATIVE (email/OTP and change-email individually) |
| Dev session `/dev-session` | Disabled in ordinary builds; missing/invalid token handling; enabled simulator sign-in and route handoff | PARTIAL UNIT (disabled/missing-token redirects and mocked invalid-token error pass; real enabled simulator sign-in and device handoff remain unverified) |
| Onboarding `/onboarding/profile` | Required name; username availability; 18+ boundary; birthday picker; back/sign out | PARTIAL WEB / UNIT / NATIVE (run 11 birthday commit and Continue pass; complete onboarding remains unverified) |
| Onboarding interests | 0/1/2/3+ selections; deselect; load failure/retry | PARTIAL WEB / UNIT / NATIVE (selection individually; full onboarding not completed) |
| Onboarding location | Allow/deny/unavailable; Charlotte fallback; back; repeated navigation | PARTIAL WEB / UNIT / NATIVE (run 10 location-deny/map flow pass) |
| Onboarding friends | Invite/cancel; finish/error/retry; already-onboarded recovery | PARTIAL WEB / NATIVE (finish→feed not yet observed native) |
| Feed `/` | Nearby/Friends; date strip/far date/Today; scroll synchronization; loading/empty/error/retry; event links; spotlight | PARTIAL WEB / UNIT |
| Feed filter menus | Time; distance; interests; neighborhood; price; clear; count; apply/cancel | PARTIAL WEB / UNIT / NATIVE (selection passed; Clear failure tracked in QA-17) |
| City `/city` | Charlotte selection/dismiss (only supported city); native swipe dismissal | PARTIAL WEB |
| Map (Feed toggle) | List/map toggle; selected day and filters; pins/select/deselect; event card; locate/permission/error | PARTIAL WEB / UNIT / NATIVE (run 10 map/location permission flow pass) |
| Event `/event/[id]` | Missing event/retry; Interested/Down-if/Going/clear; undo; privacy; attendees; tickets; directions; share; report/cancel | PARTIAL WEB / UNIT / NATIVE |
| Going sheet | Open chat; calendar permission/cancel/save; invite/cancel; dismiss | PARTIAL WEB / UNIT / NATIVE |
| Chats `/chats`, `/chat/[eventId]` | Membership gate; list/empty/error/retry; send/rapid send/failure/retry; older messages; live updates; delete/report/block; leave/cancel; archive | PARTIAL WEB / UNIT / NATIVE (run 11 unique message send passes; native delete/leave suites unexecuted) |
| Search `/search` | Events/People; shortcuts; empty/query/clear; short query; no results/error/retry; results→event/user | PARTIAL WEB / UNIT / NATIVE (event and people search individually) |
| Profile `/profile` | Activity/settings/friends; plans/interested tabs; loading/error/retry; tickets; suggestions; empty CTA | PARTIAL WEB / UNIT |
| Edit `/edit-profile` | Load/retry; cancel; field validation; interests; save/error/retry; edit while pending; reopen persistence | PARTIAL WEB / UNIT |
| Friends `/friends`, `/user/[id]` | Search; request/accept/decline/cancel/remove; invite; profile/self/missing; shared events; report/block/confirm/cancel | PARTIAL WEB / UNIT / NATIVE / HOSTED API |
| Activity `/activity` | Requests/actions; profile/event links; loading/error/retry; notification availability | PARTIAL WEB / UNIT |
| Settings `/settings` | Privacy load/save failure and persistence; links; sign-out/cancel; delete double-confirm/cancel/error | PARTIAL WEB / UNIT; native menu navigation partial, layout recheck pending |
| Blocked `/blocked` | Load/empty/error/retry; unblock/cancel; cross-screen cache refresh | PARTIAL WEB / UNIT / NATIVE / HOSTED API |
| Help `/help` | Scroll/readability/Done; accurate feature descriptions | PARTIAL WEB / UNIT |
| Suggest `/suggest` | Required/optional validation; date picker; submit/error/retry; pending edits; confirmation; history | PARTIAL WEB / UNIT |
| Not found `+not-found` | Recovery to auth/onboarding/app according to the active gate | PARTIAL UNIT (unknown route recovers to Feed in demo; native assertion authored but not executed; auth/onboarding recovery still unverified) |
| Developer gallery `/gallery` | Direct-route access only in development; component states | PARTIAL UNIT (dev/production direct-route guard passes; native gallery components and appearance states untested) |
| Native platform | Tabs; menus; sheet detents/swipe; keyboard; safe areas; light/dark; large text; VoiceOver; Reduce Motion/Transparency; app resume | PARTIAL NATIVE (tabs, selected menus and permission denial observed; accessibility, appearance and lifecycle matrix untested) |

## Confirmed findings and fix tracking

| ID | Finding | Status |
|---|---|---|
| QA-01 | Privacy setting failures hidden; unknown value rendered as enabled | FIXED; targeted UNIT pass |
| QA-02 | Profile pending/failed plan fetch shown as empty | FIXED; targeted UNIT pass |
| QA-03 | Editing profile while saving resets pending state, allowing duplicate saves/navigation | FIXED; profile pending/duplicate-save integration regression passed as part of 3/3 submission-race tests using `userEvent.press`, a prefetched interests cache and a cleared client with `gcTime: Infinity`; normal save WEB pass |
| QA-04 | Editing event suggestion while submitting permits duplicate submission | FIXED; deferred-mutation UNIT regression passed |
| QA-05 | Repeated Resend taps can send concurrent OTP requests | FIXED; deferred-mutation UNIT regression passed |
| QA-06 | Activity failed/pending requests look like empty activity | FIXED; targeted UNIT pass |
| QA-07 | Block/unblock leaves related cached views stale | FIXED; targeted UNIT pass; all cached chat screens now invalidated |
| QA-08 | Real Activity only includes friend requests; other notifications use demo fixtures | Missing feature remains. FIXED misleading Help and first-use Down-if hint promises of notifications; both now direct users to check the event. |
| QA-09 | Event Search and Map hide feed failures as empty results | FIXED; Search UNIT pass; map device check pending |
| QA-10 | Add to Calendar ignores listed end time, truncating overnight events | FIXED; observed failing regression (2AM expected, 11PM actual), then 9/9 helper tests passed |
| QA-11 | Blocked-list error tells user to retry but offers no retry control | FIXED; added Try again |
| QA-12 | Demo feed has no neighborhood metadata, so neighborhood filters incorrectly show no results | FIXED; 2 targeted regression tests pass; typecheck and targeted lint pass. Browser recheck pending. |
| QA-13 | Native demo cold launch opens Welcome instead of Feed | FIXED; root `(tabs)` anchor. Runs 9–10 reach Feed; Any time→Tonight passes. Protected guards retain real auth/onboarding routing; pure gate tests pass 10/10. |
| QA-14 | Demo blocks hide people, but Blocked people always returns empty and Unblock is a no-op | FIXED; failing regression reproduced, then demo friends/chat tests passed. Block list tracks timestamps; unblock restores discoverability and messages without restoring friendship. Native block/list/unblock passes in runs 8 and 10. |
| QA-15 | Welcome says users agree to Terms and Privacy Policy, but both are plain text with no way to open the documents | NEEDS WORK; user confirmed there are no published documents. Actual policy documents and destinations are needed before wiring links; no placeholder URLs invented. |
| QA-16 | Native Settings header/content overlap and scroll reachability | Header FIXED: run 11 screenshot shows Settings/Done correctly aligned above content. Help scrolling still needs recheck: the test swiped near screen center, outside the half-height sheet. Next flow expands from the observed grabber position before scrolling. Sign out alone is hidden in demo; Delete account opens the no-account alert. |
| QA-17 | Native Filters header is occluded by distance controls and Clear did not clear | Run 10 reproduced the overlap. First candidate regressed in run 11 to a blank body with only the footer visible. Installed react-native-screens source requires a direct ScrollView child for form-sheet sizing. Revised candidate removes the outer View and measures the overlaid footer to reserve scrolling space; native recheck pending. |
| QA-18 | Native profile name field covers Save, preventing save/dismissal | Run 11 screenshot and intersecting bounds confirm a real hit-target obstruction. Candidate uses a direct root ScrollView with an opaque sticky header and automatic keyboard insets. Suggest, Help and Blocked sheets also use the same corrected native layout. Native recheck pending. |
| QA-19 | Leaving Email while code delivery is pending can navigate back into Verify after the screen has unmounted | FIXED; deferred send-code/Back/unmount regression reproduced, then passed with the mounted-screen guard. Focused auth tests pass 2/2; typecheck/lint pass. |
| QA-20 | Native Apple sign-in button only dims while busy, allowing another authentication request | FIXED; repeated-tap test reproduced two API calls for one pending request. Synchronous in-flight guard limits it to one; focused auth tests pass 2/2. Real Apple provider login remains unverified. |
| QA-21 | Chat connection becoming ready during the first history fetch can miss newer messages | FIXED; deferred-history regression reproduced a single stale fetch. A scoped follow-up invalidation after an in-flight request settles retrieves the missing message. Chat hook tests pass 9/9, including existing reconnect and disabled-membership cases; typecheck/lint pass. |
| QA-22 | Developer gallery direct route was available to signed-in production users | FIXED; nested SDK 58 `Stack.Protected` guard denies `/gallery` outside development. Focused route regression confirms development access and production redirect. Native gallery component states remain unverified. |

## Recorded click-through evidence (WEB demo, 393 x 852 viewport)

These are individual passes, not blanket passes for their whole screen or native equivalents.

- PASS: feed event link opens matching Warehouse Party details.
- PASS: Interested and Down-if show private visibility hint.
- PASS: Going opens confirmation, reveals other attendees, and opens the correct chat.
- PASS: demo chat send displays the new message and clears/disables the empty composer.
- PASS: return from chat preserves Going; changing to Interested hides attendee names; Undo restores Going and attendee access.
- PASS: returning to feed shows the event's changed plan.
- PASS: Music + Free filters change result count from 19 to 5; Clear restores 19 and disables itself; apply returns to feed.
- PASS: map toggle shows current day's 2 demo pins; selecting Warehouse Party shows its matching card. This is the WEB map fallback, not Apple Maps.
- PASS: event search finds Warehouse; @maya switches to people search and returns Maya; Clear restores the friends shortcut.
- PASS: friends shortcut shows 1 incoming request; accepting Noah changes friends count from 5 to 6 and adds him to the list.
- PASS: Maya's user profile opens with friendship state and shared past event links.
- PASS: empty edit-profile name disables Save; saving `QA Taylor` updates the visible own-profile name.
- PASS: privacy toggle turns off and remains off after visiting Blocked people and returning.
- PASS: empty blocked list has an accurate empty message and working Done navigation.
- PASS: Suggest disables submit for an invalid URL; valid demo submission shows confirmation and Pending suggestion history in Settings.
- PASS: email validation, demo send-code navigation, six-digit input, resend countdown, and change-email navigation.
- PASS: onboarding blocks a 2015 birth date with an 18+ message; valid 1995 birth date continues. Interests requires three selections (0/2 disabled, 3 enabled).
- PASS: Just Charlotte skips location to step 4; Finish completes demo onboarding and opens the feed.
- PASS: city menu shows Charlotte as the supported city; selecting it returns to the feed.
- PASS: Morning time filter leaves 9AM rides; combining with 1 mi gives an accurate empty state; Clear filters restores Any time / 10 mi and events.
- PASS: Friends feed removes events without friends going; Chats with no Going plans shows suggestions and Browse the Feed recovery.
- PASS: cold-linking to an unknown event shows an accurate missing-event message; Back recovers to Feed.
- PARTIAL: Help opens and closes; corrected unsupported Down-if Activity notification promise (QA-08).
- BLOCKED ON WEB: native alert/action-sheet menus (chat options, report/block/delete confirmations) do not render in the React Native web fallback. Do not count clicks on those controls as passes.
- Test-data limitation: demo API mutations reset on full reload; hosted persistence is not established by these checks.

## Test environment

Local demo server uses `EXPO_NO_DOTENV=1` and empty Supabase public configuration, so mutations stay in memory. Hosted backend writes, real messages, account deletion, and deployment are not part of this test environment.

Supabase access subsequently verified through the saved CLI login: linked `yard-staging` project `lvgmelaavgmyjjdggzop` is active, with 2 auth users/profiles and 385 events. Read-only migration inventory ends at `20261104000300`. The CLI labels its default `main` branch "production"; project documentation identifies this project as staging. All 17 SQL tests were audited for BEGIN/ROLLBACK boundaries with no detected nontransactional external effects. Hosted test execution stopped because the CLI requires local Docker/Podman. A fresh exact-HEAD CI rerun provided isolated-database evidence instead; no test data was written to hosted staging.

Subsequent scoped API run: created two uniquely named `example.test` accounts, verified generated OTPs without sending email, and ran 17 assertions through normal public sessions. Only these accounts and their owned profile/friendship/block/notification rows were changed. Exact-ID cleanup verified both Auth users and all checked owned rows absent. Auth audit-log entries may remain. Existing users, events, chat messages and moderation records were not changed. Reusable runner defaults to read-only dry run; hosted mutation requires the guarded project reference and `--run`.

## Native test infrastructure

- Current: [GitHub run 41985757879](https://github.com/DixitSA/communityplansapp/actions/runs/41985757879), commit `4acad5bc92633ead6a4a94a486c95762226d2238`, twelve flows with dotenv isolation, bundle prewarm and a loopback-only URL guard. Completed; smoke/chat-actions pass, other partial or blocked results are detailed in the closeout additions. Previous run 41983879711 quarantined `.env.development` successfully but failed preflight because Expo CLI advertises localhost as `127.0.0.1`. The remaining jobs were canceled after confirming that shared blocker. The corrected parser was exercised locally: localhost/IPv4/IPv6 loopback accepted and normalized; external host and wrong port rejected. No UI assertions from that failed run.
- [GitHub run 41979937095](https://github.com/DixitSA/communityplansapp/actions/runs/41979937095), commit `a5be18939405732de95c8aaee9f944b70ba52152`: simulator/Maestro operate and produce JUnit results, but all eleven flows fail in reset before feature assertions. All three Metro logs show the staging backend configured, despite empty environment variables and `EXPO_NO_DOTENV`; GitHub checked out the tracked `mobile/.env.development`, unlike the filtered EAS archive. Welcome is the correct signed-out screen, not evidence of another auth-routing bug. Cold bundles also took 244–271 seconds, exceeding the reset wait. The next harness quarantines dotenv files only in the disposable CI checkout, prewarms the exact manifest launch asset, and rejects a bundle containing the staging host before any UI tests.
- Toolset discovery: no relevant hosted-device plugin was returned. Existing-account `eas simulator:availability --json --non-interactive` returned `available: false` for `xitidxs-team`; the interactive Expo service requires preview access. Appetize and BrowserStack require additional account/build setup, so the existing free public GitHub runner remains the selected route. No new account or paid plan was created.
- EAS run `01a1aa23-95f1-7729-9ae9-4c9440f55bd2` was rejected before execution: Free plan CI/CD/Simulator 60-minute quota exhausted, resetting December 1 UTC. No upgrade or paid runner was used.
- Free fallback: standard GitHub macOS runners in this public repository, with pinned/checksummed Maestro 2.6.1 and the same isolated Expo Go demo script. [First GitHub run](https://github.com/DixitSA/communityplansapp/actions/runs/41973621960) failed at XCTest/Maestro driver startup on `macos-26` ARM; the watchdog ended the job before the nine selected flows could complete. No reliable app assertion passes from that run. [Second GitHub run](https://github.com/DixitSA/communityplansapp/actions/runs/41975916305), commit `f7d1b491e0c5f430ede60110d29193f4e12f9003`, uses standard `macos-26-intel`, a 180-second driver startup allowance, and only smoke/profile-settings to establish driver health and verify Save. The native step timed out at 06:02:14 UTC. Maestro began smoke at 06:01:08 and tapped the Expo Go Open prompt at 06:02:05; the Feed assertion did not complete and profile-settings never started. Logs are saved locally in %TEMP%/yard-gh-run2-artifacts; no screenshots or flow summary were produced. This is incomplete infrastructure execution, not an app pass or a reproduced app failure. No paid runner used.
- QA snapshot: branch `qa/ios-sweep-20261105`, commit `766ffa297a348f27e6c4bfa12d60290e79622f76`, prepared in `C:/Users/sahil/communityplansapp-ios-qa`. Only task-authored mobile changes and the new workflow were copied. The original working tree and `main` were not changed by this commit. Preexisting generated type changes and lockfile edits remain local; the lockfile was verified equivalent after removing `dev` metadata flags, with no dependency version differences. No PR, merge, deployment or App Store submission was performed.
- Manual workflow: `mobile/.eas/workflows/ios-expo-go-smoke.yml`; Maestro flow: `mobile/.maestro/ios-smoke.yml`.
- YAML validation passed. A temporary root `.easignore` limited the QA archive; inspected archive contains the workflow, script and app, contains zero `.env*` files, and excludes marketing/backend contents. After the eighth upload, the filter was moved to `mobile/.eas/qa-upload.ignore` so ordinary builds keep their previous archive behavior. Reuse it temporarily at the repository root for another isolated demo QA upload, then restore/remove the temporary root file.
- [First hosted Mac attempt](https://expo.dev/accounts/xitidxs-team/projects/yard/workflows/01a1a97e-9dc9-7981-b6f7-2af0e8b0488c): Mac M4 Pro/Xcode 26.6 provisioned, npm ci succeeded, simulator selector exited before app launch. No native pass claimed.
- [Second hosted Mac attempt](https://expo.dev/accounts/xitidxs-team/projects/yard/workflows/01a1a983-54c9-7660-9b32-e118ba2aa163): iPhone 17 Pro on iOS 26.5 boots successfully; Expo Go downloads as an extracted `.app`. Bootstrap assumed an archive and stopped before install; corrected to accept `.app` and fixed artifact path.
- No subscription upgrade, deployment or App Store submission performed.

- Third hosted Mac attempt: Expo Go installed successfully; Metro log reports ready on localhost but the 127.0.0.1 readiness check timed out. Artifact downloaded and inspected. Retrying with consistent localhost URLs and explicit connection diagnostics.
- [Fourth hosted Mac attempt](https://expo.dev/accounts/xitidxs-team/projects/yard/workflows/01a1a996-5f1f-7629-9c0a-0fad767c7671): corrected localhost checks pass, Metro ready. Initial yard assertion timed out because iOS showed Open in Expo Go? confirmation. Screenshot verified the modal; app itself did not open. Flow now explicitly taps Open.
- [Fifth hosted Mac attempt](https://expo.dev/accounts/xitidxs-team/projects/yard/workflows/01a1a9a1-f488-77a6-a6e6-4d9a06f36559): Open succeeds, app bundles and logs demo mode/profile fetch success. Expo Go's developer-menu intro blocks yard assertion; Continue action added. Screenshot shows app Welcome underneath; investigating initial-route choice (QA-13).
- [Sixth hosted Mac attempt](https://expo.dev/accounts/xitidxs-team/projects/yard/workflows/01a1a9af-9c17-7972-8b6e-702f4c7c5457): explicit root launch added; manifest HTTP 500 from Expo CLI development-signing cache rename ENOENT prevents app assertions.
- [Seventh hosted Mac attempt](https://expo.dev/accounts/xitidxs-team/projects/yard/workflows/01a1a9ba-4548-7b2a-ad3f-d6395b21bb0c): clearing EXPO_TOKEN and using offline mode does not resolve the signing-cache failure. Native smoke and core-flow files remain unverified. Investigating cache initialization before spending another runner attempt.
- Eighth attempt uses an isolated, preinitialized Expo cache and a manifest preflight matching Expo Go headers; local preflight returned HTTP 200 multipart/mixed. The original cache error did not reproduce locally, so the workaround is not yet established as a root-cause fix. Launch URL uses Expo CLI's developer-menu suppression parameters. Smoke, core and native-menu suites run independently; each records PASS/FAIL.
- [Eighth hosted Mac result](https://expo.dev/accounts/xitidxs-team/projects/yard/workflows/01a1a9cc-ed75-75df-9924-568e3ad13b02): manifest preflight passes. All three suites fail overall. Smoke reaches Welcome instead of Feed (QA-13). Core passes Rooftop details, Interested/private hint, Going confirmation and opening chat; iOS exposes the composer as `Message Message the group`, so the selector was corrected without changing the composer. Native menus pass event-report reasons/cancel, person-report reasons/cancel, block confirmation/cancel, block, blocked-list entry, unblock confirmation/cancel and unblock to `No one blocked`. It then fails scrolling Settings to Sign out (QA-16). These individual native passes do not establish complete screen coverage.
- [Ninth hosted Mac result](https://expo.dev/accounts/xitidxs-team/projects/yard/workflows/01a1a9de-d1b5-7e5e-a440-95c69c4d1942): all six suites fail overall, but cold Feed, Any time→Tonight, all four tabs, event/people search, Noah acceptance (shown in Friends · 6), invalid/valid demo email and OTP, and profile form entry pass individually. Suggest test tapped the noninteractive date label; a sheet then remained over subsequent navigation. Birthday was below the keyboard and needed scrolling. Later root-link/map failure screenshot still shows onboarding, so it is not evidence of a map-rendering bug. Next validation uses app restart per suite, actual input/picker identifiers and appropriate scrolling; no incomplete suite is marked PASS.
- [Eleventh hosted Mac result](https://expo.dev/accounts/xitidxs-team/projects/yard/workflows/01a1aa0c-7079-7c3f-ad86-d436e46eec38): all five selected suites fail overall. Individual PASS: RSVP, sending the unique chat message, search, friend acceptance, Settings header, native birthday commit/Continue, and three checked interests with Continue enabled. The interest-count assertion targeted text below the fold. Confirmed app failures: Edit Profile input covers Save (QA-18), and the first Filters fix leaves its body blank (QA-17). Harness changes pending recheck: remove duplicate simulator prelaunch before Maestro reset, retry an early Open tap, expand half-height Settings before scrolling, and scroll to the interest count. Screenshots and accessibility bounds were inspected; none of these incomplete suites is counted as a full pass.

## November 5 closeout additions

- Developer gallery direct links are now protected in production (QA-22). Route tests verify development access and production redirect. Unknown-route recovery and dev-session disabled/missing/invalid-token cases also pass focused tests (10 tests across route/gallery/dev-session suites); enabled-session errors use mocks, not a provider. Typecheck/lint and YAML validation pass. The last full Jest baseline remains 407 tests; these later additions were checked in focused runs.
- GitHub run 41985757879, layout results: **ios-smoke PASS** (192 seconds), covering Feed/date selection, four tabs, Suggest and date-picker dismissal. Profile-settings stopped at the native Expo splash before its feature assertions. Discovery passed event/people search and friend acceptance, then XCTest returned `kAXErrorInvalidUIElement` while querying an optional Open prompt after linking to Profile; Filters was not reached. Privacy setting changed true→false, remained false on returning to Settings and after background/resume; final restoration tapped the duplicate text label instead of the switch. Test selectors now use an ID on the actual switch. No persistence defect established.
- The same run's onboarding job never started flows: XCTest driver status checks timed out. No onboarding native assertions from that job. One bounded bootstrap retry is prepared: only with an explicit driver-timeout signature, readable logs showing no flow started, and no JUnit results; it preserves first-attempt diagnostics and remains under the existing watchdog. Assertion failures are never retried by this rule.
- Main Maestro flows now wait for deep-link animations and omit repeated Open taps; reset-demo retains first-launch consent handling. Profile-settings is placed first in the next layout group so a prior flow's cold-restart issue cannot prevent reaching Save. These harness changes require native recheck.

- GitHub run 41985757879 finished with two complete flow passes: smoke and chat-actions. Chat has both `[Passed]` CLI output and completed command assertions even though the enclosing menus job later hit its watchdog before writing aggregate JUnit. Core/native-menus visibly opened Help, but the title assertion failed; screenshot evidence supports rendering, not a confirmed accessibility defect. Event-actions timed out opening Expo Go before assertions; friend-actions was not reached. The next run balances all twelve flows into four groups of three.
- Tool update: official latest Maestro release `cli-2.12.1` (November 2) is pinned with GitHub's published SHA-256 `54dbb0716425626604973cbb374c585ca30272375d9ce15177a1152765ddd9d7`. Its 2.7 changes specifically address transient `kAXErrorInvalidUIElement`, app stop/start timeout handling and hierarchy traversal performance; these match observed GH5 harness failures. This is a candidate infrastructure remedy, not proof of a pass. Help title/body assertions remain; an animation wait follows opening the nested sheet. Source: https://github.com/mobile-dev-inc/Maestro/blob/main/CHANGELOG.md#270
