#!/usr/bin/env bash
set -euo pipefail

RESULTS_DIR=".maestro/results"
mkdir -p "$RESULTS_DIR"
SIMULATOR_ID=""
QA_ENGINE="${QA_ENGINE:-maestro}"
case "$QA_ENGINE" in
  maestro|idb) ;;
  *) echo "Unsupported QA engine: $QA_ENGINE" >&2; exit 2 ;;
esac

for dotenv in .env .env.*; do
  if [[ -e "$dotenv" || -L "$dotenv" ]]; then
    printf 'Refusing QA startup while dotenv file is present: %s\n' "${dotenv##*/}" >&2
    exit 1
  fi
done
if [[ -n "${EXPO_PUBLIC_SUPABASE_URL:-}" || -n "${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}" ]]; then
  echo 'Refusing QA startup with Supabase environment values set.' >&2
  exit 1
fi

log_phase() {
  printf '[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

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
  log_phase "Listing installed simulator runtimes and devices."
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
log_phase "Selected simulator: $SIMULATOR_NAME ($SIMULATOR_ID), runtime $SIMULATOR_RUNTIME"
log_phase "Booting simulator if needed."
if ! xcrun simctl list devices booted | grep -q "$SIMULATOR_ID"; then
  xcrun simctl boot "$SIMULATOR_ID"
fi
xcrun simctl bootstatus "$SIMULATOR_ID" -b
log_phase "Simulator boot complete."

log_phase "Downloading Expo Go SDK 58."
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
log_phase "Expo Go installed."

if [[ "$QA_ENGINE" == idb ]]; then
  command -v idb
  idb_companion --version
  log_phase 'idb CLI and simulator companion ready.'
else
  command -v maestro
  maestro --version
  log_phase 'Maestro CLI ready.'
fi

EXPO_HOME_DIR="$(mktemp -d)"
mkdir -p "$EXPO_HOME_DIR/codesigning/00f881a0-b80c-47d5-8170-a549f87d7ca0"
cat > "$EXPO_HOME_DIR/codesigning/00f881a0-b80c-47d5-8170-a549f87d7ca0/development-code-signing-settings-2.json" <<'JSON'
{"easProjectId":null,"scopeKey":null,"privateKey":null,"certificateChain":null}
JSON

log_phase "Starting Metro on IPv4 localhost:8093 (matching Expo's advertised launch asset)."
env -u EXPO_TOKEN NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--dns-result-order=ipv4first" __UNSAFE_EXPO_HOME_DIRECTORY="$EXPO_HOME_DIR" EXPO_OFFLINE=1 EXPO_NO_DOTENV=1 EXPO_NO_DEV_MENU=1 CI=1 EXPO_PUBLIC_SUPABASE_URL= EXPO_PUBLIC_SUPABASE_ANON_KEY= \
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
if ! curl --fail --silent --show-error --max-time 10 http://127.0.0.1:8093/status > /tmp/yard-metro-ipv4-status.txt || ! grep -q 'packager-status:running' /tmp/yard-metro-ipv4-status.txt; then
  echo 'Metro is not reachable on the IPv4 loopback advertised to Expo Go.' >&2
  exit 1
fi
log_phase 'Metro IPv4 loopback probe passed.'
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
log_phase 'Expo Go signed-manifest request returned HTTP 200 multipart/mixed.'

LAUNCH_ASSET_URL="$(node -e '
  const fs = require("node:fs");
  const body = fs.readFileSync(process.argv[1], "utf8");
  for (const line of body.split(/\r?\n/)) {
    const candidate = line.trim();
    if (!candidate.startsWith("{") || !candidate.endsWith("}")) continue;
    try {
      const manifest = JSON.parse(candidate);
      const url = manifest.launchAsset?.url;
      if (typeof url !== "string") continue;
      const parsed = new URL(url);
      // Expo CLI intentionally advertises localhost as 127.0.0.1.
      if (parsed.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) || parsed.port !== "8093") {
        throw new Error(`launchAsset.url must use loopback port 8093 (received ${parsed.origin})`);
      }
      // Probe the exact advertised address that Expo Go will fetch, without rewriting its host.
      process.stdout.write(parsed.href);
      process.exit(0);
    } catch (error) {
      if (error instanceof SyntaxError) continue;
      throw error;
    }
  }
  throw new Error("No JSON manifest part with launchAsset.url was found");
