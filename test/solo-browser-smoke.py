"""Optional real-browser solo QA: python test/solo-browser-smoke.py [server URL].

Requires Python Playwright and Chromium. With no URL, starts and stops an
isolated server on a free local port. Inputs use real rendered controls;
window.firesideSolo.getState() is inspected read-only, never modified.
Set FIRESIDE_SCREENSHOT_DIR to select desktop/mobile preview output.
"""
import json
import os
from pathlib import Path
import subprocess
import sys
from collections import deque
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SCREENSHOTS = Path(os.environ.get("FIRESIDE_SCREENSHOT_DIR", ROOT / "test-results" / "solo"))
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


def number_text(page, selector):
    text = page.locator(selector).inner_text()
    return int("".join(character for character in text if character.isdigit()) or "0")


def check_catalog(page):
    assert page.locator("[data-create-game]").count() == 8
    assert page.locator("[data-play-solo]").count() == 7
    assert page.locator("[data-create-game]:visible").count() == 8
    assert page.locator("[data-play-solo]:visible").count() == 7
    page.locator('[data-filter="friends"]').click()
    assert page.locator("[data-create-game]:visible").count() == 8
    assert page.locator("[data-play-solo]:visible").count() == 0
    page.locator('[data-filter="solo"]').click()
    assert page.locator("[data-create-game]:visible").count() == 0
    assert page.locator("[data-play-solo]:visible").count() == 7
    page.locator('[data-filter="all"]').click()
    assert page.locator("[data-create-game]:visible").count() == 8
    assert page.locator("[data-play-solo]:visible").count() == 7


def preview_mobile(page, game):
    for width in (390, 320):
        page.set_viewport_size({"width": width, "height": 844})
        page.wait_for_timeout(80)
        assert_no_overflow(page)
        screenshot(page, f"fireside-{game}-mobile-{width}.png")
    page.set_viewport_size({"width": 1440, "height": 1100})


def pause(page, action):
    page.locator("#solo-pause").click()
    wait_phase(page, "paused")
    before = state(page)
    action()
    page.wait_for_timeout(1200)
    assert state(page) == before, "Paused game progressed or accepted a gameplay input"
    page.locator("#solo-pause").click()
    wait_phase(page, "playing")


def click_pointer(page, selector):
    """Physical pointer input also exercises disabled controls without DOM forcing."""
    box = page.locator(selector).bounding_box()
    assert box, f"No visible input target: {selector}"
    page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)


def key_on(page, selector, key):
    page.locator(selector).focus()
    page.keyboard.press(key)


def verify_persistent_best(page, context, game, best):
    page.reload()
    page.wait_for_function(f"game => {SURFACE}?.gameId === game", arg=game)
    assert number_text(page, "#solo-record") == best
    fresh = context.new_page()
    watch(fresh, f"{game}/fresh-page")
    try:
        fresh.goto(page.url)
        fresh.wait_for_function(f"game => {SURFACE}?.gameId === game", arg=game)
        assert number_text(fresh, "#solo-record") == best, "Stored best was lost in a fresh same-origin page"
    finally:
        fresh.close()
        page.bring_to_front()


def verify_browser_back(page, url, game):
    # Real-time games may finish while a fresh-tab record check is in progress.
    # Start a real new run so history restoration exercises active pause controls.
    if state(page)["phase"] in ("won", "lost"):
        page.locator("#solo-restart").click()
        wait_phase(page, "playing")
    if state(page)["phase"] == "playing":
        page.locator("#solo-pause").click()
        wait_phase(page, "paused")
    before = state(page)
    page.locator(".solo-back").click()
    page.wait_for_url(url + "/")
    # A cached restoration does not fire a second load event.
    page.go_back(wait_until="commit")
    page.wait_for_function(f"game => {SURFACE}?.gameId === game && {SURFACE}.getState() !== null", arg=game)
    cached = page.evaluate("window.__qaPageShowPersisted === true")
    if cached:
        assert state(page) == before, "Back/forward cache changed the paused board"
        assert page.locator("#solo-pause span").inner_text() == "Resume"
        page.locator("#solo-pause").click()
        wait_phase(page, "playing")
    else:
        assert state(page)["phase"] == "playing", "A fresh history navigation did not mount its game"
    page.locator("#solo-restart").click()
    assert state(page)["phase"] == "playing", "Game controls stopped working after browser Back"
    print(f"  {game}: hub backlink → browser Back, cached restore={cached}, active controls", flush=True)


