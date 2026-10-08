"""Optional real-browser QA: pip install playwright; python test/browser-smoke.py [URL].

Run against an otherwise empty game server. Uses desktop Chromium, keyboard input,
and read-only browser state inspection. The game's two player slots are occupied
for the duration of the test. No server state is modified to force outcomes.
"""
import json
import os
import sys
import time
from playwright.sync_api import sync_playwright
from browser_controls import controls_panel

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3000/afterimage.html"
errors = []
console_errors = []
failed_resources = []


def state(page):
    return page.evaluate("window.afterimage.getState()")


def wait_phase(page, phase, timeout=10000):
    page.wait_for_function("phase => window.afterimage?.getState().phase === phase", arg=phase, timeout=timeout)


def listen(page, name):
    page.on("pageerror", lambda error: errors.append(f"{name}: {error}"))
    page.on("console", lambda message: console_errors.append(f"{name}: {message.text}") if message.type == "error" else None)
    page.on("response", lambda response: failed_resources.append(f"{name}: {response.status} {response.url}") if response.status >= 400 else None)


def approach(page):
    current = state(page)
    own, rival = current["fighters"]
    if abs(rival["x"] - own["x"]) <= 76:
        return
    key = "d" if rival["x"] > own["x"] else "a"
    page.keyboard.down(key)
    try:
        page.wait_for_function("Math.abs(window.afterimage.getState().fighters[1].x - window.afterimage.getState().fighters[0].x) < 76 || window.afterimage.getState().phase !== 'fight'", timeout=6000)
    finally:
        page.keyboard.up(key)
    page.wait_for_timeout(80)


with sync_playwright() as playwright:
    launch = {"headless": True, "args": ["--no-sandbox", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"]}
    if os.path.exists("/usr/bin/chromium"):
        launch["executable_path"] = "/usr/bin/chromium"
    browser = playwright.chromium.launch(**launch)
    contexts = []
    try:
        for number in range(3):
            context = browser.new_context(viewport={"width": 1440, "height": 1100})
            contexts.append(context)
        first = contexts[0].new_page()
        second = contexts[1].new_page()
        third = contexts[2].new_page()
        for page, name in [(first, "P1"), (second, "P2"), (third, "third")]:
            listen(page, name)
        first.goto(URL)
        first.wait_for_function("window.afterimage?.connected && window.afterimage.playerId === 0")
        second.goto(URL)
        second.wait_for_function("window.afterimage?.connected && window.afterimage.playerId === 1")
        for page, name in [(first, "Mina QA"), (second, "Rook QA")]:
            with controls_panel(page, '#player-name', resume=False):
                page.locator("#player-name").fill(name)
                page.locator("#player-name").press("Enter")
        first.wait_for_function("document.querySelector('#p2-name').textContent === 'ROOK QA'")
        second.wait_for_function("document.querySelector('#p1-name').textContent === 'MINA QA'")
        print("PASS two independent contexts connect, reserve distinct slots, and sync names", flush=True)

        first.locator("#ready-button").click()
        first.wait_for_function("document.querySelector('#ready-button span').textContent === 'Cancel ready'")
        assert state(first)["phase"] == "lobby"
        second.locator("#ready-button").click()
        wait_phase(first, "countdown")
        first.locator("#ready-button").click()
        wait_phase(first, "lobby")
        first.wait_for_function("document.querySelector('#ready-button span').textContent === 'Ready up'")
        print("PASS both-ready starts countdown; cancelling readiness returns the lobby", flush=True)

        third.goto(URL)
        third.wait_for_function("document.querySelector('#connection-status').textContent === 'ROOM FULL'")
        assert third.locator("#ready-button").is_disabled()
        assert "two players" in third.locator("#error-banner").inner_text().lower()
        third.locator("#practice-button").click()
        third.wait_for_function("window.afterimage.practice")
        wait_phase(third, "fight")
        before_practice = state(third)["fighters"][0]["x"]
        third.keyboard.down("d")
        third.wait_for_timeout(250)
        third.keyboard.up("d")
        assert state(third)["fighters"][0]["x"] > before_practice
        third.locator("#practice-button").click()
        third.wait_for_function("!window.afterimage.practice")
        assert third.locator("#mode-tag").inner_text() == "PRIVATE 1V1"
        third.close()
        print("PASS third player rejected; local practice works and exits cleanly", flush=True)

        first.locator("#ready-button").click()
        second.locator("#ready-button").click()
        wait_phase(first, "fight")
        wait_phase(second, "fight")
        first.wait_for_function("document.querySelector('#ready-button').disabled && document.querySelector('#practice-button').disabled")
        assert first.locator("#ready-button").is_disabled()
        assert first.locator("#practice-button").is_disabled()
        start_x = state(first)["fighters"][0]["x"]
        first.locator("#arena").click()
        approach(first)
        assert state(first)["fighters"][0]["x"] > start_x + 100
        hp = state(first)["fighters"][1]["hp"]
        first.keyboard.press("j", delay=35)
        first.wait_for_function("hp => window.afterimage.getState().fighters[1].hp < hp", arg=hp, timeout=2500)
        second.wait_for_function("hp => window.afterimage.getState().fighters[1].hp < hp", arg=hp, timeout=2500)
        print("PASS keyboard movement and light attack produce authoritative health loss in both browsers", flush=True)

        # Finish two rounds with real movement and fresh heavy keypresses.
        deadline = time.monotonic() + 55
        heavy_hits = 0
        while state(first)["phase"] != "matchEnd":
            assert time.monotonic() < deadline, "Timed out completing the match with real inputs"
            current = state(first)
            if current["phase"] != "fight":
                first.wait_for_timeout(150)
                continue
            first.wait_for_function("window.afterimage.getState().fighters[0].action !== 'light' && window.afterimage.getState().fighters[0].action !== 'heavy'", timeout=2500)
            approach(first)
            hp = state(first)["fighters"][1]["hp"]
            first.keyboard.press("k", delay=35)
            first.wait_for_function("hp => window.afterimage.getState().fighters[1].hp < hp || window.afterimage.getState().phase !== 'fight'", arg=hp, timeout=2500)
            heavy_hits += 1
            first.wait_for_timeout(450)
        final = state(first)
        assert final["winner"] == 0
        assert final["fighters"][0]["wins"] == 2
        wait_phase(second, "matchEnd")
        print(f"PASS real heavy attacks ({heavy_hits} hits), automatic rounds, and first-to-two match completion", flush=True)

        first.locator("#ready-button").click()
        wait_phase(first, "lobby")
        assert state(first)["phase"] == "lobby"
        second.locator("#ready-button").click()
        wait_phase(first, "countdown")
        assert [fighter["wins"] for fighter in state(first)["fighters"]] == [0, 0]
        print("PASS rematch waits for both players and clears previous wins", flush=True)
        first.locator("#ready-button").click()
        wait_phase(first, "lobby")
        second.close()
        first.wait_for_function("document.querySelector('#slot2-status').textContent.includes('Waiting')")
        print("PASS disconnect returns the remaining player to an unready lobby", flush=True)
        assert not errors, f"Browser exceptions: {errors}"
        assert not console_errors, f"Console errors: {console_errors}; failed resources: {failed_resources}"
        print(json.dumps({"browser_exceptions": errors, "console_errors": console_errors}), flush=True)
    finally:
        for context in contexts:
            context.close()
        browser.close()
