"""Optional real-browser Night Drive QA: python test/driving-browser-smoke.py [URL].

Requires Python Playwright and Chromium. Without a URL, starts and stops an
isolated local server. Drives through actual keyboard and touch controls;
window.firesideSolo.getState() is read-only, never modified.
Set FIRESIDE_SCREENSHOT_DIR to select preview output.
"""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.request import urlopen

from playwright.sync_api import sync_playwright
from browser_controls import controls_panel
from browser_profiles import standard_profile, start_solo


ROOT = Path(__file__).resolve().parents[1]
SCREENSHOTS = Path(os.environ.get("FIRESIDE_SCREENSHOT_DIR", ROOT / "test-results" / "driving"))
SURFACE = "window.firesideSolo"
errors, console_errors, failed_resources, room_mutations, sockets = [], [], [], [], []


def watch(page, name):
    page.on("pageerror", lambda error: errors.append(f"{name}: {error}"))
    page.on("console", lambda message: console_errors.append(f"{name}: {message.text}") if message.type == "error" else None)
    page.on("response", lambda response: failed_resources.append(f"{name}: {response.status} {response.url}") if response.status >= 400 else None)
    page.on("request", lambda request: room_mutations.append(f"{name}: {request.method} {request.url}") if "/api/rooms" in request.url and request.method != "GET" else None)
    page.on("websocket", lambda socket: sockets.append(f"{name}: {socket.url}"))


def state(page):
    return page.evaluate(f"{SURFACE}.getState()")


def uncleared_traffic(current):
    """Keep the whole traffic body until its rear clears the player's rear."""
    player_length = current["car"]["length"]
    return [car for car in current["traffic"] if not car["passed"] and
            car["z"] > -(player_length + car["length"]) / 2]


def wait_phase(page, phase, timeout=8000):
    page.wait_for_function(f"phase => {SURFACE}?.getState().phase === phase", arg=phase, timeout=timeout)


def screenshot(page, filename):
    page.screenshot(path=str(SCREENSHOTS / filename), full_page=True)


def assert_no_overflow(page):
    dimensions = page.evaluate("({viewport:innerWidth, document:document.documentElement.scrollWidth})")
    assert dimensions["document"] <= dimensions["viewport"], dimensions


def room_ids(url):
    with urlopen(url + "/api/rooms", timeout=5) as response:
        return sorted(room["id"] for room in json.load(response)["rooms"])


def stored_record(page, game):
    return page.evaluate("game => JSON.parse(localStorage.getItem(`fireside-solo-best:${game}:default`))", game)


def check_catalog(page):
    assert page.locator("[data-create-game]").count() == 13
    assert page.locator("[data-play-solo]").count() == 12
    assert page.locator("[data-create-game]:visible").count() == 13
    assert page.locator("[data-play-solo]:visible").count() == 12
    page.locator('[data-filter="driving"]').click()
    assert page.locator("[data-create-game]:visible").count() == 0
    assert page.locator("[data-play-solo]:visible").count() == 2
    assert page.locator('[data-play-solo="paris-pedal"]:visible').count() == 1
    assert page.locator('[data-play-solo="night-drive"]:visible').count() == 1
    page.locator('[data-filter="solo"]').click()
    assert page.locator("[data-create-game]:visible").count() == 0
    assert page.locator("[data-play-solo]:visible").count() == 12
    page.locator('[data-filter="friends"]').click()
    assert page.locator("[data-create-game]:visible").count() == 13
    assert page.locator("[data-play-solo]:visible").count() == 0
    page.locator('[data-filter="all"]').click()


def mobile_previews(page, game):
    for width in (390, 320):
        page.set_viewport_size({"width": width, "height": 844})
        page.wait_for_timeout(80)
        assert_no_overflow(page)
        screenshot(page, f"fireside-{game}-mobile-{width}.png")
    page.set_viewport_size({"width": 1440, "height": 1100})


class Keyboard:
    """Avoid repeated keydown events while retaining true held-key input."""
    def __init__(self, page):
        self.page = page
        self.held = set()

    def set(self, desired):
        desired = set(desired)
        for key in sorted(self.held - desired):
            self.page.keyboard.up(key)
        for key in sorted(desired - self.held):
            self.page.keyboard.down(key)
        self.held = desired

    def release(self):
        self.set(set())


