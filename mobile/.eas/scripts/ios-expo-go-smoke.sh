#!/usr/bin/env bash
set -euo pipefail

RESULTS_DIR=".maestro/results"
mkdir -p "$RESULTS_DIR"
SIMULATOR_ID=""

collect_artifacts() {
  mkdir -p "$RESULTS_DIR"
  if [ -f /tmp/yard-metro.log ]; then cp /tmp/yard-metro.log "$RESULTS_DIR/metro.log"; fi
  if [ -d "$HOME/.maestro/tests" ]; then cp -R "$HOME/.maestro/tests/." "$RESULTS_DIR/"; fi
  find . -maxdepth 1 -type f -name '*.png' -exec cp {} "$RESULTS_DIR/" \;
  if [ -n "$SIMULATOR_ID" ]; then
    xcrun simctl io "$SIMULATOR_ID" screenshot "$RESULTS_DIR/simulator-last-screen.png" >/dev/null 2>&1 || true
  fi
  if [ -z "$(find "$RESULTS_DIR" -type f -print -quit)" ]; then
    printf 'iOS smoke job did not produce logs or screenshots.\n' > "$RESULTS_DIR/diagnostics.txt"
  fi
}
trap collect_artifacts EXIT

{
  echo "Installed iOS simulator runtimes and devices:"
  xcrun simctl list runtimes
  xcrun simctl list devices available
} > "$RESULTS_DIR/simulators.log" 2>&1
cat "$RESULTS_DIR/simulators.log"

SIMULATOR_INFO="$(xcrun simctl list devices available -j | node -e '
  let input = "";
  process.stdin.on("data", (chunk) => input += chunk);
  process.stdin.on("end", () => {
    const entries = Object.entries(JSON.parse(input).devices)
      .map(([runtime, devices]) => {
        const match = runtime.match(/iOS-(\d+)-(\d+)(?:-(\d+))?$/);
        return match ? {
          runtime,
          version: match.slice(1).map((part) => Number(part ?? 0)),
          devices,
        } : null;
      })
      .filter((entry) => entry && entry.version[0] === 26)
      .sort((a, b) => {
        for (let i = 0; i < Math.max(a.version.length, b.version.length); i++) {
          const difference = (b.version[i] ?? 0) - (a.version[i] ?? 0);
          if (difference) return difference;
        }
        return 0;
      });
    for (const entry of entries) {
      const device = entry.devices.find((item) => item.isAvailable && item.name.startsWith("iPhone"));
      if (device) {
        process.stdout.write(`${device.udid}\t${entry.runtime}\t${device.name}`);
        return;
      }
    }
    process.exit(1);
  });
')"
IFS=$'\t' read -r SIMULATOR_ID SIMULATOR_RUNTIME SIMULATOR_NAME <<< "$SIMULATOR_INFO"
echo "Selected simulator: $SIMULATOR_NAME ($SIMULATOR_ID), runtime $SIMULATOR_RUNTIME"
if ! xcrun simctl list devices booted | grep -q "$SIMULATOR_ID"; then
  xcrun simctl boot "$SIMULATOR_ID"
fi
xcrun simctl bootstatus "$SIMULATOR_ID" -b

EXPO_GO_ARCHIVE="$(npx --yes expo-go download ios 58 --json | node -e '
  let input = "";
  process.stdin.on("data", (chunk) => input += chunk);
  process.stdin.on("end", () => process.stdout.write(JSON.parse(input).path));
')"
if [ -d "$EXPO_GO_ARCHIVE" ] && [[ "$EXPO_GO_ARCHIVE" == *.app ]]; then
  # expo-go can return the already-extracted simulator application.
  EXPO_GO_APP="$EXPO_GO_ARCHIVE"
