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
from browser_profiles import standard_profile


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


def screenshot(page, filename, full_page=True):
    polished = filename.replace("fireside-", "fireside-polished-", 1)
    page.screenshot(path=str(SCREENSHOTS / polished), full_page=full_page, animations="disabled")


def no_overflow(page):
    size = page.evaluate("({viewport:innerWidth,document:document.documentElement.scrollWidth})")
    assert size["document"] <= size["viewport"], size


def mobile_layout(page, game):
    for width in (390, 320):
        page.set_viewport_size({"width": width, "height": 844})
        page.wait_for_timeout(90)
        no_overflow(page)
        screenshot(page, f"fireside-{game}-mobile-{width}.png")
    page.set_viewport_size({"width": 1440, "height": 1000})


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
    assert page.locator("[data-create-game]").count() == 9
    assert page.locator("[data-play-solo]").count() == 10
    for selector in ('[data-create-game="vector-arena"]', '[data-play-solo="prism-shift"]', '[data-play-solo="rift-survivor"]'):
        assert page.locator(selector).bounding_box()["height"] >= 44
    page.locator('[data-filter="action"]').click()
    assert page.locator("[data-create-game]:visible").count() == 5
    assert page.locator("[data-play-solo]:visible").count() == 2
    page.locator('[data-filter="driving"]').click()
    assert page.locator("[data-play-solo]:visible").count() == 3
    assert page.locator("[data-create-game]:visible").count() == 0
    page.locator('[data-filter="solo"]').click()
    assert page.locator("[data-play-solo]:visible").count() == 10
    assert page.locator("[data-create-game]:visible").count() == 0
    page.locator('[data-filter="all"]').click()


def check_search(page):
    search = page.locator("#game-search")
    search.fill("vEcToR")
    assert page.locator("[data-game-card]:visible").count() == 1
    assert page.locator('[data-game-card="vector-arena"]').is_visible()
    search.fill("falling")
    assert page.locator("[data-game-card]:visible").count() == 1
    assert page.locator('[data-game-card="prism-shift"]').is_visible()
    page.locator('[data-filter="friends"]').click()
    assert page.locator("[data-game-card]:visible").count() == 0
    assert page.locator("#shelf-empty").is_visible()
    page.locator('[data-filter="solo"]').click()
    assert page.locator('[data-game-card="prism-shift"]').is_visible()
    search.fill("driving")
    assert page.locator("[data-game-card]:visible").count() == 3
    page.locator('[data-filter="action"]').click()
    assert page.locator("[data-game-card]:visible").count() == 0
    search.fill("not-a-game-qa")
    assert page.locator("#shelf-empty").is_visible()
    search.focus()
    page.keyboard.press("ControlOrMeta+a")
    page.keyboard.press("Backspace")
    assert page.locator("[data-game-card]:visible").count() == 7
    assert page.locator("#shelf-empty").is_hidden()
    page.locator('[data-filter="all"]').click()
    assert page.locator("[data-game-card]:visible").count() == 19


CANVAS_PAINT = """() => [...document.querySelectorAll('.game-art canvas')]
  .filter(canvas => canvas.getBoundingClientRect().width > 0 && canvas.getBoundingClientRect().height > 0)
  .map(canvas => {
    if (!canvas.width || !canvas.height) return {id:canvas.id,opaque:0,colors:0};
    const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    const colors=new Set(); let opaque=0, samples=0;
    for(let row=0;row<16;row++) for(let column=0;column<16;column++) {
      const x=Math.min(canvas.width-1,Math.floor((column+.5)*canvas.width/16));
      const y=Math.min(canvas.height-1,Math.floor((row+.5)*canvas.height/16));
      const offset=(y*canvas.width+x)*4;
      if(pixels[offset+3]>0) opaque++;
      colors.add(`${pixels[offset]},${pixels[offset+1]},${pixels[offset+2]},${pixels[offset+3]}`);
      samples++;
    }
    return {id:canvas.id,width:canvas.width,height:canvas.height,opaque:opaque/samples,colors:colors.size};
  })"""


def painted_previews(page, expected):
    # ResizeObserver callbacks clear the old canvas after layout. Wait through
    # their redraw frames so stale pixels cannot satisfy a show/resize check.
    page.wait_for_timeout(120)
    page.wait_for_function(f"() => {{const paint=({CANVAS_PAINT})(); return paint.length==={expected} && paint.every(canvas=>canvas.opaque>.9 && canvas.colors>=4);}}", timeout=3000)
    return page.evaluate(CANVAS_PAINT)


