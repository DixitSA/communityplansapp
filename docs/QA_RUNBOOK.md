# Running the yard QA sweep

Results and unresolved findings live in [QA_SWEEP.md](QA_SWEEP.md). A green command proves its assertions; it does not close untested flows or establish that the app has no bugs.

## Local checks

From `mobile/`:

```sh
npm run typecheck
npm run lint
npm test -- --runInBand
```

Latest consolidated Jest result after the test-only cache cleanup: 66/66 suites and 439/439 tests passed in 91.196 seconds, exit 0 with no open-handle warning. Typecheck and full lint passed before that test-only edit; they were not rerun. The earlier pre-fix run's open-handle warning and owned-session interruption are retained in QA_SWEEP.md history.

Open-handle diagnosis found `useFriendSearch.test.tsx` created fresh QueryClients using the default five-minute cache `gcTime`. It now uses `gcTime: Infinity`, matching sibling tests. The focused suite passed 6/6 tests and exited 0 in 4.562 seconds; the subsequent full 66-suite run also exited cleanly with no warning. This supports the cache timer as the cause of the observed hang.

## Native iOS without a local Mac

The `iOS demo QA` workflow runs Expo Go on standard GitHub macOS runners. This repository is public; the workflow uses no paid large runners. It quarantines checkout dotenv files, requires empty Supabase configuration, prewarms the exact iOS bundle, and rejects the known staging host before interacting with the app.

Run one group from an authenticated GitHub CLI:

```sh
gh workflow run ios-qa.yml --ref qa/ios-sweep-20261105 -f group=idb
gh workflow run ios-qa.yml --ref qa/ios-sweep-20261105 -f group=layout
```

| Group | Checks |
|---|---|
| `layout` | Profile save/reopen, discovery/filters, tabs and appearance smoke |
| `menus` | Core RSVP/chat, chat deletion/leave, event actions |
| `social` | Report/block menus, friendship actions, privacy/resume |
| `onboarding` | Email/demo onboarding, suggestions/activity, location/map/city |
| `navigation` | Event-card long-press menu and dismissal |
| `event-actions` | Focused share/invite and Expo Go Calendar feedback |
| `event-undo` | Isolated five-second Undo toast check; manual only, excluded from `all` |
| `idb` | Independent AXBridge/HID probe: demo disclosure, profile save/reopen, filter selection/Clear/Apply, Help |
| `all` | Six main groups; excludes the isolated `event-undo` timing probe |

Maestro is pinned to 2.12.1. The independent IDB toolset is pinned to Meta's 1.7.8 formula revision. IDB avoids the XCTest UI runner; its first attempt stopped during companion startup, so installation alone is not a native pass. Both tools save diagnostic artifacts.

```sh
gh run view RUN_ID
gh run download RUN_ID --name ios-demo-qa-idb --dir PATH_TO_ARTIFACTS
```

Artifacts expire after one day. Save relevant screenshots, logs and checklists before expiry. Maestro emits per-flow commands, screenshots and usually JUnit; IDB emits a checklist and stage-specific startup/failure evidence. A watchdog may interrupt a group before aggregate JUnit exists: retain observed individual assertions, but do not mark the interrupted flow passed.

The companion startup and pre-flow Maestro bootstrap have bounded handling. App assertion failures are not retried into a pass. Use a focused dispatch to investigate a specific failure, then record both attempts and the reason for any harness change.

## Direct native simulator build

SDK58 Calendar is unsupported in Expo Go, so the separate workflow builds yard itself with embedded demo JavaScript:

```sh
gh workflow run ios-native-qa.yml --ref qa/ios-sweep-20261105 -f appearance=dark
```

This uses a standard ARM Mac runner, generates the native project only in its disposable checkout, builds Release for the selected simulator architecture with code signing disabled, and verifies the bundle ID, automatic appearance, embedded JavaScript and staging-host exclusion. It installs and launches `com.dixitsa.yard` and captures its initial screen. Release without backend settings deliberately shows the configuration-error screen; it does not enable demo navigation. Build success is separate from interaction QA. No Apple account, device signing or distribution occurs.

The `ios-native-simulator-qa` artifact contains logs/checklists/screenshots and, if compilation succeeds, a zipped simulator `.app` for reuse. It is a simulator build, not an installable iPhone or App Store package. Artifacts expire after one day.

