#!/usr/bin/env bash
set -euo pipefail

APP_ID="com.dixitsa.yard"
RESULTS_DIR=".maestro/native-recheck-results"
SIMULATOR_ID=""
GATE_FILE="src/features/auth/useGate.ts"
GATE_BACKUP="${RUNNER_TEMP:?Set RUNNER_TEMP}/yard-native-recheck-useGate.ts"
GATE_INJECTION_APPLIED=0
SIMULATOR_APPEARANCE="${SIMULATOR_APPEARANCE:-dark}"
ARTIFACT_ZIP="${ARTIFACT_ZIP:?Set ARTIFACT_ZIP to the downloaded simulator app archive}"
SOURCE_RUN_ID="${SOURCE_RUN_ID:?Set SOURCE_RUN_ID to the completed native build run}"
SOURCE_BUILD_SHA="${SOURCE_BUILD_SHA:?Set SOURCE_BUILD_SHA from the source run metadata}"
PROBE_SHA="${PROBE_SHA:?Set PROBE_SHA to the current checkout SHA}"
SOURCE_RUN_CONCLUSION="${SOURCE_RUN_CONCLUSION:?Set SOURCE_RUN_CONCLUSION from the source run metadata}"
DRIVER_ENGINE="${DRIVER_ENGINE:-appium}"
PROBE_FLOW_GROUP="${PROBE_FLOW_GROUP:-all}"
APPIUM_SERVER_PID=""
case "$PROBE_FLOW_GROUP" in
  all) PROBE_FLOWS=(profile filters calendar) ;;
  profile) PROBE_FLOWS=(profile) ;;
  filters) PROBE_FLOWS=(filters) ;;
  calendar) PROBE_FLOWS=(calendar) ;;
  filters-calendar) PROBE_FLOWS=(filters calendar) ;;
  extended) PROBE_FLOWS=(profile-interests map context-menu) ;;
  context-menu) PROBE_FLOWS=(context-menu) ;;
  *) echo "Unsupported native flow group: $PROBE_FLOW_GROUP" >&2; exit 2 ;;
esac
mkdir -p "$RESULTS_DIR"

for dotenv_path in .env .env.*; do
  if [[ -e "$dotenv_path" || -L "$dotenv_path" ]]; then
    printf 'Refusing to run native recheck while a dotenv path is present: %s\n' "$dotenv_path" >&2
    exit 1
  fi
done

log_phase() {
  printf '[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" | tee -a "$RESULTS_DIR/run.log"
}

collect_diagnostics() {
  if [[ "$GATE_INJECTION_APPLIED" -eq 1 && -f "$GATE_BACKUP" ]]; then
    cp -p "$GATE_BACKUP" "$GATE_FILE" || true
    GATE_INJECTION_APPLIED=0
  fi
  mkdir -p "$RESULTS_DIR"
  if [[ -n "$APPIUM_SERVER_PID" ]] && kill -0 "$APPIUM_SERVER_PID" 2>/dev/null; then
    kill -TERM "$APPIUM_SERVER_PID" 2>/dev/null || true
    wait "$APPIUM_SERVER_PID" 2>/dev/null || true
  fi
  if [[ -n "$SIMULATOR_ID" ]]; then
    xcrun simctl io "$SIMULATOR_ID" screenshot "$RESULTS_DIR/simulator-final.png" >/dev/null 2>&1 || true
    xcrun simctl terminate "$SIMULATOR_ID" "$APP_ID" >/dev/null 2>&1 || true
    xcrun simctl shutdown "$SIMULATOR_ID" >/dev/null 2>&1 || true
  fi
  if [[ -z "$(find "$RESULTS_DIR" -type f -print -quit)" ]]; then
    printf 'Native simulator recheck did not produce logs or screenshots.\n' > "$RESULTS_DIR/diagnostics.txt"
  fi
}
trap collect_diagnostics EXIT

if [[ -n "${EXPO_PUBLIC_SUPABASE_URL:-}" || -n "${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}" || -n "${EXPO_TOKEN:-}" ]]; then
  echo 'Refusing native recheck with Supabase environment values or EXPO_TOKEN set.' >&2
  exit 1
fi

