"""Real-browser skill-game QA: python test/skill-browser-smoke.py [URL].

Starts an isolated host by default. Uses physical keyboard, pointer and touch
inputs; game inspection is read-only. No browser state or outcomes are forced.
Requires Python Playwright and Chromium. FIRESIDE_SCREENSHOT_DIR sets previews.
"""
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.parse import parse_qs, urlparse
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SCREENSHOTS = Path(os.environ.get("FIRESIDE_SCREENSHOT_DIR", ROOT / "test-results" / "skill"))
errors, console_errors, failed_resources, solo_mutations, solo_sockets = [], [], [], [], []


def watch(page, name, solo=False):
    page.on("pageerror", lambda error: errors.append(f"{name}: {error}"))
    page.on("console", lambda message: console_errors.append(f"{name}: {message.text}") if message.type == "error" else None)
    page.on("response", lambda response: failed_resources.append(f"{name}: {response.status} {response.url}") if response.status >= 400 else None)
    if solo:
        page.on("request", lambda request: solo_mutations.append(f"{name}: {request.method} {request.url}") if "/api/rooms" in request.url and request.method != "GET" else None)
        page.on("websocket", lambda socket: solo_sockets.append(f"{name}: {socket.url}"))


def state(page, solo=True):
    return page.evaluate(f"window.{'firesideSolo' if solo else 'firesideRoom'}.getState()")


def phase(page, value, solo=True, timeout=12000):
    surface = "firesideSolo" if solo else "firesideRoom"
    page.wait_for_function(f"phase => window.{surface}?.getState()?.phase === phase", arg=value, timeout=timeout)


def screenshot(page, filename):
    page.screenshot(path=str(SCREENSHOTS / filename), full_page=True)


def no_overflow(page):
    size = page.evaluate("({viewport:innerWidth,document:document.documentElement.scrollWidth})")
    assert size["document"] <= size["viewport"], size


def mobile_layout(page, game):
    for width in (390, 320):
        page.set_viewport_size({"width": width, "height": 844})
        page.wait_for_timeout(90)
        no_overflow(page)
        screenshot(page, f"fireside-{game}-mobile-{width}.png")
    page.set_viewport_size({"width": 1440, "height": 1100})


def room_ids(url):
    with urlopen(url + "/api/rooms", timeout=5) as response:
        return sorted(room["id"] for room in json.load(response)["rooms"])


def record(page, game, scope="default"):
    return page.evaluate("([game,scope]) => JSON.parse(localStorage.getItem(`fireside-solo-best:${game}:${scope}`))", [game, scope])


class Keyboard:
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


def check_catalog(page):
    assert page.locator("[data-create-game]").count() == 8
    assert page.locator("[data-play-solo]").count() == 7
    page.locator('[data-filter="action"]').click()
    assert page.locator("[data-create-game]:visible").count() == 4
    assert page.locator("[data-play-solo]:visible").count() == 1
    page.locator('[data-filter="driving"]').click()
    assert page.locator("[data-play-solo]:visible").count() == 2
    assert page.locator("[data-create-game]:visible").count() == 0
    page.locator('[data-filter="solo"]').click()
    assert page.locator("[data-play-solo]:visible").count() == 7
    assert page.locator("[data-create-game]:visible").count() == 0
    page.locator('[data-filter="all"]').click()


def pause_and_blur(page, context, keyboard):
    page.locator("#solo-pause").click()
    phase(page, "paused")
    before = state(page)
    keyboard.set({"ArrowLeft", "j", "Space"})
    page.wait_for_timeout(700)
    assert state(page) == before, "Paused game advanced or accepted gameplay input"
    page.locator("#solo-pause").click()
    phase(page, "playing")
    keyboard.release()
    session = context.new_cdp_session(page)
    other = context.new_page()
    try:
        page.bring_to_front()
        session.send("Emulation.setFocusEmulationEnabled", {"enabled": True})
        keyboard.set({"ArrowRight", "j"})
        other.goto("about:blank")
        other.bring_to_front()
        session.send("Emulation.setFocusEmulationEnabled", {"enabled": False})
        phase(page, "paused")
        before = state(page)
        page.wait_for_timeout(500)
        assert state(page) == before, "Native browser blur did not freeze the game"
        page.bring_to_front()
        assert state(page)["phase"] == "paused"
        keyboard.release()
        page.locator("#solo-pause").click()
        phase(page, "playing")
    finally:
        session.detach()
        other.close()