def blur_pause(page, context):
    other = context.new_page()
    session = context.new_cdp_session(page)
    try:
        other.goto("about:blank")
        other.bring_to_front()
        # Headless Chromium leaves every page visible by default. Restoring
        # actual focus after emulation produces a native browser blur event.
        session.send("Emulation.setFocusEmulationEnabled", {"enabled": True})
        session.send("Emulation.setFocusEmulationEnabled", {"enabled": False})
        wait_phase(page, "paused")
        before = state(page)
        page.wait_for_timeout(1200)
        assert state(page) == before, "Game progressed while its tab was hidden"
        page.bring_to_front()
        assert state(page)["phase"] == "paused", "Returning to the tab resumed without player input"
        page.locator("#solo-pause").click()
        wait_phase(page, "playing")
    finally:
        session.detach()
        other.close()


def snake(page, context):
    vectors = {"up": (0, -1), "right": (1, 0), "down": (0, 1), "left": (-1, 0)}
    keys = {"up": "ArrowUp", "right": "ArrowRight", "down": "ArrowDown", "left": "ArrowLeft"}
    opposite = {"up": "down", "down": "up", "right": "left", "left": "right"}

    def next_direction(current):
        head = current["snake"][0]
        target = (current["food"]["x"], current["food"]["y"])
        blocked = {(segment["x"], segment["y"]) for segment in current["snake"][1:-1]}
        queue = deque([((head["x"], head["y"]), [])])
        seen = {(head["x"], head["y"])}
        while queue:
            point, path = queue.popleft()
            if point == target and path:
                return path[0]
            for direction, (dx, dy) in vectors.items():
                if not path and direction == opposite[current["direction"]]:
                    continue
                next_point = (point[0] + dx, point[1] + dy)
                if not (0 <= next_point[0] < current["width"] and 0 <= next_point[1] < current["height"]):
                    continue
                if next_point in seen or next_point in blocked:
                    continue
                seen.add(next_point)
                queue.append((next_point, path + [direction]))
        raise AssertionError("No observable safe path from the snake to its food")

    first = state(page)
    for _ in range(120):
        current = state(page)
        assert current["phase"] == "playing", "Snake collided while following the visible food"
        if current["score"] > 0:
            break
        direction = next_direction(current)
        page.locator(".snake-canvas").focus()
        page.keyboard.press(keys[direction])
        page.wait_for_function(f"ticks => {SURFACE}.getState().ticks > ticks || {SURFACE}.getState().phase !== 'playing'", arg=current["ticks"], timeout=2000)
    current = state(page)
    assert current["ticks"] > first["ticks"] and current["score"] > 0 and current["foodsEaten"] >= 1
    assert len(current["snake"]) > len(first["snake"])
    assert number_text(page, "#solo-record") >= current["score"]
    pause(page, lambda: key_on(page, ".snake-canvas", "ArrowUp"))
    blur_pause(page, context)
    # A real directional control sends the snake into a wall; no state injection.
    current = state(page)
    direction = current["direction"]
    page.locator(f'.snake-direction[data-direction="{direction}"]').click()
    wait_phase(page, "lost", timeout=6000)
    lost = state(page)
    page.wait_for_timeout(400)
    assert state(page) == lost, "Lost Snake continued simulating"
    best = number_text(page, "#solo-record")
    page.locator("#solo-restart").click()
    restarted = state(page)
    assert restarted["phase"] == "playing" and restarted["score"] == 0 and restarted["foodsEaten"] == 0
    assert number_text(page, "#solo-record") == best
    verify_persistent_best(page, context, "snake", best)
    if state(page)["phase"] == "playing":
        page.locator("#solo-pause").click()
    print("  Snake: real-time keyboard path to food, growth/score, pause/tab pause, directional control, wall loss, restart, persistent best", flush=True)