def pause_checks(page, keyboard):
    page.locator("#solo-pause").click()
    wait_phase(page, "paused")
    before = state(page)
    keyboard.set({"ArrowUp", "ArrowLeft", "Space"})
    page.wait_for_timeout(1000)
    assert state(page) == before, "Paused driving game accepted inputs or advanced its clock"
    page.locator("#solo-pause").click()
    wait_phase(page, "playing")
    # The physical keys remain held, but pausing must have cleared gameplay
    # input. The caller checks actual coasting/steering before releasing them.


def blur_checks(page, context, keyboard):
    keyboard.set({"ArrowUp", "ArrowLeft"})
    other = context.new_page()
    session = context.new_cdp_session(page)
    try:
        other.goto("about:blank")
        other.bring_to_front()
        # Headless Chromium otherwise leaves every page visible. Removing its
        # emulated focus generates the browser's native blur notification.
        session.send("Emulation.setFocusEmulationEnabled", {"enabled": True})
        session.send("Emulation.setFocusEmulationEnabled", {"enabled": False})
        wait_phase(page, "paused")
        before = state(page)
        page.wait_for_timeout(1200)
        assert state(page) == before, "Hidden driving game continued simulating"
        page.bring_to_front()
        assert state(page)["phase"] == "paused", "Returning to the tab resumed without player input"
        page.locator("#solo-pause").click()
        wait_phase(page, "playing")
        keyboard.release()
    finally:
        session.detach()
        other.close()


def touch_hold_cancel(page, context, selector, assertion, cancel=True):
    target = page.locator(selector)
    target.scroll_into_view_if_needed()
    box = target.bounding_box()
    assert box, f"Missing touch target {selector}"
    touch = {"x": box["x"] + box["width"] / 2, "y": box["y"] + box["height"] / 2}
    session = context.new_cdp_session(page)
    try:
        before = state(page)
        session.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [touch]})
        page.wait_for_timeout(650)
        held = state(page)
        assertion(before, held)
        session.send("Input.dispatchTouchEvent", {"type": "touchCancel" if cancel else "touchEnd", "touchPoints": []})
        page.wait_for_timeout(650)
        return held, state(page)
    finally:
        session.detach()


def focused_hold_controls(page, selector):
    """Accessible control buttons use their own action with Space and Enter."""
    for key in ("Space", "Enter"):
        page.locator("#solo-restart").click()
        button = page.locator(selector)
        button.focus()
        before = state(page)
        page.keyboard.down(key)
        assert button.get_attribute("aria-pressed") == "true", f"Focused {key} did not hold its button"
        page.wait_for_timeout(400)
        held = state(page)
        assert held["boosting"] and held["boost"] < before["boost"] - .07
        page.keyboard.up(key)
        assert button.get_attribute("aria-pressed") == "false", f"Focused {key} remained held after release"
    page.locator("#solo-restart").click()


def persistent_record(page, context, game, best):
    page.reload()
    start_solo(page, game)
    standard_profile(page, game)
    assert stored_record(page, game) == best
    fresh = context.new_page()
    watch(fresh, f"{game}/fresh-page")
    try:
        fresh.goto(page.url)
        start_solo(fresh, game)
        standard_profile(fresh, game)
        assert stored_record(fresh, game) == best, "Record was lost in a fresh same-origin page"
    finally:
        fresh.close()
        page.bring_to_front()


def browser_back(page, url, game):
    if state(page)["phase"] == "playing":
        page.locator("#solo-pause").click()
    before = state(page)
    page.locator(".solo-back").click()
    page.wait_for_url(url + "/")
    page.go_back(wait_until="commit")
    page.wait_for_function(f"game => {SURFACE}?.gameId === game", arg=game)
    cached = page.evaluate("window.__qaPageShowPersisted === true")
    if cached:
        assert state(page) == before, "Back/forward cache changed the paused driving session"
        assert page.locator("#solo-pause span").inner_text() == "Resume"
        page.locator("#solo-pause").click()
        wait_phase(page, "playing")
    else:
        start_solo(page, game)
        standard_profile(page, game)
        wait_phase(page, "playing")
    page.locator("#solo-restart").click()
    assert state(page)["phase"] == "playing", "Controls failed after browser Back"
    print(f"  {game}: hub backlink → browser Back, cached restore={cached}, active controls", flush=True)