case "$SIMULATOR_APPEARANCE" in
  light|dark) ;;
  *) echo "Unsupported simulator appearance: $SIMULATOR_APPEARANCE" >&2; exit 2 ;;
esac

case "$SOURCE_RUN_CONCLUSION" in
  success|failure) ;;
  *) echo "Refusing source run conclusion: $SOURCE_RUN_CONCLUSION" >&2; exit 2 ;;
esac

case "$DRIVER_ENGINE" in
  appium|idb) ;;
  *) echo "Unsupported native automation engine: $DRIVER_ENGINE" >&2; exit 2 ;;
esac
if [[ ( "$PROBE_FLOW_GROUP" == 'extended' || "$PROBE_FLOW_GROUP" == 'context-menu' ) && "$DRIVER_ENGINE" != 'appium' ]]; then
  echo 'The extended and context-menu native flows require the Appium engine.' >&2
  exit 2
fi

case "$ARTIFACT_ZIP" in
  "$RUNNER_TEMP"/*) ;;
  *) echo 'Refusing artifact path outside RUNNER_TEMP.' >&2; exit 2 ;;
esac
test -f "$ARTIFACT_ZIP"

APP_ROOT="$(mktemp -d "$RUNNER_TEMP/yard-native-recheck-app.XXXXXX")"
APP_ROOT_REAL="$(cd "$APP_ROOT" && pwd -P)"
RUNNER_TEMP_REAL="$(cd "$RUNNER_TEMP" && pwd -P)"
case "$APP_ROOT_REAL/" in
  "$RUNNER_TEMP_REAL"/*) ;;
  *) echo 'Refusing extraction directory outside RUNNER_TEMP.' >&2; exit 2 ;;
esac

log_phase "Validating simulator app archive from build run $SOURCE_RUN_ID."
python3 - "$ARTIFACT_ZIP" <<'PY'
import stat, sys, zipfile
from pathlib import PurePosixPath

archive = sys.argv[1]
root = PurePosixPath("yard.app")
seen = set()
with zipfile.ZipFile(archive) as zf:
    bad = zf.testzip()
    if bad:
        raise SystemExit(f"Corrupt archive member: {bad}")
    for info in zf.infolist():
        name = info.filename
        if "\\" in name:
            raise SystemExit(f"Refusing backslash in archive path: {name}")
        path = PurePosixPath(name)
        if path.is_absolute() or ".." in path.parts or not path.parts or path.parts[0] not in (root.name, "__MACOSX"):
            raise SystemExit(f"Refusing unsafe archive path: {name}")
        if name in seen:
            raise SystemExit(f"Refusing duplicate archive path: {name}")
        seen.add(name)
        mode = info.external_attr >> 16
        if path.parts[0] == "__MACOSX" and (stat.S_ISLNK(mode) or (mode and not (stat.S_ISREG(mode) or stat.S_ISDIR(mode)))):
            raise SystemExit(f"Refusing special AppleDouble archive member: {name}")
        if stat.S_ISLNK(mode):
            target_text = zf.read(info).decode("utf-8")
            if target_text.startswith("/") or "\\" in target_text:
                raise SystemExit(f"Refusing unsafe symlink target: {name}")
            parts = list(path.parent.parts)
            for part in PurePosixPath(target_text).parts:
                if part in ("", "."):
                    continue
                if part == "..":
                    if len(parts) <= 1:
                        raise SystemExit(f"Symlink escapes app root: {name}")
                    parts.pop()
                else:
                    parts.append(part)
            if not parts or parts[0] != root.name:
                raise SystemExit(f"Symlink escapes app root: {name}")
    required = {"yard.app/Info.plist", "yard.app/main.jsbundle"}
    if not required.issubset(seen):
        raise SystemExit(f"Archive missing required members: {sorted(required - seen)}")
PY

ditto -x -k --sequesterRsrc "$ARTIFACT_ZIP" "$APP_ROOT"
APP_PATH="$APP_ROOT/yard.app"
INFO_PLIST="$APP_PATH/Info.plist"
test -d "$APP_PATH"
test -f "$INFO_PLIST"
test -s "$APP_PATH/main.jsbundle"

BUILT_APP_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$INFO_PLIST")"
BUILT_STYLE="$(/usr/libexec/PlistBuddy -c 'Print :UIUserInterfaceStyle' "$INFO_PLIST")"
EXECUTABLE="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$INFO_PLIST")"
[[ "$BUILT_APP_ID" == "$APP_ID" ]]
[[ "$BUILT_STYLE" == 'Automatic' ]]
test -n "$EXECUTABLE"
test -f "$APP_PATH/$EXECUTABLE"

RUNNER_ARCH="$(uname -m)"
APP_ARCHS="$(lipo -archs "$APP_PATH/$EXECUTABLE")"
case "$RUNNER_ARCH" in
  arm64|x86_64) ;;
  *) echo "Unsupported simulator runner architecture: $RUNNER_ARCH" >&2; exit 2 ;;
esac
[[ " $APP_ARCHS " == *" $RUNNER_ARCH "* ]]

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

ZIP_SHA256="$(shasum -a 256 "$ARTIFACT_ZIP" | awk '{print $1}')"
printf '%s\n' \
  "Source build run: $SOURCE_RUN_ID ($SOURCE_BUILD_SHA; $SOURCE_RUN_CONCLUSION)" \
  "Probe run: ${GITHUB_RUN_ID:-local} ($PROBE_SHA)" \
  "App archive SHA-256: $ZIP_SHA256" \
  "Bundle ID: $BUILT_APP_ID" \
  "UIUserInterfaceStyle: $BUILT_STYLE" \
  "Runner/app architectures: $RUNNER_ARCH / $APP_ARCHS" | tee "$RESULTS_DIR/source-and-probe.txt"
printf '%s\n' '- Reused simulator app: bundle ID and architecture match; native binary reused: PASS' >> "$RESULTS_DIR/checklist.txt"

log_phase 'Temporarily enabling the demo routing gate in this disposable checkout.'
if ! git diff --quiet -- "$GATE_FILE"; then
  echo 'Refusing to inject QA gate because useGate.ts already has a diff.' >&2
  exit 1
fi
cp -p "$GATE_FILE" "$GATE_BACKUP"
GATE_INJECTION_APPLIED=1
python3 - "$GATE_FILE" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
old = "dev: __DEV__"
if text.count(old) != 1:
    raise SystemExit(f"Expected one {old!r} routing gate, found {text.count(old)}")
path.write_text(text.replace(old, "dev: true", 1), encoding="utf-8")
PY
git diff --check -- "$GATE_FILE"
git diff --no-ext-diff --unified=0 -- "$GATE_FILE" > "$RESULTS_DIR/qa-useGate-injection.diff"
GATE_DIFF_SHA256="$(shasum -a 256 "$RESULTS_DIR/qa-useGate-injection.diff" | awk '{print $1}')"
if [[ ! -s "$RESULTS_DIR/qa-useGate-injection.diff" ]]; then
  echo 'QA routing gate injection did not produce the expected diff.' >&2
  exit 1
fi

log_phase 'Re-bundling only JavaScript/assets for the reused native executable with the installed SDK58 CLI.'
ENTRY_FILE="$PWD/node_modules/expo-router/entry.js"
test -f "$ENTRY_FILE"
PRE_REBUNDLE_SHA256="$(shasum -a 256 "$APP_PATH/main.jsbundle" | awk '{print $1}')"
CI=1 node node_modules/expo/bin/cli export:embed \
  --entry-file "$ENTRY_FILE" \
  --platform ios \
  --dev false \
  --reset-cache \
  --bundle-output "$APP_PATH/main.jsbundle" \
  --assets-dest "$APP_PATH" \
  --bytecode 2>&1 | tee "$RESULTS_DIR/rebundle.log"
cp -p "$GATE_BACKUP" "$GATE_FILE"
GATE_INJECTION_APPLIED=0
if ! git diff --quiet -- "$GATE_FILE"; then
  echo 'QA routing gate was not restored after the embedded re-bundle.' >&2
  exit 1
fi
test -s "$APP_PATH/main.jsbundle"
POST_REBUNDLE_SHA256="$(shasum -a 256 "$APP_PATH/main.jsbundle" | awk '{print $1}')"
if [[ "$PRE_REBUNDLE_SHA256" == "$POST_REBUNDLE_SHA256" ]]; then
  echo 'Refusing to probe because the QA re-bundle did not change the embedded JavaScript bundle.' >&2
  exit 1
fi

if LC_ALL=C grep -aFq 'lvgmelaavgmyjjdggzop.supabase.co' "$APP_PATH/main.jsbundle"; then
  echo 'Refusing re-bundled native QA app whose embedded JavaScript contains the staging Supabase host.' >&2
  exit 1
else
  scan_status=$?
  if [[ "$scan_status" -ne 1 ]]; then
    echo 'Unable to scan the re-bundled JavaScript for the staging host.' >&2
    exit "$scan_status"
  fi
fi

NATIVE_BINARY_SHA256="$(shasum -a 256 "$APP_PATH/$EXECUTABLE" | awk '{print $1}')"
MAIN_BUNDLE_SHA256="$(shasum -a 256 "$APP_PATH/main.jsbundle" | awk '{print $1}')"
cat > "$RESULTS_DIR/recheck-metadata.json" <<EOF
{
  "runKind": "qa-instrumented-demo-rebundle",
  "sourceBuildRunId": "$SOURCE_RUN_ID",
  "sourceBuildSha": "$SOURCE_BUILD_SHA",
  "sourceBuildConclusion": "$SOURCE_RUN_CONCLUSION",
  "probeRunId": "${GITHUB_RUN_ID:-local}",
  "probeSha": "$PROBE_SHA",
  "nativeInputFilesCompared": ["mobile/package.json", "mobile/package-lock.json", "mobile/app.config.ts", "mobile/assets", "mobile/ios", "mobile/plugins"],
  "sourceNativeInputChanges": "none",
  "qaRoutingGateInjection": "mobile/src/features/auth/useGate.ts: dev __DEV__ -> dev true",
  "qaRoutingGateDiffSha256": "$GATE_DIFF_SHA256",
  "simulatorAppArchiveSha256": "$ZIP_SHA256",
  "nativeExecutableSha256": "$NATIVE_BINARY_SHA256",
  "rebundledMainJsBundleSha256": "$MAIN_BUNDLE_SHA256",
  "bundleId": "$BUILT_APP_ID",
  "userInterfaceStyle": "$BUILT_STYLE",
  "runnerArchitecture": "$RUNNER_ARCH",
  "appArchitectures": "$APP_ARCHS",
  "appearance": "$SIMULATOR_APPEARANCE"
}
EOF
printf '%s\n' \
  "Native binary reused SHA-256: $NATIVE_BINARY_SHA256" \
  "Re-bundled main.jsbundle SHA-256: $MAIN_BUNDLE_SHA256" \
  "Temporary QA gate diff SHA-256: $GATE_DIFF_SHA256" | tee -a "$RESULTS_DIR/source-and-probe.txt"
printf '%s\n' "Pre-rebundle main.jsbundle SHA-256: $PRE_REBUNDLE_SHA256" "Post-rebundle main.jsbundle SHA-256: $POST_REBUNDLE_SHA256" >> "$RESULTS_DIR/source-and-probe.txt"
printf '%s\n' '- QA-only demo routing gate diff recorded and restored; embedded Hermes JS/assets refreshed; staging host absent: PASS' >> "$RESULTS_DIR/checklist.txt"

log_phase 'Selecting latest available iPhone simulator on iOS 26.'
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

log_phase "Booting simulator with $SIMULATOR_APPEARANCE appearance."
if ! xcrun simctl list devices booted | grep -q "$SIMULATOR_ID"; then
  xcrun simctl boot "$SIMULATOR_ID" 2>&1 | tee "$RESULTS_DIR/simulator-boot.log"
fi
xcrun simctl bootstatus "$SIMULATOR_ID" -b 2>&1 | tee -a "$RESULTS_DIR/simulator-boot.log"
xcrun simctl ui "$SIMULATOR_ID" appearance "$SIMULATOR_APPEARANCE"
printf '%s\n' '- Selected and booted latest available iPhone on iOS 26: PASS' >> "$RESULTS_DIR/checklist.txt"

log_phase 'Installing the reused simulator app. No project build or backend request is performed.'
xcrun simctl install "$SIMULATOR_ID" "$APP_PATH" 2>&1 | tee "$RESULTS_DIR/install.log"
printf '%s\n' '- Installed reused simulator app: PASS' >> "$RESULTS_DIR/checklist.txt"

log_phase 'Launching app directly at its native root without an Expo Go URL handoff.'
xcrun simctl launch "$SIMULATOR_ID" "$APP_ID" 2>&1 | tee "$RESULTS_DIR/launch.log"
sleep 10
xcrun simctl io "$SIMULATOR_ID" screenshot "$RESULTS_DIR/native-app-first-launch.png"
printf '%s\n' '- Launched app directly and captured first-launch screenshot: PASS' >> "$RESULTS_DIR/checklist.txt"

FLOW_FAILURES=0
if [[ "$DRIVER_ENGINE" == 'appium' ]]; then
  : "${APPIUM_BIN:?Appium engine selected but APPIUM_BIN is unset}"
  : "${APPIUM_HOME:?Appium engine selected but APPIUM_HOME is unset}"
  log_phase 'Starting the Appium server on loopback for native XCTest UI automation.'
  APPIUM_HOME="$APPIUM_HOME" "$APPIUM_BIN" server \
    --address 127.0.0.1 --port 4723 --base-path / \
    --log "$RESULTS_DIR/appium-server.log" --log-level info --log-timestamp \
    > "$RESULTS_DIR/appium-server-stdout.log" 2>&1 &
  APPIUM_SERVER_PID=$!
  appium_ready=0
  for _ in $(seq 1 60); do
    if ! kill -0 "$APPIUM_SERVER_PID" 2>/dev/null; then
      echo 'Appium server exited before becoming ready.' >&2
      cat "$RESULTS_DIR/appium-server-stdout.log" >&2 || true
      exit 1
    fi
    if curl --silent --show-error --fail --max-time 2 http://127.0.0.1:4723/status \
      > "$RESULTS_DIR/appium-status.json" 2>/dev/null; then
      appium_ready=1
      break
    fi
    sleep 1
  done
  if [[ "$appium_ready" -ne 1 ]]; then
    echo 'Appium server did not become ready on loopback within 60 seconds.' >&2
    exit 1
  fi
  printf '%s\n' '- Appium server bound to 127.0.0.1; XCTest idling disabled for this probe, app performance not validated: PASS' >> "$RESULTS_DIR/checklist.txt"
  if python3 scripts/qa-appium.py --udid "$SIMULATOR_ID" --app-id "$APP_ID" \
    --server-url http://127.0.0.1:4723 --appearance "$SIMULATOR_APPEARANCE" \
    --results-dir "$RESULTS_DIR/appium" --flows "${PROBE_FLOWS[@]}"; then
    printf '%s\n' "- Appium flows (${PROBE_FLOWS[*]}): PASS" | tee -a "$RESULTS_DIR/checklist.txt"
  else
    flow_status=$?
    printf '%s\n' "- Appium flow group: FAIL (exit $flow_status; see appium/)" | tee -a "$RESULTS_DIR/checklist.txt"
    FLOW_FAILURES=1
  fi
else
  log_phase "Running selected IDB flows (${PROBE_FLOWS[*]}) separately against the reused native app."
  for flow in "${PROBE_FLOWS[@]}"; do
    flow_dir="$RESULTS_DIR/$flow"
    mkdir -p "$flow_dir"
    printf '[%s] Starting IDB flow %s.\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$flow" | tee -a "$RESULTS_DIR/run.log"
    if python3 scripts/qa-idb.py --udid "$SIMULATOR_ID" --results-dir "$flow_dir" --app-id "$APP_ID" --flow "$flow"; then
      printf '%s\n' "- IDB $flow flow: PASS" | tee -a "$RESULTS_DIR/checklist.txt"
    else
      flow_status=$?
      printf '%s\n' "- IDB $flow flow: FAIL (exit $flow_status; see $flow/)" | tee -a "$RESULTS_DIR/checklist.txt"
      FLOW_FAILURES=1
    fi
  done
fi
if [[ "$FLOW_FAILURES" -ne 0 ]]; then
  printf 'Native simulator recheck: FAIL\n' > "$RESULTS_DIR/summary.txt"
  exit 1
fi
printf 'Native simulator recheck: PASS\n' > "$RESULTS_DIR/summary.txt"
log_phase 'Native simulator recheck completed successfully.'
