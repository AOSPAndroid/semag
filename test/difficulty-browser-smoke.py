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
import re
from pathlib import Path
import subprocess
import sys

from playwright.sync_api import sync_playwright
from browser_controls import controls_panel
from browser_profiles import start_solo

ROOT = Path(__file__).resolve().parents[1]
SHOTS = Path(os.environ.get("FIRESIDE_SCREENSHOT_DIR", ROOT / "test-results" / "difficulty"))
CASES = [
    ("paris-pedal", "difficulty", "veteran", "standard-survival-v1", "veteran-survival-v3", "5:21.00"),
    ("ember-delve", "difficulty", "veteran", "default", "veteran-v3", "321"),
    ("night-drive", "difficulty", "veteran", "default", "veteran-default-v4", "321"),
    ("deckbound", "difficulty", "veteran", "default", "veteran-v3", "321"),
    ("rift-survivor", "difficulty", "veteran", "veteran", "veteran-v4", "321"),
    ("prism-shift", "profile", "veteran", "marathon", "veteran-marathon-v3", "321"),
]


def assert_known_record(page, game, scope, rendered=None):
    # A missing policy can silently fall back to a different empty record and
    # still pass a leakage check. Certify eligibility as well as the actual
    # view's seeded readout, which proves it emits this recognized scope.
    details = page.evaluate("""async ([game, scope]) => {
        const {recordDetails} = await import('/solo/solo.js');
        return recordDetails(game, {recordKey:scope, record:4242, score:4242,
          phase:game==='paris-pedal'?'lost':'won',
          result:game==='paris-pedal'?'crashed':null});
    }""", [game, scope])
    assert details["scope"] == scope and details["candidate"] == 4242, (game, "unrecognized record scope", details)
    if rendered is not None:
        assert page.locator("#solo-record").inner_text() == rendered, (game, "view emitted wrong scope", page.locator("#solo-record").inner_text())
    assert page.locator("#solo-status-label").inner_text() == "PAUSED", (game, "unrecognized paused status")


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
            for game, field, default, legacy, scope, rendered_best in CASES:
                context = browser.new_context(viewport={"width": 1440, "height": 1000})
                # Preserve easier/older records and seed the expected new scope
                # to prove the actual view reads the recognized current policy.
                historical = {legacy, re.sub(r"-v\d+$", "", scope)}
                practice_scope = "default" if game == "rift-survivor" else legacy
                historical.add(practice_scope)
                if game == "paris-pedal": historical.add("veteran-survival-v1")
                if game == "rift-survivor": historical.add("veteran-v2")
                if game == "rift-survivor": historical.add("veteran-v3")
                if game == "night-drive": historical.add("veteran-default-v3")
                record_value = 321000 if game == "paris-pedal" else 321
                initial_records = {f"fireside-solo-best:{game}:{key}": 999999 for key in historical}
                initial_records[f"fireside-solo-best:{game}:{scope}"] = record_value
                if default == "veteran":
                    initial_records[f"fireside-solo-best:{game}:{scope.replace('veteran', 'nightmare', 1)}"] = record_value
                context.add_init_script("try { for (const [key,value] of Object.entries(" + json.dumps(initial_records) + ")) localStorage.setItem(key, JSON.stringify(value)); } catch {}")
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
                    start_solo(page, game)
                    initial = state(page)
                    assert initial[field] == default, (game, initial)
                    pause_if_running(page)
                    if game == "paris-pedal":
                        assert initial["mode"] == "survival" and initial["timeLeft"] is None
                        assert page.locator("#solo-record").inner_text() == rendered_best, "An easier survival time leaked into Veteran"
                    assert "999999" not in page.locator("#solo-record").inner_text(), f"{game}: easier best leaked into challenge"
                    assert_known_record(page, game, scope, rendered_best)
                    before = state(page)
                    page.wait_for_timeout(250)
                    assert state(page) == before, f"{game}: paused challenge advanced"
                    with controls_panel(page, '#solo-how-to', resume=False):
                        page.locator("#solo-how-to summary").focus()
                        page.keyboard.press("Space", delay=20)
                        assert page.locator("#solo-how-to").evaluate("node => node.open")
                        assert state(page) == before, f"{game}: native help leaked gameplay input"
                        page.keyboard.press("Enter", delay=20)
                    for width, height in [(1440, 1000), (1366, 768), (390, 900), (320, 900)]:
                        page.set_viewport_size({"width": width, "height": height})
                        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), (game, width, "overflow")
                        if width >= 951 and game in ["ember-delve", "night-drive", "rift-survivor", "prism-shift", "paris-pedal"]:
                            page.wait_for_function("height => { const r=document.querySelector('#solo-game canvas[tabindex]').getBoundingClientRect(); return r.bottom<=height; }", arg=height, timeout=3000)
                            canvas = page.locator("#solo-game canvas[tabindex]").first.bounding_box()
                            assert canvas and canvas["y"] + canvas["height"] <= height, (game, "playfield extends below the first screen", canvas)
                            if game in ["night-drive", "paris-pedal"]:
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
                            selected_scope = practice_scope if difficulty == "standard" else scope.replace("veteran", difficulty, 1)
                            selected_display = rendered_best if difficulty != "standard" else ("16:39.99" if game == "paris-pedal" else "999999")
                            assert_known_record(page, game, selected_scope, selected_display)
                    # A fresh ready screen starts challenge defaults on explicit Start.
                    page.reload()
                    start_solo(page, game)
                    assert state(page)[field] == default
                    pause_if_running(page)
                    if game == "paris-pedal":
                        assert state(page)["mode"] == "survival"
                        assert page.locator("#solo-record").inner_text() == rendered_best
                    assert "999999" not in page.locator("#solo-record").inner_text()
                    assert_known_record(page, game, scope, rendered_best)
                    assert page.evaluate("([game, legacy]) => localStorage.getItem(`fireside-solo-best:${game}:${legacy}`)", [game, legacy]) == "999999"
                    results.append({"game": game, "default": default, "record_scope": scope, "selection_restart_pause_layout": "passed"})
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