def night_drive(page, context):
    canvas = page.locator(".highway-canvas")
    keyboard = Keyboard(page)
    canvas.focus()
    before = state(page)
    page.wait_for_timeout(750)
    cruising = state(page)
    assert cruising["distance"] > before["distance"] + 15 and cruising["speed"] > before["speed"], "Auto-cruise did not advance"
    keyboard.set({"ArrowLeft"})
    page.wait_for_timeout(220)
    keyboard.release()
    page.wait_for_timeout(180)
    left = state(page)
    assert left["x"] < -.2, "Held steering did not move the car"
    keyboard.set({"ArrowDown"})
    page.wait_for_timeout(600)
    braking = state(page)
    assert braking["speed"] < left["speed"] - 25, "Brake did not slow auto-cruise"
    keyboard.set({"ArrowUp", "Space"})
    page.wait_for_timeout(800)
    boosting = state(page)
    assert boosting["boosting"] and boosting["boost"] < braking["boost"] - .12
    assert boosting["speed"] > braking["speed"] + 40, "Boost did not accelerate"
    keyboard.release()
    page.wait_for_timeout(650)
    recharged = state(page)
    assert not recharged["boosting"] and recharged["boost"] > boosting["boost"], "Released boost did not recharge"

    pause_checks(page, keyboard)
    before_resume = state(page)
    page.wait_for_timeout(500)
    resumed = state(page)
    assert not resumed["boosting"] and resumed["boost"] >= before_resume["boost"], "Pause left boost held on resume"
    assert abs(resumed["x"] - before_resume["x"]) < .15, "Pause left steering held on resume"
    keyboard.release()
    blur_checks(page, context, keyboard)
    page.locator("#solo-restart").click()

    def touch_boosted(before, held):
        assert held["boosting"] and held["boost"] < before["boost"] - .1, "Touch boost did not engage"

    held, released = touch_hold_cancel(page, context, '.highway-control[data-control="boost"]', touch_boosted)
    assert not released["boosting"] and released["boost"] > held["boost"], "Cancelled touch boost stayed engaged"
    page.locator("#solo-restart").click()
    held, released = touch_hold_cancel(page, context, '.highway-control[data-control="boost"]', touch_boosted, cancel=False)
    assert not released["boosting"] and released["boost"] > held["boost"], "Released touch boost stayed engaged"
    focused_hold_controls(page, '.highway-control[data-control="boost"]')
    page.locator("#solo-restart").click()
    canvas.focus()

    def steer_toward(current, x, base):
        keys = set(base)
        predicted = current["x"] + current["steeringVelocity"] * .065
        if predicted < x - .025:
            keys.add("ArrowRight")
        elif predicted > x + .025:
            keys.add("ArrowLeft")
        keyboard.set(keys)

    # Follow the visible opening in each traffic row and earn an actual pass.
    deadline = time.monotonic() + 18
    while time.monotonic() < deadline:
        current = state(page)
        assert current["phase"] == "playing", "Traffic pass driver lost the run"
        if current["overtakePoints"] >= 50:
            break
        upcoming = uncleared_traffic(current)
        row = min(upcoming, key=lambda car: car["z"])["row"]
        occupied = {car["lane"] for car in upcoming if car["row"] == row}
        safe = min((x for index, x in enumerate((-.62, 0, .62)) if index not in occupied), key=lambda x: abs(x - current["x"]))
        steer_toward(current, safe, {"ArrowUp", "Space"})
        page.wait_for_timeout(65)
    keyboard.release()
    passed = state(page)
    assert passed["overtakePoints"] >= 50 and passed["score"] > 50
    assert any(event["type"] in ("pass", "near-miss") for event in passed["events"]), "Traffic crossing did not report a pass"
    screenshot(page, "fireside-night-drive-gameplay.png")

    # Deliberately line up with actual oncoming traffic through real steering.
    # Three physical contacts must exhaust health and freeze the completed run.
    page.locator("#solo-restart").click()
    canvas.focus()
    deadline, crash_events = time.monotonic() + 45, set()
    while time.monotonic() < deadline:
        current = state(page)
        crash_events.update(event["id"] for event in current["events"] if event["type"] == "crash")
        if current["phase"] == "lost":
            break
        upcoming = uncleared_traffic(current)
        assert upcoming, "No traffic available to test collisions"
        target = min(upcoming, key=lambda car: car["z"])
        steer_toward(current, target["x"], {"ArrowUp", "Space"})
        page.wait_for_timeout(65)
    keyboard.release()
    lost = state(page)
    assert lost["phase"] == "lost" and lost["health"] == 0, "Traffic contacts did not end the run"
    assert len(crash_events) == 3, "A contact damaged health more than once"
    page.wait_for_timeout(500)
    assert state(page) == lost, "Completed highway run continued moving"
    best = stored_record(page, "night-drive")
    assert best >= lost["score"] and best >= passed["score"]
    page.locator("#solo-restart").click()
    restarted = state(page)
    assert restarted["phase"] == "playing" and restarted["health"] == 3 and restarted["distance"] < 5
    assert stored_record(page, "night-drive") == best
    persistent_record(page, context, "night-drive", best)
    print("  Night Drive: auto-cruise, steering/brake, boost/recharge, touch cancellation, pause/tab pause, real traffic pass and three collisions, frozen finish, persistent best", flush=True)