def browser_back(page, url, game):
    if state(page)["phase"] in ("playing", "upgrade"):
        page.locator("#solo-pause").click()
    before = state(page)
    page.locator(".solo-back").click()
    page.wait_for_url(url + "/")
    page.go_back(wait_until="commit")
    page.wait_for_function("game => window.firesideSolo?.gameId === game", arg=game)
    if page.evaluate("window.__qaPageShowPersisted === true"):
        assert state(page) == before, "BFCache lost the paused session"
        assert page.locator("#solo-pause span").inner_text() == "Resume"
    page.locator("#solo-restart").click()
    phase(page, "playing")


def touch_hold(page, context, selector, milliseconds=350, offset=(0, 0), cancel=True, solo=True):
    target = page.locator(selector)
    target.scroll_into_view_if_needed()
    box = target.bounding_box()
    assert box, selector
    touch = {"x": box["x"] + box["width"] * (.5 + offset[0]), "y": box["y"] + box["height"] * (.5 + offset[1]), "id": 1}
    session = context.new_cdp_session(page)
    try:
        before = state(page, solo)
        session.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [touch]})
        page.wait_for_timeout(milliseconds)
        held = state(page, solo)
        session.send("Input.dispatchTouchEvent", {"type": "touchCancel" if cancel else "touchEnd", "touchPoints": []})
        page.wait_for_timeout(200)
        released = state(page, solo)
        assert "is-held" not in (target.get_attribute("class") or ""), f"Touch stuck after cancellation: {selector}"
        assert target.get_attribute("aria-pressed") != "true", f"Touch held after release: {selector}"
        return before, held, released
    finally:
        session.detach()


SPAWNS = {
    "I": [(0, 1), (1, 1), (2, 1), (3, 1)], "J": [(0, 0), (0, 1), (1, 1), (2, 1)],
    "L": [(2, 0), (0, 1), (1, 1), (2, 1)], "O": [(1, 0), (2, 0), (1, 1), (2, 1)],
    "S": [(1, 0), (2, 0), (0, 1), (1, 1)], "T": [(1, 0), (0, 1), (1, 1), (2, 1)],
    "Z": [(0, 0), (1, 0), (1, 1), (2, 1)],
}


def shape_cells(kind, rotation):
    cells = SPAWNS[kind]
    for _ in range(rotation):
        cells = cells if kind == "O" else [(3 - y if kind == "I" else 2 - y, x) for x, y in cells]
    return cells


def place_plan(current):
    """Read-only lookahead chooses a placement; keys perform the actual move."""
    board, piece = current["board"], current["active"]
    choices = []
    for rotation in range(4 if piece["type"] != "O" else 1):
        cells = shape_cells(piece["type"], rotation)
        for x in range(-2, 10):
            y = 3
            def blocked(at_y):
                return any(x + dx < 0 or x + dx >= 10 or at_y + dy >= 24 or at_y + dy < 0 or board[at_y + dy][x + dx] is not None for dx, dy in cells)
            if blocked(y):
                continue
            while not blocked(y + 1):
                y += 1
            simulated = [[cell is not None for cell in row] for row in board]
            for dx, dy in cells:
                simulated[y + dy][x + dx] = True
            clears = sum(all(row) for row in simulated)
            simulated = [[False] * 10 for _ in range(clears)] + [row for row in simulated if not all(row)]
            heights, holes = [], 0
            for column in range(10):
                occupied = [row for row in range(24) if simulated[row][column]]
                heights.append(24 - occupied[0] if occupied else 0)
                if occupied:
                    holes += sum(not simulated[row][column] for row in range(occupied[0], 24))
            cost = sum(heights) * .51 + holes * .85 + sum(abs(a - b) for a, b in zip(heights, heights[1:])) * .19 - clears * .76
            choices.append((cost, rotation, x))
    assert choices, "No legal placement left in physical input driver"
    return min(choices)[1:]


