#!/usr/bin/env bash
set -euo pipefail

APP_ID="com.dixitsa.yard"
RESULTS_DIR=".maestro/native-results"
DERIVED_DATA="$RUNNER_TEMP/yard-native-derived-data"
SIMULATOR_ID=""
SIMULATOR_APPEARANCE="${SIMULATOR_APPEARANCE:-light}"
mkdir -p "$RESULTS_DIR"

log_phase() {
  printf '[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" | tee -a "$RESULTS_DIR/run.log"
}

for dotenv in .env .env.*; do
  if [[ -e "$dotenv" || -L "$dotenv" ]]; then
    printf 'Refusing native QA build while dotenv file is present: %s\n' "${dotenv##*/}" >&2
    exit 1
  fi
done
if [[ -n "${EXPO_PUBLIC_SUPABASE_URL:-}" || -n "${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}" ]]; then
  echo 'Refusing native QA build with Supabase environment values set.' >&2
  exit 1
fi
if [[ -n "${EXPO_TOKEN:-}" ]]; then
  echo 'Refusing native QA build with EXPO_TOKEN set.' >&2
  exit 1
fi
if [[ -e ios ]]; then
  echo 'Refusing native QA build because ios/ already exists; use a fresh CI checkout.' >&2
  exit 1
fi
case "$SIMULATOR_APPEARANCE" in
  light|dark) ;;
  *) echo "Unsupported simulator appearance: $SIMULATOR_APPEARANCE" >&2; exit 2 ;;
esac

collect_diagnostics() {
  mkdir -p "$RESULTS_DIR"
  if [[ -n "$SIMULATOR_ID" ]]; then
    xcrun simctl io "$SIMULATOR_ID" screenshot "$RESULTS_DIR/simulator-final.png" >/dev/null 2>&1 || true
    xcrun simctl terminate "$SIMULATOR_ID" "$APP_ID" >/dev/null 2>&1 || true
    xcrun simctl shutdown "$SIMULATOR_ID" >/dev/null 2>&1 || true
  fi
  if [[ -z "$(find "$RESULTS_DIR" -type f -print -quit)" ]]; then
    printf 'Native simulator QA did not produce logs or screenshots.\n' > "$RESULTS_DIR/diagnostics.txt"
  fi
}
trap collect_diagnostics EXIT

export EXPO_NO_DOTENV=1
export EXPO_PUBLIC_SUPABASE_URL=
export EXPO_PUBLIC_SUPABASE_ANON_KEY=
export EXPO_OFFLINE=1
unset EXPO_TOKEN

printf '%s\n' \
  'iOS native simulator QA checklist' \
  '- Checkout dotenv quarantine and blank Supabase environment: PASS' \
  '- Expo token unset: PASS' > "$RESULTS_DIR/checklist.txt"
printf 'Simulator appearance: %s\n' "$SIMULATOR_APPEARANCE" | tee "$RESULTS_DIR/appearance.txt"

log_phase "Expo SDK version: $(node -p "require('./node_modules/expo/package.json').version")"
log_phase 'Generating iOS native project in this disposable checkout.'
CI=1 npx expo prebuild --platform ios --no-install 2>&1 | tee "$RESULTS_DIR/prebuild.log"
printf '%s\n' '- Generated iOS native project: PASS' >> "$RESULTS_DIR/checklist.txt"

log_phase 'Installing CocoaPods dependencies.'
(cd ios && pod install) 2>&1 | tee "$RESULTS_DIR/pod-install.log"
printf '%s\n' '- Installed CocoaPods dependencies: PASS' >> "$RESULTS_DIR/checklist.txt"

log_phase 'Selecting the latest available iPhone simulator on the iOS 26 runtime.'
SIMULATOR_ID="$(xcrun simctl list devices available -j | python3 -c '
import json, sys
devices = json.load(sys.stdin)["devices"]
candidates = []
for runtime, entries in devices.items():
    if not runtime.startswith("com.apple.CoreSimulator.SimRuntime.iOS-26-"):
        continue
    version = tuple(int(part) for part in runtime.rsplit("iOS-", 1)[1].split("-"))
    candidates.extend((version, device) for device in entries if device.get("isAvailable") and "iPhone" in device.get("name", ""))
if not candidates:
    raise SystemExit("No available iPhone simulator on iOS 26.x")
