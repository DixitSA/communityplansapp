#!/usr/bin/env python3
"""Bounded native iOS smoke flows over Appium's local W3C WebDriver endpoint."""
import argparse
import base64
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

APP_ID = "com.dixitsa.yard"
DEMO_NOTICE = "Demo mode: there is no account to sign out of."


class AppiumError(RuntimeError):
    pass


class WebDriver:
    def __init__(self, base_url: str, udid: str, app_id: str, log_path: Path):
        self.base_url = base_url.rstrip("/")
        self.udid = udid
        self.app_id = app_id
        self.log_path = log_path
        self.session_id = ""

    def request(self, method: str, path: str, payload=None, timeout=30):
        url = self.base_url + path
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        headers = {} if body is None else {"Content-Type": "application/json; charset=utf-8"}
        started = datetime.now(timezone.utc).isoformat()
        before = time.monotonic()
        error = None
        try:
            request = urllib.request.Request(url, data=body, headers=headers, method=method)
            with urllib.request.urlopen(request, timeout=timeout) as response:
                raw = response.read()
            result = json.loads(raw.decode("utf-8")) if raw else {}
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError) as exc:
            error = f"{type(exc).__name__}: {exc}"
            if isinstance(exc, urllib.error.HTTPError):
                try:
                    error += ": " + exc.read().decode("utf-8", "replace")[-2000:]
                except Exception:
                    pass
            result = None
        entry = {
            "timestamp": started,
            "method": method,
            "path": path,
            "durationMs": round((time.monotonic() - before) * 1000),
            "error": error,
        }
        with self.log_path.open("a", encoding="utf-8") as log:
            log.write(json.dumps(entry, separators=(",", ":")) + "\n")
        if error:
            raise AppiumError(f"{method} {path} failed after {entry['durationMs']}ms: {error}")
        result_value = result.get("value") if isinstance(result, dict) else None
        if isinstance(result_value, dict) and result_value.get("error"):
            raise AppiumError(f"{method} {path}: {result_value.get('message', result_value['error'])}")
        return result.get("value") if isinstance(result, dict) else result

    def create_session(self):
        capabilities = {
            "platformName": "iOS",
            "appium:automationName": "XCUITest",
            "appium:udid": self.udid,
            "appium:bundleId": self.app_id,
            "appium:noReset": True,
            # Hosted runners already boot the device without a Simulator.app window.
            "appium:isHeadless": True,
            # This disables XCTest idling checks only; app performance/idle behavior is not measured.
            "appium:waitForIdleTimeout": 0,
            "appium:wdaLaunchTimeout": 120000,
            "appium:wdaStartupRetries": 1,
            "appium:wdaStartupRetryInterval": 5000,
            "appium:newCommandTimeout": 120,
            "appium:useNewWDA": True,
        }
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        (self.log_path.parent / "capabilities.json").write_text(
            json.dumps({"alwaysMatch": capabilities, "performanceValidation": "not performed; waitForIdleTimeout=0"}, indent=2),
            encoding="utf-8",
        )
        value = self.request("POST", "/session", {"capabilities": {"alwaysMatch": capabilities}}, timeout=600)
        session_id = value.get("sessionId") if isinstance(value, dict) else None
        if not session_id:
            raise AppiumError(f"Appium did not return a session ID: {value!r}")
        self.session_id = str(session_id)

    def call(self, method: str, suffix: str, payload=None, timeout=30):
        if not self.session_id:
            raise AppiumError("No active Appium session")
        return self.request(method, f"/session/{self.session_id}{suffix}", payload, timeout)

    def find_all(self, value: str):
        return self.call("POST", "/elements", {"using": "accessibility id", "value": value}) or []

    def wait_one(self, value: str, label: str | None = None, timeout=45):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            found = self.find_all(value)
            if len(found) == 1:
                return found[0]
            if len(found) > 1:
                raise AssertionError(f"Expected one accessible element {label or value!r}; found {len(found)}")
            time.sleep(0.6)
        raise AssertionError(f"Timed out after {timeout}s waiting for accessible element {label or value!r}")

    def click(self, element):
        element_id = element.get("element-6066-11e4-a52e-4f735466cecf") or element.get("ELEMENT")
        if not element_id:
            raise AppiumError(f"Appium returned malformed element reference: {element!r}")
        return self.call("POST", f"/element/{urllib.parse.quote(str(element_id), safe='')}/click", {})

    def attribute(self, element, name):
        element_id = element.get("element-6066-11e4-a52e-4f735466cecf") or element.get("ELEMENT")
        if not element_id:
            raise AppiumError(f"Appium returned malformed element reference: {element!r}")
        value = self.call("GET", f"/element/{urllib.parse.quote(str(element_id), safe='')}/attribute/{name}")
        return "" if value is None else str(value)

    def set_text(self, element, text: str):
        element_id = element.get("element-6066-11e4-a52e-4f735466cecf") or element.get("ELEMENT")
        if not element_id:
            raise AppiumError(f"Appium returned malformed element reference: {element!r}")
        self.call("POST", f"/element/{urllib.parse.quote(str(element_id), safe='')}/clear", {})
        self.call("POST", f"/element/{urllib.parse.quote(str(element_id), safe='')}/value", {"text": text, "value": list(text)})

    def source(self):
        return str(self.call("GET", "/source", timeout=45))

    def screenshot(self, path: Path):
        encoded = self.call("GET", "/screenshot", timeout=45)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(base64.b64decode(encoded, validate=True))

    def execute_mobile(self, name: str, args: dict):
        return self.call("POST", "/execute/sync", {"script": f"mobile: {name}", "args": [args]}, timeout=90)

    def swipe(self, screen_direction: str):
        self.execute_mobile("swipe", {"direction": screen_direction, "velocity": 1000})

    def deep_link(self, url: str):
        self.execute_mobile("deepLink", {"url": url, "bundleId": self.app_id})

    def restart_app(self):
        self.execute_mobile("terminateApp", {"bundleId": self.app_id})
        self.execute_mobile("launchApp", {"bundleId": self.app_id})

    def delete_session(self):
        if self.session_id:
            try:
                self.call("DELETE", "", timeout=30)
            finally:
                self.session_id = ""


