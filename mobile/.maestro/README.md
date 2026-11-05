# Native QA

These Maestro flows run the app in Expo Go SDK 58 on an iOS simulator through the EAS macOS workflow or `.github/workflows/ios-qa.yml`. They use local demo data; they do not send real messages or email. A YAML parse is not a device pass.

Coverage and observed results are tracked in [QA_SWEEP.md](../../docs/QA_SWEEP.md).

`ios-privacy-resume.yml` checks the phone-discovery switch across in-app navigation and Expo Go background/resume. Demo mode stores that setting in memory, so this flow does not claim persistence after process death. Maestro 2.6.1 flow commands do not change iOS appearance, text size, or VoiceOver settings; those checks remain untested.

The GitHub workflow has selectable groups: `layout` (profile/settings, discovery, smoke), `menus` (core, chat, event actions), `social` (native menus, friend actions, privacy/resume), `onboarding` (onboarding, suggestions/activity, map/permission), `navigation` (card context menu), and `idb` (independent accessibility probe). `all` runs those six groups, at most five concurrently. `event-actions` and `event-undo` are separate focused selections. The workflow runs on matching changes to `qa/ios-sweep-*` branches or manual dispatch and uploads one `ios-demo-qa-*` artifact per group with one-day retention. Each job has a 50-minute cap and a 45-minute simulator watchdog. EAS free simulator usage was exhausted during this sweep; use the standard public GitHub Mac runners. See [QA_RUNBOOK.md](../../docs/QA_RUNBOOK.md) for current commands and evidence limits.

The isolated `event-undo` workflow group runs only `ios-event-undo`; it is a manual selection and is excluded from the default `all` matrix. Undo uses a five-second toast, so keeping it in a separate flow prevents Maestro command latency from interfering with the Calendar and share checks in `ios-event-actions`.

The GitHub job moves dotenv files out of its disposable checkout before dependencies or Metro start because Expo Babel can inline tracked `.env.development` values despite `EXPO_NO_DOTENV`. The simulator script refuses dotenv files or non-empty Supabase variables, prewarms the exact Expo Go manifest bundle, and fails if that bundle contains the staging host. The private quarantine and prewarm bundle are not uploaded; local developer env files are untouched.

From the repository root in PowerShell, upload an isolated demo run:

```powershell
if (Test-Path .easignore) { throw 'Preserve the existing .easignore before using the QA archive filter.' }
Copy-Item mobile/.eas/qa-upload.ignore .easignore
try {
  Push-Location mobile
  try {
    npx eas-cli workflow:run .eas/workflows/ios-expo-go-smoke.yml --non-interactive --no-wait
  } finally { Pop-Location }
} finally { Remove-Item -LiteralPath .easignore }
```

Use the returned workflow URL to inspect the job and download artifacts. Each group runs its selected flow files in one Maestro invocation and writes per-flow outcomes to `junit.xml`, alongside Maestro output and simulator diagnostics. The GitHub simulator step has a 45-minute watchdog. The separate EAS workflow retains its 15-minute watchdog; EAS usage quotas apply.

Run local checks from `mobile`:

```powershell
npm run typecheck
npm run lint
npm test -- --runInBand
```

The separate `scripts/qa-staging.cjs` runner checks real auth and persistence. It defaults to a read-only identity/configuration check. Passing `--run` creates two disposable accounts on the hard-guarded `yard-staging` project, tests only their owned data, and cleans up exact generated IDs. It requires the existing Supabase CLI login; keys and sessions stay in memory. This is API coverage, not native login UI coverage.

```powershell
node scripts/qa-staging.cjs --project-ref lvgmelaavgmyjjdggzop
# Explicitly run the disposable-account tests:
node scripts/qa-staging.cjs --project-ref lvgmelaavgmyjjdggzop --run
# Include isolated RSVP, chat persistence, live delivery, deletion and membership checks:
node scripts/qa-staging.cjs --project-ref lvgmelaavgmyjjdggzop --run --chat
```

The chat option adds one uniquely identified event dated in 2099, outside the feed window. Assertions use the two disposable accounts; cleanup verifies that the exact event, messages, RSVPs, read markers and accounts are absent. Two consecutive runs passed all 30 checks after an initial live-delivery timeout; this is backend API evidence, not native UI evidence.

Apple sign-in, real email delivery, push notifications, VoiceOver and a release build require separate evidence. Demo mode omits Sign out; Delete account explains that no account exists. The script defaults to all eleven suites; `QA_FLOWS` can select a space-separated subset for a focused recheck. Keep EAS selections small enough for its 15-minute watchdog.