print(max(candidates, key=lambda item: item[0])[1]["udid"])
')"
test -n "$SIMULATOR_ID"
printf 'Simulator UDID: %s\n' "$SIMULATOR_ID" | tee "$RESULTS_DIR/simulator.txt"

log_phase 'Building Release for iOS Simulator without code signing.'
xcodebuild \
  -workspace ios/yard.xcworkspace \
  -scheme yard \
  -configuration Release \
  -sdk iphonesimulator \
  -destination "id=$SIMULATOR_ID" \
  -derivedDataPath "$DERIVED_DATA" \
  ONLY_ACTIVE_ARCH=YES \
  CODE_SIGNING_ALLOWED=NO \
  build > "$RESULTS_DIR/xcodebuild.log" 2>&1 || {
    tail -n 100 "$RESULTS_DIR/xcodebuild.log"
    exit 1
  }
printf '%s\n' '- Built Release simulator app without code signing: PASS' >> "$RESULTS_DIR/checklist.txt"

APP_PATH="$DERIVED_DATA/Build/Products/Release-iphonesimulator/yard.app"
if [[ ! -d "$APP_PATH" ]]; then
  echo 'Expected Release simulator app was not produced.' >&2
  exit 1
fi
INFO_PLIST="$APP_PATH/Info.plist"
BUILT_APP_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$INFO_PLIST")"
BUILT_STYLE="$(/usr/libexec/PlistBuddy -c 'Print :UIUserInterfaceStyle' "$INFO_PLIST")"
[[ "$BUILT_APP_ID" == "$APP_ID" ]]
[[ "$BUILT_STYLE" == 'Automatic' ]]
printf 'Bundle ID: %s\nUIUserInterfaceStyle: %s\n' "$BUILT_APP_ID" "$BUILT_STYLE" | tee "$RESULTS_DIR/app-info.txt"
if [[ ! -s "$APP_PATH/main.jsbundle" ]]; then
  echo 'Release app is missing its embedded JavaScript bundle.' >&2
  exit 1
fi
if LC_ALL=C grep -aFq 'lvgmelaavgmyjjdggzop.supabase.co' "$APP_PATH/main.jsbundle"; then
  echo 'Refusing native QA app whose embedded bundle contains the staging Supabase host.' >&2
  exit 1
else
  scan_status=$?
  if [[ "$scan_status" -ne 1 ]]; then
    echo 'Unable to scan the embedded JavaScript bundle for the staging host.' >&2
    exit "$scan_status"
  fi
fi
log_phase 'Bundle ID, automatic appearance, embedded JavaScript, and staging-host checks passed.'
printf '%s\n' '- Verified bundle ID, automatic appearance, embedded JS, and staging-host exclusion: PASS' >> "$RESULTS_DIR/checklist.txt"

ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$RESULTS_DIR/yard-release-simulator.zip"
log_phase 'Archived the validated simulator app for reuse.'

if ! xcrun simctl list devices booted | grep -q "$SIMULATOR_ID"; then
  xcrun simctl boot "$SIMULATOR_ID"
fi
xcrun simctl bootstatus "$SIMULATOR_ID" -b 2>&1 | tee "$RESULTS_DIR/simulator-boot.log"
printf '%s\n' '- Booted latest available iPhone on iOS 26: PASS' >> "$RESULTS_DIR/checklist.txt"
xcrun simctl install "$SIMULATOR_ID" "$APP_PATH"
xcrun simctl ui "$SIMULATOR_ID" appearance "$SIMULATOR_APPEARANCE"
xcrun simctl launch "$SIMULATOR_ID" "$APP_ID" | tee "$RESULTS_DIR/launch.log"
sleep 10
xcrun simctl io "$SIMULATOR_ID" screenshot "$RESULTS_DIR/native-app-first-launch.png"
printf '%s\n' '- Installed and launched app; captured first-launch screenshot: PASS' >> "$RESULTS_DIR/checklist.txt"

log_phase 'Running the iOS accessibility/action probe against the real app bundle.'
python3 scripts/qa-idb.py --udid "$SIMULATOR_ID" --results-dir "$RESULTS_DIR" --app-id "$APP_ID"
printf '%s\n' '- Completed IDB simulator interaction probe: PASS' >> "$RESULTS_DIR/checklist.txt"
printf 'Native simulator app + idb probe: PASS\n' > "$RESULTS_DIR/summary.txt"
log_phase 'Native simulator QA completed successfully.'
