"""Trusted native checks for shared voxel shot feedback and walking camera motion.

python test/voxel-feel-browser-smoke.py http://127.0.0.1:3000
SEMAG_FEEL_CASES selects practice,horde. SEMAG_SCREENSHOT_DIR selects artifacts.
One real Chromium game page runs at a time. Game actions use actual keyboard,
mouse and native controls; observations copy product debug snapshots only.
No game state, input handler, WebSocket, animation frame or clock is replaced.
SwiftShader observations verify behavior, not hardware refresh-rate performance.
"""
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import sys
import time
import traceback

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3000').rstrip('/')
OUT = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', '/workspace/scratch/semag-fps-feel-native'))
REPORT = {'cases': [], 'failures': [], 'errors': [], 'failed_resources': [],
          'screenshots': [], 'working_bytes': [],
          'input_policy': 'Trusted native keyboard/mouse; copied product state; no WS/RAF/clock/game replacement',
          'performance_scope': 'Software WebGL behavioral checks; no hardware FPS claims'}
MODE = {}


def load_fixture(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'test' / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.URL = URL
    return module


practice = load_fixture('feel_practice_native', 'voxel-practice-browser-smoke.py')
horde = load_fixture('feel_horde_native', 'voxel-horde-browser-smoke.py')


def log(stage, **details):
    print(json.dumps({'stage': stage, **details}), flush=True)


def save_report():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'report.json').write_text(json.dumps(REPORT, indent=2))


def freeze(stage):
    files = [ROOT / 'server.js', ROOT / 'package.json', ROOT / 'public/audio.js', Path(__file__).resolve()]
    files += sorted((ROOT / 'public').glob('voxel*'))
    hashes = {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
              for path in files if path.is_file()}
    previous = REPORT['working_bytes'][-1]['sha256'] if REPORT['working_bytes'] else {}
    manifest = {'stage': stage, 'sha256': hashes,
                'changed_since_previous': [name for name in hashes if previous and previous.get(name) != hashes[name]]}
    REPORT['working_bytes'].append(manifest)
    save_report()
    return hashes


def debug(page):
    return 'firesidePractice' if MODE[id(page)] == 'practice' else 'semagHorde'


def snapshot(page):
    return page.evaluate('window.' + debug(page) + '.getState()')


def actor(page):
    seen = snapshot(page)
    ident = 0 if MODE[id(page)] == 'practice' else seen['playerId']
    return next(player for player in seen['state']['players'] if player['id'] == ident)


def observe(page, tag):
    page.on('pageerror', lambda error: REPORT['errors'].append({'page': tag, 'error': str(error)}))
    page.on('console', lambda message: REPORT['errors'].append({'page': tag, 'error': message.text}) if message.type == 'error' else None)
    page.on('response', lambda response: REPORT['failed_resources'].append({'page': tag, 'url': response.url, 'status': response.status}) if response.status >= 400 else None)


def wait(page, expression, arg=None, timeout=12000):
    return page.wait_for_function(expression, arg=arg, polling=25, timeout=timeout)


def compact(page):
    return page.evaluate('''name => {
      const seen=window[name].getState(),id=name==='firesidePractice'?0:seen.playerId;
      const p=seen.state.players.find(player=>player.id===id);
      return {phase:seen.state.phase,tick:seen.state.tick,renderCount:seen.renderCount,
        paused:seen.paused||seen.controls.paused,graphicsError:seen.graphicsError,
        player:{x:p.x,y:p.y,z:p.z,vx:p.vx,vz:p.vz,grounded:p.grounded,alive:p.alive,
          shots:p.shots,ammo:p.ammo,aimTicks:p.aimTicks,recoil:p.recoil,shotCooldown:p.shotCooldown},
        audio:seen.audio,renderer:seen.renderStats};
    }''', debug(page))


def samples(page, seconds=1, interval=35):
    seen, deadline = [], time.monotonic() + seconds
    while time.monotonic() < deadline:
        point = compact(page)
        if not seen or point['renderCount'] != seen[-1]['renderCount']:
            seen.append(point)
        page.wait_for_timeout(interval)
    assert len(seen) >= 3, ('Too few actual rendered observations', len(seen))
    assert all(not point['graphicsError'] for point in seen), seen
    return seen


def screenshot(page, name):
    path = OUT / (name + '.png')
    box = page.locator('#practice-shell' if MODE[id(page)] == 'practice' else '#horde-shell').bounding_box()
    page.screenshot(path=str(path), clip=box, timeout=5000)
    REPORT['screenshots'].append(str(path))
    save_report()


def record(name, **details):
    REPORT['cases'].append({'name': name, **details})
    log('case-passed', name=name)
    save_report()