def prism(page, context):
    keyboard = Keyboard(page)
    canvas = page.locator(".prism-canvas")
    canvas.focus()
    initial = state(page)
    page.keyboard.press("c")
    held = state(page)
    assert held["hold"] == initial["active"]["type"] and held["holdUsed"]
    page.keyboard.press("c")
    assert state(page)["hold"] == held["hold"] and state(page)["active"]["type"] == held["active"]["type"], "Hold used twice on a piece"
    if held["active"]["type"] != "O":
        page.keyboard.press("ArrowUp")
        assert state(page)["active"]["rotation"] == 1
        page.keyboard.press("z")
        assert state(page)["active"]["rotation"] == 0
    x = state(page)["active"]["x"]
    keyboard.set({"ArrowLeft"})
    page.wait_for_timeout(300)
    assert state(page)["active"]["x"] < x - 1, "DAS did not repeat movement"
    keyboard.release()
    x = state(page)["active"]["x"]
    page.wait_for_timeout(180)
    assert state(page)["active"]["x"] == x, "Horizontal movement stuck after key release"
    page.keyboard.press("Space")
    assert state(page)["piecesLocked"] == 1 and state(page)["score"] > 0
    assert not state(page)["holdUsed"]
    page.keyboard.press("c")
    assert state(page)["holdUsed"]
    pause_and_blur(page, context, keyboard)
    page.locator("#solo-restart").click()
    canvas.focus()
    for _ in range(65):
        current = state(page)
        assert current["phase"] == "playing", current
        rotation, target_x = place_plan(current)
        for _ in range(rotation):
            page.keyboard.press("ArrowUp")
        for _ in range(12):
            x = state(page)["active"]["x"]
            if x == target_x:
                break
            page.keyboard.press("ArrowRight" if x < target_x else "ArrowLeft")
        assert state(page)["active"]["x"] == target_x, "Placement keyboard path blocked unexpectedly"
        page.keyboard.press("Space")
        if state(page)["lines"] >= 4:
            break
    current = state(page)
    assert current["lines"] >= 4, "Physical placement driver did not clear rows"
    assert current["score"] > 100 and current["lastClear"] is not None
    page.wait_for_timeout(120)
    best = record(page, "prism-shift", "marathon")
    assert best >= current["score"]
    screenshot(page, "fireside-prism-shift.png")
    page.locator('[data-mode="sprint"]').click()
    assert state(page)["mode"] == "sprint" and state(page)["score"] == 0
    page.wait_for_timeout(350)
    assert record(page, "prism-shift", "sprint") is None, "Unfinished sprint saved a time"
    assert page.locator("#solo-score-label").inner_text() == "TIME"
    assert page.locator("#solo-record-label").inner_text() == "BEST 40 LINES"
    assert page.locator("#solo-record").inner_text() == "—"
    assert page.locator("#solo-score").inner_text().endswith("s")
    page.locator("#solo-pause").click()
    mobile_layout(page, "prism-shift")
    page.locator("#solo-pause").click()
    page.set_viewport_size({"width": 390, "height": 844})
    before, held, released = touch_hold(page, context, '.prism-control[data-action="left"]')
    assert held["active"]["x"] < before["active"]["x"]
    assert released["active"]["x"] == held["active"]["x"]
    before, held, released = touch_hold(page, context, '.prism-control[data-action="hardDrop"]', cancel=False)
    assert held["piecesLocked"] == before["piecesLocked"] + 1 and released["piecesLocked"] == held["piecesLocked"]
    page.set_viewport_size({"width": 1440, "height": 1100})
    page.locator('[data-mode="marathon"]').click()
    assert record(page, "prism-shift", "marathon") == best
    page.reload()
    page.wait_for_function("window.firesideSolo?.gameId === 'prism-shift'")
    assert record(page, "prism-shift", "marathon") == best
    assert state(page)["piecesLocked"] == 0 and state(page)["hold"] is None
    print("  Prism Shift: real rotation/hold, DAS/release, hard drops and four cleared rows, scoring, scoped Sprint time, native blur/pause, touch cancel/release and records", flush=True)


def aim_at(page, selector, x, y, width, height):
    box = page.locator(selector).bounding_box()
    assert box
    page.mouse.move(box["x"] + x / width * box["width"], box["y"] + y / height * box["height"])


