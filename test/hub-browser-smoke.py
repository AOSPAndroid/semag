"""Optional Chromium QA: python test/hub-browser-smoke.py [server URL].

Requires Python Playwright and Chromium (or a Playwright-installed browser).
Creates four real rooms through the hub. Uses only clicks, keyboard controls,
and read-only inspection; no match outcomes or game state are forced.
"""
import json
import math
import os
import sys
import time
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright

URL = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3000").rstrip("/")
SURFACE = "(window.firesideRoom || window.afterimage)"
errors, console_errors, failed_resources = [], [], []


def watch(page, name):
    page.on("pageerror", lambda error: errors.append(f"{name}: {error}"))
    page.on("console", lambda message: console_errors.append(f"{name}: {message.text}") if message.type == "error" else None)
    page.on("response", lambda response: failed_resources.append(f"{name}: {response.status} {response.url}") if response.status >= 400 else None)


def state(page):
    return page.evaluate(f"{SURFACE}.getState()")


def wait_phase(page, phase):
    page.wait_for_function(f"phase => {SURFACE}?.getState().phase === phase", arg=phase, timeout=12000)


def wait_connected(page, seat):
    page.wait_for_function(f"seat => {SURFACE}?.connected && {SURFACE}.playerId === seat", arg=seat, timeout=12000)


def name_in_hub(page, name):
    page.locator("#hub-name").fill(name)
    page.locator("#hub-name").press("Enter")


def approach_duel(page, distance):
    first, second = state(page)["fighters"]
    key = "d" if second["x"] > first["x"] else "a"
    page.locator("#arena").click()
    page.keyboard.down(key)
    try:
        page.wait_for_function(f"distance => Math.abs({SURFACE}.getState().fighters[1].x - {SURFACE}.getState().fighters[0].x) < distance", arg=distance, timeout=6000)
    finally:
        page.keyboard.up(key)
    page.wait_for_timeout(100)


def checkers_move(page, rival):
    page.wait_for_function("!!document.querySelector('.checker-square.is-available')")
    square = page.locator(".checker-square.is-available").first
    source = int(square.get_attribute("data-square"))
    square.click()
    destination = page.locator(".checker-square.is-destination").first
    target = int(destination.get_attribute("data-square"))
    destination.click()
    page.wait_for_function(f"from => !{SURFACE}.getState().board[from]", arg=source)
    rival.wait_for_function(f"from => !{SURFACE}.getState().board[from]", arg=source)
    assert state(page)["board"][target] is not None


def damage_coop_enemy(page):
    before = {enemy["id"]: enemy["hp"] for enemy in state(page)["enemies"]}
    page.locator("#arena").click()
    deadline = time.monotonic() + 9
    while time.monotonic() < deadline:
        current = state(page)
        if any(enemy["hp"] < before.get(enemy["id"], enemy["hp"]) for enemy in current["enemies"]):
            return
        assert current["phase"] == "fight", "The co-op run ended before the combat check"
        hero = current["fighters"][0]
        enemies = [enemy for enemy in current["enemies"] if enemy["hp"] > 0]
        nearest = min(enemies, key=lambda enemy: math.hypot(enemy["x"] - hero["x"], enemy["y"] - hero["y"]))
        dx, dy = nearest["x"] - hero["x"], nearest["y"] - hero["y"]
        held = []
        if abs(dx) > 12:
            held.append("d" if dx > 0 else "a")
        if abs(dy) > 12:
            held.append("s" if dy > 0 else "w")
        for key in held:
            page.keyboard.down(key)
        page.wait_for_timeout(120)
        for key in held:
            page.keyboard.up(key)
        page.keyboard.press("j", delay=45)
        page.wait_for_timeout(340)
    raise AssertionError("Real movement and sword inputs did not damage a co-op enemy")


