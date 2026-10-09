"""Native solo controls and French key/code integration.

python test/keyboard-solo-browser-smoke.py [http://127.0.0.1:3000]
Requires Python Playwright and Chromium. Reads game state; never injects it.
"""
import json
from pathlib import Path
import sys

from playwright.sync_api import sync_playwright
from browser_profiles import start_solo

GAMES = {
    'ember-delve': ('ember', 'ember-canvas'),
    'rift-survivor': ('rift', 'rift-canvas'),
    'night-drive': ('highway', 'highway-canvas'),
    'paris-pedal': ('paris', 'paris-canvas'),
    'prism-shift': ('prism', 'prism-canvas'),
}


def state(page):
    return page.evaluate('window.firesideSolo.getState()')


def layout(page, value):
    picker = page.locator('select[data-keyboard-layout]')
    assert picker.count() == 1, 'Solo shell must offer one keyboard picker'
    picker.select_option(value)


def toggle_pause(page):
    page.locator('#solo-pause').focus()
    page.keyboard.press('Space')


def mismatch(page, key, code, kind='keydown'):
    # A real French keyboard emits e.g. key=q/code=KeyA. Chromium's native
    # keyboard API uses QWERTY, so exercise this browser event shape explicitly.
    return page.evaluate('''([key, code, kind]) => {
        const event = new KeyboardEvent(kind, {key, code, bubbles:true, cancelable:true});
        document.activeElement.dispatchEvent(event);
        return event.defaultPrevented;
    }''', [key, code, kind])


def left_button(prefix):
    return f'.{prefix}-controls [data-control="left"]'


