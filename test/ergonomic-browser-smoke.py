"""Native ergonomic controls integration checks.

python test/ergonomic-browser-smoke.py [http://127.0.0.1:3000]
Requires Playwright and Chromium. Live games receive native browser input only;
CDP supplies the trusted key/code combinations produced by AZERTY hardware.
Game snapshots are read without changing the simulation or its inputs.
SEMAG_SCREENSHOT_DIR selects the JSON report and screenshot directory.
"""
import json
import os
from pathlib import Path
import sys
import time
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', ROOT / 'test-results' / 'ergonomic-controls'))
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3000').rstrip('/')
ERRORS, RESOURCES, CHECKS = [], [], []
SOLOS = ('shadow-lantern', 'skyline-hook', 'starfall-squadron', 'ironwood-tactics',
         'paris-pedal', 'ember-delve', 'deckbound', 'snake', 'minesweeper', '2048',
         'apex-circuit', 'night-drive', 'prism-shift', 'rift-survivor')
ROOM_ACTIONS = {
    'shinobi-showdown': [('c', 'attack'), ('g', 'heavy'), ('e', 'throw'), ('f', 'parry')],
    'relic-duel': [('c', 'attack'), ('g', 'shoot'), ('f', 'block')],
    'dungeon-run': [('c', 'attack'), ('g', 'shoot'), ('f', 'block')],
    'vector-arena': [('c', 'fire'), ('f', 'focus')],
    'oddstock-rumble': [('c', 'attack'), ('g', 'special'), ('f', 'shield')],
    'afterimage': [('c', 'light'), ('g', 'heavy'), ('f', 'block')],
}


def watch(page, name):
    page.on('pageerror', lambda error: ERRORS.append(f'{name}: {error}'))
    page.on('console', lambda message: ERRORS.append(f'{name}: {message.text}') if message.type == 'error' else None)
    page.on('response', lambda response: RESOURCES.append(f'{name}: {response.status} {response.url}') if response.status >= 400 else None)


def wait(page, expression, arg=None, timeout=5000):
    return page.wait_for_function(expression, arg=arg, polling=20, timeout=timeout)


def cdp_key(page, key, code, kind='keyDown', repeat=False, modifiers=0):
    session = page.context.new_cdp_session(page)
    try:
        payload = {'type': kind, 'key': key, 'code': code, 'autoRepeat': repeat,
                   'modifiers': modifiers,
                   'windowsVirtualKeyCode': ord(key.upper()) if len(key) == 1 else {'Escape': 27, 'Shift': 16}.get(key, 0)}
        if kind == 'keyDown' and len(key) == 1 and not modifiers:
            payload.update(text=key, unmodifiedText=key)
        session.send('Input.dispatchKeyEvent', payload)
    finally:
        session.detach()


def layout(page, chosen):
    picker = page.locator('select[data-keyboard-layout]')
    assert picker.count() == 1
    picker.select_option(chosen)
    assert picker.input_value() == chosen
    assert (page.evaluate("localStorage.getItem('semag-keyboard-layout')") or 'wasd') == chosen


def solo_state(page):
    return page.evaluate('window.firesideSolo.getState()')


def solo_focus(page):
    target = page.locator('#solo-game [data-solo-focus],#solo-game canvas[tabindex],#solo-game [role="grid"][tabindex],#solo-game [tabindex="0"]').first
    (target if target.count() else page.locator('#solo-game')).focus()


def no_overflow(page, label):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (label, 'Horizontal overflow')


def native_blur(page, check):
    """Disable Playwright's forced focus, then let Chromium send trusted blur."""
    session = page.context.new_cdp_session(page)
    foreground = None
    try:
        session.send('Emulation.setFocusEmulationEnabled', {'enabled': False})
        foreground = page.context.new_page()
        foreground.goto('about:blank')
        foreground.bring_to_front()
        wait(page, '!document.hasFocus()')
        check()
    finally:
        if foreground:
            foreground.close()
        page.bring_to_front()
        session.send('Emulation.setFocusEmulationEnabled', {'enabled': True})
        session.detach()