def run(url):
    SCREENSHOTS.mkdir(parents=True, exist_ok=True)
    before_rooms = room_ids(url)
    with sync_playwright() as playwright:
        options = {"headless": True, "args": ["--no-sandbox", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"]}
        if os.path.exists("/usr/bin/chromium"):
            options["executable_path"] = "/usr/bin/chromium"
        browser = playwright.chromium.launch(**options, ignore_default_args=["--disable-back-forward-cache"])
        try:
            for game, exercise in (("night-drive", night_drive),):
                context = browser.new_context(viewport={"width": 1440, "height": 1100}, has_touch=True)
                context.add_init_script("window.addEventListener('pageshow', event => { window.__qaPageShowPersisted = event.persisted; });")
                page = context.new_page()
                watch(page, game)
                try:
                    page.goto(url)
                    page.wait_for_function("document.querySelector('#host-status').textContent === 'Host is online'")
                    check_catalog(page)
                    page.locator('[data-filter="driving"]').click()
                    page.wait_for_timeout(220)
                    screenshot(page, "fireside-driving-hub.png")
                    mobile_previews(page, "driving-hub")
                    page.locator(f'[data-play-solo="{game}"]').click()
                    page.wait_for_url(f"**/solo.html?game={game}")
                    start_solo(page, game)
                    standard_profile(page, game)
                    wait_phase(page, "playing")
                    with controls_panel(page, '#solo-how-to', resume=True):
                        assert page.locator("#solo-controls-list").is_visible()
                        assert not page.locator("#solo-rules").is_visible()
                        page.locator("#solo-how-to > summary").click()
                        assert page.locator("#solo-rules").is_visible()
                        page.locator("#solo-how-to > summary").click()
                    assert "room=" not in page.url
                    page.locator("#solo-pause").click()
                    wait_phase(page, "paused")
                    screenshot(page, f"fireside-{game}.png")
                    mobile_previews(page, game)
                    page.locator("#solo-pause").click()
                    wait_phase(page, "playing")
                    exercise(page, context)
                    browser_back(page, url, game)
                    assert room_ids(url) == before_rooms, "Launching a driving game changed a multiplayer room"
                    print(f"PASS {game}: hub launch, physical driving controls, pause/restart/record, desktop and 390/320px layout, no rooms/WebSockets", flush=True)
                finally:
                    context.close()
            assert room_ids(url) == before_rooms
            assert not errors, errors
            assert not console_errors, console_errors
            assert not failed_resources, failed_resources
            assert not room_mutations, room_mutations
            assert not sockets, sockets
            print(json.dumps({"games_tested": 1, "rooms_before": before_rooms, "rooms_after": room_ids(url), "browser_exceptions": errors, "console_errors": console_errors, "failed_resources": failed_resources, "room_mutations": room_mutations, "websockets": sockets, "screenshots": str(SCREENSHOTS)}), flush=True)
        finally:
            browser.close()


def main():
    if len(sys.argv) > 1:
        run(sys.argv[1].rstrip("/"))
        return
    source = "import { createServer } from './server.js'; const server = createServer(); const address = await server.listen(0, '127.0.0.1'); console.log(JSON.stringify({port: address.port})); process.on('SIGTERM', async () => { await server.close(); process.exit(0); });"
    server = subprocess.Popen(["node", "--input-type=module", "--eval", source], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        line = server.stdout.readline()
        if not line:
            raise RuntimeError(f"Temporary server could not start: {server.stderr.read()}")
        run(f"http://127.0.0.1:{json.loads(line)['port']}")
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait(timeout=5)


if __name__ == "__main__":
    main()