def minesweeper(page, context):
    center = 4 * state(page)["cols"] + 4
    page.locator('.minesweeper-tile[data-index="0"]').focus()
    page.keyboard.press("ArrowDown")
    page.keyboard.press("ArrowRight")
    page.wait_for_function("document.activeElement?.dataset.index === '10'")
    key_on(page, f'.minesweeper-tile[data-index="{center}"]', "Enter")
    current = state(page)
    # A lucky opening can legitimately clear every safe tile. Use another
    # real board for the flag/timer checks instead of assuming it cannot win.
    for _ in range(5):
        if current["phase"] != "won":
            break
        page.locator("#solo-restart").click()
        key_on(page, f'.minesweeper-tile[data-index="{center}"]', "Enter")
        current = state(page)
    assert current["generated"] and current["phase"] == "playing"
    assert current["cells"][center]["revealed"] and current["cells"][center]["adjacent"] == 0
    assert current["opened"] >= 9, "Safe first-click flood did not reveal its surrounding cells"
    hidden = next(index for index, cell in enumerate(current["cells"]) if not cell["revealed"])
    tile = page.locator(f'.minesweeper-tile[data-index="{hidden}"]')
    tile.click(button="right")
    assert state(page)["cells"][hidden]["flagged"]
    tile.focus()
    page.keyboard.press("f")
    assert not state(page)["cells"][hidden]["flagged"]
    page.locator(".minesweeper-flag-mode").tap()
    assert page.locator(".minesweeper-flag-mode").get_attribute("aria-pressed") == "true"
    tile.tap()
    assert state(page)["cells"][hidden]["flagged"]
    tile.tap()
    assert not state(page)["cells"][hidden]["flagged"]
    page.locator(".minesweeper-flag-mode").click()
    page.wait_for_timeout(1300)
    assert state(page)["elapsed"] >= 1
    pause(page, lambda: click_pointer(page, f'.minesweeper-tile[data-index="{hidden}"]'))
    blur_pause(page, context)
    # Only use revealed numbers to infer flags; never inspect covered mine data.
    current = state(page)
    neighbors = lambda index: [row * current["cols"] + col for row in range(max(0, index // current["cols"] - 1), min(current["rows"], index // current["cols"] + 2)) for col in range(max(0, index % current["cols"] - 1), min(current["cols"], index % current["cols"] + 2)) if row * current["cols"] + col != index]
    inferred = next((index for index, cell in enumerate(current["cells"]) if cell["revealed"] and cell["adjacent"] > 0 and len([other for other in neighbors(index) if not current["cells"][other]["revealed"]]) == cell["adjacent"]), None)
    chorded = False
    if inferred is not None:
        for index in neighbors(inferred):
            if not state(page)["cells"][index]["revealed"]:
                page.locator(f'.minesweeper-tile[data-index="{index}"]').click(button="right")
        current = state(page)
        candidate = next((index for index, cell in enumerate(current["cells"]) if cell["revealed"] and cell["adjacent"] > 0 and sum(current["cells"][other]["flagged"] for other in neighbors(index)) == cell["adjacent"] and any(not current["cells"][other]["revealed"] and not current["cells"][other]["flagged"] for other in neighbors(index))), None)
        if candidate is not None:
            before_opened = current["opened"]
            key_on(page, f'.minesweeper-tile[data-index="{candidate}"]', "Enter")
            assert state(page)["opened"] > before_opened and state(page)["phase"] != "lost", "A correctly inferred numbered chord failed"
            chorded = True
    page.locator(".minesweeper-difficulty").select_option("intermediate")
    changed = state(page)
    assert changed["difficulty"] == "intermediate" and not changed["generated"] and changed["elapsed"] == 0
    assert changed["rows"] == 16 and changed["cols"] == 16
    preview_mobile(page, "minesweeper-intermediate")
    page.locator(".minesweeper-difficulty").select_option("beginner")
    page.locator('.minesweeper-tile[data-index="40"]').click()
    page.locator("#solo-restart").click()
    reset = state(page)
    assert not reset["generated"] and reset["opened"] == 0 and reset["flags"] == 0 and reset["elapsed"] == 0
    print(f"  Minesweeper: keyboard navigation/first safe flood, right-click/keyboard/touch-mode flags, observed-number chord={chorded}, timer pause, tab pause, difficulty, restart", flush=True)


def twenty_forty_eight(page, context):
    initial = state(page)
    directions = ("ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp")
    for index in range(80):
        before = state(page)
        page.locator(".tiles-2048-grid").focus()
        page.keyboard.press(directions[index % 4])
        after = state(page)
        if after["moves"] > before["moves"]:
            assert after["undoAvailable"]
            page.locator('[data-action="undo"]').click()
            undone = state(page)
            assert undone["board"] == before["board"] and undone["score"] == before["score"] and undone["moves"] == before["moves"]
            assert not undone["undoAvailable"]
            page.locator(".tiles-2048-grid").focus()
            page.keyboard.press(directions[index % 4])
            break
    assert state(page)["moves"] > initial["moves"], "Keyboard did not move the board"
    for index in range(160):
        if state(page)["score"] > 0:
            break
        page.locator(".tiles-2048-grid").focus()
        page.keyboard.press(directions[index % 4])
    assert state(page)["score"] > 0, "Real keyboard moves did not merge any tiles"
    earned = state(page)["score"]
    assert number_text(page, "#solo-record") >= earned
    pause(page, lambda: key_on(page, ".tiles-2048-grid", "ArrowLeft"))
    blur_pause(page, context)
    def legal_direction(board):
        for direction in ("left", "up", "right", "down"):
            for line_index in range(4):
                indices = [line_index * 4 + offset if direction in ("left", "right") else offset * 4 + line_index for offset in range(4)]
                if direction in ("right", "down"):
                    indices.reverse()
                original = [board[index] for index in indices]
                packed = [value for value in original if value]
                merged = []
                offset = 0
                while offset < len(packed):
                    if offset + 1 < len(packed) and packed[offset] == packed[offset + 1]:
                        merged.append(packed[offset] * 2)
                        offset += 2
                    else:
                        merged.append(packed[offset])
                        offset += 1
                if merged + [0] * (4 - len(merged)) != original:
                    return direction
        raise AssertionError("Playing 2048 has no legal direction")

    before = state(page)
    direction = legal_direction(before["board"])
    page.locator(f'[data-action="move-{direction}"]').click()
    assert state(page)["moves"] == before["moves"] + 1
    # Use touch events with a real pointer path rather than directly invoking game code.
    box = page.locator(".tiles-2048-grid").bounding_box()
    before = state(page)
    direction = legal_direction(before["board"])
    x, y = box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 0.5
    dx, dy = {"left": (-80, 0), "right": (80, 0), "up": (0, -80), "down": (0, 80)}[direction]
    session = context.new_cdp_session(page)
    session.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]})
    session.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x + dx, "y": y + dy}]})
    session.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    session.detach()
    assert state(page)["phase"] == "playing" and state(page)["moves"] == before["moves"] + 1, "A real touch swipe did not move tiles"
    best = number_text(page, "#solo-record")
    verify_persistent_best(page, context, "2048", best)
    assert state(page)["score"] == 0
    if state(page)["phase"] == "paused":
        page.locator("#solo-pause").click()
    page.locator(".tiles-2048-grid").focus()
    page.keyboard.press("ArrowLeft")
    page.locator("#solo-restart").click()
    assert state(page)["score"] == 0 and state(page)["moves"] == 0 and not state(page)["undoAvailable"]
    assert number_text(page, "#solo-record") == best
    print("  2048: keyboard moves/merges, exact one-step undo, pause/tab pause, directional control/swipe, persistent best, restart", flush=True)


