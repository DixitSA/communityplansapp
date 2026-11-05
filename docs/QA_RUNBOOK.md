# Running the yard QA sweep

Results and unresolved findings live in [QA_SWEEP.md](QA_SWEEP.md). A green command proves its assertions; it does not close untested flows or establish that the app has no bugs.

## Local checks

From `mobile/`:

```sh
npm run typecheck
npm run lint
npm test -- --runInBand
```

Latest consolidated result: 65 suites / 438 tests pass, plus typecheck and lint. Jest still reports an unidentified open handle after its summary. Preserve the summary; if it remains open after ten seconds, stop only that test process. Do not use a broad Node process kill or treat an interrupted run without a summary as a pass.

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
node scripts/qa-staging.cjs --project-ref lvgmelaavgmyjjdggzop --run --delete-account
```

These create uniquely named disposable accounts; chat also creates an owned event dated 2099. OTPs are verified without sending email. The runner uses normal authenticated sessions for behavior checks and exact-ID cleanup for its fixtures. It verifies cleanup and never logs keys. Do not change the project guard or point this script at production to bypass a failure.

The deletion option first uploads a synthetic 1×1 PNG using the disposable account’s normal storage client, verifies the exact owned path exists, invokes the deployed account-deletion function, and verifies file/Auth/owned-row removal. It tracks the path before upload and cleans that exact path before Auth deletion on failure. The latest run passed 22/22 with exit 0 and verified cleanup of both disposable users. Native confirmation UI remains separate. The chat runner retains a 15-second delivery failure even if a later observation sees a message. Current intermittent Realtime failures remain recorded despite passing repeats and the app's history-refresh mitigation.

## Closing a finding

Record the trigger, expected result, observed failure, fix, and the exact evidence used to recheck it. Keep WEB, UNIT, hosted API and NATIVE evidence separate. Browser screenshots do not validate iOS sheet geometry or native dialogs. A source change without a successful recheck remains pending.

Full sign-off still requires the unfinished items in QA_SWEEP.md, including native layout rechecks, actual provider/email paths, accessibility and device/build coverage, and published Terms/Privacy destinations. Do not erase these gaps when automated suites turn green.

The app now opts into server-confirmed Postgres Changes readiness. The staging runner's explicit `--wait-for-postgres` flag mirrors that behavior; omitting it retains the earlier subscription signal for comparison. One guarded readiness-wait run passed 30/30, with live delivery at 1.021 seconds after setup and fixture cleanup verified. This does not establish long-term transport reliability.

Latest Appium checkpoint: `42032824181` could not start WebDriverAgent (`/status` timeout), so its three flow checklists contain zero assertions. Earlier `42029546093` reached native Settings, establishing that the driver can interact, but stopped at a now-corrected Release-hidden footer check. Core flows are not signed off. The proposed extended group/accessibility audits and chat burst/reconnect mode do not exist yet; see the continuation checkpoint in QA_SWEEP.md.

Native rechecks can select `flow_group=all`, `profile`, `filters`, `calendar`, or `filters-calendar`. For the current remaining core checks, add `-f flow_group=filters-calendar` to the recheck dispatch command. Appium now matches exact visible/accessible identifiers or labels, checkpoints assertions incrementally, and handles the observed Calendar new-event discard confirmation without saving. Profile save/reopen passed 8/8 in `42106758884`; the filter fix and complete Calendar return path await recheck.
