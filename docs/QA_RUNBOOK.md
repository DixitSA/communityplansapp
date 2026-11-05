# Running the yard QA sweep

Results and unresolved findings live in [QA_SWEEP.md](QA_SWEEP.md). A green command proves its assertions; it does not close untested flows or establish that the app has no bugs.

## Local checks

From `mobile/`:

```sh
npm run typecheck
npm run lint
npm test -- --runInBand
```

Latest consolidated result: 63 suites / 419 tests pass, plus typecheck and lint. Jest still reports an unidentified open handle after its summary. Preserve the summary; if it remains open after ten seconds, stop only that test process. Do not use a broad Node process kill or treat an interrupted run without a summary as a pass.

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
| `event-actions` | Focused retry of event Undo, sharing, invitation and calendar |
| `social` | Report/block menus, friendship actions, privacy/resume |
| `onboarding` | Email/demo onboarding, suggestions/activity, location/map/city |
| `navigation` | Event-card long-press menu and dismissal |
| `idb` | Independent AXBridge/HID probe: demo disclosure, profile save/reopen, filter selection/Clear/Apply, Help |
| `all` | All groups |

Maestro is pinned to 2.12.1. The independent IDB toolset is pinned to Meta's 1.7.8 formula revision. IDB avoids the XCTest UI runner; its first attempt stopped during companion startup, so installation alone is not a native pass. Both tools save diagnostic artifacts.

```sh
gh run view RUN_ID
gh run download RUN_ID --name ios-demo-qa-idb --dir PATH_TO_ARTIFACTS
```

Artifacts expire after one day. Save relevant screenshots, logs and checklists before expiry. Maestro emits per-flow commands, screenshots and usually JUnit; IDB emits a checklist and stage-specific startup/failure evidence. A watchdog may interrupt a group before aggregate JUnit exists: retain observed individual assertions, but do not mark the interrupted flow passed.

The companion startup and pre-flow Maestro bootstrap have bounded handling. App assertion failures are not retried into a pass. Use a focused dispatch to investigate a specific failure, then record both attempts and the reason for any harness change.

## Hosted staging checks

From `mobile/`, the runner defaults to a read-only preflight:

```sh
node scripts/qa-staging.cjs
```

Explicit scoped runs require the existing Supabase CLI login and the guarded `yard-staging` project:

```sh
node scripts/qa-staging.cjs --run
node scripts/qa-staging.cjs --run --chat --wait-for-postgres
node scripts/qa-staging.cjs --run --delete-account
```

These create uniquely named disposable accounts; chat also creates an owned event dated 2099. OTPs are verified without sending email. The runner uses normal authenticated sessions for behavior checks and exact-ID cleanup for its fixtures. It verifies cleanup and never logs keys. Do not change the project guard or point this script at production to bypass a failure.

The deletion option invokes the deployed account-deletion function for its own disposable account. It does not demonstrate native confirmation UI or avatar-file deletion without an uploaded avatar fixture. The chat runner retains a 15-second delivery failure even if a later observation sees a message. Current intermittent Realtime failures remain recorded despite passing repeats and the app's history-refresh mitigation.

## Closing a finding

Record the trigger, expected result, observed failure, fix, and the exact evidence used to recheck it. Keep WEB, UNIT, hosted API and NATIVE evidence separate. Browser screenshots do not validate iOS sheet geometry or native dialogs. A source change without a successful recheck remains pending.

Full sign-off still requires the unfinished items in QA_SWEEP.md, including native layout rechecks, actual provider/email paths, accessibility and device/build coverage, and published Terms/Privacy destinations. Do not erase these gaps when automated suites turn green.

The app now opts into server-confirmed Postgres Changes readiness. The staging runner's explicit `--wait-for-postgres` flag mirrors that behavior; omitting it retains the earlier subscription signal for comparison. One guarded readiness-wait run passed 30/30, with live delivery at 1.021 seconds after setup and fixture cleanup verified. This does not establish long-term transport reliability.