def hold(page, key, seconds):
    page.keyboard.down(key)
    try:
        return samples(page, seconds)
    finally:
        page.keyboard.up(key)


def stop_settle(page):
    page.wait_for_timeout(650)
    return samples(page, .5)


def bob_size(point):
    return abs(point['renderer']['firstPerson']['bobY'])


def kick_size(point):
    return abs(point['renderer']['firstPerson']['shot']['kick'])


def check_motion(page):
    idle = stop_settle(page)
    moving = hold(page, 'a', 1.2)
    settled = stop_settle(page)
    displacement = math.hypot(moving[-1]['player']['x']-moving[0]['player']['x'], moving[-1]['player']['z']-moving[0]['player']['z'])
    assert displacement > .6, ('Native movement did not travel', displacement)
    assert max(map(bob_size, moving)) > .001, ('Walking produced no visible camera motion', moving)
    assert max(map(bob_size, settled)) < .001, ('Camera did not settle after release', settled)
    page.mouse.down(button='right')
    try:
        wait(page, 'name=>window[name].getState().state.players[0].aimTicks===18', debug(page))
        ads = hold(page, 'd', 1.2)
    finally:
        page.mouse.up(button='right')
    assert max(map(bob_size, ads)) < max(map(bob_size, moving)) * .55, ('ADS did not reduce head motion', moving, ads)
    stop_settle(page)
    record(MODE[id(page)] + '-actual-travel-camera-bob-stop-ads', idle=idle, moving=moving, settled=settled, ads=ads, displacement=displacement)


def check_shot(page):
    canvas = '#practice-canvas' if MODE[id(page)] == 'practice' else '#horde-canvas'
    box = page.locator(canvas).bounding_box()
    page.mouse.move(box['x'] + box['width']/2, box['y'] + box['height']/2)
    before = compact(page)
    assert before['audio']['enabled'] and before['player']['shotCooldown'] == 0, before
    page.mouse.down(button='left')
    try:
        observed = samples(page, 1)
    finally:
        page.mouse.up(button='left')
    recovered = samples(page, .65)
    after = recovered[-1]
    assert after['player']['shots'] == before['player']['shots'] + 1, ('Semi-auto emitted extra shots', before, after)
    assert after['player']['ammo'] == before['player']['ammo'] - 1, ('Shot did not consume one round', before, after)
    assert after['renderer']['firstPerson']['acceptedShots'] == before['renderer']['firstPerson']['acceptedShots'] + 1, ('Shell was not presented exactly once', before, after)
    assert max(map(kick_size, observed)) > .01, ('Shot had no rendered kick', observed)
    assert kick_size(after) < .001, ('Shot kick did not recover', after)
    assert after['audio']['played'] == before['audio']['played'] + 1, ('Shell did not schedule exactly one actual sound', before, after)
    assert after['audio']['cachedBuffers'] >= 1 and after['audio']['activeVoices'] == 0, after
    assert all(point['audio']['activeVoices'] <= point['audio']['maxVoices'] == 24 for point in observed), observed
    record(MODE[id(page)] + '-native-shell-ammo-kick-recovery-audio', before=before, observed=observed, recovered=recovered)


def check_pause(page):
    page.keyboard.press('Escape')
    wait(page, 'name=>window[name].getState().state.phase==="paused"', debug(page))
    paused = compact(page)
    page.wait_for_timeout(300)
    assert compact(page)['tick'] == paused['tick'], 'Solo world advanced while paused'
    page.locator('#practice-resume' if MODE[id(page)] == 'practice' else '#horde-resume').click()
    wait(page, 'name=>window[name].getState().state.phase==="fight"', debug(page))
    resumed = stop_settle(page)
    assert resumed[-1]['player']['shots'] == paused['player']['shots'], 'Resume replayed a shot'
    assert max(map(bob_size, resumed)) < .001 and max(map(kick_size, resumed)) < .001, resumed
    record(MODE[id(page)] + '-real-pause-resume-no-replay', paused=paused, resumed=resumed)


def check_wall(page):
    practice.aim(page, 0, 0)
    page.keyboard.down('s')
    try:
        wait(page, 'window.firesidePractice.getState().state.players[0].z>=21.67', timeout=18000)
        page.wait_for_timeout(650)
        blocked = samples(page, .8)
    finally:
        page.keyboard.up('s')
    travelled = math.hypot(blocked[-1]['player']['x']-blocked[0]['player']['x'], blocked[-1]['player']['z']-blocked[0]['player']['z'])
    assert travelled < .005, ('Wall hold continued travelling', travelled, blocked)
    assert max(map(bob_size, blocked)) < .001, ('Held key marched camera against wall', blocked)
    assert all(point['player']['z'] <= 21.681 for point in blocked), blocked
    record('practice-real-wall-contact-camera-settle', travelled=travelled, observed=blocked)


