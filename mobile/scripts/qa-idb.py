#!/usr/bin/env python3
"""Focused no-XCTest iOS smoke probe: demo profile save/reopen and feed filters."""
import argparse, json, os, re, shutil, subprocess, sys, time
from datetime import datetime, timezone
from pathlib import Path

ROOT = "exp://localhost:8093/--/?__expo_disable_fab=1&__expo_disable_auto_launch=1&__expo_disable_onboarding=1"
FILTERS_URLS = {
    "host.exp.Exponent": "exp://localhost:8093/--/filters",
    "com.dixitsa.yard": "yard://filters",
}
COMMAND_LOG = None

def record_command(args, started, elapsed, error):
    if COMMAND_LOG is None: return
    entry = {
        "timestamp": started,
        "argv": [str(x) for x in args],
        "duration_ms": round(elapsed * 1000),
        "exit_error": error,
    }
    with COMMAND_LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, separators=(",", ":")) + "\n")

def run(args, timeout=25, allow=False):
    started = datetime.now(timezone.utc).isoformat()
    before = time.monotonic()
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        elapsed = time.monotonic() - before
        record_command(args, started, elapsed, f"timeout after {timeout}s")
        raise RuntimeError(f"command timed out after {timeout}s: {args!r}") from exc
    except Exception as exc:
        record_command(args, started, time.monotonic() - before, f"{type(exc).__name__}: {exc}")
        raise RuntimeError(f"command failed: {args!r}: {type(exc).__name__}: {exc}") from exc
    error = f"exit {p.returncode}" if p.returncode else None
    record_command(args, started, time.monotonic() - before, error)
    if p.returncode and not allow:
        raise RuntimeError(f"command {args!r} exited {p.returncode}: {p.stderr[-500:]}")
    return p.stdout.strip()

def walk(x):
    if isinstance(x, dict):
        yield x
        for v in x.values():
            if isinstance(v, (dict, list)): yield from walk(v)
    elif isinstance(x, list):
        for v in x: yield from walk(v)

def fields(n):
    return {str(k).lower(): v for k, v in n.items()}

def label(n):
    f = fields(n)
    return str(f.get("label", f.get("axlabel", f.get("accessibilitytext", ""))) or "")

def value(n):
    f = fields(n)
    return str(f.get("value", f.get("axvalue", "")) or "")

def node_id(n):
    f = fields(n)
    return str(f.get("axuniqueid", f.get("uniqueid", f.get("unique_id", ""))) or "")

def onscreen(n, size):
    f = fields(n); box = f.get("frame", f.get("axframe"))
    if not isinstance(box, dict): return False
    b = fields(box)
    try:
        x, y = float(b["x"]), float(b["y"])
        w, h = float(b["width"]), float(b["height"])
        sw, sh = size
        return w > 0 and h > 0 and x < sw and y < sh and x + w > 0 and y + h > 0
    except (KeyError, TypeError, ValueError): return False

