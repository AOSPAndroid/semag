"""Native multiplayer/practice keyboard-layout smoke test.

python test/keyboard-multiplayer-browser-smoke.py [http://127.0.0.1:3000]
Creates real rooms through the shelf, joins/starts normally, and observes actual
engine state. CDP supplies the trusted key/code shape emitted by French hardware.
"""
import json
from pathlib import Path
import sys
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright
from browser_controls import controls_panel

URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3000').rstrip('/')
RESULTS = Path('/workspace/scratch/keyboard-multiplayer')
ERRORS, RESOURCES, CHECKS = [], [], []


def surface(game):
    return 'window.afterimage' if game == 'afterimage' else 'window.firesideRoom'


def state(page, game):
    return page.evaluate(f'{surface(game)}.getState()')


def wait_phase(page, game, phase):
    page.wait_for_function(f'phase => {surface(game)}?.getState().phase === phase', arg=phase, timeout=12000)


def layout(page, value):
    with controls_panel(page, 'select[data-keyboard-layout]', resume=False):
        picker = page.locator('select[data-keyboard-layout]')
        assert picker.count() == 1, 'Each page must have exactly one layout selector'
        picker.select_option(value)
        assert picker.input_value() == value
        assert page.evaluate("localStorage.getItem('semag-keyboard-layout')") == value


def observe(page, name):
    page.on('pageerror', lambda error: ERRORS.append(f'{name}: {error}'))
    page.on('console', lambda msg: ERRORS.append(f'{name}: {msg.text}') if msg.type == 'error' else None)
    page.on('response', lambda response: RESOURCES.append(f'{name}: {response.status} {response.url}') if response.status >= 400 else None)


def input_is(page, game, action, value):
    page.wait_for_function(f'([action,value]) => {surface(game)}.getState().fighters[0].previousInput[action] === value', arg=[action, value], timeout=3000)


def cdp_key(page, key, code, kind='keyDown', repeat=False):
    session = page.context.new_cdp_session(page)
    try:
        payload = {'type': kind, 'key': key, 'code': code, 'windowsVirtualKeyCode': ord(key.upper()) if len(key) == 1 else 0}
        if kind == 'keyDown':
            payload['autoRepeat'] = repeat
            if len(key) == 1:
                payload['text'] = key
                payload['unmodifiedText'] = key
        session.send('Input.dispatchKeyEvent', payload)
    finally:
        session.detach()


def left_moves(page, game, letter, french=False):
    page.locator('#arena').focus()
    for attempt in range(2):
        if game == 'oddstock-rumble':
            page.wait_for_function('''() => { const fighter=window.firesideRoom.getState().fighters[0];
                return fighter.stocks > 0 && fighter.respawnTicks === 0 && fighter.grounded; }''', timeout=5000)
        initial = state(page, game)['fighters'][0]
        before = initial['x']
        if french:
            cdp_key(page, letter, 'KeyA')
        else:
            page.keyboard.down(letter)
        input_is(page, game, 'left', True)
        page.wait_for_timeout(100)
        observed = state(page, game)['fighters'][0]
        moved = observed['x']
        if french:
            cdp_key(page, letter, 'KeyA', 'keyUp')
        else:
            page.keyboard.up(letter)
        input_is(page, game, 'left', False)
        if game != 'oddstock-rumble' or observed['stocks'] == initial['stocks'] and observed['respawnTicks'] == 0:
            break
        # A respawn teleports the fighter. It cannot prove direction; retry a
        # fresh trusted key press after the surviving fighter lands safely.
        assert attempt == 0 and observed['stocks'] > 0, ('No safe brawl movement sample', initial, observed)
    assert moved < before - 4, (game, letter, before, moved, 'Left input did not move real fighter')
    # Restore room on the platform and away from boundary walls.
    page.keyboard.down('d')
    input_is(page, game, 'right', True)
    page.wait_for_timeout(100)
    page.keyboard.up('d')
    input_is(page, game, 'right', False)


def up_input(page, game, letter, french=False):
    page.locator('#arena').focus()
    action = 'jump' if game == 'afterimage' else 'up'
    if game == 'afterimage':
        page.wait_for_function(f'{surface(game)}.getState().fighters[0].y >= 469.99', timeout=3000)
    if french:
        cdp_key(page, letter, 'KeyW')
    else:
        page.keyboard.down(letter)
    input_is(page, game, action, True)
    if game == 'afterimage':
        page.wait_for_function('window.afterimage.getState().fighters[0].y < 460', timeout=2000)
    if french:
        cdp_key(page, letter, 'KeyW', 'keyUp')
    else:
        page.keyboard.up(letter)
    input_is(page, game, action, False)


