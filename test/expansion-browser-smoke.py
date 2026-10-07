"""Physical browser QA for Ember Delve, Deckbound and Oddstock Rumble.

python test/expansion-browser-smoke.py [URL]
Starts an isolated host when URL is omitted. Requires Python Playwright and
Chromium. FIRESIDE_SCREENSHOT_DIR controls saved screenshots. Game inspection
is read-only; all choices, combat, stocks and outcomes use actual UI inputs.
"""
import importlib.util
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright
from browser_profiles import standard_profile, start_solo

ROOT = Path(__file__).resolve().parents[1]
SHOTS = Path(os.environ.get("FIRESIDE_SCREENSHOT_DIR", ROOT / "test-results" / "expansion"))
spec = importlib.util.spec_from_file_location("skill_qa", ROOT / "test" / "skill-browser-smoke.py")
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)


def state(page, solo=True):
    return qa.state(page, solo)


def shot(page, name):
    page.screenshot(path=str(SHOTS / f"fireside-{name}.png"), full_page=True, animations="disabled")


def mobile(page, name, buttons=None):
    for width in (390, 320):
        page.set_viewport_size({"width": width, "height": 900})
        qa.no_overflow(page)
        if buttons:
            for button in page.locator(buttons).all():
                if button.is_visible():
                    assert button.bounding_box()["height"] >= 44, f"{name}: touch target below 44px"
        shot(page, f"{name}-{width}")
    page.set_viewport_size({"width": 1440, "height": 900})


def paused_choice(page, expected, selector):
    page.locator("#solo-pause").click()
    qa.phase(page, "paused")
    before = state(page)
    assert before["pausedPhase"] == expected
    assert all(button.is_disabled() or not button.is_visible() for button in page.locator(selector).all())
    page.wait_for_timeout(180)
    assert state(page) == before, "Paused decision advanced"
    page.locator("#solo-pause").click()
    qa.phase(page, expected)


def native_help(page):
    page.locator("#solo-how-to summary").focus()
    before = state(page)
    page.keyboard.press("Space", delay=30)
    assert page.locator("#solo-how-to").evaluate("n => n.open")
    after = state(page)
    if "stamina" in after.get("player", {}):
        assert after["player"]["stamina"] >= before["player"]["stamina"] - .01
        assert after["player"]["dashTime"] == 0
    else:
        assert after == before, "Native help leaked a card shortcut"
    page.keyboard.press("Enter", delay=30)
    assert not page.locator("#solo-how-to").evaluate("n => n.open")


def catalog(page):
    assert page.locator("[data-create-game]").count() == 10
    assert page.locator("[data-play-solo]").count() == 14
    for name, friends, solos in [("all", 10, 14), ("friends", 10, 0), ("solo", 0, 14), ("roguelike", 0, 4), ("driving", 0, 3)]:
        page.locator(f'[data-filter="{name}"]').click()
        assert page.locator("[data-create-game]:visible").count() == friends
        assert page.locator("[data-play-solo]:visible").count() == solos
    page.locator('[data-filter="all"]').click()
    for game in ("ember-delve", "deckbound", "oddstock-rumble"):
        assert page.locator(f'[data-game-card="{game}"]').is_visible()
    page.locator('#game-search').fill('roguelike')
    assert page.locator('[data-game-card]:visible').count() == 4
    page.locator('#game-search').fill('')
    mobile(page, "expanded-hub")


def route_path(current, goal):
    points = [(x, y) for y in range(80, 561, 40) for x in range(80, 881, 40)
              if not any(o["x"] - 22 < x < o["x"] + o["width"] + 22 and o["y"] - 22 < y < o["y"] + o["height"] + 22
                         for o in current["room"]["obstacles"])]
    closest = lambda point: min(points, key=lambda xy: math.hypot(xy[0] - point["x"], xy[1] - point["y"]))
    first, last = closest(current["player"]), closest(goal)
    parents, queue = {first: None}, [first]
    for point in queue:
        if point == last:
            break
        for other in points:
            if other not in parents and abs(other[0] - point[0]) + abs(other[1] - point[1]) == 40:
                parents[other] = point
                queue.append(other)
    assert last in parents, "No accessible physical route to the exit"
    result, point = [(goal["x"], goal["y"])], last
    while point is not None:
        result.insert(0, point)
        point = parents[point]
    return result