def surface(game):
    return 'window.afterimage' if game == 'afterimage' else 'window.firesideRoom'


def room_state(page, game):
    return page.evaluate(surface(game) + '.getState()')


def room_input(page, game, action, value):
    wait(page, f'([action, value]) => {surface(game)}.getState().fighters[0].previousInput[action] === value', [action, value])


def settled_seats(pages, identity):
    """WS open precedes Welcome; cold startup may briefly reconnect either tab."""
    deadline = time.monotonic() + 20
    previous = None
    while time.monotonic() < deadline:
        observations = [identity(page) for page in pages]
        seats = [value['playerId'] for value in observations]
        if all(value['connected'] for value in observations) and all(seat in (0, 1) for seat in seats) and len(set(seats)) == 2:
            if previous == seats:
                return [pages[seats.index(seat)] for seat in (0, 1)]
            previous = seats
        else:
            previous = None
        pages[0].wait_for_timeout(80)
    raise AssertionError(('Both players did not settle into unique assigned seats', observations))


def combat_room(browser, game):
    contexts = [browser.new_context(viewport={'width': 1440, 'height': 1000}) for _ in range(2)]
    first, second = [context.new_page() for context in contexts]
    try:
        for index, page in enumerate((first, second)):
            watch(page, game + '/' + str(index))
        first.goto(URL)
        first.locator(f'[data-create-game="{game}"]').click()
        first.wait_for_url('**/*room=*')
        wait(first, surface(game) + '?.connected && ' + surface(game) + '.playerId != null', timeout=15000)
        code = parse_qs(urlparse(first.url).query)['room'][0]
        second.goto(URL)
        second.locator('#room-code').fill(code)
        second.locator('#join-button').click()
        second.wait_for_url('**/*room=*')
        wait(second, surface(game) + '?.connected && ' + surface(game) + '.playerId != null', timeout=15000)
        first, second = settled_seats([first, second], lambda page: page.evaluate(f'({{connected:{surface(game)}.connected,playerId:{surface(game)}.playerId}})'))
        first.locator('#player-name').fill('cgef')
        first.locator('#player-name').press('r')
        assert first.locator('#player-name').input_value() == 'cgefr'
        assert room_state(first, game)['phase'] == 'lobby'
        if game == 'oddstock-rumble':
            first.locator('[data-brawl-character="wrench"]').click()
            first.locator('[data-brawl-stage="rooftop"]').click()
            second.locator('[data-brawl-character="sprout"]').click()
            wait(first, 'window.firesideRoom.getState().stageSelected && window.firesideRoom.getState().fighters.every(fighter => fighter.selected)')
        first.locator('#ready-button').click()
        wait(first, 'document.querySelector("#ready-button span").textContent === "Cancel ready"')
        assert room_state(first, game)['phase'] == 'lobby'
        second.locator('#ready-button').click()
        wait(first, surface(game) + '.getState().phase === "fight"', timeout=12000)

        for chosen in ('wasd', 'zqsd'):
            layout(first, chosen)
            first.locator('#arena').focus()
            # Move toward the open centre; each action must reach the real host
            # while the movement key remains held and the other hand aims.
            first.keyboard.down('d')
            room_input(first, game, 'right', True)
            arena = first.locator('#arena').bounding_box()
            first.mouse.move(arena['x'] + arena['width'] * .65, arena['y'] + arena['height'] * .5)
            for key, action in ROOM_ACTIONS[game]:
                first.keyboard.down(key)
                room_input(first, game, action, True)
                room_input(first, game, 'right', True)
                first.keyboard.up(key)
                room_input(first, game, action, False)
            first.keyboard.up('d')
            room_input(first, game, 'right', False)
            if game in ('shinobi-showdown', 'vector-arena'):
                for mouse_button, action in [('left', 'attack' if game == 'shinobi-showdown' else 'fire'),
                                             ('right', 'heavy' if game == 'shinobi-showdown' else 'focus')]:
                    first.keyboard.down('d')
                    first.mouse.down(button=mouse_button)
                    room_input(first, game, action, True)
                    room_input(first, game, 'right', True)
                    first.mouse.up(button=mouse_button)
                    room_input(first, game, action, False)
                    first.keyboard.up('d')
                    room_input(first, game, 'right', False)
        layout(first, 'zqsd')
        first.locator('#arena').focus()
        first.keyboard.down('j')
        room_input(first, game, ROOM_ACTIONS[game][0][1], True)
        first.keyboard.up('j')
        room_input(first, game, ROOM_ACTIONS[game][0][1], False)
        cdp_key(first, 'q', 'KeyA')
        room_input(first, game, 'left', True)
        cdp_key(first, 'c', 'KeyC')
        room_input(first, game, ROOM_ACTIONS[game][0][1], True)
        room_input(first, game, 'left', True)
        cdp_key(first, 'c', 'KeyC', 'keyUp')
        cdp_key(first, 'Q', 'KeyA', 'keyUp')
        room_input(first, game, 'left', False)
        # A preference switch releases even unchanged keys, and an orphaned
        # auto-repeat may not recreate a held command after release.
        first.keyboard.down('d')
        room_input(first, game, 'right', True)
        layout(first, 'wasd')
        room_input(first, game, 'right', False)
        first.keyboard.up('d')
        cdp_key(first, 'd', 'KeyD', repeat=True)
        room_input(first, game, 'right', False)
        cdp_key(first, 'd', 'KeyD', 'keyUp')
        first.locator('#arena').focus()
        first.keyboard.down('d')
        room_input(first, game, 'right', True)
        # Player names are locked after Ready; the live keyboard selector is
        # the editable control available during combat and releases held input.
        first.locator('select[data-keyboard-layout]').focus()
        room_input(first, game, 'right', False)
        first.keyboard.up('d')
        first.keyboard.type('cgef')
        for key, action in ROOM_ACTIONS[game]:
            room_input(first, game, action, False)
        if game == 'shinobi-showdown':
            first.bring_to_front()
            first.locator('#arena').focus()
            first.keyboard.down('d')
            first.keyboard.down('f')
            room_input(first, game, 'right', True)
            room_input(first, game, 'parry', True)
            native_blur(first, lambda: (room_input(first, game, 'right', False), room_input(first, game, 'parry', False)))
            first.keyboard.up('d')
            first.keyboard.up('f')
        layout(first, 'zqsd')
        labels = first.locator('.controls-panel').inner_text()
        assert all(key.upper() in labels for key, _ in ROOM_ACTIONS[game]), (game, labels)
        if game == 'shinobi-showdown':
            first.screenshot(path=str(OUT / 'shinobi-zqsd-controls-desktop.png'), full_page=True)
            first.locator('#controls-panel').screenshot(path=str(OUT / 'shinobi-zqsd-control-card.png'))
            for width in (390, 320):
                first.set_viewport_size({'width': width, 'height': 900})
                no_overflow(first, game + '/' + str(width))
                first.screenshot(path=str(OUT / f'shinobi-zqsd-controls-{width}.png'), full_page=True)
        CHECKS.append({'game': game, 'near_hand_actions': dict(ROOM_ACTIONS[game]),
                       'wasd_zqsd': True, 'simultaneous_movement': True,
                       'mouse_preserved': game in ('shinobi-showdown', 'vector-arena'),
                       'legacy_j_preserved': True,
                       'trusted_azerty': True, 'shifted_keyup': True,
                       'neutral_layout_form': True, 'orphan_repeat_ignored': True,
                       'trusted_browser_focus_loss_neutral': game == 'shinobi-showdown',
                       'two_player_ready': True})
        print(f'PASS {game}: native nearby actions, simultaneous movement/aim, both layouts, real AZERTY, release guards', flush=True)
    except BaseException:
        first.screenshot(path=str(OUT / f'failure-{game}.png'), full_page=True)
        (OUT / f'failure-{game}.json').write_text(json.dumps(room_state(first, game), indent=2) + '\n')
        diagnostics = {'game': game, 'errors': ERRORS, 'failed_resources': RESOURCES, 'pages': []}
        for page in (first, second):
            diagnostics['pages'].append({'url': page.url, 'inspection': page.evaluate(f'''() => ({{
                connected:{surface(game)}?.connected, playerId:{surface(game)}?.playerId,
                playerIdType:typeof {surface(game)}?.playerId, focus:document.hasFocus(),
                visibility:document.visibilityState, active:document.activeElement?.id,
                error:document.querySelector('.error-banner')?.textContent,
                roster:document.querySelector('#players-list')?.textContent,
                body:document.body.innerText.slice(0,1800)
            }})''')})
        (OUT / f'failure-{game}-diagnostics.json').write_text(json.dumps(diagnostics, indent=2) + '\n')
        raise
    finally:
        for context in contexts:
            context.close()


