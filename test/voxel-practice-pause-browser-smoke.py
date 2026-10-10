"""Native P-menu and Escape fullscreen checks for voxel practice and the dojo.

Run: python test/voxel-practice-pause-browser-smoke.py http://127.0.0.1:3000
Uses real keyboard, mouse and armory controls. Game state is read only.
Software WebGL checks behavior; it does not measure hardware performance.
"""
import hashlib
import json
import os
from pathlib import Path
import sys

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3000').rstrip('/')
OUT = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', '/workspace/scratch/semag-practice-pause-browser'))
REPORT = {'cases': [], 'errors': [], 'failed_resources': [], 'websockets': []}
SOURCES = ['voxel-practice.html', 'voxel-practice-client.js', 'pause-shortcut.js']


def hashes():
    return {name: hashlib.sha256((ROOT / 'public' / name).read_bytes()).hexdigest() for name in SOURCES}


def snapshot(page):
    return page.evaluate('window.firesidePractice.getState()')


def wait_phase(page, phase):
    page.wait_for_function('phase=>window.firesidePractice?.getState().state.phase===phase', arg=phase, timeout=15000)


def frozen(page):
    state = snapshot(page)['state']
    page.wait_for_timeout(200)
    assert snapshot(page)['state'] == state, 'Paused simulation advanced'
    assert not snapshot(page)['controls']['pointerLocked'], 'Paused game retained pointer capture'
    assert not any(value for key, value in snapshot(page)['input'].items() if key not in ('yaw', 'pitch', 'dojoWeapon', 'dojoBlade'))
    return state


def armory_weapon(page, weapon):
    page.locator('#practice-loadout-field [data-armory-action="open"]').click()
    dialog = page.locator('[data-voxel-armory][data-kind="gun"]')
    dialog.wait_for(state='visible')
    search = dialog.locator('[data-armory-search]')
    search.click()
    page.keyboard.press('p')
    assert search.input_value() == 'p', 'Pause shortcut swallowed armory text input'
    assert snapshot(page)['state']['phase'] == 'ready'
    page.keyboard.press('Control+a')
    page.keyboard.press('Backspace')
    dialog.locator(f'[data-weapon-id="{weapon}"]').click()
    dialog.locator('[data-armory-action="equip"]').click()
    dialog.wait_for(state='hidden')
    assert snapshot(page)['state']['practice']['config']['weapon'] == weapon


def practice_case(browser, mode, query):
    context = browser.new_context(viewport={'width': 1440, 'height': 900})
    page = context.new_page()
    page.on('pageerror', lambda error: REPORT['errors'].append({'mode': mode, 'message': str(error)}))
    page.on('response', lambda response: REPORT['failed_resources'].append({'mode': mode, 'url': response.url, 'status': response.status}) if response.status >= 400 else None)
    page.on('websocket', lambda socket: REPORT['websockets'].append({'mode': mode, 'url': socket.url}))
    try:
        page.goto(URL + '/voxel-practice.html' + query)
        page.wait_for_function('window.firesidePractice?.getState().state.phase==="ready"&&!document.querySelector("#practice-start").disabled')
        page.keyboard.press('p')
        assert snapshot(page)['state']['phase'] == 'ready', 'P started a game from setup'
        page.locator('#practice-start').click()
        wait_phase(page, 'countdown')
        page.keyboard.down('p')
        wait_phase(page, 'paused')
        paused = frozen(page)
        page.keyboard.down('p')  # Native repeat must not toggle back to play.
        assert snapshot(page)['state'] == paused
        page.keyboard.up('p')
        assert page.locator('#practice-resume').evaluate('element=>element===document.activeElement')
        page.keyboard.press('p')  # A focused Resume button still accepts P.
        wait_phase(page, 'countdown')
        wait_phase(page, 'fight')
        if mode == 'dojo':
            page.keyboard.press('Tab')
            assert page.locator('#dojo-tools').is_visible()
            page.keyboard.press('p')  # The focused gun-rack trigger is a button.
            wait_phase(page, 'paused')
            assert page.locator('#dojo-tools').is_hidden()
            assert page.locator('#dojo-tools-toggle').get_attribute('aria-expanded') == 'false'
            frozen(page)
            page.keyboard.press('p')
            wait_phase(page, 'fight')
        page.keyboard.down('w')
        page.wait_for_timeout(100)
        page.keyboard.press('p')
        page.keyboard.up('w')
        wait_phase(page, 'paused')
        frozen(page)
        page.locator('#practice-help').click()
        assert page.locator('#practice-guide').is_visible()
        page.keyboard.press('p')
        wait_phase(page, 'fight')
        assert page.locator('#practice-guide').is_hidden()
        page.keyboard.press('p')
        wait_phase(page, 'paused')
        page.locator('#practice-help').click()
        page.keyboard.press('Escape')
        assert page.locator('#practice-guide').is_hidden()
        wait_phase(page, 'paused')
        frozen(page)  # Closing help with Escape never recaptures the cursor.

        page.locator('#practice-fullscreen').click()
        page.wait_for_function('document.fullscreenElement?.id==="practice-shell"')
        page.keyboard.press('p')
        wait_phase(page, 'fight')
        page.keyboard.press('p')
        wait_phase(page, 'paused')
        assert page.evaluate('document.fullscreenElement?.id') == 'practice-shell', 'P exited fullscreen'
        page.keyboard.press('p')
        wait_phase(page, 'fight')
        page.keyboard.press('Escape')
        wait_phase(page, 'paused')
        frozen(page)
        # CDP key presses reach the page, but some headless Chromium versions
        # do not execute the browser's fullscreen Escape binding. Record that
        # limitation and exit through the genuine fullscreen button instead.
        page.wait_for_timeout(100)
        escape_exited_fullscreen = page.evaluate('!document.fullscreenElement')
        if not escape_exited_fullscreen:
            page.locator('#practice-fullscreen').click()
            page.wait_for_function('!document.fullscreenElement')
        frozen(page)
        page.screenshot(path=str(OUT / f'{mode}-pause-menu.png'), full_page=True)

        page.locator('#practice-change-setup').click()
        wait_phase(page, 'ready')
        assert snapshot(page)['state']['tick'] == 0, 'Change setup did not reset the drill'
        if mode != 'royale':
            armory_weapon(page, 'guardian')
            page.locator('#practice-start').click()
            wait_phase(page, 'countdown')
            assert snapshot(page)['state']['players'][0]['weapon'] == 'guardian'
            page.keyboard.press('p')
            wait_phase(page, 'paused')
            frozen(page)
        REPORT['cases'].append({'mode': mode, 'passed': True, 'escape_browser_exited_fullscreen': escape_exited_fullscreen, 'checks': ['ready-no-autostart', 'countdown-pause-resume', 'repeat-guard', 'focused-button-resume', 'fight-input-release', 'guide-p-resume', 'guide-escape-close', 'p-keeps-fullscreen', 'escape-pauses-releases-cursor', 'native-fullscreen-button-exit', 'setup-restarts-drill'] + ([] if mode == 'royale' else ['armory-text-input', 'new-loadout-on-start']) + (['range-tools-focused-button-pause'] if mode == 'dojo' else [])})
        print(json.dumps(REPORT['cases'][-1]), flush=True)
    except BaseException:
        page.screenshot(path=str(OUT / f'{mode}-failure.png'), full_page=True)
        (OUT / f'{mode}-failure.json').write_text(json.dumps(snapshot(page), indent=2))
        raise
    finally:
        context.close()