def visible_xml_strings(source: str):
    try:
        root = ET.fromstring(source)
    except ET.ParseError as exc:
        raise AppiumError(f"XCUITest page source was not valid XML: {exc}") from exc
    for node in root.iter():
        if node.attrib.get("visible", "").lower() != "true":
            continue
        if node.text and node.text.strip():
            yield node.text.strip()
        for key in ("label", "name", "value", "placeholderValue", "hint"):
            value = node.attrib.get(key)
            if value:
                yield value


class Flow:
    def __init__(self, driver: WebDriver, root: Path, name: str):
        self.driver = driver
        self.root = root / name
        self.name = name
        self.checks = []
        self.root.mkdir(parents=True, exist_ok=True)

    def record(self, check: str, passed: bool, detail=""):
        item = {"check": check, "passed": bool(passed), "detail": str(detail)}
        self.checks.append(item)
        if not passed:
            raise AssertionError(check + (f": {detail}" if detail else ""))

    def source(self):
        source = self.driver.source()
        (self.root / "last-page-source.xml").write_text(source, encoding="utf-8")
        return source

    @staticmethod
    def has_visible(source: str, text: str):
        return any(text.casefold() in value.casefold() for value in visible_xml_strings(source))

    @staticmethod
    def has_visible_exact(source: str, text: str):
        return any(text.casefold() == value.casefold() for value in visible_xml_strings(source))

    def wait_source(self, predicate, what: str, timeout=45):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            source = self.source()
            if predicate(source):
                return source
            time.sleep(0.6)
        raise AssertionError(f"Timed out after {timeout}s waiting for {what}")

    def click(self, label: str, timeout=45):
        self.driver.click(self.driver.wait_one(label, timeout=timeout))

    def capture(self, name: str):
        self.driver.screenshot(self.root / name)

    def finish_failure(self, exc):
        try:
            self.capture("failure.png")
        except Exception as capture_exc:
            (self.root / "failure-capture-error.txt").write_text(str(capture_exc), encoding="utf-8")
        try:
            self.source()
        except Exception as source_exc:
            (self.root / "failure-source-error.txt").write_text(str(source_exc), encoding="utf-8")
        (self.root / "checklist.json").write_text(
            json.dumps({"passed": False, "flow": self.name, "error": str(exc), "checks": self.checks}, indent=2),
            encoding="utf-8",
        )

    def restart_to_feed(self):
        self.driver.restart_app()
        self.wait_source(lambda x: self.has_visible(x, "Nearby") and self.has_visible(x, "Feed"), "feed after app restart")
        self.capture("feed.png")

    def settings_demo_preflight(self):
        self.click("Settings")
        source = self.wait_source(
            lambda x: self.has_visible_exact(x, "Settings") and self.has_visible(x, "Who sees what"),
            "visible Settings sheet",
        )
        self.record("Settings sheet opened", self.has_visible_exact(source, "Settings"))
        for _ in range(4):
            source = self.source()
            if self.has_visible(source, DEMO_NOTICE):
                break
            self.driver.swipe("up")
        source = self.wait_source(lambda x: self.has_visible(x, DEMO_NOTICE), "visible demo settings disclosure")
        self.record("demo settings disclosure visible before mutation", self.has_visible(source, DEMO_NOTICE))
        self.capture("demo-settings.png")
        self.click("Done")
        self.wait_source(lambda x: self.has_visible(x, "Nearby") and not self.has_visible(x, DEMO_NOTICE), "feed after Settings")

    def profile_name_field(self, timeout=30):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            by_id = self.driver.find_all("edit-profile-name-input")
            if len(by_id) == 1:
                return by_id[0]
            if len(by_id) > 1:
                raise AssertionError(f"Expected one profile name testID; found {len(by_id)}")
            by_name = self.driver.find_all("Name")
            if len(by_name) == 1:
                return by_name[0]
            if len(by_name) > 1:
                raise AssertionError(f"Expected one accessible Name field; found {len(by_name)}")
            time.sleep(0.5)
        raise AssertionError("Timed out waiting for the profile name input")

    def run_profile(self):
        self.restart_to_feed()
        self.settings_demo_preflight()
        self.click("Profile")
        self.wait_source(lambda x: self.has_visible(x, "Edit profile"), "profile screen")
        self.click("Edit profile")
        self.wait_source(lambda x: self.has_visible_exact(x, "Save") and self.has_visible_exact(x, "Name"), "profile editor")
        field = self.profile_name_field()
        old_name = self.driver.attribute(field, "value")
        self.record("profile name field/value available", bool(old_name), "empty profile field" if not old_name else "")
        new_name = old_name + " QA"
        self.record("profile replacement is ASCII and within length limit", new_name.isascii() and len(new_name) <= 50)
        self.driver.set_text(field, new_name)
        deadline = time.monotonic() + 30
        actual_name = ""
        while time.monotonic() < deadline:
            field = self.profile_name_field(timeout=2)
            actual_name = self.driver.attribute(field, "value")
            if actual_name == new_name:
                break
            time.sleep(0.5)
        self.record("profile name exactly replaced before Save", actual_name == new_name, f"expected {new_name!r}; got {actual_name!r}")
        self.capture("profile-edited.png")
        save = self.driver.wait_one("Save")
        enabled = self.driver.attribute(save, "enabled").lower() == "true"
        self.record("Save enabled for changed profile", enabled)
        self.driver.click(save)
        source = self.wait_source(
            lambda x: self.has_visible(x, new_name) and self.has_visible(x, "Edit profile") and not self.has_visible_exact(x, "Cancel"),
            "saved profile screen",
        )
        self.record("save dismissed editor and updated profile", self.has_visible(source, new_name))
        self.capture("profile-saved.png")
        self.click("Edit profile")
        self.wait_source(lambda x: self.has_visible_exact(x, "Save") and self.has_visible_exact(x, "Name"), "reopened profile editor")
        field = self.profile_name_field()
        persisted = self.driver.attribute(field, "value")
        self.record("saved name persists after reopen", persisted == new_name, f"expected {new_name!r}; got {persisted!r}")
        self.capture("profile-reopened.png")

    def result_count(self, source: str):
        for value in visible_xml_strings(source):
            match = re.fullmatch(r"Show (\d+) events?", value)
            if match:
                return int(match.group(1)), value
        return None, None

    def run_filters(self):
        self.restart_to_feed()
        self.settings_demo_preflight()
        self.driver.deep_link("yard://filters")
        source = self.wait_source(lambda x: self.has_visible_exact(x, "Filters") and self.result_count(x)[0] is not None, "visible Filters screen and count")
        baseline, label = self.result_count(source)
        self.record("default filter count exposed", baseline is not None, label or "")
        self.capture("filters-default.png")
        self.click("Nightlife")
        source = self.wait_source(lambda x: self.result_count(x)[0] is not None and self.result_count(x)[0] != baseline, "Nightlife count change")
        filtered, _ = self.result_count(source)
        self.record("Nightlife changes result count", filtered != baseline, f"{baseline} -> {filtered}")
        self.capture("filters-nightlife.png")
        self.click("Clear all filters")
        source = self.wait_source(lambda x: self.result_count(x)[0] == baseline, "Clear restores default count")
        self.record("Clear restores default result count", self.result_count(source)[0] == baseline, str(baseline))
        self.capture("filters-cleared.png")
        _, apply_label = self.result_count(source)
        self.click(apply_label)
        source = self.wait_source(
            lambda x: self.has_visible(x, "Nearby") and not self.has_visible_exact(x, "Filters"),
            "feed after Apply",
        )
        self.record("Apply returns to feed", self.has_visible(source, "Nearby") and not self.has_visible_exact(source, "Filters"))
        self.capture("feed-after-filters.png")

    def run_calendar(self):
        self.restart_to_feed()
        self.settings_demo_preflight()
        self.driver.deep_link("yard://event/ev-007")
        source = self.wait_source(lambda x: self.has_visible(x, "Rooftop Happy Hour"), "calendar probe event")
        self.record("calendar probe event opened", self.has_visible(source, "Rooftop Happy Hour"))
        self.click("Going")
        source = self.wait_source(lambda x: self.has_visible(x, "You're going"), "Going confirmation")
        self.record("Going confirmation opened", self.has_visible(source, "You're going"))
        for _ in range(5):
            source = self.source()
            if self.has_visible(source, "Add to Calendar"):
                break
            self.driver.swipe("up")
        self.click("Add to Calendar")
        source = self.wait_source(lambda x: self.has_visible_exact(x, "New Event") and self.has_visible_exact(x, "Cancel"), "native calendar editor")
        self.record("native calendar editor opened", True)
        self.record("calendar editor contains event title", self.has_visible(source, "Rooftop Happy Hour"))
        self.capture("calendar-editor-open.png")
        self.click("Cancel")
        source = self.wait_source(lambda x: self.has_visible(x, "You're going") and not self.has_visible_exact(x, "New Event"), "Going sheet after cancel")
        self.record("calendar editor cancelled without saving", not self.has_visible_exact(source, "New Event"))
        self.capture("calendar-editor-cancelled.png")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--udid", required=True)
    parser.add_argument("--app-id", choices=(APP_ID,), default=APP_ID)
    parser.add_argument("--server-url", required=True)
    parser.add_argument("--appearance", choices=("light", "dark"), required=True)
    parser.add_argument("--results-dir", required=True, type=Path)
    args = parser.parse_args()
    parsed_url = urllib.parse.urlparse(args.server_url)
    if parsed_url.scheme != "http" or parsed_url.hostname != "127.0.0.1" or parsed_url.port != 4723:
        parser.error("Appium server must be reachable only at http://127.0.0.1:4723")
    if any(os.environ.get(key, "").strip() for key in (
        "EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY", "EXPO_TOKEN"
    )):
        parser.error("Appium QA requires blank backend values and EXPO_TOKEN")
    args.results_dir.mkdir(parents=True, exist_ok=True)
    driver = WebDriver(args.server_url, args.udid, args.app_id, args.results_dir / "webdriver-commands.jsonl")
    (args.results_dir / "run-metadata.json").write_text(json.dumps({
        "engine": "Appium XCUITest",
        "appId": args.app_id,
        "udid": args.udid,
        "appearance": args.appearance,
        "waitForIdleTimeout": 0,
        "performanceOrIdleBehaviorValidated": False,
        "flows": ["profile", "filters", "calendar"],
    }, indent=2), encoding="utf-8")
    flows = [Flow(driver, args.results_dir, name) for name in ("profile", "filters", "calendar")]
    failures = 0
    try:
        driver.create_session()
        for flow in flows:
            try:
                (flow.root / "flow-start.txt").write_text(datetime.now(timezone.utc).isoformat(), encoding="utf-8")
                getattr(flow, f"run_{flow.name}")()
                (flow.root / "checklist.json").write_text(
                    json.dumps({"passed": True, "flow": flow.name, "checks": flow.checks}, indent=2), encoding="utf-8"
                )
                print(f"PASS {flow.name}: {len(flow.checks)} checks")
            except Exception as exc:
                failures += 1
                flow.finish_failure(exc)
                print(f"FAIL {flow.name} after {len(flow.checks)} checks: {type(exc).__name__}: {exc}", file=sys.stderr)
                if not driver.session_id:
                    for remaining in flows:
                        if remaining is flow:
                            continue
                        path = remaining.root / "checklist.json"
                        if not path.exists():
                            path.write_text(json.dumps({
                                "passed": False, "flow": remaining.name,
                                "error": "Appium session unavailable after an earlier flow terminated it.",
                                "checks": remaining.checks,
                            }, indent=2), encoding="utf-8")
                    break
        try:
            driver.delete_session()
        except Exception as exc:
            (args.results_dir / "delete-session-error.txt").write_text(str(exc), encoding="utf-8")
    except Exception as exc:
        failures = len(flows)
        (args.results_dir / "session-error.txt").write_text(f"{type(exc).__name__}: {exc}", encoding="utf-8")
        for flow in flows:
            flow.finish_failure(f"Appium session unavailable: {type(exc).__name__}: {exc}")
    summary = {
        "passed": failures == 0,
        "engine": "Appium XCUITest",
        "performanceOrIdleBehaviorValidated": False,
        "flows": [json.loads((flow.root / "checklist.json").read_text(encoding="utf-8")) for flow in flows],
    }
    (args.results_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