def run(url):
    SCREENSHOTS.mkdir(parents=True, exist_ok=True)
    before_rooms = room_ids(url)
    with sync_playwright() as playwright:
        options = {"headless": True, "args": ["--no-sandbox", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"]}
        if os.path.exists("/usr/bin/chromium"):
            options["executable_path"] = "/usr/bin/chromium"
        browser = playwright.chromium.launch(**options, ignore_default_args=["--disable-back-forward-cache"])
        try:
            for game, exercise in (("snake", snake), ("minesweeper", minesweeper), ("2048", twenty_forty_eight)):
                context = browser.new_context(viewport={"width": 1440, "height": 1100}, has_touch=True)
                context.add_init_script("window.addEventListener('pageshow', event => { window.__qaPageShowPersisted = event.persisted; });")
                page = context.new_page()
                watch(page, game)
                try:
                    page.goto(url)
                    page.wait_for_function("document.querySelector('#host-status').textContent === 'Host is online'")
                    check_catalog(page)
                    if game == "snake":
                        screenshot(page, "fireside-solo-hub-all.png")
                        page.locator('[data-filter="solo"]').click()
                        screenshot(page, "fireside-solo-hub.png")
                        preview_mobile(page, "solo-hub")
                    page.locator('[data-filter="solo"]').click()
                    page.locator(f'[data-play-solo="{game}"]').click()
                    page.wait_for_url(f"**/solo.html?game={game}")
                    page.wait_for_function(f"game => {SURFACE}?.gameId === game", arg=game)
                    wait_phase(page, "playing")
                    assert page.locator("#solo-controls-list").is_visible()
                    assert page.locator("#solo-rules").is_visible()
                    assert "room=" not in page.url
                    if game == "snake":
                        page.locator("#solo-pause").click()
                        wait_phase(page, "paused")
                    screenshot(page, f"fireside-{game}.png")
                    preview_mobile(page, game)
                    if game == "snake":
                        page.locator("#solo-pause").click()
                        wait_phase(page, "playing")
                    exercise(page, context)
                    verify_browser_back(page, url, game)
                    assert room_ids(url) == before_rooms, "Launching a solo game created or changed a multiplayer room"
                    print(f"PASS {game}: direct hub launch, real gameplay, pause/restart, desktop and 390/320px layout, no rooms/WebSockets", flush=True)
                finally:
                    context.close()
            assert room_ids(url) == before_rooms
            assert not errors, errors
            assert not console_errors, console_errors
            assert not failed_resources, failed_resources
            assert not room_mutations, room_mutations
            assert not sockets, sockets
            print(json.dumps({"games_tested": 3, "rooms_before": before_rooms, "rooms_after": room_ids(url), "browser_exceptions": errors, "console_errors": console_errors, "failed_resources": failed_resources, "room_mutations": room_mutations, "websockets": sockets, "screenshots": str(SCREENSHOTS)}), flush=True)
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
