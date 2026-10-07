"""Real-browser Paris Pedal QA: python test/paris-browser-smoke.py [URL].

Requires Python Playwright and Chromium. With no URL an isolated local host
is started and stopped. Every gameplay action uses actual keyboard or touch
input; window.firesideSolo.getState() is only read. The route controller reads
the same road actors and warnings a rider can see and steers into open gaps.
Native pause freezes real road positions for perspective camera evidence;
the canvas is exported unchanged, without its separate pause dialog.
Set FIRESIDE_SCREENSHOT_DIR to select the artifact directory.
"""
import json
import base64
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.request import urlopen

from playwright.sync_api import sync_playwright
from browser_profiles import start_solo

ROOT = Path(__file__).resolve().parents[1]
SHOTS = Path(os.environ.get("FIRESIDE_SCREENSHOT_DIR", ROOT / "test-results" / "paris"))
GAME = "paris-pedal"
SURFACE = "window.firesideSolo"
VIEWPORTS = [(1440, 1000), (1366, 768), (390, 900), (320, 900)]


def state(page):
    return page.evaluate(f"{SURFACE}.getState()")


def wait_phase(page, phase, timeout=8000):
    page.wait_for_function(f"phase => {SURFACE}?.getState().phase === phase", arg=phase, timeout=timeout)


def native_button(page, selector):
    button = page.locator(selector)
    assert button.is_visible() and button.is_enabled(), selector
    button.focus()
    page.keyboard.press("Space", delay=20)


def restart(page):
    native_button(page, "#solo-restart")
    wait_phase(page, "playing")
    page.locator(".paris-canvas").focus()


def record(page, scope):
    return page.evaluate("scope => JSON.parse(localStorage.getItem(`fireside-solo-best:paris-pedal:${scope}`))", scope)


def duration_text(milliseconds):
    minutes, remainder = divmod(milliseconds, 60000)
    seconds, remainder = divmod(remainder, 1000)
    return f"{minutes}:{seconds:02d}.{remainder // 10:02d}"


def room_ids(url):
    with urlopen(url + "/api/rooms", timeout=5) as response:
        return sorted(room["id"] for room in json.load(response)["rooms"])


class Keyboard:
    """Keep physical keys held without generating fresh down events each frame."""
    def __init__(self, page):
        self.page, self.held = page, set()

    def set(self, desired):
        desired = set(desired)
        for key in sorted(self.held - desired):
            self.page.keyboard.up(key)
        for key in sorted(desired - self.held):
            self.page.keyboard.down(key)
        self.held = desired

    def release(self):
        self.set(set())


def catalog(page):
    assert page.locator("[data-create-game]").count() == 9
    assert page.locator("[data-play-solo]").count() == 10
    assert page.locator("[data-create-game]:visible").count() + page.locator("[data-play-solo]:visible").count() == 19
    for category, multiplayer, solo in [("driving", 0, 3), ("solo", 0, 10), ("friends", 9, 0)]:
        page.locator(f'[data-filter="{category}"]').click()
        assert page.locator("[data-create-game]:visible").count() == multiplayer
        assert page.locator("[data-play-solo]:visible").count() == solo
        if category in ("driving", "solo"):
            assert page.locator(f'[data-play-solo="{GAME}"]:visible').count() == 1
    page.locator('[data-filter="all"]').click()
    page.locator(f'[data-play-solo="{GAME}"]').click()
    start_solo(page, GAME)
    assert "room=" not in page.url


def layout_checks(page, mode):
    assert state(page)["phase"] == "paused" and state(page)["mode"] == mode
    for width, height in VIEWPORTS:
        page.set_viewport_size({"width": width, "height": height})
        page.wait_for_timeout(100)
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), (width, "horizontal overflow")
        if width >= 951:
            page.wait_for_function("height => document.querySelector('.paris-canvas').getBoundingClientRect().bottom <= height", arg=height)
            box = page.locator(".paris-canvas").bounding_box()
            assert box and box["width"] >= 300, (width, "road too small to read", box)
        else:
            assert page.locator(".paris-mobile-hud").is_visible(), "Perspective mobile street lost its instruments"
            assert page.locator(".paris-mobile-hud > div").count() == 4
            canvas = page.locator(".paris-canvas").bounding_box()
            board = page.locator(".paris-board").bounding_box()
            assert canvas and board and canvas["x"] >= board["x"] and canvas["x"] + canvas["width"] <= board["x"] + board["width"], (width, "mobile camera cropped the road", canvas, board)
        for button in page.locator(".paris-controls button").all():
            box = button.bounding_box()
            assert box and box["width"] >= 44 and box["height"] >= 44, (width, "small touch control", box)
        page.screenshot(path=str(SHOTS / f"paris-{mode}-layout-{width}.png"), full_page=True, animations="disabled")
    page.set_viewport_size({"width": 1440, "height": 1000})