def run(url):
    errors, failed_resources, results = [], [], []
    with sync_playwright() as playwright:
        options = {'headless': True, 'args': ['--no-sandbox']}
        if Path('/usr/bin/chromium').exists():
            options['executable_path'] = '/usr/bin/chromium'
        browser = playwright.chromium.launch(**options)
        try:
            context = browser.new_context(viewport={'width': 1440, 'height': 1000})
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
            page.on('response', lambda response: failed_resources.append(f'{response.status} {response.url}') if response.status >= 400 else None)
            for game, (prefix, canvas_class) in GAMES.items():
                for selected in ('wasd', 'zqsd'):
                    page.goto(f'{url}/solo.html?game={game}')
                    start_solo(page, game)
                    toggle_pause(page)
                    before = state(page)
                    assert before['phase'] == 'paused', (game, before['phase'])
                    layout(page, selected)
                    assert state(page) == before, (game, 'Changing keyboard layout changed paused game state')
                    canvas = page.locator('.' + canvas_class)
                    view = page.locator('#solo-game > section')
                    assert view.get_attribute('data-keyboard-layout') == selected
                    label = 'Z Q S D' if selected == 'zqsd' else 'W A S D'
                    spoken = canvas.get_attribute('aria-label')
                    assert label in spoken or label.replace(' ', '') in spoken, (game, spoken)
                    toggle_pause(page)
                    canvas.focus()
                    left = 'q' if selected == 'zqsd' else 'a'
                    up = 'z' if selected == 'zqsd' else 'w'
                    if game in ('ember-delve', 'rift-survivor'):
                        x = state(page)['player']['x']
                        page.keyboard.down(left)
                        page.wait_for_timeout(150)
                        page.keyboard.up(left)
                        assert state(page)['player']['x'] < x - 8, (game, selected, 'Native left did not move')
                    elif game in ('night-drive', 'paris-pedal'):
                        button = page.locator(left_button(prefix))
                        page.keyboard.down(left)
                        assert button.get_attribute('aria-pressed') == 'true', (game, selected, 'Native left not held')
                        page.keyboard.up(left)
                        assert button.get_attribute('aria-pressed') == 'false', (game, selected, 'Native left not released')
                        throttle = page.locator(f'.{prefix}-controls [data-control="throttle"]')
                        page.keyboard.down(up)
                        assert throttle.get_attribute('aria-pressed') == 'true', (game, selected, 'Native up not held')
                        page.keyboard.up(up)
                        assert throttle.get_attribute('aria-pressed') == 'false'
                    elif game == 'prism-shift':
                        if state(page)['active']['type'] == 'O':
                            page.keyboard.press('c')
                        assert state(page)['active']['type'] != 'O', 'Use a piece with visible rotation'
                        before_piece = state(page)['active']
                        page.keyboard.press(left)
                        assert state(page)['active']['x'] == before_piece['x'] - 1
                        rotation = state(page)['active']['rotation']
                        page.keyboard.press(up)
                        assert state(page)['active']['rotation'] == (rotation + 1) % 4
                        reverse = 'w' if selected == 'zqsd' else 'z'
                        page.keyboard.press(reverse)
                        assert state(page)['active']['rotation'] == rotation, (game, selected, 'Counterrotation conflict')
                        assert page.locator('.prism-control[data-action="rotateCCW"] .prism-control-key').inner_text() == reverse.upper()
                    # Typing in editable UI is never converted into game input.
                    toggle_pause(page)
                    before = state(page)
                    page.evaluate('''() => {
                        const input = document.createElement('input'); input.id='keyboard-qa-input';
                        document.querySelector('#solo-game').append(input); input.focus();
                    }''')
                    page.keyboard.type('zqsdwasd')
                    assert page.locator('#keyboard-qa-input').input_value() == 'zqsdwasd'
                    assert state(page) == before, (game, selected, 'Form typing changed game')
                    page.locator('#keyboard-qa-input').evaluate('input => input.remove()')
                    results.append({'game': game, 'layout': selected, 'native_controls': True, 'paused_layout_preserved': True, 'form_typing': True})
                # Actual AZERTY event.key wins over a conflicting physical code.
                layout(page, 'zqsd')
                toggle_pause(page)
                canvas.focus()
                if game in ('night-drive', 'paris-pedal'):
                    button = page.locator(left_button(prefix))
                    assert mismatch(page, 'q', 'KeyA')
                    assert button.get_attribute('aria-pressed') == 'true', (game, 'AZERTY left ignored')
                    mismatch(page, 'q', 'KeyA', 'keyup')
                    assert button.get_attribute('aria-pressed') == 'false', (game, 'AZERTY keyup stuck')
                    page.keyboard.down('q')
                    # Change the preference while a key is physically held.
                    page.evaluate("async () => (await import('/keyboard-layout.js')).setKeyboardLayout('wasd')")
                    assert button.get_attribute('aria-pressed') == 'false', (game, 'Held control survived layout change')
                    page.keyboard.up('q')
                elif game in ('ember-delve', 'rift-survivor'):
                    x = state(page)['player']['x']
                    mismatch(page, 'q', 'KeyA')
                    page.wait_for_timeout(150)
                    mismatch(page, 'q', 'KeyA', 'keyup')
                    assert state(page)['player']['x'] < x - 8, (game, 'AZERTY letter direction failed')
                    page.keyboard.down('q')
                    page.wait_for_timeout(80)
                    page.evaluate("async () => (await import('/keyboard-layout.js')).setKeyboardLayout('wasd')")
                    page.wait_for_timeout(250)
                    x = state(page)['player']['x']
                    page.wait_for_timeout(150)
                    assert abs(state(page)['player']['x'] - x) < 1, (game, 'Held movement survived layout change')
                    page.keyboard.up('q')
                elif game == 'prism-shift':
                    x = state(page)['active']['x']
                    assert mismatch(page, 'q', 'KeyA')
                    mismatch(page, 'q', 'KeyA', 'keyup')
                    assert state(page)['active']['x'] == x - 1, 'AZERTY Prism left failed'
                    page.keyboard.down('q')
                    page.evaluate("async () => (await import('/keyboard-layout.js')).setKeyboardLayout('wasd')")
                    x = state(page)['active']['x']
                    page.wait_for_timeout(350)
                    assert state(page)['active']['x'] == x, 'Prism auto-repeat survived layout change'
                    page.keyboard.up('q')
                print(json.dumps({'game': game, 'native_layouts': 2, 'azerty_event_shape': True}), flush=True)
            assert not errors, errors
            assert not failed_resources, failed_resources
            print(json.dumps({'passed': results, 'errors': errors, 'failed_resources': failed_resources}, indent=2))
        finally:
            browser.close()


if __name__ == '__main__':
    run((sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3000').rstrip('/'))