The IDB probe accepts `--flow profile`, `--flow filters`, or `--flow calendar` for independent checks; default `all` retains the combined flow with Help. Calendar requires the standalone native app. Each result records its flow, observed checks and command timings. AX reads have a bounded 30-second budget for the observed missing-frontmost-window/command-timeout transitions; assertion failures are not retried into a pass.

For demo interaction tests without recompiling the native app:

```sh
gh workflow run ios-native-recheck.yml --ref qa/ios-sweep-20261105 -f build_run_id=42016734035 -f appearance=dark -f engine=appium
```

The recheck validates the source run, archive and unchanged native build inputs, then refreshes embedded Hermes JavaScript/assets. Only in the disposable CI checkout, it changes `useGate.ts`'s `dev: __DEV__` argument to `dev: true` to allow in-memory demo routing in Release, records that exact diff, and restores the source immediately after bundling. It leaves the committed production guard and other development-only behavior intact. Metadata distinguishes native source SHA, JavaScript/probe SHA, bundle hashes and this instrumentation: results are **instrumented demo**, not production authentication sign-off. Profile, filters and Calendar run independently, so one failure does not suppress the others. No calendar event is saved. The first recheck reached and captured a correctly dark Feed; it did not complete profile/filter/Calendar assertions. AXBridge writes failed, so follow-up probes use source-verified HID swipes and keyboard entry. Recheck `42023956161` executed HID swipes but again timed out on AX reads before feature assertions. Both attempts and their outcomes stay in the checklist; further IDB retries are paused.