def native_selection_and_layout(page):
    initial = state(page)
    assert initial["difficulty"] == "veteran" and initial["mode"] == "survival", initial
    assert initial["timeLeft"] is None, "Survival launched a delivery clock"
    assert page.locator('.paris-modes [data-mode="rush"]').count() == 0
    assert page.locator('.paris-modes [data-mode="survival"]').count() == 1
    native_button(page, "#solo-pause")
    wait_phase(page, "paused")
    paused = state(page)
    page.wait_for_timeout(250)
    assert state(page) == paused, "Paused ride advanced"
    # Help is a native disclosure. Space/Enter must never reach the rider.
    page.locator("#solo-how-to summary").focus()
    page.keyboard.press("Space", delay=20)
    assert page.locator("#solo-how-to").evaluate("element => element.open")
    assert state(page) == paused, "Help key leaked into gameplay"
    page.keyboard.press("Enter", delay=20)
    layout_checks(page, "survival")
    native_button(page, "#solo-pause")
    for difficulty in ["nightmare", "standard", "veteran"]:
        native_button(page, f'.paris-difficulties [data-difficulty="{difficulty}"]')
        current = state(page)
        assert current["difficulty"] == difficulty and current["mode"] == "survival"
        assert page.locator(f'.paris-difficulties [data-difficulty="{difficulty}"]').evaluate("element => element === document.activeElement"), "Native tier selection lost keyboard focus"
        assert current["distance"] < 2, "Selecting difficulty retained earlier route progress"
        assert not current["assistActive"], "Native difficulty Space leaked into electric assist"
        if difficulty == "standard":
            assert record(page, "standard-survival-v1") == 1200, "Standard duration disappeared from its own tier"
            assert page.locator("#solo-record").inner_text() == "0:01.20"
        elif difficulty == "nightmare":
            assert record(page, "nightmare-survival-v1") == 2500
            assert page.locator("#solo-record").inner_text() == "0:02.50"
        restart(page)
        assert state(page)["difficulty"] == difficulty
    native_button(page, '.paris-modes [data-mode="delivery"]')
    assert state(page)["mode"] == "delivery" and not state(page)["assistActive"]
    restart(page)
    assert record(page, "veteran-delivery") is None, "Unfinished ride saved a delivery score"
    native_button(page, "#solo-pause")
    layout_checks(page, "delivery")
    native_button(page, "#solo-pause")
    page.locator("#solo-how-to summary").focus()
    page.keyboard.press("Space", delay=40)
    page.wait_for_timeout(60)
    assert not state(page)["assistActive"], "Live help key leaked into motor assist"
    page.keyboard.press("Enter", delay=20)
    print("  Survival default, native selection/restart/help, both-mode desktop/laptop/390/320px layouts and 44px controls passed", flush=True)


def touch_input(page, context, control, duration=500, cancel=True):
    button = page.locator(f'.paris-controls [data-control="{control}"]')
    button.scroll_into_view_if_needed()
    box = button.bounding_box()
    touch = {"x": box["x"] + box["width"] / 2, "y": box["y"] + box["height"] / 2}
    session = context.new_cdp_session(page)
    try:
        before = state(page)
        session.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [touch]})
        page.wait_for_timeout(duration)
        held = state(page)
        assert button.get_attribute("aria-pressed") == "true", "Touch input never became held"
        session.send("Input.dispatchTouchEvent", {"type": "touchCancel" if cancel else "touchEnd", "touchPoints": []})
        page.wait_for_timeout(300)
        assert button.get_attribute("aria-pressed") == "false", "Touch input survived release/cancel"
        return before, held, state(page)
    finally:
        session.detach()


