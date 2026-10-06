"""Challenge-default integration QA using rendered controls and read-only state.

python test/difficulty-browser-smoke.py [URL]
Requires Python Playwright and Chromium. With no URL, runs an isolated host.
FIRESIDE_SCREENSHOT_DIR selects the desktop/mobile screenshot destination.
Engine tests cover balance and legal solutions; this checks that the actual
hub launches those rules, keeps difficulty records separate, and supports
native selection, pause, restart and small-screen controls.
"""
import json
import os
from pathlib import Path
import subprocess
import sys

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOTS = Path(os.environ.get("FIRESIDE_SCREENSHOT_DIR", ROOT / "test-results" / "difficulty"))
CASES = [
    ("paris-pedal", "difficulty", "veteran", "standard-survival-v1"),
    ("ember-delve", "difficulty", "veteran", "default"),
    ("night-drive", "difficulty", "veteran", "default"),
    ("deckbound", "difficulty", "veteran", "default"),
    ("rift-survivor", "difficulty", "veteran", "veteran"),
    ("apex-circuit", "difficulty", "veteran", "three-laps"),
    ("prism-shift", "profile", "veteran", "marathon"),
    ("snake", "mode", "gauntlet", "gardens"),
    ("2048", "mode", "master", "puzzles"),
    ("minesweeper", "difficulty", "expert", "beginner"),
]


def state(page):
    return page.evaluate("window.firesideSolo.getState()")


def press_button(page, selector):
    button = page.locator(selector)
    assert button.is_visible() and button.is_enabled(), selector
    button.focus()
    page.keyboard.press("Space", delay=20)


def tier(page, value, field="difficulty"):
    select = page.locator("#solo-game select").filter(has=page.locator('option[value="standard"]'))
    if select.count():
        select.first.click()
        page.keyboard.press("Home")
        for _ in range(["standard", "veteran", "nightmare"].index(value)):
            page.keyboard.press("ArrowDown")
        page.keyboard.press("Enter")
    else:
        press_button(page, f'#solo-game [data-{field}="{value}"]')
    page.wait_for_function("([field, value]) => window.firesideSolo.getState()[field] === value", arg=[field, value])


def pause_if_running(page):
    if state(page)["phase"] not in ("paused", "won", "lost"):
        press_button(page, "#solo-pause")
    assert state(page)["phase"] == "paused"


