# Native QA

These Maestro flows run the app in Expo Go SDK 58 on an iOS simulator through the existing EAS macOS workflow. They use local demo data; they do not send real messages or email. A YAML parse is not a device pass.

Coverage and observed results are tracked in [QA_SWEEP.md](../../docs/QA_SWEEP.md).

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

Use the returned workflow URL to inspect the job and download artifacts. The job records each suite's result separately and takes a screenshot after each failure. It has a 15-minute watchdog. EAS workflow usage applies; no paid plan is required by this configuration and no automatic upgrade is performed.

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
```

Apple sign-in, real email delivery, push notifications, VoiceOver and a release build require separate evidence. Demo mode omits Sign out; Delete account explains that no account exists. The script defaults to all ten suites; `QA_FLOWS` can select a space-separated subset for a focused recheck. Split long runs into subsets to stay within the 15-minute watchdog.