def check_mute(page):
    page.keyboard.press('Escape')
    wait(page, 'window.firesidePractice.getState().state.phase==="paused"')
    page.locator('#practice-sound').click()
    wait(page, 'document.querySelector("#practice-sound").getAttribute("aria-pressed")==="false"')
    muted = compact(page)
    assert not muted['audio']['enabled'] and muted['audio']['activeVoices'] == 0, muted
    page.locator('#practice-resume').click()
    wait(page, 'window.firesidePractice.getState().state.phase==="fight"')
    page.keyboard.press('c', delay=40)
    wait(page, 'before=>window.firesidePractice.getState().state.players[0].shots===before+1', muted['player']['shots'])
    played = compact(page)
    assert played['audio']['played'] == muted['audio']['played'] and played['audio']['activeVoices'] == 0, played
    page.keyboard.press('Escape')
    wait(page, 'window.firesidePractice.getState().state.phase==="paused"')
    page.locator('#practice-sound').click()
    wait(page, 'document.querySelector("#practice-sound").getAttribute("aria-pressed")==="true"')
    page.locator('#practice-resume').click()
    wait(page, 'window.firesidePractice.getState().state.phase==="fight"')
    resumed = stop_settle(page)
    assert resumed[-1]['audio']['played'] == muted['audio']['played'], 'Re-enabling replayed a muted shell'
    assert resumed[-1]['player']['shots'] == muted['player']['shots'] + 1, resumed
    record('practice-native-mute-shot-reenable-no-audio-replay', muted=muted, shot=played, resumed=resumed)


def practice_case(browser):
    context, page = practice.ready(browser, device_scale_factor=.6)
    MODE[id(page)] = 'practice'
    observe(page, 'practice')
    try:
        practice.select(page, '#practice-count', '1')
        practice.select(page, '#practice-weapon', 'pistol')
        practice.select(page, '#practice-keyboard-select', 'wasd')
        page.locator('#practice-sound').click()
        wait(page, 'document.querySelector("#practice-sound").getAttribute("aria-pressed")==="true"')
        practice.begin(page)
        check_motion(page)
        practice.aim(page, 0, -.6)
        check_shot(page)
        check_pause(page)
        check_wall(page)
        check_mute(page)
        screenshot(page, 'voxel-shot-feel-practice')
    finally:
        if sys.exc_info()[0] is not None:
            try:
                (OUT / 'practice-failure-state.json').write_text(json.dumps(snapshot(page), indent=2))
                screenshot(page, 'practice-failure')
            except Exception:
                pass
        context.close()


def horde_case(browser):
    context = browser.new_context(viewport={'width': 1000, 'height': 720}, device_scale_factor=.6)
    page = context.new_page()
    MODE[id(page)] = 'horde'
    observe(page, 'horde')
    try:
        horde.solo(page, weapon='pistol')
        page.locator('#horde-sound').click()
        wait(page, 'document.querySelector("#horde-sound").getAttribute("aria-pressed")==="true"')
        horde.start_solo(page)
        moving = hold(page, 'a', .65)
        assert max(map(bob_size, moving)) > .001, moving
        stop_settle(page)
        horde.aim(page, 0, -.6)
        check_shot(page)
        check_pause(page)
        record('last-stand-shared-native-walking-camera', observed=moving)
        screenshot(page, 'voxel-shot-feel-last-stand')
    finally:
        if sys.exc_info()[0] is not None:
            try:
                (OUT / 'horde-failure-state.json').write_text(json.dumps(snapshot(page), indent=2))
                screenshot(page, 'horde-failure')
            except Exception:
                pass
        context.close()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    selected = os.environ.get('SEMAG_FEEL_CASES', 'practice,horde').split(',')
    freeze('before')
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                args=['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            try:
                for name in selected:
                    {'practice': practice_case, 'horde': horde_case}[name](browser)
            finally:
                browser.close()
        assert not REPORT['errors'], REPORT['errors']
        assert not REPORT['failed_resources'], REPORT['failed_resources']
        freeze('after')
        assert not REPORT['working_bytes'][-1]['changed_since_previous'], REPORT['working_bytes'][-1]
        REPORT['passed'] = True
    except BaseException as error:
        REPORT['passed'] = False
        REPORT['failures'].append({'error': repr(error), 'traceback': traceback.format_exc()})
        raise
    finally:
        save_report()
        log('complete', passed=REPORT.get('passed'), cases=len(REPORT['cases']), report=str(OUT / 'report.json'))


if __name__ == '__main__':
    main()