def neutral_change(page, game):
    layout(page, 'zqsd')
    page.locator('#arena').focus()
    page.keyboard.down('d')
    input_is(page, game, 'right', True)
    # The selector focuses a form; preference changes must still release every
    # held key immediately, including D, whose label does not change.
    layout(page, 'wasd')
    input_is(page, game, 'right', False)
    page.keyboard.up('d')
    page.locator('#arena').focus()
    cdp_key(page, 'd', 'KeyD', repeat=True)
    page.wait_for_timeout(100)
    input_is(page, game, 'right', False)
    cdp_key(page, 'd', 'KeyD', 'keyUp')
    page.keyboard.down('d')
    input_is(page, game, 'right', True)
    page.keyboard.up('d')
    input_is(page, game, 'right', False)


def hints(page, game, chosen):
    if game == 'afterimage':
        assert page.locator('.controls-panel kbd').first.inner_text() == ('Q' if chosen == 'zqsd' else 'A')
        assert ('Z to jump' if chosen == 'zqsd' else 'W to jump') in page.locator('.alternate-controls').inner_text()
        assert ('Use Q and D' if chosen == 'zqsd' else 'Use A and D') in page.locator('#arena').get_attribute('aria-label')
    elif game == 'oddstock-rumble':
        assert page.locator('#controls-panel kbd').first.inner_text() == ('Q' if chosen == 'zqsd' else 'A')
        assert page.locator('#controls-panel kbd').nth(2).inner_text() == ('Z' if chosen == 'zqsd' else 'W')
        assert ('Q and D move, Z and S' if chosen == 'zqsd' else 'A and D move, W and S') in page.locator('#arena').get_attribute('aria-label')
    else:
        letters = page.locator('#controls-panel .keys kbd').all_text_contents()
        assert letters == (['Z', 'Q', 'S', 'D'] if chosen == 'zqsd' else ['W', 'A', 'S', 'D']), (game, letters)
        assert ('ZQSD' if chosen == 'zqsd' else 'WASD') in page.locator('#arena').get_attribute('aria-label')


def responsive(page, game):
    assert page.title().endswith('— Semag'), page.title()
    if game != 'afterimage':
        logo = page.locator('svg.pixel-logo')
        assert logo.count() >= 1, (game, 'Missing pixel Semag logo')
        assert '/hub/logo.svg#brand' in logo.first.locator('use').get_attribute('href')
    else:
        assert 'SEMAG' in page.locator('.edition').inner_text()
    back = page.locator('a[aria-label*="Semag"]').first
    assert back.count() == 1
    for width in (390, 320):
        page.set_viewport_size({'width': width, 'height': 844})
        page.wait_for_timeout(90)
        sizes = page.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})')
        assert sizes['scroll'] <= sizes['width'], (game, sizes)
        with controls_panel(page, 'select[data-keyboard-layout]'):
            picker = page.locator('select[data-keyboard-layout]').bounding_box()
            assert picker and picker['x'] >= 0 and picker['x'] + picker['width'] <= width + 1, (game, picker)
        page.screenshot(path=str(RESULTS / f'{game}-{width}.png'), full_page=True)
    page.set_viewport_size({'width': 1440, 'height': 1000})


def actual_controls(page, game, label):
    for selected in ('wasd', 'zqsd'):
        if label == 'practice':
            page.locator('#ready-button').click()
            wait_phase(page, game, 'fight')
        layout(page, selected)
        hints(page, game, selected)
        left_moves(page, game, 'q' if selected == 'zqsd' else 'a')
        up_input(page, game, 'z' if selected == 'zqsd' else 'w')
        page.locator('#arena').focus()
        page.keyboard.down('ArrowLeft')
        input_is(page, game, 'left', True)
        page.keyboard.up('ArrowLeft')
        input_is(page, game, 'left', False)
        CHECKS.append({'game': game, 'mode': label, 'layout': selected, 'native_movement': True, 'arrows': True, 'hints': True})
    if label == 'practice':
        page.locator('#ready-button').click()
        wait_phase(page, game, 'fight')
    layout(page, 'zqsd')
    hints(page, game, 'zqsd')
    left_moves(page, game, 'q', french=True)
    up_input(page, game, 'z', french=True)
    neutral_change(page, game)
    CHECKS.append({'game': game, 'mode': label, 'trusted_french_key_code': True, 'layout_change_neutral': True, 'keyup_release': True, 'repeat_after_release_ignored': True})