def check_previews(page):
    """Showing a shelf card must repaint a canvas cleared by its resize observer."""
    assert len(painted_previews(page, 4)) == 4
    page.locator('[data-filter="solo"]').click()
    painted_previews(page, 0)
    page.locator('[data-filter="all"]').click()
    painted_previews(page, 4)
    page.locator('[data-filter="action"]').click()
    painted_previews(page, 3)
    page.locator('[data-filter="friends"]').click()
    painted_previews(page, 4)
    page.locator('[data-filter="all"]').click()
    search=page.locator("#game-search")
    search.fill("vector")
    painted_previews(page, 0)
    search.fill("relic")
    assert painted_previews(page, 1)[0]["id"] == "preview-duel"
    search.fill("afterimage")
    assert painted_previews(page, 1)[0]["id"] == "preview-afterimage"
    search.fill("")
    painted_previews(page, 4)
    for width,height in ((390,844),(320,844),(1440,1000)):
        page.set_viewport_size({"width":width,"height":height})
        no_overflow(page)
        painted_previews(page, 4)
        page.locator('[data-filter="solo"]').click()
        painted_previews(page, 0)
        page.locator('[data-filter="all"]').click()
        painted_previews(page, 4)
    print("  Shelf previews: opaque, varied pixels survive physical filter/search hide-show and desktop/390/320px resizing", flush=True)


def native_help(page, game):
    disclosure = page.locator("#solo-how-to")
    assert disclosure.get_attribute("open") is None, "Long help should begin collapsed"
    summary = disclosure.locator("summary")
    before = state(page)
    summary.focus()
    page.keyboard.press("Space", delay=40)
    assert disclosure.get_attribute("open") is not None, "Space did not activate native help"
    assert page.locator("#solo-rules").is_visible()
    page.keyboard.press("Enter", delay=40)
    assert disclosure.get_attribute("open") is None, "Enter did not close native help"
    after = state(page)
    if game == "prism-shift":
        assert after["piecesLocked"] == before["piecesLocked"], "Opening help also hard-dropped a piece"
    else:
        assert after["player"]["stamina"] >= before["player"]["stamina"] - .01, "Opening help also dashed"
        assert after["player"]["dashTime"] == 0 and after["player"]["heat"] <= before["player"]["heat"], "Native help leaked combat input"
    page.locator("[data-solo-focus]").focus()


def desktop_play_layout(page, game):
    no_overflow(page)
    assert page.evaluate("matchMedia('(pointer:fine)').matches"), "Desktop QA must use a fine pointer"
    controls = ".prism-controls" if game == "prism-shift" else ".rift-controls"
    assert page.locator(controls).is_hidden(), "Touch hardware crowds the desktop playfield"
    canvas = page.locator(".prism-canvas" if game == "prism-shift" else ".rift-canvas").bounding_box()
    assert canvas and canvas["y"] + canvas["height"] <= 1000, f"Desktop playfield extends below the first screen: {canvas}"
    for action in ("#solo-pause", "#solo-restart"):
        button = page.locator(action).bounding_box()
        assert button and button["y"] < canvas["y"] and button["height"] >= 36, "Session controls should be usable above the board"


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
    else:
        standard_profile(page, game)
    page.locator("#solo-restart").click()
    phase(page, "playing")


def touch_hold(page, context, selector, milliseconds=350, offset=(0, 0), cancel=True, solo=True):
    target = page.locator(selector)
    target.scroll_into_view_if_needed()
    box = target.bounding_box()
    assert box, selector
    assert box["height"] >= 44 and box["width"] >= 44, f"Touch target is too small: {selector}: {box}"
    touch = {"x": box["x"] + box["width"] * (.5 + offset[0]), "y": box["y"] + box["height"] * (.5 + offset[1]), "id": 1}
    session = context.new_cdp_session(page)
    try:
        session.send("Emulation.setTouchEmulationEnabled", {"enabled": True, "maxTouchPoints": 5})
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
        session.send("Emulation.setTouchEmulationEnabled", {"enabled": False})
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
    page.set_viewport_size({"width": 320, "height": 844})
    before, held, released = touch_hold(page, context, '.prism-control[data-action="right"]')
    assert held["active"]["x"] > before["active"]["x"]
    assert released["active"]["x"] == held["active"]["x"]
    page.set_viewport_size({"width": 1440, "height": 1000})
    page.locator('[data-mode="marathon"]').click()
    assert record(page, "prism-shift", "marathon") == best
    page.reload()
    page.wait_for_function("window.firesideSolo?.gameId === 'prism-shift'")
    standard_profile(page, 'prism-shift')
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
    page.set_viewport_size({"width": 320, "height": 844})
    before, held, released = touch_hold(page, context, '[data-stick="move"]', offset=(-.3, 0))
    assert held["player"]["x"] < before["player"]["x"] - 20
    page.wait_for_timeout(180)
    assert abs(state(page)["player"]["x"] - released["player"]["x"]) < 1
    page.set_viewport_size({"width": 1440, "height": 1000})
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
    standard_profile(page, 'rift-survivor')
    assert record(page, "rift-survivor") >= best
    print("  Rift Survivor: physical aiming/kills and first wave upgrade, next wave, dash/heat/cooling, playing/upgrade pause, native blur, twin touchpads/buttons, natural defeat and persistent score", flush=True)