else
  EXPO_GO_DIR="$(mktemp -d)"
  case "$EXPO_GO_ARCHIVE" in
    *.tar.gz|*.tgz) tar -xzf "$EXPO_GO_ARCHIVE" -C "$EXPO_GO_DIR" ;;
    *.zip) ditto -x -k "$EXPO_GO_ARCHIVE" "$EXPO_GO_DIR" ;;
    *) echo "Unexpected Expo Go archive: $EXPO_GO_ARCHIVE" >&2; exit 1 ;;
  esac
  EXPO_GO_APP="$(find "$EXPO_GO_DIR" -type d -name '*.app' -print -quit)"
fi
test -n "$EXPO_GO_APP"
xcrun simctl install "$SIMULATOR_ID" "$EXPO_GO_APP"

command -v maestro
maestro --version

EXPO_HOME_DIR="$(mktemp -d)"
mkdir -p "$EXPO_HOME_DIR/codesigning/00f881a0-b80c-47d5-8170-a549f87d7ca0"
cat > "$EXPO_HOME_DIR/codesigning/00f881a0-b80c-47d5-8170-a549f87d7ca0/development-code-signing-settings-2.json" <<'JSON'
{"easProjectId":null,"scopeKey":null,"privateKey":null,"certificateChain":null}
JSON

env -u EXPO_TOKEN __UNSAFE_EXPO_HOME_DIRECTORY="$EXPO_HOME_DIR" EXPO_OFFLINE=1 EXPO_NO_DOTENV=1 EXPO_NO_DEV_MENU=1 CI=1 EXPO_PUBLIC_SUPABASE_URL= EXPO_PUBLIC_SUPABASE_ANON_KEY= \
  npx expo start --localhost --port 8093 --clear > /tmp/yard-metro.log 2>&1 &
METRO_PID=$!
trap 'collect_artifacts; kill "$METRO_PID" 2>/dev/null || true' EXIT

for attempt in $(seq 1 60); do
  if curl --fail --silent --show-error --max-time 2 http://localhost:8093/status > /tmp/yard-metro-status.txt 2>/tmp/yard-metro-status-error.txt && grep -q 'packager-status:running' /tmp/yard-metro-status.txt; then
    break
  fi
  sleep 2
done
if ! grep -q 'packager-status:running' /tmp/yard-metro-status.txt; then
  cat /tmp/yard-metro.log /tmp/yard-metro-status.txt /tmp/yard-metro-status-error.txt
  exit 1
fi
MANIFEST_STATUS="$(curl --silent --show-error --max-time 20 \
  -D /tmp/yard-manifest-headers.txt -o /tmp/yard-manifest.body -w '%{http_code}' \
  -H 'accept: multipart/mixed' \
  -H 'expo-platform: ios' \
  -H 'expo-protocol-version: 1' \
  -H 'expo-sfv-version: 0' \
  -H 'expo-expect-signature: keyid="expo-root", alg="rsa-v1_5-sha256"' \
  http://localhost:8093/ )"
if [ "$MANIFEST_STATUS" != "200" ] || ! grep -qi '^content-type: multipart/mixed' /tmp/yard-manifest-headers.txt; then
  echo "Expo Go manifest probe failed: HTTP $MANIFEST_STATUS"
  cat /tmp/yard-manifest-headers.txt
  cat /tmp/yard-metro.log
  exit 1
fi
echo 'Expo Go signed-manifest request returned HTTP 200 multipart/mixed.'
echo 'Metro is ready; each Maestro suite will open Expo Go once.'
echo 'Running native UI assertions.'
FLOW_FAILURE=0
for flow in ${QA_FLOWS:-ios-smoke ios-core-flows ios-native-menus ios-discovery ios-onboarding ios-map-permission ios-profile-settings ios-chat-actions ios-event-actions ios-activity-suggest}; do
  if maestro test ".maestro/$flow.yml"; then
    echo "$flow: PASS" | tee -a "$RESULTS_DIR/flow-summary.txt"
  else
    echo "$flow: FAIL" | tee -a "$RESULTS_DIR/flow-summary.txt"
    xcrun simctl io "$SIMULATOR_ID" screenshot "$RESULTS_DIR/$flow-failure.png" >/dev/null 2>&1 || true
    FLOW_FAILURE=1
  fi
done
exit "$FLOW_FAILURE"