def run(browser, game):
    contexts = [browser.new_context(viewport={'width': 1440, 'height': 1000}) for _ in range(2)]
    first, second = [context.new_page() for context in contexts]
    try:
        observe(first, f'{game}/P1')
        observe(second, f'{game}/P2')
        first.goto(URL)
        first.wait_for_function("document.querySelector('#host-status').textContent === 'Host is online'")
        layout(first, 'zqsd')
        first.locator(f'[data-create-game="{game}"]').click()
        first.wait_for_url('**/*room=*')
        first.wait_for_function(f'{surface(game)}?.connected && {surface(game)}.playerId === 0')
        assert first.locator('select[data-keyboard-layout]').input_value() == 'zqsd', 'Saved hub layout did not follow into game'
        code = parse_qs(urlparse(first.url).query)['room'][0]
        second.goto(URL)
        second.locator('#room-code').fill(code.lower())
        second.locator('#join-button').click()
        second.wait_for_url('**/*room=*')
        second.wait_for_function(f'{surface(game)}?.connected && {surface(game)}.playerId === 1')
        # Changing layout / typing R within a name must never ready a player.
        layout(first, 'zqsd')
        with controls_panel(first, '#player-name', resume=False):
            first.locator('#player-name').fill('')
            first.locator('#player-name').press('r')
            first.locator('#player-name').press('q')
            assert first.locator('#player-name').input_value() == 'rq'
        assert state(first, game)['phase'] == 'lobby'
        assert first.locator('#ready-button span').inner_text() == 'Ready up'
        if game == 'oddstock-rumble':
            first.locator('[data-brawl-character="wrench"]').click()
            first.locator('[data-brawl-stage="rooftop"]').click()
            second.locator('[data-brawl-character="sprout"]').click()
            first.wait_for_function('window.firesideRoom.getState().stageSelected && window.firesideRoom.getState().fighters.every(f=>f.selected)')
        responsive(first, game)
        first.locator('#ready-button').click()
        first.wait_for_function("document.querySelector('#ready-button span').textContent === 'Cancel ready'")
        assert state(first, game)['phase'] == 'lobby', 'One ready player started game'
        second.locator('#ready-button').click()
        wait_phase(first, game, 'fight')
        actual_controls(first, game, 'online')
        # Basic untouched action keys still reach the server under ZQSD.
        layout(first, 'zqsd')
        first.locator('#arena').focus()
        action = 'light' if game == 'afterimage' else 'fire' if game == 'vector-arena' else 'attack'
        first.keyboard.down('j')
        input_is(first, game, action, True)
        first.keyboard.up('j')
        input_is(first, game, action, False)
        CHECKS.append({'game': game, 'mode': 'online', 'action_key_preserved': True, 'two_player_ready': True, 'form_typing': True, 'responsive_320_390': True, 'semag_branding': True})
        if game == 'afterimage':
            second.close()
            wait_phase(first, game, 'lobby')
            first.wait_for_function("!document.querySelector('#practice-button').disabled")
            first.locator('#practice-button').click()
            first.wait_for_function('window.afterimage.practice')
            wait_phase(first, game, 'fight')
            actual_controls(first, game, 'practice')
        print(f'PASS {game}: native WASD/ZQSD, trusted AZERTY events, arrows/actions, neutral change, form/picker, Semag logo, 320/390px headers', flush=True)
    finally:
        for context in contexts:
            context.close()


RESULTS.mkdir(parents=True, exist_ok=True)
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
    try:
        for game in ('relic-duel', 'vector-arena', 'oddstock-rumble', 'afterimage'):
            run(browser, game)
    finally:
        browser.close()
assert not ERRORS, ERRORS
assert not RESOURCES, RESOURCES
report = {'checks': CHECKS, 'errors': ERRORS, 'failed_resources': RESOURCES, 'screenshots': str(RESULTS)}
(RESULTS / 'report.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report), flush=True)