def run(url):
    SHOTS.mkdir(parents=True, exist_ok=True)
    errors, resources, mutations, sockets, results = [], [], [], [], []
    with sync_playwright() as playwright:
        options = {"headless": True, "args": ["--no-sandbox"]}
        if Path("/usr/bin/chromium").exists():
            options["executable_path"] = "/usr/bin/chromium"
        browser = playwright.chromium.launch(**options)
        try:
            for game, field, default, legacy in CASES:
                context = browser.new_context(viewport={"width": 1440, "height": 1000})
                # Populate only easier historical records before the game mounts.
                context.add_init_script(f"try {{ localStorage.setItem({json.dumps('fireside-solo-best:' + game + ':' + legacy)}, '999999'); }} catch {{}}")
                page = context.new_page()
                page.on("pageerror", lambda error, game=game: errors.append(f"{game}: {error}"))
                page.on("console", lambda msg, game=game: errors.append(f"{game}: {msg.text}") if msg.type == "error" else None)
                page.on("response", lambda response: resources.append(f"{response.status} {response.url}") if response.status >= 400 else None)
                page.on("request", lambda request: mutations.append(request.url) if "/api/rooms" in request.url and request.method != "GET" else None)
                page.on("websocket", lambda socket: sockets.append(socket.url))
                try:
                    page.goto(url + "/")
                    page.locator('[data-filter="solo"]').click()
                    page.locator(f'[data-play-solo="{game}"]').click()
                    page.wait_for_function("game => window.firesideSolo?.gameId === game", arg=game)
                    initial = state(page)
                    assert initial[field] == default, (game, initial)
                    pause_if_running(page)
                    if game == "paris-pedal":
                        assert initial["mode"] == "survival" and initial["timeLeft"] is None
                        assert page.locator("#solo-record").inner_text() == "—", "An easier survival time leaked into Veteran"
                    assert "999999" not in page.locator("#solo-record").inner_text(), f"{game}: easier best leaked into challenge"
                    before = state(page)
                    page.wait_for_timeout(250)
                    assert state(page) == before, f"{game}: paused challenge advanced"
                    page.locator("#solo-how-to summary").focus()
                    page.keyboard.press("Space", delay=20)
                    assert page.locator("#solo-how-to").evaluate("node => node.open")
                    assert state(page) == before, f"{game}: native help leaked gameplay input"
                    page.keyboard.press("Enter", delay=20)
                    for width, height in [(1440, 1000), (1366, 768), (390, 900), (320, 900)]:
                        page.set_viewport_size({"width": width, "height": height})
                        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), (game, width, "overflow")
                        if width >= 951 and game in ["ember-delve", "night-drive", "rift-survivor", "apex-circuit", "prism-shift", "paris-pedal"]:
                            page.wait_for_function("height => { const r=document.querySelector('#solo-game canvas[tabindex]').getBoundingClientRect(); return r.bottom<=height; }", arg=height, timeout=3000)
                            canvas = page.locator("#solo-game canvas[tabindex]").first.bounding_box()
                            assert canvas and canvas["y"] + canvas["height"] <= height, (game, "playfield extends below the first screen", canvas)
                            if game in ["night-drive", "apex-circuit", "paris-pedal"]:
                                assert canvas["width"] >= 300, (game, "driving scene too small to read", canvas)
                        page.screenshot(path=str(SHOTS / f"{game}-{width}.png"), full_page=True, animations="disabled")
                    page.set_viewport_size({"width": 1440, "height": 1000})
                    if state(page)["phase"] == "paused":
                        press_button(page, "#solo-pause")
                    if field in ("difficulty", "profile") and default == "veteran":
                        for difficulty in ["nightmare", "standard", "veteran"]:
                            if state(page)["phase"] == "paused":
                                press_button(page, "#solo-pause")
                            tier(page, difficulty, field)
                            press_button(page, "#solo-restart")
                            assert state(page)[field] == difficulty, f"{game}: restart lost difficulty"
                            pause_if_running(page)
                    elif field == "mode":
                        press_button(page, '#solo-game [data-mode="classic"]')
                        assert state(page)[field] == "classic"
                        press_button(page, f'#solo-game [data-mode="{default}"]')
                        assert state(page)[field] == default
                        pause_if_running(page)
                    else:
                        select = page.locator(".minesweeper-difficulty")
                        select.click()
                        page.keyboard.press("Home")
                        page.keyboard.press("Enter")
                        assert state(page)[field] == "beginner"
                        select.click()
                        page.keyboard.press("End")
                        page.keyboard.press("Enter")
                        assert state(page)[field] == "expert"
                        pause_if_running(page)
                    # Fresh navigation must launch challenge defaults again.
                    page.reload()
                    page.wait_for_function("game => window.firesideSolo?.gameId === game", arg=game)
                    assert state(page)[field] == default
                    pause_if_running(page)
                    if game == "paris-pedal":
                        assert state(page)["mode"] == "survival"
                        assert page.locator("#solo-record").inner_text() == "—"
                    assert "999999" not in page.locator("#solo-record").inner_text()
                    results.append({"game": game, "default": default, "selection_restart_pause_layout": "passed"})
                    print(f"PASS {game}: challenge hub launch, records, native selection, restart, pause, desktop/laptop/390/320px", flush=True)
                finally:
                    context.close()
            assert not errors, errors
            assert not resources, resources
            assert not mutations, mutations
            assert not sockets, sockets
            print(json.dumps({"games": results, "errors": errors, "failed_resources": resources, "room_mutations": mutations, "sockets": sockets, "screenshots": str(SHOTS)}), flush=True)
        finally:
            browser.close()


def main():
    if len(sys.argv) > 1:
        run(sys.argv[1].rstrip("/"))
        return
    source = "import { createServer } from './server.js'; const server = createServer(); const address = await server.listen(0, '127.0.0.1'); console.log(JSON.stringify({port: address.port})); process.on('SIGTERM', async () => { await server.close(); process.exit(0); });"
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
