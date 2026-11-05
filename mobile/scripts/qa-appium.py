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
DEMO_ALERT = "No account to delete"


def accessibility_predicate(value: str) -> str:
    """Match an exact visible accessible element by stable ID or user-facing label."""
    literal = json.dumps(value, ensure_ascii=False)
    return f"(name == {literal} OR label == {literal}) AND visible == 1 AND accessible == 1"


class AppiumError(RuntimeError):
    pass


class WebDriver:
    def __init__(self, base_url: str, udid: str, app_id: str, log_path: Path):
        self.base_url = base_url.rstrip("/")
        self.udid = udid
        self.app_id = app_id
        self.log_path = log_path
        self.session_id = ""
        self.demo_verified = False

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
            "appium:wdaLaunchTimeout": 360000,
            "appium:showXcodeLog": True,
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
        return self.call("POST", "/elements", {
            "using": "-ios predicate string",
            "value": accessibility_predicate(value),
        }) or []

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
        self.last_source = ""
        self.feed_source = ""
        self.root.mkdir(parents=True, exist_ok=True)

    def record(self, check: str, passed: bool, detail=""):
        item = {"check": check, "passed": bool(passed), "detail": str(detail)}
        self.checks.append(item)
        self.write_checklist("in_progress" if passed else "failed", None if passed else check + (f": {detail}" if detail else ""))
        if not passed:
            raise AssertionError(check + (f": {detail}" if detail else ""))

    def write_checklist(self, status: str, error=None):
        payload = {
            "status": status,
            "passed": True if status == "completed" else False if status == "failed" else None,
            "flow": self.name,
            "checks": self.checks,
        }
        if error is not None:
            payload["error"] = str(error)
        target = self.root / "checklist.json"
        temporary = target.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        temporary.replace(target)

    def source(self):
        source = self.driver.source()
        self.last_source = source
        (self.root / "last-page-source.xml").write_text(source, encoding="utf-8")
        return source

    @staticmethod
    def ancestor_hides_node(ancestor, node):
        """Ignore WDA's false same-frame wrapper, but honor a hidden containing subtree."""
        if ancestor.attrib.get("visible", "true").lower() != "false":
            return False
        try:
            ax, ay, aw, ah = (float(ancestor.attrib[k]) for k in ("x", "y", "width", "height"))
            nx, ny, nw, nh = (float(node.attrib[k]) for k in ("x", "y", "width", "height"))
        except (KeyError, ValueError):
            return True
        contains = ax <= nx and ay <= ny and ax + aw >= nx + nw and ay + ah >= ny + nh
        return contains and (aw > nw or ah > nh)

    @classmethod
    def accessible_nodes(cls, source: str):
        try:
            root = ET.fromstring(source)
        except ET.ParseError as exc:
            raise AppiumError(f"XCUITest page source was not valid XML: {exc}") from exc
        parents = {child: parent for parent in root.iter() for child in parent}
        result = []
        for node in root.iter():
            if node.attrib.get("visible", "").lower() != "true" or node.attrib.get("accessible", "").lower() != "true":
                continue
            ancestor = parents.get(node)
            hidden = False
            while ancestor is not None:
                if cls.ancestor_hides_node(ancestor, node):
                    hidden = True
                    break
                ancestor = parents.get(ancestor)
            if not hidden:
                result.append(node)
        return result

    @staticmethod
    def label_of(node):
        return node.attrib.get("label") or node.attrib.get("name") or ""

    @staticmethod
    def frame_of(node):
        try:
            return tuple(float(node.attrib[key]) for key in ("x", "y", "width", "height"))
        except (KeyError, ValueError):
            return None

    def quick_plan_entries(self, source: str):
        try:
            nodes = ET.fromstring(source).iter()
        except ET.ParseError as exc:
            raise AppiumError(f"XCUITest page source was not valid XML: {exc}") from exc
        prefix = "Make a plan for "
        entries = []
        for node in nodes:
            if node.attrib.get("visible", "").lower() != "true":
                continue
            for value in set((node.attrib.get("label", ""), node.attrib.get("name", ""))):
                if value.startswith(prefix) and value[len(prefix):].strip():
                    entries.append((value[len(prefix):], node))
        return entries

    def quick_plan_titles(self, source: str):
        return {title for title, _ in self.quick_plan_entries(source)}

    def quick_plan_card_targets(self, source: str):
        """Resolve visible plan buttons to their nearest measured event-card wrapper."""
        try:
            root = ET.fromstring(source)
        except ET.ParseError as exc:
            raise AppiumError(f"XCUITest page source was not valid XML: {exc}") from exc
        parents = {child: parent for parent in root.iter() for child in parent}
        prefix = "Make a plan for "
        targets = []
        for plan in root.iter():
            if plan.attrib.get("visible", "").lower() != "true":
                continue
            ancestor = parents.get(plan)
            ancestry = []
            while ancestor is not None:
                ancestry.append(ancestor)
                ancestor = parents.get(ancestor)
            if any(self.ancestor_hides_node(node, plan) for node in ancestry):
                continue
            titles = {
                value[len(prefix):]
                for value in (plan.attrib.get("label", ""), plan.attrib.get("name", ""))
                if value.startswith(prefix) and value[len(prefix):].strip()
            }
            if len(titles) != 1:
                continue
            plan_frame = self.frame_of(plan)
            if not plan_frame:
                continue
            x, y, width, height = plan_frame
            ancestor = parents.get(plan)
            while ancestor is not None:
                frame = self.frame_of(ancestor)
                if frame:
                    ax, ay, aw, ah = frame
                    contains_control = ax <= x and ay <= y and ax + aw >= x + width and ay + ah >= y + height
                    if contains_control and aw > width and ah > height:
                        targets.append({"title": next(iter(titles)), "plan": plan_frame, "card": frame})
                        break
                ancestor = parents.get(ancestor)
        return targets

    @staticmethod
    def row_title_matches(row_label: str, titles):
        return [title for title in titles if f"{title}, " in row_label]

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
        self.write_checklist("failed", exc)
        try:
            self.capture("failure.png")
        except Exception as capture_exc:
            (self.root / "failure-capture-error.txt").write_text(str(capture_exc), encoding="utf-8")
        try:
            self.source()
        except Exception as source_exc:
            (self.root / "failure-source-error.txt").write_text(str(source_exc), encoding="utf-8")

    def restart_to_feed(self):
        self.driver.restart_app()
        self.feed_source = self.wait_source(lambda x: self.has_visible(x, "Nearby") and self.has_visible(x, "Feed"), "feed after app restart")
        (self.root / "feed-page-source.xml").write_text(self.feed_source, encoding="utf-8")
        self.capture("feed.png")

    def settings_demo_preflight(self):
        if self.driver.demo_verified:
            # Same immutable bundle/config and Appium session; restarting the app
            # cannot change its blank backend configuration. Keep the first proof.
            self.record("demo guard verified earlier in this same native session", True)
            return
        settings_sheet = lambda x: self.has_visible_exact(x, "Settings") and self.has_visible(x, "Who sees what")
        self.click("Settings")
        source = self.source()
        if not settings_sheet(source):
            visible_settings_button = [n for n in self.accessible_nodes(source) if self.label_of(n) == "Settings"]
            click_remained_on_feed = (
                self.has_visible(source, "Nearby")
                and self.has_visible(source, "Feed")
                and len(visible_settings_button) == 1
                and not self.has_visible(source, "Who sees what")
                and not self.has_visible_exact(source, "Done")
            )
            if click_remained_on_feed:
                self.record("Feed remained visible after first Settings tap; retrying the observed button once", True, "Settings sheet not present")
                self.driver.click(self.driver.wait_one("Settings"))
            source = self.wait_source(settings_sheet, "visible Settings sheet")
        self.record("Settings sheet opened", self.has_visible_exact(source, "Settings"))
        for _ in range(4):
            source = self.source()
            if self.has_visible_exact(source, "Delete account"):
                break
            self.driver.swipe("up")
        # The first tap never deletes anything: demo shows this alert; configured
        # builds show a first confirmation. Never tap Continue or Delete my account.
        self.click("Delete account")
        source = self.wait_source(
            lambda x: self.has_visible_exact(x, DEMO_ALERT) and self.has_visible(x, "demo mode"),
            "native no-account demo alert",
        )
        self.record("native alert confirms demo mode before mutation", self.has_visible_exact(source, DEMO_ALERT))
        self.capture("demo-guard-alert.png")
        self.click("OK")
        self.click("Done")
        self.wait_source(lambda x: self.has_visible(x, "Nearby") and not self.has_visible_exact(x, DEMO_ALERT), "feed after Settings")
        self.driver.demo_verified = True

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

    def run_profile_interests(self):
        self.restart_to_feed()
        self.settings_demo_preflight()
        self.click("Profile")
        self.wait_source(lambda x: self.has_visible(x, "Edit profile"), "profile screen")
        self.click("Edit profile")
        source = self.wait_source(lambda x: self.has_visible_exact(x, "Fitness") and self.has_visible_exact(x, "Save"), "profile interests editor")
        fitness = [n for n in self.accessible_nodes(source) if self.label_of(n) == "Fitness"]
        self.record("Fitness checkbox is exposed exactly once", len(fitness) == 1, f"found {len(fitness)}")
        before = fitness[0].attrib.get("value", "").lower()
        self.record("Fitness starts unchecked", before in ("checkbox, unchecked", "0", "false"), before)
        self.capture("profile-interests-before.png")
        self.driver.click(self.driver.wait_one("Fitness"))
        source = self.wait_source(
            lambda x: any(self.label_of(n) == "Fitness" and n.attrib.get("value", "").lower() in ("checkbox, checked", "1", "true") for n in self.accessible_nodes(x)),
            "Fitness checkbox selected",
        )
        self.record("Fitness checkbox selected", True)
        save = self.driver.wait_one("Save")
        self.record("Save enabled after interest change", self.driver.attribute(save, "enabled").lower() == "true")
        self.capture("profile-interests-selected.png")
        self.driver.click(save)
        self.wait_source(lambda x: self.has_visible(x, "Edit profile") and not self.has_visible_exact(x, "Save"), "profile after saving interest")
        self.click("Edit profile")
        source = self.wait_source(
            lambda x: any(self.label_of(n) == "Fitness" and n.attrib.get("value", "").lower() in ("checkbox, checked", "1", "true") for n in self.accessible_nodes(x)),
            "reopened profile with Fitness selected",
        )
        self.record("Fitness selection persists after reopen", True)
        self.capture("profile-interests-reopened.png")

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

    def run_map(self):
        self.restart_to_feed()
        self.settings_demo_preflight()
        source = self.source()
        date_choices = [
            node for node in self.accessible_nodes(source)
            if re.search(r", [1-9]\d* events?(?:, friends going)?$", self.label_of(node))
        ]
        self.record("date strip exposes a day with upcoming events", bool(date_choices), ", ".join(self.label_of(node) for node in date_choices) or "No visible date chip reports upcoming events")
        day_label = self.label_of(date_choices[0])
        weekday = day_label.split(" ", 1)[0]
        self.driver.click(self.driver.wait_one(day_label))
        source = self.wait_source(
            lambda x: bool(self.quick_plan_titles(x)),
            "source-labeled events after date selection",
        )
        plan_titles = self.quick_plan_titles(source)
        self.record("selected date exposes source-labeled event titles", bool(plan_titles), ", ".join(sorted(plan_titles)) or day_label)
        row_titles = set()
        visible_rows = [
            node for node in self.accessible_nodes(source)
            if node.attrib.get("name", "").startswith("event-row-") and f", {weekday} " in self.label_of(node)
        ]
        for node in visible_rows:
            matches = self.row_title_matches(self.label_of(node), plan_titles)
            self.record("visible event row resolves to one quick-plan title", len(matches) == 1, self.label_of(node))
            row_titles.add(matches[0])
        candidate_titles = row_titles or plan_titles
        self.record("selected date exposes a source-labeled event title", bool(candidate_titles), ", ".join(sorted(candidate_titles)) or day_label)
        self.click("Show map")
        source = self.wait_source(lambda x: self.has_visible_exact(x, "Show list"), "map view")
        marker_titles = {
            self.label_of(node)
            for node in self.accessible_nodes(source)
            if node.attrib.get("type") == "XCUIElementTypeOther" and self.label_of(node) in candidate_titles
        }
        self.record("map exposes a matching accessible marker title", bool(marker_titles), ", ".join(sorted(marker_titles)) or "No visible marker matched a live feed event title")
        title = sorted(marker_titles)[0]
        marker_nodes = [
            n for n in self.accessible_nodes(source)
            if n.attrib.get("type") == "XCUIElementTypeOther" and self.label_of(n) == title
        ]
        self.record("chosen visible map marker is unique after ancestor filtering", len(marker_nodes) == 1, f"{title}: found {len(marker_nodes)}")
        marker_frame = self.frame_of(marker_nodes[0])
        self.record("chosen map marker has a measured frame", marker_frame is not None, title)
        self.capture("map-marker.png")
        mx, my, mw, mh = marker_frame
        marker_point = (mx + mw / 2, my + mh / 2)
        self.driver.execute_mobile("tap", {"x": marker_point[0], "y": marker_point[1]})
        source = self.wait_source(
            lambda x: any(
                n.attrib.get("type") == "XCUIElementTypeButton" and self.label_of(n) != title and title in self.label_of(n)
                for n in self.accessible_nodes(x)
            ),
            "selected map event card",
        )
        cards = [
            n for n in self.accessible_nodes(source)
            if n.attrib.get("type") == "XCUIElementTypeButton" and self.label_of(n) != title and title in self.label_of(n)
        ]
        self.record("selected marker produced one event card", len(cards) == 1, f"found {len(cards)}")
        card_label = self.label_of(cards[0])
        self.driver.click(self.driver.wait_one(card_label))
        source = self.wait_source(
            lambda x: self.has_visible(x, title) and not self.has_visible_exact(x, "Show list")
            and self.has_visible_exact(x, "Going") and self.has_visible_exact(x, "Interested"),
            "event details with RSVP controls opened from map card",
        )
        self.record("map card opened event details with RSVP controls", self.has_visible(source, title), title)
        self.capture("map-event-details.png")

    def run_context_menu(self):
        self.restart_to_feed()
        self.settings_demo_preflight()
        source = self.source()
        self.feed_source = source
        (self.root / "feed-page-source.xml").write_text(source, encoding="utf-8")
        card_targets = self.quick_plan_card_targets(source)
        self.record("visible plan label resolves to a measured event-card wrapper", bool(card_targets), f"found {len(card_targets)} candidates")
        card_targets.sort(key=lambda target: (-target["card"][2], target["card"][1], target["title"]))
        target = card_targets[0]
        title = target["title"]
        row_frame = target["card"]
        quick_frame = target["plan"]
        self.record("event-card wrapper is grounded by its observed plan label", True, f"{title}: {row_frame}")
        x, y, width, height = row_frame
        center = (x + width / 2, y + height / 2)
        self.record("long-press center lies inside observed card frame", x <= center[0] <= x + width and y <= center[1] <= y + height, f"center {center}; card {row_frame}")
        qx, qy, qw, qh = quick_frame
        outside_quick_plan = not (qx <= center[0] <= qx + qw and qy <= center[1] <= qy + qh)
        self.record("long-press center lies outside quick-plan sibling", outside_quick_plan, f"center {center}; quick-plan {quick_frame}")
        map_toggles = [n for n in self.accessible_nodes(source) if self.label_of(n) == "Show map"]
        self.record("feed map-toggle frame available before long press", len(map_toggles) == 1, f"found {len(map_toggles)}")
        toggle_frame = self.frame_of(map_toggles[0])
        self.record("feed map-toggle frame is measurable", toggle_frame is not None)
        self.capture("context-menu-before.png")
        self.driver.execute_mobile("touchAndHold", {
            "x": center[0],
            "y": center[1],
            "duration": 1.5,
        })
        source = self.wait_source(
            lambda x: all(self.has_visible_exact(x, label) for label in ("Going", "Interested", "Share", "Directions")),
            "event card context menu actions",
        )
        self.record("card menu exposes Going, Interested, Share, and Directions", True)
        self.capture("context-menu-open.png")
        menu_labels = ("Going", "Interested", "Share", "Directions")
        menu_frames = [
            self.frame_of(node) for node in self.accessible_nodes(source)
            if self.label_of(node) in menu_labels
        ]
        menu_frames = [frame for frame in menu_frames if frame]
        self.record("context-menu action frames available for safe dismissal", len(menu_frames) == len(menu_labels), f"found {len(menu_frames)} of {len(menu_labels)}")
        tx, ty, tw, th = toggle_frame
        tap_point = (tx + tw / 2, ty + th / 2)
        outside_menu = all(not (mx <= tap_point[0] <= mx + mw and my <= tap_point[1] <= my + mh) for mx, my, mw, mh in menu_frames)
        self.record("observed map-toggle point is outside menu action bounds", outside_menu, f"tap point {tap_point}")
        self.driver.execute_mobile("tap", {"x": tap_point[0], "y": tap_point[1]})
        source = self.wait_source(
            lambda x: self.has_visible(x, "Nearby") and not any(self.has_visible_exact(x, label) for label in ("Going", "Interested", "Share", "Directions")),
            "context menu dismissed back to feed",
        )
        self.record("context menu dismissed without choosing an action", self.has_visible(source, "Nearby"))
        self.capture("context-menu-dismissed.png")

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
        source = self.wait_source(
            lambda x: self.has_visible_exact(x, "Are you sure you want to discard this new event?")
            and self.has_visible_exact(x, "Discard Changes"),
            "native unsaved-event discard confirmation",
        )
        self.record("Cancel shows the new-event discard confirmation", self.has_visible_exact(source, "Are you sure you want to discard this new event?"))
        self.capture("calendar-discard-confirmation.png")
        self.click("Discard Changes")
        source = self.wait_source(
            lambda x: self.has_visible(x, "You're going") and not self.has_visible_exact(x, "New Event"),
            "Going sheet after discarding unsaved calendar event",
        )
        self.record("discard closed the calendar editor", not self.has_visible_exact(source, "New Event"))
        self.record("discard returned to the Going sheet", self.has_visible(source, "You're going"))
        self.capture("calendar-editor-cancelled.png")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--udid", required=True)
    parser.add_argument("--app-id", choices=(APP_ID,), default=APP_ID)
    parser.add_argument("--server-url", required=True)
    parser.add_argument("--appearance", choices=("light", "dark"), required=True)
    parser.add_argument("--results-dir", required=True, type=Path)
    parser.add_argument("--flows", nargs="+", choices=("profile", "filters", "calendar", "profile-interests", "map", "context-menu"), default=("profile", "filters", "calendar"))
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
        "flows": args.flows,
    }, indent=2), encoding="utf-8")
    flows = [Flow(driver, args.results_dir, name) for name in args.flows]
    failures = 0
    try:
        driver.create_session()
        for flow in flows:
            try:
                (flow.root / "flow-start.txt").write_text(datetime.now(timezone.utc).isoformat(), encoding="utf-8")
                getattr(flow, f"run_{flow.name.replace('-', '_')}")()
                flow.write_checklist("completed")
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