def vector(browser, url):
    contexts = [browser.new_context(viewport={"width": 1440, "height": 1000}, has_touch=False) for _ in range(2)]
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
        # Round 2's central relay deliberately blocks the old center-lane shot.
        # Use actual movement to cross the safe upper flank, then alternate
        # winners so the physical match also visits the third arena.
        keyboards = [keyboard, Keyboard(second)]
        routes = {
            1: [],
            2: [(806, 70), (100, 70), (100, 320)],
            3: [(100, 410), (100, 70), (880, 70), (880, 230)],
        }
        visited, captured, waypoint, last_round = set(), set(), 0, 0
        deadline = time.monotonic() + 45
        while time.monotonic() < deadline:
            current = state(first, False)
            if current["phase"] == "matchEnd":
                break
            if current["phase"] != "fight":
                for controls in keyboards:
                    controls.release()
                first.wait_for_timeout(40)
                continue
            round_number = current["round"]
            if round_number != last_round:
                for controls in keyboards:
                    controls.release()
                waypoint, last_round = 0, round_number
                [first, second][1 if round_number == 2 else 0].locator("#arena").focus()
            visited.add(current["stageId"])
            for page in (first, second):
                assert current["stageName"].upper() in page.locator("#stage-label").inner_text()
            shooter_id = 1 if round_number == 2 else 0
            page, controls = [first, second][shooter_id], keyboards[shooter_id]
            fighter, target = current["fighters"][shooter_id], current["fighters"][1 - shooter_id]
            desired = set()
            route = routes[round_number]
            if waypoint < len(route):
                x, y = route[waypoint]
                if abs(x - fighter["x"]) > 10:
                    desired.add("d" if fighter["x"] < x else "a")
                elif abs(y - fighter["y"]) > 10:
                    desired.add("s" if fighter["y"] < y else "w")
                else:
                    waypoint += 1
            else:
                if current["stageId"] not in captured:
                    screenshot(first, f"fireside-vector-{current['stageId']}.png")
                    captured.add(current["stageId"])
                aim_at(page, "#arena", target["x"], target["y"], 960, 640)
                desired = {"i", "j"}
            controls.set(desired)
            first.wait_for_timeout(20)
        for controls in keyboards:
            controls.release()
        phase(first, "matchEnd", False, timeout=1500)
        phase(second, "matchEnd", False)
        assert visited == {"garden", "relay", "vault"}, visited
        assert captured == visited, captured
        assert state(first, False)["winner"] == 0
        assert [f["wins"] for f in state(first, False)["fighters"]] == [2, 1]
        assert [f["wins"] for f in state(second, False)["fighters"]] == [2, 1]
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
        first.set_viewport_size({"width": 320, "height": 844})
        before, held, released = touch_hold(first, contexts[0], '[data-vector-action="focus"]', solo=False)
        assert held["fighters"][0]["previousInput"]["focus"]
        assert not released["fighters"][0]["previousInput"]["focus"]
        second.close()
        phase(first, "lobby", False)
        assert all(f["hp"] == 100 and f["wins"] == 0 for f in state(first, False)["fighters"])
        print("PASS vector-arena: real two-context room/code join, ready cancellation, movement/dash, synchronized shooting/reload, all 3 arena names/backgrounds, cover flanks and first-to-two match, both-agree rematch, touch pads/fire cancellation, disconnect reset and 390/320px layouts", flush=True)
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
                context = browser.new_context(viewport={"width": 1440, "height": 1000}, has_touch=False)
                context.add_init_script("window.addEventListener('pageshow', event => {window.__qaPageShowPersisted = event.persisted;});")
                page = context.new_page()
                watch(page, game, solo=True)
                try:
                    page.goto(url)
                    page.wait_for_function("document.querySelector('#host-status').textContent === 'Host is online'")
                    check_catalog(page)
                    check_search(page)
                    check_previews(page)
                    if game == "prism-shift":
                        screenshot(page, "fireside-skill-hub.png", full_page=False)
                        screenshot(page, "fireside-skill-hub-full.png")
                        mobile_layout(page, "skill-hub")
                    page.locator(f'[data-play-solo="{game}"]').click()
                    page.wait_for_url(f"**/solo.html?game={game}")
                    page.wait_for_function("game => window.firesideSolo?.gameId === game", arg=game)
                    standard_profile(page, game)
                    phase(page, "playing")
                    native_help(page, game)
                    desktop_play_layout(page, game)
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
