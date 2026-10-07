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
    ("paris-pedal", "difficulty", "veteran", "standard-survival-v1", "veteran-survival-v3", "5:21.00"),
    ("ember-delve", "difficulty", "veteran", "default", "veteran-v3", "321"),
    ("night-drive", "difficulty", "veteran", "default", "veteran-default-v3", "321"),
    ("deckbound", "difficulty", "veteran", "default", "veteran-v3", "321"),
    ("rift-survivor", "difficulty", "veteran", "veteran", "veteran-v3", "321"),
    ("apex-circuit", "difficulty", "veteran", "three-laps", "veteran-three-laps-v3", "321.00s"),
    ("prism-shift", "profile", "veteran", "marathon", "veteran-marathon-v3", "321"),
    ("snake", "mode", "gauntlet", "gardens", "gauntlet-v3", "321"),
    ("2048", "mode", "master", "puzzles", "master-v3", "321"),
    ("minesweeper", "difficulty", "master", "beginner", "master-v3", "321s"),
]


def assert_known_record(page, game, scope, rendered=None):
    # A missing policy can silently fall back to a different empty record and
    # still pass a leakage check. Certify eligibility as well as the actual
    # view's seeded readout, which proves it emits this recognized scope.
    details = page.evaluate("""async ([game, scope]) => {
        const {recordDetails} = await import('/solo/solo.js');
        return recordDetails(game, {recordKey:scope, record:4242, score:4242,
          phase:game==='paris-pedal'?'lost':'won',
          result:game==='paris-pedal'?'crashed':game==='2048'?'tour':null});
    }""", [game, scope])
    assert details["scope"] == scope and details["candidate"] == 4242, (game, "unrecognized record scope", details)
    if rendered is not None:
        assert page.locator("#solo-record").inner_text() == rendered, (game, "view emitted wrong scope", page.locator("#solo-record").inner_text())
    assert page.locator("#solo-status-label").inner_text() == "PAUSED", (game, "unrecognized paused status")


def select_native(page, selector, value):
    select = page.locator(selector)
    values = select.locator("option").evaluate_all("options => options.map(option => option.value)")
    assert value in values, (selector, value, values)
    select.click()
    page.keyboard.press("Home")
    for _ in range(values.index(value)):
        page.keyboard.press("ArrowDown")
    page.keyboard.press("Enter")



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
                historical = {legacy, scope.removesuffix("-v3")}
                practice_scope = "default" if game in ("rift-survivor", "snake", "2048") else legacy
                historical.add(practice_scope)
                if game == "paris-pedal": historical.add("veteran-survival-v1")
                if game == "rift-survivor": historical.add("veteran-v2")
                if game == "minesweeper": historical.add("expert")
                record_value = 321000 if game == "paris-pedal" else 321
                initial_records = {f"fireside-solo-best:{game}:{key}": 999999 for key in historical}
                initial_records[f"fireside-solo-best:{game}:{scope}"] = record_value
                if default == "veteran":
                    initial_records[f"fireside-solo-best:{game}:{scope.replace('veteran', 'nightmare', 1)}"] = record_value
                if game == "minesweeper": initial_records[f"fireside-solo-best:{game}:intermediate"] = record_value
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
                    page.wait_for_function("game => window.firesideSolo?.gameId === game", arg=game)
                    initial = state(page)
                    assert initial[field] == default, (game, initial)
                    pause_if_running(page)
                    if game == "paris-pedal":
                        assert initial["mode"] == "survival" and initial["timeLeft"] is None
                        assert page.locator("#solo-record").inner_text() == rendered_best, "An easier survival time leaked into Veteran"
                    assert "999999" not in page.locator("#solo-record").inner_text(), f"{game}: easier best leaked into challenge"
                    assert_known_record(page, game, scope, rendered_best)
                    if game == "minesweeper":
                        assert initial["rows"] == 16 and initial["cols"] == 24 and initial["mines"] == 90
                        assert initial["logicOnly"] and initial["timeLimit"] == 360
                        assert page.locator(".minesweeper-clock").inner_text() == "6:00"
                    if game == "2048":
                        assert initial["rewindsLeft"] == 2 and initial["retriesLeft"] == 2
                        assert "17" in page.locator(".tiles-2048-budget").inner_text()
                    if game == "snake":
                        assert len(initial["snake"]) == 8 and initial["fruitMoves"] >= 64
                        assert "168 fruit" in page.locator(".snake-hint").inner_text()
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
                            selected_scope = practice_scope if difficulty == "standard" else scope.replace("veteran", difficulty, 1)
                            selected_display = rendered_best if difficulty != "standard" else ("16:39.99" if game == "paris-pedal" else "999999.00s" if game == "apex-circuit" else "999999")
                            assert_known_record(page, game, selected_scope, selected_display)
                    elif field == "mode":
                        press_button(page, '#solo-game [data-mode="classic"]')
                        assert state(page)[field] == "classic"
                        pause_if_running(page)
                        assert_known_record(page, game, "default", "999999")
                        press_button(page, f'#solo-game [data-mode="{default}"]')
                        assert state(page)[field] == default
                        pause_if_running(page)
                    else:
                        for difficulty in ["beginner", "intermediate", "expert", "master"]:
                            select_native(page, ".minesweeper-difficulty", difficulty)
                            assert state(page)[field] == difficulty
                            press_button(page, "#solo-restart")
                            assert state(page)[field] == difficulty, "Mines restart lost selected mode"
                            pause_if_running(page)
                            selected_scope = "master-v3" if difficulty == "master" else difficulty
                            selected_display = "999999s" if difficulty in ("beginner", "expert") else "321s"
                            assert_known_record(page, game, selected_scope, selected_display)
                    # Fresh navigation must launch challenge defaults again.
                    page.reload()
                    page.wait_for_function("game => window.firesideSolo?.gameId === game", arg=game)
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
