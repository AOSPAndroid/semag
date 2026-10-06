"""Optional real-browser card QA: python test/cards-browser-smoke.py [server URL].

Requires Python Playwright and Chromium. Without a URL, starts and stops an
isolated server on a free local port. All game actions use the rendered UI;
window.firesideRoom.getState() and WebSocket snapshots are inspected read-only.
Set FIRESIDE_SCREENSHOT_DIR to choose where desktop/mobile previews are saved.
"""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SCREENSHOTS = Path(os.environ.get("FIRESIDE_SCREENSHOT_DIR", ROOT / "test-results" / "cards"))
SURFACE = "window.firesideRoom"
errors, console_errors, failed_resources, action_errors = [], [], [], []
snapshots = {}


def watch(page, name):
    page.on("pageerror", lambda error: errors.append(f"{name}: {error}"))
    page.on("console", lambda message: console_errors.append(f"{name}: {message.text}") if message.type == "error" else None)
    page.on("response", lambda response: failed_resources.append(f"{name}: {response.status} {response.url}") if response.status >= 400 else None)

    def receive(payload):
        try:
            message = json.loads(payload)
        except (ValueError, TypeError):
            return
        if message.get("type") == "state":
            snapshots[name] = message["state"]
            assert_private(message["state"], 0 if name.endswith("P1") else 1)
        elif message.get("type") == "error":
            action_errors.append(f"{name}: {message.get('message')}")

    page.on("websocket", lambda socket: socket.on("framereceived", receive))


def state(page):
    return page.evaluate(f"{SURFACE}.getState()")


def wait_phase(page, phase, timeout=12000):
    page.wait_for_function(f"phase => {SURFACE}?.getState().phase === phase", arg=phase, timeout=timeout)


def wait_connected(page, seat):
    page.wait_for_function(f"seat => {SURFACE}?.connected && {SURFACE}.playerId === seat", arg=seat, timeout=12000)


def assert_private(view, seat):
    forbidden = {"deck", "board", "discard", "shoe", "solution", "random"}
    assert not forbidden.intersection(view), f"Secret fields in snapshot: {forbidden.intersection(view)}"
    game = view["gameId"]
    if game in ("crazy-eights", "twenty-one"):
        hidden = game == "crazy-eights" or view["phase"] not in ("roundEnd", "matchEnd")
        if hidden:
            assert all(card is None for card in view["hands"][1 - seat]), "Opponent hand leaked"
            if game == "twenty-one":
                assert view["totals"][1 - seat] is None, "Opponent total leaked"
        assert all(card is not None for card in view["hands"][seat]), "Own hand is unavailable"
    else:
        for index, card in enumerate(view["cards"]):
            exposed = view["matched"][index] is not None or index in view["revealed"]
            assert (card is not None) == exposed, f"Memory card {index} visibility is wrong"


def assert_sync(first, second):
    left, right = state(first), state(second)
    assert_private(left, 0)
    assert_private(right, 1)
    for key in ("gameId", "phase", "revision", "scores", "round", "winner", "result", "handCounts", "turn", "topCard", "activeSuit", "stood", "cards", "matched", "revealed"):
        if key in left:
            assert left[key] == right[key], f"Players disagree on {key}: {left[key]} / {right[key]}"


def action(first, second, actor, selector, keyboard=False):
    before = state(actor)["revision"]
    button = actor.locator(selector)
    button.wait_for(state="visible")
    wait_actionable(actor, selector)
    if keyboard:
        button.focus()
        actor.keyboard.press("Enter")
    else:
        button.click()
    for page in (first, second):
        page.wait_for_function(f"revision => {SURFACE}.getState().revision > revision", arg=before)
    assert_sync(first, second)


def wait_actionable(page, selector):
    page.wait_for_function("selector => { const button = document.querySelector(selector); return button && !button.disabled && button.getAttribute('aria-disabled') !== 'true' && !button.closest('.cards-view').classList.contains('is-pending'); }", arg=selector)


def screenshot(page, filename):
    page.screenshot(path=str(SCREENSHOTS / filename), full_page=True)


def assert_no_overflow(page):
    dimensions = page.evaluate("({ viewport: innerWidth, document: document.documentElement.scrollWidth })")
    assert dimensions["document"] <= dimensions["viewport"], dimensions


def mobile_preview(page, game):
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(120)
    assert_no_overflow(page)
    screenshot(page, f"fireside-{game}-mobile.png")
    page.set_viewport_size({"width": 1440, "height": 1100})