def physical_controls(page, context):
    native_button(page, '.paris-modes [data-mode="delivery"]')
    keyboard = Keyboard(page)
    restart(page)
    before = state(page)
    keyboard.set({"ArrowUp"})
    page.wait_for_timeout(650)
    accelerated = state(page)
    assert accelerated["speed"] > before["speed"] + 1, "Throttle did not accelerate"
    keyboard.set({"ArrowUp", "ArrowLeft"})
    page.wait_for_timeout(230)
    left = state(page)
    assert left["x"] < accelerated["x"] - .1, "Steering did not move the rider"
    keyboard.set({"ArrowDown"})
    page.wait_for_timeout(450)
    assert state(page)["speed"] < left["speed"], "Braking did not slow the rider"
    keyboard.set({"ArrowUp", "Space"})
    page.wait_for_timeout(600)
    assisting = state(page)
    assert assisting["assistActive"] and assisting["battery"] < before["battery"], "Assist did not consume charge"
    keyboard.release()
    page.keyboard.press("b", delay=40)
    assert state(page)["bellCooldown"] > 0, "Bell key did not ring"
    # A pause must clear physical held input even if the key is still down.
    keyboard.set({"ArrowUp", "ArrowLeft", "Space"})
    page.wait_for_timeout(100)
    native_button(page, "#solo-pause")
    paused = state(page)
    page.wait_for_timeout(300)
    assert state(page) == paused
    native_button(page, "#solo-pause")
    page.wait_for_timeout(300)
    resumed = state(page)
    assert not resumed["assistActive"], "Paused assist remained stuck"
    assert abs(resumed["x"] - paused["x"]) < .3, "Paused steering remained stuck"
    page.locator(".paris-canvas").focus()
    repeat_start = state(page)
    # Playwright produces the browser's actual repeat event for a key that
    # remains physically down. It must not rearm input cleared by the pause.
    page.keyboard.down("ArrowLeft")
    page.wait_for_timeout(200)
    assert abs(state(page)["x"] - repeat_start["x"]) < .2, "Repeated key rearmed cleared steering"
    keyboard.release()
    # Focused action buttons support their own action with keyboard holds.
    for key in ("Space", "Enter"):
        restart(page)
        button = page.locator('.paris-controls [data-control="assist"]')
        button.focus()
        page.keyboard.down(key)
        page.wait_for_timeout(250)
        assert button.get_attribute("aria-pressed") == "true" and state(page)["assistActive"]
        page.keyboard.up(key)
        assert button.get_attribute("aria-pressed") == "false"
    for cancel in (True, False):
        restart(page)
        before, held, released = touch_input(page, context, "assist", cancel=cancel)
        assert held["assistActive"] and held["battery"] < before["battery"]
        assert not released["assistActive"], "Released/cancelled touch assist stayed active"
    restart(page)
    keyboard.set({"ArrowUp", "ArrowLeft", "Space"})
    other = context.new_page()
    session = context.new_cdp_session(page)
    try:
        other.goto("about:blank")
        other.bring_to_front()
        session.send("Emulation.setFocusEmulationEnabled", {"enabled": True})
        session.send("Emulation.setFocusEmulationEnabled", {"enabled": False})
        wait_phase(page, "paused")
        blurred = state(page)
        page.wait_for_timeout(300)
        assert state(page) == blurred, "Blurred game advanced"
        page.bring_to_front()
        assert state(page)["phase"] == "paused"
        native_button(page, "#solo-pause")
        page.wait_for_timeout(250)
        assert not state(page)["assistActive"], "Blur left assist held"
        keyboard.release()
    finally:
        session.detach()
        other.close()
        page.bring_to_front()
    restart(page)
    print("  Real throttle/steer/brake/assist/bell, focused holds, touch release/cancel, pause and tab blur passed", flush=True)