with sync_playwright() as playwright:
    options = {"headless": True, "args": ["--no-sandbox", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"]}
    if os.path.exists("/usr/bin/chromium"):
        options["executable_path"] = "/usr/bin/chromium"
    browser = playwright.chromium.launch(**options)
    try:
        for game_id in ["checkers", "relic-duel", "dungeon-run", "afterimage"]:
            contexts = [browser.new_context(viewport={"width": 1440, "height": 1100}) for _ in range(3)]
            first, second, observer = [context.new_page() for context in contexts]
            try:
                for page, role in [(first, "P1"), (second, "P2"), (observer, "observer")]:
                    watch(page, f"{game_id}/{role}")
                first.goto(URL)
                first.wait_for_function("document.querySelector('#host-status').textContent === 'Host is online'")
                assert first.locator("[data-create-game]").count() == 10
                name_in_hub(first, "Mina QA")
                first.locator(f'[data-create-game="{game_id}"]').click()
                first.wait_for_url("**/*room=*")
                wait_connected(first, 0)
                code = parse_qs(urlparse(first.url).query)["room"][0]
                second.goto(URL)
                name_in_hub(second, "Rook QA")
                # Exercise pasted invitation parsing once and lowercase codes otherwise.
                invitation = first.url if game_id == "relic-duel" else code.lower()
                second.locator("#room-code").fill(invitation)
                second.locator("#join-button").click()
                second.wait_for_url("**/*room=*")
                wait_connected(second, 1)
                first.wait_for_function("document.querySelector('#p2-name').textContent === 'ROOK QA'")
                second.wait_for_function("document.querySelector('#p1-name').textContent === 'MINA QA'")
                assert parse_qs(urlparse(second.url).query)["room"][0] == code

                observer.goto(URL)
                row = observer.locator(f'[data-room-id="{code}"]')
                row.wait_for()
                assert "2/2 players" in row.inner_text()
                assert row.locator("button").is_disabled()
                if game_id == "checkers":
                    observer.locator("#room-code").fill("ZZZZZZ")
                    observer.locator("#join-button").click()
                    observer.wait_for_function("!document.querySelector('#join-error').hidden")
                    assert "not found" in observer.locator("#join-error").inner_text().lower()
                    observer.goto(first.url)
                    observer.wait_for_function("document.querySelector('#error-banner').textContent.includes('two players')")
                    assert observer.locator("#ready-button").is_disabled()

                first.locator("#ready-button").click()
                first.wait_for_function("document.querySelector('#ready-button span').textContent === 'Cancel ready'")
                assert state(first)["phase"] == "lobby"
                second.locator("#ready-button").click()
                wait_phase(first, "countdown")
                first.locator("#ready-button").click()
                wait_phase(first, "lobby")
                first.wait_for_function("document.querySelector('#ready-button span').textContent === 'Ready up'")
                second.wait_for_function("document.querySelector('#ready-button span').textContent === 'Ready up'")
                first.locator("#ready-button").click()
                second.locator("#ready-button").click()
                wait_phase(first, "fight")
                wait_phase(second, "fight")
                first.wait_for_function("document.querySelector('#ready-button').disabled")

                if game_id == "checkers":
                    assert first.locator(".checker-square").count() == 64
                    checkers_move(first, second)
                    assert state(first)["turn"] == 1
                    checkers_move(second, first)
                    assert state(first)["turn"] == 0
                elif game_id == "relic-duel":
                    start_x = state(first)["fighters"][0]["x"]
                    approach_duel(first, 60)
                    assert state(first)["fighters"][0]["x"] > start_x + 100
                    for key in ["j", "k"]:
                        hp = state(first)["fighters"][1]["hp"]
                        first.keyboard.press(key, delay=45)
                        first.wait_for_function(f"hp => {SURFACE}.getState().fighters[1].hp < hp", arg=hp, timeout=3000)
                        second.wait_for_function(f"hp => {SURFACE}.getState().fighters[1].hp < hp", arg=hp, timeout=3000)
                        first.wait_for_timeout(400)
                    before_roll = state(first)["fighters"][0]["stamina"]
                    first.keyboard.press("Space", delay=45)
                    first.wait_for_function(f"{SURFACE}.getState().fighters[0].action === 'roll'", timeout=1500)
                    assert state(first)["fighters"][0]["stamina"] < before_roll
                elif game_id == "dungeon-run":
                    assert state(first)["mode"] == "coop"
                    assert state(first)["wave"] == 1
                    assert len(state(first)["enemies"]) > 0
                    damage_coop_enemy(first)
                    assert state(second)["wave"] == state(first)["wave"]
                else:
                    approach_duel(first, 85)
                    hp = state(first)["fighters"][1]["hp"]
                    first.keyboard.press("j", delay=45)
                    first.wait_for_function(f"hp => {SURFACE}.getState().fighters[1].hp < hp", arg=hp, timeout=3000)
                    second.wait_for_function(f"hp => {SURFACE}.getState().fighters[1].hp < hp", arg=hp, timeout=3000)
                second.close()
                wait_phase(first, "lobby")
                print(f"PASS {game_id}: hub create/join, name sync, room list, ready/cancel, real gameplay, disconnect reset", flush=True)
            finally:
                for context in contexts:
                    context.close()
        assert not errors, errors
        assert not console_errors, f"{console_errors}; HTTP failures: {failed_resources}"
        assert not failed_resources, failed_resources
        print(json.dumps({"games_tested": 4, "browser_exceptions": errors, "console_errors": console_errors, "failed_resources": failed_resources}), flush=True)
    finally:
        browser.close()