def solo_pause_and_ui(browser, game):
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    page = context.new_page()
    try:
        watch(page, game)
        page.goto(f'{URL}/solo.html?game={game}')
        wait(page, 'game => window.firesideSolo?.gameId === game', game)
        assert solo_state(page) is None
        page.locator('#solo-game').focus()
        for key in ('Escape', 'p', 'r', 'Space'):
            page.keyboard.press(key)
        assert solo_state(page) is None, (game, 'Ready gate bypassed by shortcut')
        page.locator('#solo-start').click()
        wait(page, 'window.firesideSolo.getState() !== null')
        phase = solo_state(page)['phase']
        solo_focus(page)
        page.keyboard.press('Escape')
        wait(page, 'window.firesideSolo.getState().phase === "paused"')
        paused = solo_state(page)
        cdp_key(page, 'Escape', 'Escape', repeat=True)
        cdp_key(page, 'Escape', 'Escape', 'keyUp')
        page.wait_for_timeout(110)
        assert solo_state(page) == paused, (game, 'Repeat Escape or pause advanced state')

        # Existing forms plus inherited/empty contenteditable must accept native
        # editing without R restarting, P pausing, or a game action firing.
        for tag, editable in (('input', None), ('div', ''), ('div', 'plaintext-only')):
            page.evaluate('''([tag, editable]) => {
                const element = document.createElement(tag); element.id = 'ergonomic-qa-editor';
                element.setAttribute('aria-label', 'Controls QA editor');
                if (editable !== null) element.setAttribute('contenteditable', editable);
                document.querySelector('.solo-sidebar').append(element); element.focus();
            }''', [tag, editable])
            page.keyboard.type('rpzqsdwasdef123')
            page.keyboard.press('Escape')
            value = page.locator('#ergonomic-qa-editor').input_value() if tag == 'input' else page.locator('#ergonomic-qa-editor').inner_text()
            assert value == 'rpzqsdwasdef123', (game, editable, value)
            assert solo_state(page) == paused, (game, editable, 'Editing triggered game shortcuts')
            page.locator('#ergonomic-qa-editor').evaluate('element => element.remove()')

        for chosen in ('wasd', 'zqsd'):
            layout(page, chosen)
            assert solo_state(page) == paused, (game, 'Layout selection changed paused game')
        summary = page.locator('#solo-how-to summary')
        summary.focus()
        if page.locator('#solo-how-to').evaluate('element => element.open'):
            page.keyboard.press('Enter')
        page.keyboard.press('Space')
        assert page.locator('#solo-how-to').evaluate('element => element.open')
        assert solo_state(page) == paused, (game, 'Help Space activated a game action')
        page.keyboard.press('Enter')
        assert not page.locator('#solo-how-to').evaluate('element => element.open')
        assert solo_state(page) == paused
        solo_focus(page)
        page.keyboard.press('Escape')
        wait(page, 'phase => window.firesideSolo.getState().phase === phase', phase)
        page.keyboard.press('p')
        wait(page, 'window.firesideSolo.getState().phase === "paused"')
        solo_focus(page)
        page.keyboard.press('Escape')
        wait(page, 'phase => window.firesideSolo.getState().phase === phase', phase)
        actions = solo_near_actions(page, game)
        if game == 'ember-delve':
            solo_focus(page)
            page.keyboard.down('d')
            native_blur(page, lambda: wait(page, 'window.firesideSolo.getState().phase === "paused"'))
            page.keyboard.up('d')
            solo_focus(page)
            page.keyboard.press('Escape')
            wait(page, 'window.firesideSolo.getState().phase === "playing"')
        page.keyboard.press('Escape')
        wait(page, 'window.firesideSolo.getState().phase === "paused"')
        for width in (390, 320):
            page.set_viewport_size({'width': width, 'height': 900})
            no_overflow(page, game + '/' + str(width))
        CHECKS.append({'game': game, 'escape_pause_resume': True, 'legacy_p': True,
                       'repeat_ignored': True, 'ready_gate': True, 'forms_contenteditable': True,
                       'layout_preserves_pause': True, 'native_help': True, 'responsive_320_390': True,
                       'native_near_actions': actions})
        print(f'PASS {game}: Escape, P compatibility, pause stability, native forms/help, layouts, 320/390px', flush=True)
    except BaseException:
        page.screenshot(path=str(OUT / f'failure-{game}.png'), full_page=True)
        (OUT / f'failure-{game}.json').write_text(json.dumps(solo_state(page), indent=2) + '\n')
        raise
    finally:
        context.close()