def active_fullscreen_loss_case(browser):
    # Touch hardware avoids pointer lock: fullscreen loss itself must pause,
    # without relying on the separate pointerlockchange safety handler.
    context = browser.new_context(viewport={'width': 1440, 'height': 900}, has_touch=True, is_mobile=True)
    page = context.new_page()
    page.on('pageerror', lambda error: REPORT['errors'].append({'mode': 'touch-dojo', 'message': str(error)}))
    page.on('response', lambda response: REPORT['failed_resources'].append({'mode': 'touch-dojo', 'url': response.url, 'status': response.status}) if response.status >= 400 else None)
    page.on('websocket', lambda socket: REPORT['websockets'].append({'mode': 'touch-dojo', 'url': socket.url}))
    try:
        page.goto(URL + '/voxel-practice.html?mode=dojo')
        page.wait_for_function('window.firesidePractice?.getState().state.phase==="ready"&&!document.querySelector("#practice-start").disabled')
        page.locator('#practice-fullscreen').tap()
        page.wait_for_function('document.fullscreenElement?.id==="practice-shell"')
        page.locator('#practice-start').tap()
        wait_phase(page, 'fight')
        assert not snapshot(page)['controls']['pointerLocked']
        assert page.evaluate('document.fullscreenElement?.id') == 'practice-shell'
        page.locator('#practice-fullscreen').tap()
        page.wait_for_function('!document.fullscreenElement')
        wait_phase(page, 'paused')
        frozen(page)
        REPORT['cases'].append({'mode': 'touch-dojo', 'passed': True, 'checks': ['active-native-fullscreen-button-exit-pauses-without-pointerlock']})
        print(json.dumps(REPORT['cases'][-1]), flush=True)
    finally:
        context.close()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    REPORT['sources'] = hashes()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=os.environ.get('SEMAG_CHROMIUM_PATH', '/usr/bin/chromium'), headless=True, args=['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            try:
                for mode, query in [('breach', '?game=voxel'), ('royale', '?game=voxel-royale'), ('dojo', '?mode=dojo')]:
                    practice_case(browser, mode, query)
                active_fullscreen_loss_case(browser)
            finally:
                browser.close()
        assert REPORT['sources'] == hashes(), 'Practice sources changed during native QA'
        assert not REPORT['errors'], REPORT['errors']
        assert not REPORT['failed_resources'], REPORT['failed_resources']
        assert not REPORT['websockets'], 'Solo practice opened a multiplayer socket'
        REPORT['passed'] = True
    except BaseException as error:
        REPORT['passed'] = False
        REPORT['failure'] = repr(error)
        raise
    finally:
        (OUT / 'report.json').write_text(json.dumps(REPORT, indent=2))
        print(json.dumps({'report': str(OUT / 'report.json'), 'passed': REPORT.get('passed')}), flush=True)


if __name__ == '__main__':
    main()