The recheck now supports `engine=appium` (default) or `engine=idb`. Appium 3.9.0 with XCUITest driver 12.22.8 uses one session on the selected simulator, a loopback-only server, explicit headless simulator mode, and separate profile/filter/Calendar cases. It disables the driver idle wait with `waitForIdleTimeout=0`; a pass therefore does **not** validate performance or idle behavior. Demo preflight opens the first Delete account alert, requires “No account to delete” plus the demo-mode message, and dismisses it; it never continues a deletion confirmation. The proof is reused only within the same immutable bundle/session. The Release-hidden passive footer is not used. It preserves normal OS motion settings, records command timings/capabilities and saves per-flow checklists, screenshots and page sources. The workflow has a 25-minute job limit and a 20-minute probe watchdog. Driver setup or session startup alone is not a flow pass. [Appium capability reference](https://appium.github.io/appium-xcuitest-driver/latest/reference/capabilities/).

## Hosted staging checks

From `mobile/`, the runner defaults to a read-only preflight:

```sh
node scripts/qa-staging.cjs --project-ref lvgmelaavgmyjjdggzop
```

Explicit scoped runs require the existing Supabase CLI login and the guarded `yard-staging` project:

```sh
node scripts/qa-staging.cjs --project-ref lvgmelaavgmyjjdggzop --run
node scripts/qa-staging.cjs --project-ref lvgmelaavgmyjjdggzop --run --chat --wait-for-postgres
node scripts/qa-staging.cjs --project-ref lvgmelaavgmyjjdggzop --run --chat --wait-for-postgres --chat-stress
node scripts/qa-staging.cjs --project-ref lvgmelaavgmyjjdggzop --run --delete-account
```

These create uniquely named disposable accounts; chat also creates an owned event dated 2099. OTPs are verified without sending email. The runner uses normal authenticated sessions for behavior checks and exact-ID cleanup for its fixtures. It verifies cleanup and never logs keys. Do not change the project guard or point this script at production to bypass a failure.

The deletion option first uploads a synthetic 1×1 PNG using the disposable account’s normal storage client, verifies the exact owned path exists, invokes the deployed account-deletion function, and verifies file/Auth/owned-row removal. It tracks the path before upload and cleans that exact path before Auth deletion on failure. The latest run passed 22/22 with exit 0 and verified cleanup of both disposable users. Native confirmation UI remains separate. Optional `--chat-stress` requires `--run --chat --wait-for-postgres`; it sends five ordered QA messages, removes the recipient subscription, writes a message during the gap, verifies authenticated history catch-up, rejoins with server-confirmed readiness and tests another live insert. One guarded run passed 46/46 total, including all 16 stress checks, with exact fixture and disposable-user cleanup verified; sanitized evidence is in `docs/qa-evidence/2026-11-05-chat-stress.json`. Historical Realtime timeouts remain on record; this single pass does not establish long-term reliability.

## Closing a finding

Record the trigger, expected result, observed failure, fix, and the exact evidence used to recheck it. Keep WEB, UNIT, hosted API and NATIVE evidence separate. Browser screenshots do not validate iOS sheet geometry or native dialogs. A source change without a successful recheck remains pending.

Full sign-off still requires the unfinished items in QA_SWEEP.md, including native layout rechecks, actual provider/email paths, accessibility and device/build coverage, and published Terms/Privacy destinations. Do not erase these gaps when automated suites turn green.

The app now opts into server-confirmed Postgres Changes readiness. The staging runner's explicit `--wait-for-postgres` flag mirrors that behavior; omitting it retains the earlier subscription signal for comparison. One guarded readiness-wait run passed 30/30, with live delivery at 1.021 seconds after setup and fixture cleanup verified. The later optional chat-stress run passed 16/16 stress checks (five ordered inserts, recipient unsubscribe/reconnect, history catch-up and next live delivery); cleanup was verified. Both are finite passing observations and do not establish long-term transport reliability.

Latest native checkpoint: all six selected instrumented-demo flows pass on the iOS 26 simulator: Profile 8/8 (`42106758884`); Filters 6/6 and Calendar 8/8 (`42110711142`); Profile interests 7/7 and Map 9/9 (`42119726139`); Context menu 15/15 (`42132047126`, latest script SHA `3d7b7fe`). Appium has `waitForIdleTimeout=0`; this does not validate performance/idle behavior or production authentication. QA-17/27/31 are closed for these tested flows. Earlier setup/dismissal failures remain historical in QA_SWEEP.md. Broader accessibility, older iOS, provider/email, policy and sustained Realtime checks remain open.

Current native follow-up: discovery completed selected event/people search, friend acceptance and privacy assertions, then hit an ambiguous duplicate Nightlife locator. The isolated Expo Go filter recheck `42160407629` passed 29 commands for Nightlife/Free/Uptown selection and Clear; [checklist/screenshots](qa-evidence/2026-11-06-ios-filters-checklist.md). Feed/Settings larger-text overflow is QA-32, fixed locally and being rechecked in `42161253591`. The iOS 26 AX audit `42157207355` recorded 13 generic Feed and 4 Settings findings with no element-level detail; review is pending, so native accessibility coverage is partial.

An iPhone 16 Pro/iOS 18.5 compatibility run on arm64 macOS 15.8.2/Xcode 16.4 passed Map 10/10 and Calendar 8/8 (`42158370458`, `e008d4f`): marker→event details/RSVP, plus native Calendar editor/title and Cancel→discard→Going return. No event was saved. [Map](qa-evidence/2026-11-05-native-map-details-ios18-5.png), [Calendar](qa-evidence/2026-11-05-native-calendar-cancelled-ios18-5.png), [metadata](qa-evidence/2026-11-05-native-ios18-5-compatibility.json). Profile/filter compatibility at 18.5 and iOS 16/17 remain untested.

Focused WEB check: latest run `web-checks-20261106040046552` passed 9/9 in isolated in-memory demo with `EXPO_NO_DOTENV=1` and all `EXPO_PUBLIC_*` blank. It verifies invalid profile draft disables Save, Cancel/reopen preserves the saved name, and Afternoon + 5 mi remains selected across Filters→Feed→reopen; Clear restores defaults and returns to the captured initial count (19; selected count 2). This is not native evidence. Run `cd mobile && node scripts/qa-web-checks.cjs`; the runner refuses occupied port 8097, checks its owned Expo child during startup, and uses a unique evidence folder per run. [Checklist/screenshots](qa-evidence/web-checks-20261106040046552). The earlier 7/7 dated evidence remains intact. Load-error/retry coverage remains untested: the blank-backend demo does not offer a deterministic request-failure setup.

Native workflow groups include `all`, `profile`, `filters`, `calendar`, and `filters-calendar`; Appium-only `extended` covers Profile interests, Map, and Context menu. The three flows passed 7/7, 9/9, and 15/15 respectively. The context-menu flow verified its actions, measured gutter dismissal, and return to Feed without selecting an action. [Opened menu](qa-evidence/2026-11-05-native-context-menu.png); [dismissed menu](qa-evidence/2026-11-05-native-context-menu-dismissed.png). Appium matches exact visible/accessible identifiers or labels and checkpoints assertions incrementally.