def solo_near_actions(page, game):
    """Observe game consequences rather than mirroring a key mapping table."""
    solo_focus(page)
    if game == 'ember-delve':
        event = solo_state(page)['eventId']
        page.keyboard.press('c', delay=45)
        wait(page, 'id => window.firesideSolo.getState().events.some(event => event.id > id && event.type === "swing")', event)
        return ['C sword']
    if game == 'rift-survivor':
        shots = solo_state(page)['player']['shotsFired']
        page.keyboard.down('c')
        try:
            wait(page, 'shots => window.firesideSolo.getState().player.shotsFired > shots', shots)
        finally:
            page.keyboard.up('c')
        return ['C fire']
    if game == 'starfall-squadron':
        page.locator('[data-starfall-auto]').uncheck()
        solo_focus(page)
        # Focused manual fire uses the visible lance shape; existing automatic
        # shots cannot satisfy the independent manual-fire observation.
        page.keyboard.down('Shift')
        page.keyboard.press('c', delay=150)
        page.keyboard.up('Shift')
        value = solo_state(page)
        assert any(shot['focus'] for shot in value['friendlyShots']), (game, 'Manual C fire produced no focused shots')
        bombs = value['player']['bombs']
        page.keyboard.press('e', delay=50)
        wait(page, 'bombs => window.firesideSolo.getState().player.bombs === bombs - 1', bombs)
        return ['C fire', 'E bomb']
    if game == 'paris-pedal':
        event = solo_state(page)['eventId']
        page.keyboard.press('e', delay=55)
        wait(page, 'id => window.firesideSolo.getState().events.some(event => event.id > id && event.type === "bell")', event)
        # Native restart gives the legacy key a fresh zero-cooldown run; pause
        # and resume deliberately put the tap before the next resumed frame.
        page.locator('#solo-restart').click()
        solo_focus(page)
        page.keyboard.press('Escape')
        wait(page, 'window.firesideSolo.getState().phase === "paused"')
        paused = solo_state(page)
        page.keyboard.press('b', delay=55)
        assert solo_state(page) == paused, 'Paused legacy bell tap changed game'
        page.keyboard.press('Escape')
        wait(page, 'window.firesideSolo.getState().phase === "playing"')
        wait(page, 'elapsed => window.firesideSolo.getState().elapsed > elapsed', paused['elapsed'])
        assert not any(event['type'] == 'bell' for event in solo_state(page)['events']), 'Paused bell tap replayed after resume'
        page.keyboard.press('Escape')
        wait(page, 'window.firesideSolo.getState().phase === "paused"')
        page.keyboard.press('Escape')
        wait(page, 'window.firesideSolo.getState().phase === "playing"')
        page.keyboard.press('b', delay=55)
        wait(page, 'window.firesideSolo.getState().events.some(event => event.type === "bell")')
        assert len([event for event in solo_state(page)['events'] if event['type'] == 'bell']) == 1
        assert page.locator('.paris-controls [data-control="bell"]').get_attribute('aria-pressed') == 'false'
        return ['E 55ms bell tap after resume', 'B 55ms bell tap after resume', 'paused tap neutral', 'single bell consumption']
    if game == 'ironwood-tactics':
        cdp_key(page, 'é', 'Digit2')
        cdp_key(page, 'é', 'Digit2', 'keyUp')
        assert page.locator('[data-action="hero"][aria-pressed="true"]').get_attribute('data-hero') == solo_state(page)['heroes'][1]['id']
        page.keyboard.press('f')
        assert page.locator('[data-action="mode"][data-mode="attack"]').get_attribute('aria-pressed') == 'true'
        page.keyboard.press('c')
        assert page.locator('[data-action="mode"][data-mode="move"]').get_attribute('aria-pressed') == 'true'
        return ['C move', 'AZERTY Digit2 hero']
    if game == 'deckbound':
        routes = solo_state(page)['routeOptions']
        route = next(route for route in routes if route['kind'] == 'combat')
        page.locator(f'[data-action="choose-route"][data-id="{route["id"]}"]').click()
        wait(page, 'window.firesideSolo.getState().phase === "battle"')
        page.locator('#solo-game').focus()
        card = solo_state(page)['hand'][0]['uid']
        cdp_key(page, '&', 'Digit1')
        cdp_key(page, '&', 'Digit1', 'keyUp')
        wait(page, 'uid => !window.firesideSolo.getState().hand.some(card => card.uid === uid)', card)
        return ['AZERTY Digit1 card']
    return []