def survival_checks(page, context):
    native_button(page, '.paris-modes [data-mode="survival"]')
    restart(page)
    keyboard = Keyboard(page)
    initial = state(page)
    assert initial["mode"] == "survival" and initial["difficulty"] == "veteran"
    assert initial["timeLeft"] is None
    assert record(page, "veteran-survival-v1") is None
    samples = [initial]
    # No throttle: the street itself forces motion and a steadily rising pace.
    for _ in range(5):
        page.wait_for_timeout(220)
        samples.append(state(page))
    assert samples[-1]["distance"] > initial["distance"] + 7, "Survival stalled without a pedal input"
    assert all(b["survivalPace"] > a["survivalPace"] for a, b in zip(samples, samples[1:])), "Forced pace did not rise with active time"
    assert all(s["score"] == int(s["elapsed"] * 1000) for s in samples), "Primary Survival score is not active milliseconds"
    assert record(page, "veteran-survival-v1") is None, "An unfinished Survival set a longest-time record"
    before_brake = state(page)
    keyboard.set({"ArrowDown"})
    page.wait_for_timeout(1800)
    braking = state(page)
    keyboard.release()
    assert braking["phase"] == "playing" and braking["health"] == 3
    assert braking["survivalPace"] > before_brake["survivalPace"]
    assert braking["speed"] >= braking["survivalPace"] * .75 and braking["distance"] > before_brake["distance"] + 10, "Holding brake stopped or indefinitely slowed Survival"
    assert not braking["brakeActive"], "A long held brake stayed continuously effective"
    page.screenshot(path=str(SHOTS / "paris-survival-gameplay.png"), full_page=True)
    native_button(page, "#solo-pause")
    wait_phase(page, "paused")
    paused = state(page)
    best = record(page, "veteran-survival-v1")
    page.wait_for_timeout(500)
    assert state(page) == paused, "Paused elapsed time, forced pace or resources advanced"
    assert record(page, "veteran-survival-v1") == best
    native_button(page, "#solo-pause")
    page.locator(".paris-canvas").focus()
    page.keyboard.press("b", delay=40)
    assert state(page)["bellCooldown"] > 0
    # Survival shares accessible steering controls and cancellation behavior.
    for key in ("Space", "Enter"):
        restart(page)
        button = page.locator('.paris-controls [data-control="left"]')
        button.focus()
        x = state(page)["x"]
        page.keyboard.down(key)
        page.wait_for_timeout(180)
        assert button.get_attribute("aria-pressed") == "true" and state(page)["x"] < x - .1
        page.keyboard.up(key)
        assert button.get_attribute("aria-pressed") == "false"
    restart(page)
    before, held, released = touch_input(page, context, "left", duration=220, cancel=True)
    assert held["x"] < before["x"] - .1
    assert abs(released["vx"]) < .3, "Cancelled Survival touch steering stayed held"
    restart(page)
    keyboard.release()
    crashes, crash_times = 0, []
    end = time.monotonic() + 65
    while time.monotonic() < end:
        # State and record share one browser task so a terminal animation frame
        # cannot occur between a playing snapshot and its storage assertion.
        snapshot = page.evaluate("({state:window.firesideSolo.getState(), record:JSON.parse(localStorage.getItem('fireside-solo-best:paris-pedal:veteran-survival-v1'))})")
        current = snapshot["state"]
        if current["phase"] != "playing":
            break
        if current["totalCrashes"] > crashes:
            crashes = current["totalCrashes"]
            crash_times.append(current["elapsed"])
        assert snapshot["record"] is None, "A nonterminal collision stored a Survival record"
        # Deliberately steer into an actual visible traffic body. No damage,
        # time or terminal result is injected into the game.
        hazards = [a for a in current["traffic"] if not a["passed"] and a["z"] + a["length"] / 2 + 1 > current["distance"]]
        target = min(hazards, key=lambda a: a["z"] - a["length"] / 2)["x"] if hazards else 0
        error = target - current["x"] - current["vx"] * .08
        keyboard.set({"ArrowLeft"} if error < -.08 else {"ArrowRight"} if error > .08 else set())
        page.wait_for_timeout(60)
    keyboard.release()
    terminal = state(page)
    assert terminal["phase"] == "lost" and terminal["result"] == "crashed", terminal
    assert terminal["totalCrashes"] == 3 and terminal["health"] == 0
    assert terminal["finishTime"] == terminal["elapsed"] and terminal["timeLeft"] is None
    assert terminal["score"] == int(terminal["elapsed"] * 1000)
    best = record(page, "veteran-survival-v1")
    assert best == terminal["score"] and best > 1000, "Third impact did not store the active-time score"
    assert page.locator("#solo-record").inner_text() == duration_text(best)
    assert record(page, "standard-survival-v1") == 1200 and record(page, "nightmare-survival-v1") == 2500
    assert record(page, "standard-delivery") == 999999 and record(page, "veteran-rush") == 888888
    page.wait_for_timeout(300)
    assert state(page) == terminal, "Terminal Survival kept accumulating time"
    (SHOTS / "survival-result.json").write_text(json.dumps({"samples": samples, "held_brake": braking, "crash_times": crash_times, "terminal": terminal, "best_ms": best}, indent=2))
    page.screenshot(path=str(SHOTS / "paris-survival-terminal.png"), full_page=True)
    restart(page)
    assert state(page)["mode"] == "survival" and record(page, "veteran-survival-v1") == best
    native_button(page, "#solo-pause")
    page.reload()
    start_solo(page, GAME)
    assert state(page)["difficulty"] == "veteran" and state(page)["mode"] == "survival"
    assert record(page, "veteran-survival-v1") == best
    assert page.locator("#solo-record").inner_text() == duration_text(best)
    print(f"  Survival: automatic rising pace, finite brake, pause/native controls, three legal impacts at {terminal['elapsed']:.2f}s, completed-only persistent duration and tier/legacy isolation passed", flush=True)
    return best