def rift(page, context):
    keyboard = Keyboard(page)
    canvas = page.locator(".rift-canvas")
    canvas.focus()
    before = state(page)
    keyboard.set({"ArrowRight"})
    page.wait_for_timeout(240)
    keyboard.release()
    assert state(page)["player"]["x"] > before["player"]["x"] + 40
    stamina = state(page)["player"]["stamina"]
    page.keyboard.press("Space", delay=40)
    assert state(page)["player"]["stamina"] < stamina - 20
    page.wait_for_timeout(220)
    pause_and_blur(page, context, keyboard)
    page.locator("#solo-restart").click()
    canvas.focus()
    # Aim away from enemies into the upper border to exercise heat independently.
    aim_at(page, ".rift-canvas", 500, 0, 1000, 680)
    keyboard.set({"j"})
    page.wait_for_function("window.firesideSolo.getState().player.overheated", timeout=5000)
    keyboard.release()
    hot = state(page)["player"]["heat"]
    page.wait_for_timeout(600)
    assert state(page)["player"]["heat"] < hot - 10
    page.locator("#solo-restart").click()
    canvas.focus()
    deadline, hits = time.monotonic() + 28, set()
    while time.monotonic() < deadline:
        current = state(page)
        hits.update(event["id"] for event in current["events"] if event["type"] == "hit")
        if current["phase"] == "upgrade":
            break
        assert current["phase"] == "playing", "Physical aiming driver lost before first wave clear"
        player = current["player"]
        target = min(current["enemies"], key=lambda enemy: math.hypot(enemy["x"] - player["x"], enemy["y"] - player["y"]))
        aim_at(page, ".rift-canvas", target["x"], target["y"], 1000, 680)
        desired = {"j"}
        gap = math.hypot(target["x"] - player["x"], target["y"] - player["y"])
        if gap < 130:
            dx, dy = player["x"] - target["x"], player["y"] - target["y"]
            desired.add("ArrowRight" if dx > 0 and player["x"] < 850 else "ArrowLeft" if player["x"] > 150 else "ArrowRight")
            desired.add("ArrowDown" if dy > 0 and player["y"] < 580 else "ArrowUp" if player["y"] > 100 else "ArrowDown")
        keyboard.set(desired)
        page.wait_for_timeout(70)
    keyboard.release()
    current = state(page)
    assert current["phase"] == "upgrade" and current["wavesCleared"] == 1 and current["kills"] == 4, current
    assert hits and current["score"] >= 700
    assert page.locator("[data-upgrade]:visible").count() == 3
    page.locator("#solo-pause").click()
    phase(page, "paused")
    assert state(page)["pausedPhase"] == "upgrade"
    before = state(page)
    page.wait_for_timeout(500)
    assert state(page) == before
    page.locator("#solo-pause").click()
    phase(page, "upgrade")
    selection = page.locator("[data-upgrade]").first
    chosen = selection.get_attribute("data-upgrade")
    selection.click()
    phase(page, "playing")
    assert state(page)["wave"] == 2 and state(page)["upgrades"][chosen] == 1
    aim_at(page, ".rift-canvas", 900, 340, 1000, 680)
    screenshot(page, "fireside-rift-survivor.png")
    best = record(page, "rift-survivor")
    assert best >= 700
    page.locator("#solo-pause").click()
    mobile_layout(page, "rift-survivor")
    page.locator("#solo-restart").click()
    page.set_viewport_size({"width": 390, "height": 844})
    before, held, released = touch_hold(page, context, '[data-stick="move"]', offset=(.3, 0))
    assert held["player"]["x"] > before["player"]["x"] + 20
    page.wait_for_timeout(180)
    assert abs(state(page)["player"]["x"] - released["player"]["x"]) < 1, "Touch movement remained active after cancellation"
    before, held, released = touch_hold(page, context, '[data-stick="aim"]', offset=(.3, 0), cancel=False)
    assert held["player"]["heat"] > before["player"]["heat"]
    page.wait_for_timeout(300)
    assert state(page)["player"]["heat"] < held["player"]["heat"], "Touch aim continued firing after release"
    before, held, released = touch_hold(page, context, '[data-control="dash"]', milliseconds=130)
    assert held["player"]["stamina"] < before["player"]["stamina"] - 20
    before, held, released = touch_hold(page, context, '[data-control="fire"]', milliseconds=300)
    assert held["player"]["heat"] > before["player"]["heat"]
    page.set_viewport_size({"width": 1440, "height": 1100})
    # Let real enemies reach the unarmed player and verify an actual terminal run.
    page.locator("#solo-restart").click()
    phase(page, "lost", timeout=40000)
    lost = state(page)
    assert lost["player"]["hp"] == 0
    page.wait_for_timeout(500)
    assert state(page) == lost, "Lost Rift run kept simulating"
    page.locator("#solo-restart").click()
    assert state(page)["score"] == 0 and state(page)["player"]["hp"] == 100
    assert record(page, "rift-survivor") >= best
    page.reload()
    page.wait_for_function("window.firesideSolo?.gameId === 'rift-survivor'")
    assert record(page, "rift-survivor") >= best
    print("  Rift Survivor: physical aiming/kills and first wave upgrade, next wave, dash/heat/cooling, playing/upgrade pause, native blur, twin touchpads/buttons, natural defeat and persistent score", flush=True)