def ready_pair(first, second, cancel=True):
    first.locator("#ready-button").click()
    first.wait_for_function("document.querySelector('#ready-button span').textContent === 'Cancel ready'")
    assert state(first)["phase"] == "lobby", "One ready player started the game"
    second.locator("#ready-button").click()
    if cancel:
        wait_phase(first, "countdown")
        first.locator("#ready-button").click()
        for page in (first, second):
            wait_phase(page, "lobby")
            page.wait_for_function("document.querySelector('#ready-button span').textContent === 'Ready up'")
        first.locator("#ready-button").click()
        second.locator("#ready-button").click()
    for page in (first, second):
        wait_phase(page, "fight")
        page.wait_for_function("document.querySelector('#game-overlay').hidden")
    assert_sync(first, second)


def crazy_eights(first, second):
    played, draws, suits = 0, 0, 0
    for step in range(18):
        current = state(first)
        if current["phase"] == "matchEnd":
            break
        actor = [first, second][current["turn"]]
        own = state(actor)
        legal = [card for card in own["hands"][own["turn"]] if card["rank"] == 8 or card["rank"] == own["topCard"]["rank"] or card["suit"] == own["activeSuit"]]
        if legal:
            card = next((candidate for candidate in legal if candidate["rank"] == 8), legal[0])
            selector = f'[data-card-id="{card["id"]}"]'
            if card["rank"] == 8:
                wait_actionable(actor, selector)
                actor.locator(selector).click()
                actor.locator('[data-suit="0"]').wait_for(state="visible")
                action(first, second, actor, '[data-suit="0"]', keyboard=True)
                assert state(first)["activeSuit"] == 0
                suits += 1
            else:
                action(first, second, actor, selector, keyboard=played == 0)
            played += 1
        elif not own["drawn"][own["turn"]]:
            action(first, second, actor, '[data-action="draw"]')
            assert state(actor)["drawn"][own["turn"]]
            draws += 1
        else:
            action(first, second, actor, '[data-action="pass"]')
        if played >= 4 and draws >= 1 and suits >= 1:
            break
    assert played >= 1, "No card was played through the UI"
    assert_sync(first, second)
    print(f"  Crazy Eights: {played} plays, {draws} draws, {suits} wild suit choices", flush=True)


def twenty_one(first, second):
    hit = False
    simultaneous = False
    rounds = set()
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        current = state(first)
        if current["phase"] == "matchEnd":
            break
        if current["phase"] == "roundEnd":
            assert_sync(first, second)
            assert all(card is not None for hand in current["hands"] for card in hand), "Finished hands did not reveal"
            first.wait_for_function(f"{SURFACE}.getState().phase !== 'roundEnd'", timeout=7000)
            continue
        rounds.add(current["round"])
        if hit and not simultaneous and not any(current["stood"]):
            for actor in (first, second):
                wait_actionable(actor, '[data-action="stand"]')
            revision = current["revision"]
            start_at = int(time.time() * 1000) + 250
            for actor in (first, second):
                actor.evaluate("start => setTimeout(() => document.querySelector('[data-action=stand]').click(), Math.max(0, start - Date.now()))", start_at)
            for actor in (first, second):
                actor.wait_for_function(f"revision => {SURFACE}.getState().revision >= revision + 2", arg=revision)
            assert state(first)["stood"] == [True, True]
            assert_sync(first, second)
            simultaneous = True
            continue
        for seat, actor in enumerate((first, second)):
            current = state(actor)
            if current["phase"] != "fight" or current["stood"][seat]:
                continue
            if not hit:
                before = len(current["hands"][seat])
                action(first, second, actor, '[data-action="hit"]', keyboard=True)
                assert len(state(actor)["hands"][seat]) == before + 1
                hit = True
                current = state(actor)
            if current["phase"] == "fight" and not current["stood"][seat]:
                action(first, second, actor, '[data-action="stand"]')
    assert state(first)["phase"] == "matchEnd", "Five-round Twenty-One did not finish"
    assert hit, "No hit was exercised"
    assert simultaneous, "No simultaneous decisions were exercised"
    assert state(first)["round"] == 5
    assert_sync(first, second)
    first.locator("#ready-button").click()
    for page in (first, second):
        wait_phase(page, "lobby")
    assert state(first)["scores"] == [0, 0]
    assert state(first)["round"] == 1
    second.locator("#ready-button").click()
    for page in (first, second):
        wait_phase(page, "fight")
    assert_sync(first, second)
    print(f"  Twenty-One: real hit, simultaneous stands, {len(rounds)} active rounds, complete five-round match, two-player rematch", flush=True)