def capture_road(page, keyboard, name, all_sizes=False):
    """Export actual rendered frames at frozen, physically reached positions."""
    keyboard.release()
    native_button(page, "#solo-pause")
    wait_phase(page, "paused")
    frozen = state(page)
    sizes = VIEWPORTS if all_sizes else [(1440, 1000)]
    for width, height in sizes:
        page.set_viewport_size({"width": width, "height": height})
        page.wait_for_timeout(100)
        # The dialog is a DOM sibling, so reading canvas pixels captures the
        # game frame exactly as drawn without removing UI or modifying state.
        encoded = page.locator(".paris-canvas").evaluate("canvas => canvas.toDataURL('image/png')")
        (SHOTS / f"{name}-{width}.png").write_bytes(base64.b64decode(encoded.split(",", 1)[1]))
        assert state(page) == frozen, "Camera layout change advanced the paused route"
    (SHOTS / f"{name}-state.json").write_text(json.dumps(frozen, indent=2))
    page.set_viewport_size({"width": 1440, "height": 1000})
    native_button(page, "#solo-pause")
    wait_phase(page, "playing")
    page.locator(".paris-canvas").focus()


def ride_delivery(page, survival_best):
    """Read visible actors, choose a broad corridor, then press actual keys."""
    native_button(page, '.paris-modes [data-mode="delivery"]')
    restart(page)
    keyboard = Keyboard(page)
    types, warnings, events, checkpoints = set(), set(), set(), []
    captured = False
    captured_scenes = set()
    selected_row, selected_target = None, None
    end = time.monotonic() + 280
    # The road is ten metres wide; leave room for the rider and kerb. These
    # are geometric visibility margins rather than imported engine rules.
    road_left, road_right, rider_margin = -4.05, 4.05, .45
    while time.monotonic() < end:
        current = state(page)
        if current["phase"] != "playing":
            break
        actors = [actor for actor in current["traffic"] if not actor["passed"] and actor["z"] + actor["length"] / 2 + 1 > current["distance"]]
        types.update(actor["kind"] for actor in actors)
        warnings.update(actor["kind"] for actor in actors if actor["warningActive"])
        events.update(event["type"] for event in current["events"])
        target = current["x"]
        if actors:
            nearest = min(actors, key=lambda actor: actor["z"] - actor["length"] / 2)
            # Keep the queue's full remembered geometry until its longest
            # vehicle clears; individual parked cars can pass earlier.
            row = [actor for actor in current["traffic"] if actor["row"] == nearest["row"]]
            blocked = []
            for actor in row:
                left, right = actor["x"] - actor["width"] / 2, actor["x"] + actor["width"] / 2
                if actor["warningActive"] or actor["maneuverStarted"]:
                    left = min(left, actor["targetX"] - actor["targetWidth"] / 2)
                    right = max(right, actor["targetX"] + actor["targetWidth"] / 2)
                blocked.append((left - rider_margin, right + rider_margin))
            gaps, cursor = [], road_left
            for left, right in sorted(blocked):
                if left > cursor:
                    gaps.append((cursor, min(left, road_right)))
                cursor = max(cursor, right)
            if cursor < road_right:
                gaps.append((cursor, road_right))
            gaps = [(left, right) for left, right in gaps if right > left]
            assert gaps, "Visible row has no bike corridor"
            # Once a parked door has passed, a wider edge opening can appear
            # while cars in the same queue are still beside the rider. Keep
            # the closest usable corridor rather than cutting across them.
            if nearest["row"] == selected_row and any(left < selected_target < right for left, right in gaps):
                target = selected_target
            else:
                usable = [gap for gap in gaps if gap[1] - gap[0] >= .55] or gaps
                left, right = min(usable, key=lambda gap: abs((gap[0] + gap[1]) / 2 - current["x"]))
                target = (left + right) / 2
                selected_row, selected_target = nearest["row"], target
        error = target - (current["x"] + current["vx"] * .08)
        keys = {"ArrowUp"}
        if error < -.055:
            keys.add("ArrowLeft")
        elif error > .055:
            keys.add("ArrowRight")
        # Save some charge for later districts. Assist only after lining up
        # with the gap, avoiding a last-second lunge towards a bus.
        reserve = .05 if current["stageIndex"] >= 4 else .23
        if current["battery"] > reserve and abs(error) < .2:
            keys.add("Space")
        cyclists = [actor for actor in actors if actor["kind"] == "cyclist" and 2 < actor["z"] - current["distance"] < 26]
        if cyclists and current["bellCooldown"] == 0:
            keys.add("b")
        keyboard.set(keys)
        if current["deliveries"] > len(checkpoints):
            checkpoints.append({"delivery": current["deliveries"], "elapsed": current["elapsed"], "health": current["health"], "timeLeft": current["districtResults"][-1]["timeLeft"]})
            assert record(page, "veteran-delivery") is None, "A partial delivery route stored a qualifying record"
            print(f"  Veteran delivery {current['deliveries']}/5: {current['elapsed']:.2f}s, health {current['health']}", flush=True)
        if not captured and {"car", "cyclist", "bus"}.issubset(types) and current["distance"] > 200:
            page.screenshot(path=str(SHOTS / "paris-gameplay.png"), full_page=True)
            captured = True
        # These frames support visual review of depth, scaled actor types,
        # ground warning footprints and body occlusion near the rider. They
        # are reached by the same legal route inputs used for the finish.
        nearby = [actor for actor in actors if 5 < actor["z"] - current["distance"] < 17]
        if abs(error) < .15 and abs(current["vx"]) < .4:
            for kind in ("bus", "cyclist", "door"):
                candidates = [actor for actor in nearby if actor["kind"] == kind]
                if kind not in captured_scenes and candidates:
                    capture_road(page, keyboard, f"paris-near-{kind}", all_sizes=kind == "bus")
                    captured_scenes.add(kind)
                    break
            else:
                late_bus = [actor for actor in actors if actor["kind"] == "bus" and -1 < actor["z"] - current["distance"] < .8]
                if "bus-beside-rider" not in captured_scenes and late_bus:
                    capture_road(page, keyboard, "paris-bus-beside-rider", all_sizes=True)
                    captured_scenes.add("bus-beside-rider")
        page.wait_for_timeout(55)
    keyboard.release()
    finished = state(page)
    events.update(event["type"] for event in finished["events"])
    (SHOTS / "delivery-result.json").write_text(json.dumps({"result": finished, "types_seen": sorted(types), "warnings_seen": sorted(warnings), "events_seen": sorted(events), "perspective_scenes": sorted(captured_scenes), "checkpoints": checkpoints}, indent=2))
    assert finished["phase"] == "won", f"Physical Veteran route did not finish: {finished}"
    assert finished["deliveries"] == 5 and len(finished["districtResults"]) == 5
    assert {"car", "cyclist", "bus"}.issubset(types), types
    assert {"cyclist", "bus", "door"}.issubset(warnings), warnings
    assert {"bus", "cyclist", "door", "bus-beside-rider"}.issubset(captured_scenes), "Missing near-actor perspective evidence"
    assert "pass" in events and "near-pass" in events and finished["passPoints"] > 0
    assert finished["finishTime"] > 100 and finished["score"] > finished["distance"]
    assert record(page, "veteran-delivery") == finished["score"]
    assert record(page, "standard-delivery") == 999999 and record(page, "veteran-rush") == 888888
    assert record(page, "veteran-survival-v1") == survival_best, "Delivery points replaced Survival time"
    page.wait_for_timeout(350)
    assert state(page) == finished, "Finished route continued simulating"
    page.screenshot(path=str(SHOTS / "paris-delivery-complete.png"), full_page=True)
    best = finished["score"]
    restart(page)
    assert record(page, "veteran-delivery") == best
    assert record(page, "veteran-survival-v1") == survival_best
    native_button(page, '.paris-difficulties [data-difficulty="nightmare"]')
    assert record(page, "nightmare-delivery") is None and "999999" not in page.locator("#solo-record").inner_text()
    native_button(page, '.paris-difficulties [data-difficulty="veteran"]')
    # Without throttle or steering the default route must fail. Even if the
    # first row happens to be clear, the delivery clock prevents idle wins.
    page.locator(".paris-canvas").focus()
    end = time.monotonic() + 55
    while time.monotonic() < end and state(page)["phase"] == "playing":
        page.wait_for_timeout(250)
    failed = state(page)
    assert failed["phase"] == "lost" and failed["deliveries"] == 0, failed
    assert record(page, "veteran-delivery") == best, "Failed route replaced qualifying delivery score"
    page.screenshot(path=str(SHOTS / "paris-idle-failure.png"), full_page=True)
    page.reload()
    start_solo(page, GAME)
    assert state(page)["difficulty"] == "veteran" and state(page)["mode"] == "survival"
    assert record(page, "veteran-delivery") == best
    print(f"  Full five-district Veteran route won in {finished['finishTime']:.2f}s; visible traffic/warnings, scoring, qualifying-only records and idle failure passed", flush=True)