def vector(browser, url):
    contexts = [browser.new_context(viewport={"width": 1440, "height": 1100}, has_touch=True) for _ in range(2)]
    first, second = [context.new_page() for context in contexts]
    keyboard = Keyboard(first)
    try:
        for page, label in ((first, "vector/P1"), (second, "vector/P2")):
            watch(page, label)
            page.goto(url)
            page.wait_for_function("document.querySelector('#host-status').textContent === 'Host is online'")
        first.locator("#hub-name").fill("Mina QA")
        first.locator("#hub-name").press("Enter")
        first.locator('[data-create-game="vector-arena"]').click()
        first.wait_for_url("**/*room=*")
        first.wait_for_function("window.firesideRoom?.connected && window.firesideRoom.playerId === 0")
        code = parse_qs(urlparse(first.url).query)["room"][0]
        second.locator("#hub-name").fill("Rook QA")
        second.locator("#hub-name").press("Enter")
        second.locator("#room-code").fill(code.lower())
        second.locator("#join-button").click()
        second.wait_for_url("**/*room=*")
        second.wait_for_function("window.firesideRoom?.connected && window.firesideRoom.playerId === 1")
        first.wait_for_function("document.querySelector('#p2-name').textContent === 'ROOK QA'")
        first.locator("#ready-button").click()
        first.wait_for_function("document.querySelector('#ready-button span').textContent === 'Cancel ready'")
        assert state(first, False)["phase"] == "lobby"
        second.locator("#ready-button").click()
        phase(first, "countdown", False)
        first.locator("#ready-button").click()
        phase(first, "lobby", False)
        first.locator("#ready-button").click()
        second.locator("#ready-button").click()
        phase(first, "fight", False)
        phase(second, "fight", False)
        first.locator("#arena").focus()
        before = state(first, False)["fighters"][0]
        keyboard.set({"d"})
        first.wait_for_timeout(210)
        keyboard.release()
        first.wait_for_timeout(90)
        moved = state(first, False)["fighters"][0]
        assert moved["x"] > before["x"] + 50
        aim_at(first, "#arena", 806, 320, 960, 640)
        first.keyboard.press("Space", delay=40)
        first.wait_for_timeout(130)
        assert state(first, False)["fighters"][0]["stamina"] < 80
        first.wait_for_timeout(220)
        stamina = state(first, False)["fighters"][0]["stamina"]
        first.keyboard.down("Space")
        first.wait_for_timeout(110)
        first.keyboard.up("Space")
        assert state(first, False)["fighters"][0]["stamina"] < stamina - 20
        first.wait_for_timeout(250)
        # Restore an open horizontal shooting lane using real keyboard input.
        while state(first, False)["fighters"][0]["x"] > 330:
            keyboard.set({"a"})
            first.wait_for_timeout(70)
        keyboard.release()
        aim_at(first, "#arena", 806, 320, 960, 640)
        keyboard.set({"i", "j"})
        first.wait_for_function("window.firesideRoom.getState().fighters[1].hp < 100", timeout=3000)
        keyboard.release()
        second.wait_for_function("window.firesideRoom.getState().fighters[1].hp < 100", timeout=3000)
        first.keyboard.press("r", delay=45)
        first.wait_for_function("window.firesideRoom.getState().fighters[0].reloadTicks > 0", timeout=1500)
        assert state(first, False)["phase"] == "fight", "R triggered ready/rematch instead of reload"
        first.wait_for_function("window.firesideRoom.getState().fighters[0].ammo === 6 && window.firesideRoom.getState().fighters[0].reloadTicks === 0", timeout=2500)
        screenshot(first, "fireside-vector-arena.png")
        keyboard.set({"i", "j"})
        phase(first, "matchEnd", False, timeout=16000)
        keyboard.release()
        phase(second, "matchEnd", False)
        assert state(first, False)["winner"] == 0
        assert [f["wins"] for f in state(first, False)["fighters"]] == [2, 0]
        assert [f["wins"] for f in state(second, False)["fighters"]] == [2, 0]
        first.locator("#ready-button").click()
        first.wait_for_timeout(200)
        assert state(first, False)["phase"] == "lobby", "One player started a new match without peer agreement"
        second.locator("#ready-button").click()
        phase(first, "countdown", False)
        phase(first, "fight", False)
        mobile_layout(first, "vector-arena")
        first.set_viewport_size({"width": 390, "height": 844})
        before, held, released = touch_hold(first, contexts[0], '[data-vector-pad="move"]', offset=(.3, 0), solo=False)
        assert held["fighters"][0]["x"] > before["fighters"][0]["x"] + 35
        assert not released["fighters"][0]["previousInput"]["right"]
        before, held, released = touch_hold(first, contexts[0], '[data-vector-pad="aim"]', offset=(.3, -.2), solo=False)
        assert held["fighters"][0]["aimY"] < -.2
        assert math.isclose(math.hypot(held["fighters"][0]["aimX"], held["fighters"][0]["aimY"]), 1, abs_tol=.001)
        before, held, released = touch_hold(first, contexts[0], '[data-vector-action="fire"]', solo=False)
        assert held["fighters"][0]["ammo"] < before["fighters"][0]["ammo"]
        assert not released["fighters"][0]["previousInput"]["fire"]
        second.close()
        phase(first, "lobby", False)
        assert all(f["hp"] == 100 and f["wins"] == 0 for f in state(first, False)["fighters"])
        print("PASS vector-arena: real two-context room/code join, ready cancellation, movement/dash, synchronized shooting/reload, first-to-two match, both-agree rematch, touch pads/fire cancellation, disconnect reset and 390/320px layouts", flush=True)
    finally:
        keyboard.release()
        for context in contexts:
            context.close()