def nodes_for(data, size):
    return [n for n in walk(data) if (label(n) or node_id(n) or value(n)) and onscreen(n, size)]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--udid", required=True)
    ap.add_argument("--results-dir", required=True, type=Path)
    ap.add_argument("--app-id", choices=("host.exp.Exponent", "com.dixitsa.yard"), default="host.exp.Exponent")
    ap.add_argument("--flow", choices=("all", "profile", "filters", "calendar"), default="all")
    a = ap.parse_args(); a.results_dir.mkdir(parents=True, exist_ok=True)
    global COMMAND_LOG
    COMMAND_LOG = a.results_dir / "commands.jsonl"
    if not shutil.which("idb") or not shutil.which("xcrun"):
        ap.error("idb and xcrun must already be installed")
    if any(os.environ.get(k, "").strip() for k in ("EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY")):
        ap.error("demo preflight failed: Supabase URL/key must be blank")
    if a.flow == "calendar" and a.app_id != "com.dixitsa.yard":
        ap.error("Calendar editor requires the standalone native simulator app")
    checks = []
    stage = "idb-companion-connect"

    def startup_output(name, stdout, stderr):
        def clean(value):
            return value.decode("utf-8", "replace") if isinstance(value, bytes) else (value or "")
        (a.results_dir / f"{name}.log").write_text(
            f"STDOUT\n{clean(stdout)}\nSTDERR\n{clean(stderr)}", encoding="utf-8"
        )

    def startup_command(name, command, timeout):
        started = datetime.now(timezone.utc).isoformat(); before = time.monotonic()
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=timeout)
        except subprocess.TimeoutExpired as exc:
            record_command(command, started, time.monotonic() - before, f"timeout after {timeout}s")
            startup_output(name, exc.stdout, exc.stderr)
            raise
        except Exception as exc:
            record_command(command, started, time.monotonic() - before, f"{type(exc).__name__}: {exc}")
            raise RuntimeError(f"command failed: {command!r}: {type(exc).__name__}: {exc}") from exc
        record_command(command, started, time.monotonic() - before, f"exit {result.returncode}" if result.returncode else None)
        startup_output(name, result.stdout, result.stderr)
        if result.returncode:
            raise RuntimeError(f"command {command!r} exited {result.returncode}; see {name}.log")
        return result.stdout.strip()

    def startup_failure(error):
        try:
            run(["xcrun", "simctl", "io", a.udid, "screenshot", str(a.results_dir / "preflight-screen.png")], timeout=30)
        except Exception:
            pass
        (a.results_dir / "checklist.json").write_text(json.dumps({
            "passed": False, "flow": a.flow, "failed_at": stage, "error": str(error), "checks": checks,
        }, indent=2), encoding="utf-8")

    try:
        # Explicitly separate companion cold start from the first metadata request.
        startup_command("companion-start", ["idb", "--log", "DEBUG", "connect", a.udid], 120)
        stage = "idb-initial-describe"
        desc = json.loads(startup_command(
            "initial-describe", ["idb", "describe", "--json", "--udid", a.udid], 45,
        ))
    except Exception as exc:
        startup_failure(exc)
        print(f"FAIL during {stage}; startup logs and preflight screenshot saved: {a.results_dir}", file=sys.stderr)
        return 1
    size = next(((float(fields(n).get("width_points", fields(n).get("widthpoints"))),
                  float(fields(n).get("height_points", fields(n).get("heightpoints"))))
                 for n in walk(desc) if fields(n).get("width_points", fields(n).get("widthpoints")) and fields(n).get("height_points", fields(n).get("heightpoints"))), None)
    if not size:
        stage = "idb-screen-dimensions"
        startup_failure("idb describe JSON did not report screen point dimensions")
        print(f"FAIL during {stage}; preflight screenshot saved: {a.results_dir}", file=sys.stderr)
        return 1
    def record(name, ok, detail=""):
        checks.append({"check": name, "passed": bool(ok), "detail": detail})
        if not ok: raise AssertionError(name + (": " + detail if detail else ""))
    def ax():
        command = ["idb", "ui", "describe-all", "--api", "axbridge", "--format", "complete", "--json", "--udid", a.udid]
        deadline = time.monotonic() + 30
        while True:
            try:
                return json.loads(run(command, timeout=max(0.1, min(15, deadline - time.monotonic()))))
            except RuntimeError as exc:
                transient = ("window-server frontmost returned no application object" in str(exc)
                             or isinstance(exc.__cause__, subprocess.TimeoutExpired))
                if not transient or time.monotonic() >= deadline:
                    raise
                time.sleep(0.25)
    def tap(text):
        ns = nodes_for(ax(), size); matches = [n for n in ns if label(n) == text]
        if len(matches) != 1: raise AssertionError(f"expected one visible {text!r}, found {len(matches)}")
        f = fields(matches[0]); box = fields(f.get("frame", f.get("axframe", {})))
        try:
            x = int(float(box["x"]) + float(box["width"]) / 2)
            y = int(float(box["y"]) + float(box["height"]) / 2)
        except (KeyError, TypeError, ValueError):
            raise AssertionError(f"visible {text!r} has no usable AX frame")
        sw, sh = size
        if not (0 <= x < sw and 0 <= y < sh):
            raise AssertionError(f"visible {text!r} center is outside {sw:g}x{sh:g} point screen")
        run(["idb", "ui", "tap", str(x), str(y), "--udid", a.udid, "--api", "hid"])
    def wait(pred, what, timeout=45):
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            data = ax(); ns = nodes_for(data, size)
            if pred(ns): return data, ns
            time.sleep(.6)
        raise AssertionError("timed out waiting for " + what)
    def has(ns, text): return any(text in label(n) or text in value(n) for n in ns)
    def exact(ns, text): return any(label(n) == text for n in ns)
    def save_shot(name): run(["idb", "screenshot", str(a.results_dir / name), "--udid", a.udid], timeout=30)
    def save_ax(name, data): (a.results_dir / name).write_text(json.dumps(data, indent=2), encoding="utf-8")
    def fail_evidence(exc):
        try:
            (a.results_dir / "failure-ax.json").write_text(json.dumps(ax(), indent=2), encoding="utf-8")
            save_shot("failure.png")
        except Exception: pass
        (a.results_dir / "checklist.json").write_text(json.dumps({"passed": False, "flow": a.flow, "error": str(exc), "checks": checks}, indent=2), encoding="utf-8")
    try:
        run(["xcrun", "simctl", "terminate", a.udid, a.app_id], allow=True)
        run(["xcrun", "simctl", "launch", a.udid, a.app_id], timeout=30)
        if a.app_id == "host.exp.Exponent":
            run(["xcrun", "simctl", "openurl", a.udid, ROOT], timeout=30)
            for _ in range(3):
                _, ns = wait(lambda x: any(t in [label(n) for n in x] for t in ("Open", "Continue", "Nearby")), "Expo Go / feed")
                if exact(ns, "Open"): tap("Open")
                elif exact(ns, "Continue"): tap("Continue")
                elif exact(ns, "Nearby"): break
        # Native launch already selects the anchored Feed. Avoid a redundant scheme handoff.
        data, ns = wait(lambda x: exact(x, "Nearby"), "demo feed")
        record("feed opened", exact(ns, "Feed") and exact(ns, "Nearby")); save_shot("feed.png")
        tap("Settings")
        for _ in range(4):
            data = ax(); ns = nodes_for(data, size)
            if has(ns, "Demo mode: there is no account to sign out of."): break
            run(["idb", "ui", "scroll", "down", "--udid", a.udid])
        data, ns = wait(lambda x: has(x, "Demo mode: there is no account to sign out of."), "demo preflight")
        record("demo preflight visible", True); tap("Done")
        _, ns = wait(lambda x: exact(x, "Nearby") and not has(x, "Demo mode: there is no account to sign out of."), "feed after Settings")
        if a.flow in ("all", "profile"):
            tap("Profile"); _, ns = wait(lambda x: exact(x, "Edit profile"), "profile page")
            tap("Edit profile"); data, ns = wait(lambda x: exact(x, "Name") and exact(x, "Save"), "edit form")
            field = next((n for n in ns if "edit-profile-name-input" in node_id(n)), None) or next((n for n in ns if label(n) == "Name"), None)
            old = value(field) if field else ""
            record("profile name field/value available", bool(field and old), "field unavailable" if not old else "")
            new = old + " QA"
            record("ASCII name fits", len(new) <= 50 and new.isascii())
            ident, key = (node_id(field), "AXUniqueId") if node_id(field) else ("Name", "AXLabel")
            run(["idb", "ui", "set-value", ident, "--match-key", key, "--value", new, "--udid", a.udid])
            _, ns = wait(lambda x: any(label(n) == "Save" and str(fields(n).get("enabled", "true")).lower() != "false" for n in x), "enabled Save")
            tap("Save")
            _, ns = wait(lambda x: has(x, new) and exact(x, "Edit profile") and not any(label(n) in ("Save", "Cancel") for n in x), "saved profile screen")
            record("save dismissed editor and updated profile", True); save_shot("profile-saved.png")
            tap("Edit profile"); data, ns = wait(lambda x: exact(x, "Name") and exact(x, "Save"), "reopened editor")
            field = next((n for n in ns if "edit-profile-name-input" in node_id(n)), None) or next((n for n in ns if label(n) == "Name"), None)
            record("saved name persists after reopen", bool(field and new in value(field)), "reopened field mismatch")
            save_shot("profile-reopened.png"); tap("Cancel")
            _, ns = wait(lambda x: exact(x, "Edit profile") and exact(x, "Feed") and not any(label(n) in ("Save", "Cancel") for n in x), "profile after editor cancel")
            tap("Feed"); _, ns = wait(lambda x: exact(x, "Nearby"), "Feed screen")
        if a.flow in ("all", "filters"):
            run(["xcrun", "simctl", "openurl", a.udid, FILTERS_URLS[a.app_id]], timeout=30)
            data, ns = wait(lambda x: exact(x, "Filters") and any(re.match(r"Show \d+ events?", label(n)) for n in x), "Filters screen")
            count = lambda xs: next((int(m.group(1)) for n in xs if (m := re.match(r"Show (\d+) events?", label(n)))), None)
            baseline = count(ns); record("default filter count exposed", baseline is not None, str(baseline))
            tap("Nightlife"); data, ns = wait(lambda x: count(x) is not None and count(x) != baseline, "Nightlife count change")
            filtered = count(ns); record("Nightlife changes result count", filtered != baseline, f"{baseline} -> {filtered}"); save_shot("filters-nightlife.png")
            tap("Clear all filters"); data, ns = wait(lambda x: count(x) == baseline, "Clear restores count")
            record("Clear restores default result count", True, str(count(ns))); save_shot("filters-cleared.png")
            tap(next(label(n) for n in ns if re.match(r"Show \d+ events?", label(n))))
            _, ns = wait(lambda x: exact(x, "Nearby") and not exact(x, "Filters"), "feed after Apply")
            record("Apply returns to feed", True); save_shot("feed-after-filters.png")
        if a.flow == "all":
            tap("Settings")
            for _ in range(4):
                data = ax(); ns = nodes_for(data, size)
                if exact(ns, "How yard works"): break
                run(["idb", "ui", "scroll", "down", "--udid", a.udid])
            _, ns = wait(lambda x: exact(x, "How yard works"), "Settings Help row")
            tap("How yard works")
            try:
                data, ns = wait(lambda x: has(x, "Saves the event for later. Only you can see it."), "unique Help body")
            except Exception:
                data = ax(); save_ax("help-ax.json", data); save_shot("help.png"); raise
            save_ax("help-ax.json", data); save_shot("help.png")
            record("Help-only body visible", has(ns, "Saves the event for later. Only you can see it."))
        if a.app_id == "com.dixitsa.yard" and a.flow in ("all", "calendar"):
            # Expo Go does not include expo-calendar. Exercise the native iOS editor only,
            # then cancel before any calendar write.
            run(["xcrun", "simctl", "terminate", a.udid, a.app_id], allow=True)
            run(["xcrun", "simctl", "launch", a.udid, a.app_id], timeout=30)
            _, ns = wait(lambda x: exact(x, "Nearby"), "feed after native relaunch")
            run(["xcrun", "simctl", "openurl", a.udid, "yard://event/ev-007"], timeout=30)
            data, ns = wait(lambda x: exact(x, "Rooftop Happy Hour"), "calendar probe event")
            record("calendar probe event opened", True)
            tap("Going")
            _, ns = wait(lambda x: exact(x, "You're going"), "Going confirmation")
            record("Going confirmation opened", True)
            for _ in range(4):
                data = ax(); ns = nodes_for(data, size)
                if exact(ns, "Add to Calendar"):
                    break
                run(["idb", "ui", "scroll", "up", "--udid", a.udid])
            _, ns = wait(lambda x: exact(x, "Add to Calendar"), "Add to Calendar action")
            tap("Add to Calendar")
            data, ns = wait(lambda x: exact(x, "New Event") and exact(x, "Cancel"), "native calendar editor")
            record("native calendar editor opened", True)
            record("calendar editor contains the event title", has(ns, "Rooftop Happy Hour"))
            save_ax("calendar-editor-ax.json", data); save_shot("calendar-editor-open.png")
            tap("Cancel")
            _, ns = wait(lambda x: exact(x, "You're going") and not exact(x, "New Event"), "Going sheet after calendar cancel")
            record("calendar editor cancelled without saving", True)
            save_shot("calendar-editor-cancelled.png")
        (a.results_dir / "checklist.json").write_text(json.dumps({"passed": True, "flow": a.flow, "checks": checks}, indent=2), encoding="utf-8")
        print(f"PASS {len(checks)} focused IDB checks; artifacts: {a.results_dir}")
    except Exception as e:
        fail_evidence(e); print(f"FAIL after {len(checks)} checks: {type(e).__name__}: {e}", file=sys.stderr); return 1
    return 0

if __name__ == "__main__": raise SystemExit(main())