def run(url):
    SHOTS.mkdir(parents=True, exist_ok=True)
    errors, resources, mutations, sockets = [], [], [], []
    before_rooms = room_ids(url)
    with sync_playwright() as playwright:
        options = {"headless": True, "args": ["--no-sandbox"]}
        if Path("/usr/bin/chromium").exists():
            options["executable_path"] = "/usr/bin/chromium"
        browser = playwright.chromium.launch(**options)
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        # Seed only historical points and other-tier durations, never gameplay.
        context.add_init_script("for (const [scope,value] of [['standard-delivery',999999],['veteran-rush',888888],['veteran-survival',777777],['standard-survival-v1',1200],['nightmare-survival-v1',2500]]) { const key=`fireside-solo-best:paris-pedal:${scope}`; if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(value)); }")
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.on("response", lambda response: resources.append(f"{response.status} {response.url}") if response.status >= 400 else None)
        page.on("request", lambda request: mutations.append(f"{request.method} {request.url}") if "/api/rooms" in request.url and request.method != "GET" else None)
        page.on("websocket", lambda socket: sockets.append(socket.url))
        try:
            page.goto(url + "/")
            catalog(page)
            assert page.locator("#solo-record").inner_text() == "—", "Legacy points leaked into the new duration best"
            native_selection_and_layout(page)
            physical_controls(page, context)
            survival_best = survival_checks(page, context)
            ride_delivery(page, survival_best)
            assert room_ids(url) == before_rooms, "Solo game changed multiplayer rooms"
            assert not errors, errors
            assert not resources, resources
            assert not mutations, mutations
            assert not sockets, sockets
            print("PASS Paris Pedal: real Survival pacing/three-impact time record and full Veteran delivery, native controls, records, idle failure, desktop/mobile layouts and solo network isolation", flush=True)
            print(json.dumps({"game": GAME, "errors": errors, "failed_resources": resources, "room_mutations": mutations, "websockets": sockets, "screenshots": str(SHOTS)}), flush=True)
        finally:
            context.close()
            browser.close()


def main():
    if len(sys.argv) > 1:
        run(sys.argv[1].rstrip("/"))
        return
    source = "import { createServer } from './server.js'; const host = createServer(); const address = await host.listen(0, '127.0.0.1'); console.log(JSON.stringify({port: address.port})); process.on('SIGTERM', async () => { await host.close(); process.exit(0); });"
    host = subprocess.Popen(["node", "--input-type=module", "--eval", source], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        line = host.stdout.readline()
        if not line:
            raise RuntimeError(host.stderr.read())
        run(f"http://127.0.0.1:{json.loads(line)['port']}")
    finally:
        host.terminate()
        try:
            host.wait(timeout=5)
        except subprocess.TimeoutExpired:
            host.kill()
            host.wait(timeout=5)


if __name__ == "__main__":
    main()