def run(url):
    SCREENSHOTS.mkdir(parents=True, exist_ok=True)
    selected = set(os.environ.get("FIRESIDE_QA_GAMES", "prism-shift,rift-survivor,vector-arena").split(","))
    with sync_playwright() as playwright:
        options = {"headless": True, "args": ["--no-sandbox", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"]}
        if os.path.exists("/usr/bin/chromium"):
            options["executable_path"] = "/usr/bin/chromium"
        browser = playwright.chromium.launch(**options, ignore_default_args=["--disable-back-forward-cache"])
        try:
            for game, exercise in (("prism-shift", prism), ("rift-survivor", rift)):
                if game not in selected:
                    continue
                before_rooms = room_ids(url)
                context = browser.new_context(viewport={"width": 1440, "height": 1100}, has_touch=True)
                context.add_init_script("window.addEventListener('pageshow', event => {window.__qaPageShowPersisted = event.persisted;});")
                page = context.new_page()
                watch(page, game, solo=True)
                try:
                    page.goto(url)
                    page.wait_for_function("document.querySelector('#host-status').textContent === 'Host is online'")
                    check_catalog(page)
                    if game == "prism-shift":
                        screenshot(page, "fireside-skill-hub.png")
                        mobile_layout(page, "skill-hub")
                    page.locator(f'[data-play-solo="{game}"]').click()
                    page.wait_for_url(f"**/solo.html?game={game}")
                    page.wait_for_function("game => window.firesideSolo?.gameId === game", arg=game)
                    phase(page, "playing")
                    exercise(page, context)
                    browser_back(page, url, game)
                    assert room_ids(url) == before_rooms, "Solo game altered multiplayer rooms"
                    print(f"PASS {game}: hub launch, responsive physical gameplay, records/pause/restart, BFCache, touch and mobile layout, no rooms/WebSockets", flush=True)
                finally:
                    context.close()
            if "vector-arena" in selected:
                vector(browser, url)
            assert not errors, errors
            assert not console_errors, console_errors
            assert not failed_resources, failed_resources
            assert not solo_mutations, solo_mutations
            assert not solo_sockets, solo_sockets
            print(json.dumps({"games_tested": len(selected), "browser_exceptions": errors, "console_errors": console_errors, "failed_resources": failed_resources, "solo_room_mutations": solo_mutations, "solo_websockets": solo_sockets, "screenshots": str(SCREENSHOTS)}), flush=True)
        finally:
            browser.close()


def main():
    if len(sys.argv) > 1:
        run(sys.argv[1].rstrip("/"))
        return
    source = "import { createServer } from './server.js'; const server = createServer(); const address = await server.listen(0, '127.0.0.1'); console.log(JSON.stringify({port:address.port})); process.on('SIGTERM', async () => {await server.close();process.exit(0);});"
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