def voxel_controls(browser):
    contexts = [browser.new_context(viewport={'width': 1440, 'height': 1000}) for _ in range(2)]
    first, second = [context.new_page() for context in contexts]
    read = lambda page: page.evaluate('window.SemagVoxel.getState()')
    try:
        for index, page in enumerate((first, second)):
            watch(page, 'voxel/' + str(index))
        first.goto(URL)
        first.locator('[data-create-game="voxel-breach"]').click()
        first.locator('#voxel-setup [name=teamSize][value="1"]').check()
        first.locator('#voxel-create').click()
        first.wait_for_url('**/voxel.html?room=*')
        wait(first, 'window.SemagVoxel?.getState().connected', timeout=15000)
        second.goto(first.url)
        wait(second, 'window.SemagVoxel?.getState().connected && window.SemagVoxel.getState().playerId != null', timeout=15000)
        first, second = settled_seats([first, second], lambda page: {'connected': read(page)['connected'], 'playerId': read(page)['playerId']})
        layout(first, 'zqsd')
        first.locator('#ready-button').click()
        assert read(first)['state']['phase'] == 'lobby'
        second.locator('#ready-button').click()
        wait(first, 'window.SemagVoxel.getState().state.phase === "fight"', timeout=16000)
        if first.locator('#enter-arena').is_visible():
            first.locator('#enter-arena').click()
        wait(first, '!window.SemagVoxel.getState().controls.paused')
        first.locator('#arena').focus()
        first.keyboard.down('Control')
        wait(first, 'window.SemagVoxel.getState().input.crouch')
        cdp_key(first, 'q', 'KeyA', modifiers=2)
        wait(first, 'window.SemagVoxel.getState().input.left && window.SemagVoxel.getState().input.crouch')
        assert read(first)['state']['players'][0]['hp'] == 200
        cdp_key(first, 'f', 'KeyF', modifiers=2)
        wait(first, 'window.SemagVoxel.getState().input.heal && window.SemagVoxel.getState().input.left && window.SemagVoxel.getState().input.crouch')
        assert read(first)['state']['players'][0]['potions'] == 1, 'Full-health potion was consumed'
        cdp_key(first, 'f', 'KeyF', 'keyUp', modifiers=2)
        cdp_key(first, 'a', 'KeyQ', modifiers=2)
        wait(first, 'window.SemagVoxel.getState().input.grenade && window.SemagVoxel.getState().input.left && window.SemagVoxel.getState().input.crouch')
        wait(first, 'window.SemagVoxel.getState().state.players[0].grenades === 0')
        cdp_key(first, 'a', 'KeyQ', 'keyUp', modifiers=2)
        cdp_key(first, 'Q', 'KeyA', 'keyUp', modifiers=2)
        first.keyboard.up('Control')
        wait(first, '!window.SemagVoxel.getState().input.left && !window.SemagVoxel.getState().input.heal && !window.SemagVoxel.getState().input.grenade')
        assert not read(first)['input']['crouch'], 'Crouch remained held after keyup'
        first.keyboard.down('h')
        wait(first, 'window.SemagVoxel.getState().input.heal')
        first.keyboard.up('h')
        first.keyboard.down('g')
        wait(first, 'window.SemagVoxel.getState().input.grenade')
        first.keyboard.up('g')
        first.keyboard.press('Escape')
        wait(first, 'window.SemagVoxel.getState().controls.paused')
        CHECKS.append({'game': 'voxel-breach', 'f_heal': True, 'azerty_a_grenade': True,
                       'simultaneous_zqsd': True, 'shifted_keyup': True,
                       'legacy_g_h': True, 'finite_grenade': True,
                       'control_crouch_french_utilities': True,
                       'full_health_potion_preserved': True, 'escape_neutral': True})
        print('PASS voxel-breach: AZERTY A frag/F potion beside ZQSD, simultaneous movement, legacy aliases, finite kit, Escape', flush=True)
    except BaseException:
        first.screenshot(path=str(OUT / 'failure-voxel-breach.png'), full_page=True)
        (OUT / 'failure-voxel-breach.json').write_text(json.dumps(read(first), indent=2) + '\n')
        raise
    finally:
        for context in contexts:
            context.close()


def run():
    OUT.mkdir(parents=True, exist_ok=True)
    chosen = set(os.environ.get('SEMAG_QA_GAMES', ','.join([*ROOM_ACTIONS, *SOLOS, 'voxel-breach'])).split(','))
    def checkpoint():
        report = {'checks': CHECKS, 'errors': ERRORS, 'failed_resources': RESOURCES, 'screenshots': str(OUT)}
        (OUT / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
        return report
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path='/usr/bin/chromium',
            args=['--no-sandbox', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
                  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        try:
            for game in ROOM_ACTIONS:
                if game in chosen:
                    combat_room(browser, game)
                    checkpoint()
            for game in SOLOS:
                if game in chosen:
                    solo_pause_and_ui(browser, game)
                    checkpoint()
            if 'voxel-breach' in chosen:
                voxel_controls(browser)
                checkpoint()
        finally:
            browser.close()
    assert not ERRORS, ERRORS
    assert not RESOURCES, RESOURCES
    report = checkpoint()
    print(json.dumps(report), flush=True)


if __name__ == '__main__':
    run()