def ember(page, context):
    qa.phase(page, "playing")
    native_help(page)
    seed = page.locator(".ember-seed input")
    seed.fill("12345")
    page.get_by_role("button", name="Replay seed", exact=True).click()
    assert state(page)["seed"] == 12345
    canvas = page.locator(".ember-canvas")
    canvas.focus()
    rect = canvas.bounding_box()
    assert rect["y"] + rect["height"] <= 900, f"Ember combat is below the first screen: {rect}"
    keyboard = qa.Keyboard(page)
    waypoints, point, exit_path = [(120, 90), (840, 90), (840, 550), (120, 550)], 0, None
    deadline = time.monotonic() + 65
    while time.monotonic() < deadline:
        current = state(page)
        if current["phase"] == "reward":
            break
        assert current["phase"] == "playing", current["phase"]
        own = current["player"]
        wanted = set()
        if current["enemies"]:
            enemy = min(current["enemies"], key=lambda e: math.hypot(e["x"] - own["x"], e["y"] - own["y"]))
            qa.aim_at(page, ".ember-canvas", enemy["x"], enemy["y"], 960, 640)
            target = waypoints[point]
            if math.hypot(target[0] - own["x"], target[1] - own["y"]) < 35:
                point = (point + 1) % 4
                target = waypoints[point]
            wanted = {"j", "e"}
            if math.hypot(enemy["x"] - own["x"], enemy["y"] - own["y"]) < 110 and own["stamina"] > 45:
                page.keyboard.press("Space", delay=15)
        else:
            goal = current["room"]["exit"]
            if exit_path is None:
                exit_path = route_path(current, goal)
            target = exit_path[0]
            if math.hypot(target[0] - own["x"], target[1] - own["y"]) < 20 and len(exit_path) > 1:
                exit_path.pop(0)
                target = exit_path[0]
            if math.hypot(goal["x"] - own["x"], goal["y"] - own["y"]) < 50:
                keyboard.release()
                page.keyboard.press("f", delay=20)
                continue
        dx, dy = target[0] - own["x"], target[1] - own["y"]
        if abs(dx) > 12:
            wanted.add("d" if dx > 0 else "a")
        if abs(dy) > 12:
            wanted.add("s" if dy > 0 else "w")
        keyboard.set(wanted)
        page.wait_for_timeout(45)
    keyboard.release()
    current = state(page)
    assert current["phase"] == "reward" and current["kills"] >= 4, current
    assert page.locator(".ember-choice:visible").count() == 3
    paused_choice(page, "reward", ".ember-choice")
    shot(page, "ember-reward")
    mobile(page, "ember-reward", ".ember-choice")
    chosen = current["choices"][0]["id"]
    page.locator(f'.ember-choice[data-choice="{chosen}"]').focus()
    page.keyboard.press("Space", delay=30)
    qa.phase(page, "route")
    assert state(page)["relics"][chosen] == 1
    assert page.locator(".ember-choice:visible").count() == 2
    paused_choice(page, "route", ".ember-choice")
    shot(page, "ember-route")
    route = state(page)["choices"][0]["id"]
    page.locator(f'.ember-choice[data-choice="{route}"]').click()
    qa.phase(page, "playing")
    assert state(page)["depth"] == 2
    seed.fill("12345")
    page.get_by_role("button", name="Replay seed", exact=True).click()
    assert state(page)["score"] == 0 and state(page)["relics"] == {}
    page.set_viewport_size({"width": 390, "height": 900})
    before, held, released = qa.touch_hold(page, context, '.ember-stick[data-stick="move"]', offset=(.3, 0))
    assert held["player"]["x"] > before["player"]["x"] + 10
    page.wait_for_timeout(120)
    assert abs(state(page)["player"]["x"] - released["player"]["x"]) < 1
    page.locator("#solo-pause").click()
    mobile(page, "ember-delve", ".ember-action,.ember-stick")
    print("PASS Ember: real combat/exit/relic/routes, paused choices, native Space, seed replay, touch cancel and 320/390px", flush=True)