' /tmp/yard-manifest.body)"
log_phase 'Prewarming the signed-manifest launch asset.'
PREWARM_START=$SECONDS
curl --fail --silent --show-error --max-time 600 "$LAUNCH_ASSET_URL" -o /tmp/yard-ios-prewarm.bundle
PREWARM_SECONDS=$((SECONDS - PREWARM_START))
PREWARM_BYTES="$(wc -c < /tmp/yard-ios-prewarm.bundle | tr -d ' ')"
log_phase "Launch bundle prewarmed in ${PREWARM_SECONDS}s (${PREWARM_BYTES} bytes)."
if LC_ALL=C grep -aFq 'lvgmelaavgmyjjdggzop.supabase.co' /tmp/yard-ios-prewarm.bundle; then
  echo 'Refusing QA bundle containing the staging Supabase host.' >&2
  exit 1
else
  BUNDLE_SCAN_STATUS=$?
  if [[ "$BUNDLE_SCAN_STATUS" -ne 1 ]]; then
    echo 'Unable to scan the prewarmed bundle for the staging host.' >&2
    exit "$BUNDLE_SCAN_STATUS"
  fi
fi
log_phase 'Launch bundle staging-host guard passed.'
log_phase 'Metro and the isolated launch bundle are ready.'

if [[ "$QA_ENGINE" == idb ]]; then
  log_phase 'Running the independent idb layout probe.'
  python3 scripts/qa-idb.py --udid "$SIMULATOR_ID" --results-dir "$RESULTS_DIR"
  exit $?
fi

FLOW_FILES=()
for flow in ${QA_FLOWS:-ios-smoke ios-core-flows ios-native-menus ios-discovery ios-onboarding ios-map-permission ios-profile-settings ios-chat-actions ios-event-actions ios-friend-actions ios-activity-suggest ios-privacy-resume}; do
  flow_file=".maestro/$flow.yml"
  if [ ! -f "$flow_file" ]; then
    log_phase "Configured Maestro flow is missing: $flow_file"
    exit 1
  fi
  FLOW_FILES+=("$flow_file")
done
log_phase "Running Maestro flows in one CLI session: ${QA_FLOWS:-default flow set}."
FLOW_FAILURE=0
run_maestro() {
  maestro test --config .maestro/config.yaml --format JUNIT --output "$RESULTS_DIR/junit.xml" --test-output-dir "$RESULTS_DIR" "${FLOW_FILES[@]}" 2>&1 | tee "$RESULTS_DIR/maestro-output.log"
}
if ! run_maestro; then
  # Retry only a failed driver bootstrap, before any suite produced a result.
  # Assertion failures remain failures, and the outer watchdog still bounds both attempts.
  FLOW_STARTED=0
  DRIVER_LOGS=0
  while IFS= read -r -d '' driver_log; do
    DRIVER_LOGS=$((DRIVER_LOGS + 1))
    if grep -Fq 'TestSuiteInteractor.runFlow:  Running flow ' "$driver_log"; then
      FLOW_STARTED=1
    elif [[ "$?" -ne 1 ]]; then
      # An unreadable log cannot establish that no flow started.
      FLOW_STARTED=1
    fi
  done < <(find "$HOME/.maestro/tests" "$RESULTS_DIR" -type f -name maestro.log -print0 2>/dev/null)
  if [[ ! -f "$RESULTS_DIR/junit.xml" && "$DRIVER_LOGS" -gt 0 && "$FLOW_STARTED" -eq 0 ]] && grep -Eq 'IOSDriverTimeoutException|iOS driver not ready in time' "$RESULTS_DIR/maestro-output.log"; then
    mv "$RESULTS_DIR/maestro-output.log" "$RESULTS_DIR/maestro-bootstrap-attempt1.log"
    log_phase 'Maestro bootstrap failed before flow results; rebooting the isolated simulator before one retry.'
    xcrun simctl shutdown "$SIMULATOR_ID"
    xcrun simctl boot "$SIMULATOR_ID"
    xcrun simctl bootstatus "$SIMULATOR_ID" -b
    if ! run_maestro; then FLOW_FAILURE=1; fi
  else
    FLOW_FAILURE=1
  fi
fi
if [[ "$FLOW_FAILURE" -eq 0 ]]; then
  printf 'Maestro CLI: PASS\n' > "$RESULTS_DIR/flow-summary.txt"
  log_phase "Maestro finished successfully; per-flow results are in junit.xml."
else
  printf 'Maestro CLI: FAIL\n' > "$RESULTS_DIR/flow-summary.txt"
  xcrun simctl io "$SIMULATOR_ID" screenshot "$RESULTS_DIR/maestro-failure.png" >/dev/null 2>&1 || true
  log_phase "Maestro failed; per-flow results and diagnostics were collected."
fi
exit "$FLOW_FAILURE"