def memory(first, second):
    known = {}
    flips, mismatches = 0, 0
    # Exercise arrow navigation and native Enter selection before using clicks.
    first.locator('[data-index="0"]').focus()
    first.keyboard.press("ArrowRight")
    first.wait_for_function("document.activeElement?.dataset.index === '1'")
    action(first, second, first, '[data-index="1"]', keyboard=True)
    flips += 1
    for attempt in range(36):
        current = state(first)
        for index, card in enumerate(current["cards"]):
            if card is not None:
                known[index] = (card["rank"], card["suit"])
        if sum(current["scores"]) > 0:
            break
        if current["mismatchTicks"] > 0:
            mismatches += 1
            assert len(current["revealed"]) == 2
            turn = current["turn"]
            first.wait_for_function(f"{SURFACE}.getState().mismatchTicks === 0", timeout=3000)
            second.wait_for_function(f"{SURFACE}.getState().mismatchTicks === 0", timeout=3000)
            assert state(first)["turn"] == 1 - turn
            assert state(first)["revealed"] == []
            assert_sync(first, second)
            continue
        revealed = current["revealed"]
        available = [index for index in range(32) if current["matched"][index] is None and index not in revealed]
        chosen = None
        if revealed:
            identity = known[revealed[0]]
            chosen = next((index for index in available if known.get(index) == identity), None)
        else:
            chosen = next((index for index in available if any(other != index and known.get(other) == known.get(index) for other in available) and index in known), None)
        if chosen is None:
            chosen = next((index for index in available if index not in known), available[0])
        actor = [first, second][current["turn"]]
        action(first, second, actor, f'[data-index="{chosen}"]')
        flips += 1
    assert sum(state(first)["scores"]) >= 1, "Remembered visible positions did not produce a legal pair"
    assert_sync(first, second)
    print(f"  Memory: arrow/Enter selection, {flips} real flips, {mismatches} timed mismatches, remembered pair", flush=True)


def run(url):
    SCREENSHOTS.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        options = {"headless": True, "args": ["--no-sandbox", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"]}
        if os.path.exists("/usr/bin/chromium"):
            options["executable_path"] = "/usr/bin/chromium"
        browser = playwright.chromium.launch(**options)
        try:
            for game in ("crazy-eights", "twenty-one", "memory"):
                contexts = [browser.new_context(viewport={"width": 1440, "height": 1100}) for _ in range(2)]
                first, second = [context.new_page() for context in contexts]
                try:
                    for page, role in ((first, "P1"), (second, "P2")):
                        watch(page, f"{game}/{role}")
                    first.goto(url)
                    first.wait_for_function("document.querySelector('#host-status').textContent === 'Host is online'")
                    assert first.locator("[data-create-game]").count() == 8
                    if game == "crazy-eights":
                        screenshot(first, "fireside-card-hub.png")
                        first.set_viewport_size({"width": 390, "height": 844})
                        assert_no_overflow(first)
                        screenshot(first, "fireside-card-hub-mobile.png")
                        first.set_viewport_size({"width": 1440, "height": 1100})
                    first.locator("#hub-name").fill("Mina QA")
                    first.locator("#hub-name").press("Enter")
                    first.locator(f'[data-create-game="{game}"]').click()
                    first.wait_for_url("**/*room=*")
                    wait_connected(first, 0)
                    code = parse_qs(urlparse(first.url).query)["room"][0]
                    second.goto(url)
                    second.locator("#hub-name").fill("Rook QA")
                    second.locator("#hub-name").press("Enter")
                    second.locator("#room-code").fill(code.lower())
                    second.locator("#join-button").click()
                    second.wait_for_url("**/*room=*")
                    wait_connected(second, 1)
                    first.wait_for_function("document.querySelector('#p2-name').textContent === 'ROOK QA'")
                    second.wait_for_function("document.querySelector('#p1-name').textContent === 'MINA QA'")
                    assert parse_qs(urlparse(second.url).query)["room"][0] == code
                    ready_pair(first, second)
                    assert first.locator(".cards-view").is_visible()
                    screenshot(first, f"fireside-{game}.png")
                    mobile_preview(first, game)
                    {"crazy-eights": crazy_eights, "twenty-one": twenty_one, "memory": memory}[game](first, second)
                    second.close()
                    wait_phase(first, "lobby")
                    assert_private(state(first), 0)
                    print(f"PASS {game}: independent browsers, hub create/code join, ready/cancel, synchronized UI actions, hidden-card privacy, mobile layout, disconnect reset", flush=True)
                finally:
                    for context in contexts:
                        context.close()
            assert not errors, errors
            assert not console_errors, console_errors
            assert not failed_resources, failed_resources
            assert not action_errors, action_errors
            print(json.dumps({"games_tested": 3, "browser_exceptions": errors, "console_errors": console_errors, "failed_resources": failed_resources, "action_errors": action_errors, "screenshots": str(SCREENSHOTS)}), flush=True)
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
        port = json.loads(line)["port"]
        run(f"http://127.0.0.1:{port}")
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait(timeout=5)


if __name__ == "__main__":
    main()