def deckbound(page, context):
    qa.phase(page, "route")
    native_help(page)
    paused_choice(page, "route", '[data-action="choose-route"]')
    shot(page, "deckbound-route")
    mobile(page, "deckbound-route", '[data-action="choose-route"]')
    route = next(option for option in state(page)["routeOptions"] if option["kind"] == "combat")
    page.locator(f'[data-action="choose-route"][data-id="{route["id"]}"]').focus()
    page.keyboard.press("Space", delay=30)
    qa.phase(page, "battle")
    assert page.locator(".deckbound-intent").count() == len(state(page)["enemies"])
    for enemy in state(page)["enemies"]:
        assert enemy["intent"]["label"]
    paused_choice(page, "battle", '[data-action="play-card"], [data-action="end-turn"]')
    shot(page, "deckbound-battle")
    mobile(page, "deckbound-battle", '[data-action="play-card"], [data-action="end-turn"]')
    initial_hp = state(page)["hp"]
    saw_card, saw_enemy = False, False
    for _ in range(80):
        current = state(page)
        if current["phase"] == "reward":
            break
        assert current["phase"] == "battle", current["phase"]
        playable = page.locator('[data-action="play-card"]:enabled')
        if playable.count():
            before = state(page)
            playable.first.click()
            assert state(page) != before
            saw_card = True
        else:
            turn = current["turn"]
            page.locator('[data-action="end-turn"]').click()
            after = state(page)
            saw_enemy = saw_enemy or after["hp"] < initial_hp or after["player"]["weak"] > 0
            assert after["phase"] == "reward" or after["turn"] > turn
    qa.phase(page, "reward")
    assert saw_card and saw_enemy
    paused_choice(page, "reward", '[data-action="choose-reward"]')
    size = len(state(page)["deck"])
    page.locator('[data-action="choose-reward"]:not([data-id="skip"])').first.focus()
    page.keyboard.press("Enter", delay=30)
    assert len(state(page)["deck"]) == size + 1
    assert state(page)["phase"] == "route"
    page.locator("#solo-restart").click()
    assert state(page)["score"] == 0 and state(page)["floor"] == 1
    print("PASS Deckbound: native route/card decisions, enemy intent/turn/damage, reward/deck growth, exact paused phases and mobile choices", flush=True)


def brawl(browser, url):
    contexts = [browser.new_context(viewport={"width": 1440, "height": 900}) for _ in range(2)]
    first, second = [context.new_page() for context in contexts]
    try:
        for page, name in [(first, "Oddstock/P1"), (second, "Oddstock/P2")]:
            qa.watch(page, name)
        first.goto(url)
        first.locator('[data-create-game="oddstock-rumble"]').click()
        first.wait_for_function("window.firesideRoom?.connected")
        second.goto(first.url)
        second.wait_for_function("window.firesideRoom?.playerId===1")
        assert first.locator("[data-brawl-character]").count() == 6
        assert first.locator("#ready-button").is_disabled()
        first.locator('[data-brawl-character="wrench"]').click()
        second.locator('[data-brawl-character="bulk"]').click()
        for stage in ("garden", "foundry", "rooftop"):
            first.locator(f'[data-brawl-stage="{stage}"]').click()
            second.wait_for_function("stage=>window.firesideRoom.getState().stageId===stage", arg=stage)
            assert second.locator(f'[data-brawl-stage="{stage}"]').is_disabled()
        shot(first, "oddstock-lobby")
        first.locator("#ready-button").focus()
        first.keyboard.press("Space", delay=30)
        first.wait_for_function("document.querySelector('#ready-button').classList.contains('is-ready')")
        assert state(first, False)["phase"] == "lobby"
        second.locator("#ready-button").click()
        qa.phase(first, "fight", False)
        first.wait_for_timeout(650)
        first.locator("#arena").focus()
        first.keyboard.down("d")
        first.wait_for_function("Math.abs(window.firesideRoom.getState().fighters[0].x-window.firesideRoom.getState().fighters[1].x)<65")
        first.keyboard.up("d")
        first.keyboard.press("j", delay=40)
        for page in (first, second):
            page.wait_for_function("window.firesideRoom.getState().fighters[1].damage>0")
        shot(first, "oddstock-rumble")
        canvas = first.locator("#arena").bounding_box()
        assert canvas["y"] + canvas["height"] <= 900, f"Oddstock stage extends below first screen: {canvas}"
        mobile(first, "oddstock-rumble", "[data-brawl-action]")
        first.locator("#arena").focus()
        first.keyboard.down("d")
        first.keyboard.down("s")
        first.wait_for_function("window.firesideRoom.getState().fighters[0].stocks===2", timeout=12000)
        first.keyboard.up("d")
        first.keyboard.up("s")
        assert state(second, False)["fighters"][0]["stocks"] == 2
        second.close()
        qa.phase(first, "lobby", False)
        assert state(first, False)["fighters"][0]["stocks"] == 3
        print("PASS Oddstock: six fighters/host stages, both-ready native Space, synchronized hit/stock, disconnect reset and 44px mobile actions", flush=True)
    finally:
        for context in contexts:
            context.close()


def run(url):
    SHOTS.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        options = {"headless": True, "args": ["--no-sandbox", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"]}
        if Path("/usr/bin/chromium").exists():
            options["executable_path"] = "/usr/bin/chromium"
        browser = playwright.chromium.launch(**options)
        try:
            for game, exercise in [("ember-delve", ember), ("deckbound", deckbound)]:
                before = qa.room_ids(url)
                context = browser.new_context(viewport={"width": 1440, "height": 900}, has_touch=True)
                page = context.new_page()
                qa.watch(page, game, solo=True)
                page.goto(url)
                page.wait_for_function("document.querySelector('#host-status').textContent==='Host is online'")
                if game == "ember-delve":
                    catalog(page)
                page.locator(f'[data-play-solo="{game}"]').click()
                start_solo(page, game)
                standard_profile(page, game)
                exercise(page, context)
                context.close()
                assert qa.room_ids(url) == before, "Solo game changed multiplayer rooms"
            brawl(browser, url)
            assert not qa.errors, qa.errors
            assert not qa.console_errors, qa.console_errors
            assert not qa.failed_resources, qa.failed_resources
            assert not qa.solo_mutations, qa.solo_mutations
            assert not qa.solo_sockets, qa.solo_sockets
            print(json.dumps({"games": 3, "browser_errors": [], "http_errors": [], "solo_room_mutations": [], "solo_websockets": [], "screenshots": str(SHOTS)}), flush=True)
        finally:
            browser.close()


def main():
    if len(sys.argv) > 1:
        run(sys.argv[1].rstrip("/"))
        return
    source = "import {createServer} from './server.js';const server=createServer();const address=await server.listen(0,'127.0.0.1');console.log(JSON.stringify({port:address.port}));process.on('SIGTERM',async()=>{await server.close();process.exit(0);});"
    server = subprocess.Popen(["node", "--input-type=module", "--eval", source], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        line = server.stdout.readline()
        if not line:
            raise RuntimeError(f"Temporary host failed: {server.stderr.read()}")
        run(f"http://127.0.0.1:{json.loads(line)['port']}")
    finally:
        server.terminate()
        server.wait(timeout=10)


if __name__ == "__main__":
    main()
