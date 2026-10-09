"""Native Last Stand checks for the new monster roster.

Run against the freshly started frozen build:
  python test/voxel-monsters-browser-smoke.py http://127.0.0.1:3136
SEMAG_MONSTER_CASES selects hound,melee,coop. Only trusted browser keyboard and
mouse input changes play. Copies of snapshots and pure geometry guide checks;
simulation, sockets, clocks and gameplay handlers are never patched. Later-wave
abilities are exercised by the independent deterministic Node suite rather than
skipping real waves. Software WebGL observations do not measure hardware FPS.
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
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3136').rstrip('/')
OUT = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', '/workspace/scratch/semag-monsters-release/native'))
REPORT = {'cases': [], 'failures': [], 'errors': [], 'failed_resources': [], 'screenshots': [], 'working_bytes': [],
          'input_policy': 'Trusted keyboard and mouse; copied state and pure geometry only',
          'performance_scope': 'Software WebGL behavioral checks; no hardware FPS claim'}
LAUNCH = {'executable_path': '/usr/bin/chromium', 'headless': True,
          'args': ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle',
                   '--use-angle=swiftshader', '--enable-unsafe-swiftshader']}
spec = importlib.util.spec_from_file_location('monster_native_horde', ROOT / 'test/voxel-horde-browser-smoke.py')
horde = importlib.util.module_from_spec(spec)
spec.loader.exec_module(horde)
horde.URL = URL
horde.OUT = OUT / 'helper-evidence'


def save():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'report.json').write_text(json.dumps(REPORT, indent=2))


def log(stage, **details):
    print(json.dumps({'stage': stage, **details}), flush=True)


def freeze(stage):
    files = sorted(path for path in (ROOT / 'public').rglob('*') if path.is_file())
    files += [ROOT / 'server.js', ROOT / 'package.json', ROOT / 'package-lock.json', ROOT / 'README.md']
    hashes = {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in files}
    old = REPORT['working_bytes'][0]['sha256'] if REPORT['working_bytes'] else {}
    changed = [name for name, digest in hashes.items() if old and old.get(name) != digest]
    REPORT['working_bytes'].append({'stage': stage, 'sha256': hashes, 'changed_since_start': changed})
    save()
    assert not changed, ('Production changed during native checks', changed)


def context(browser, tag, scale=.8):
    ctx = browser.new_context(viewport={'width': 1200, 'height': 780}, device_scale_factor=scale)
    page = ctx.new_page()
    page.on('pageerror', lambda error: REPORT['errors'].append(f'{tag}: {error}'))
    page.on('console', lambda msg: REPORT['errors'].append(f'{tag}: {msg.text}') if msg.type == 'error' else None)
    page.on('response', lambda response: REPORT['failed_resources'].append(f'{tag}: {response.status} {response.url}') if response.status >= 400 else None)
    return ctx, page


def screenshot(page, name):
    path = OUT / (name + '.png')
    page.locator('#horde-shell').screenshot(path=str(path), timeout=10000)
    REPORT['screenshots'].append(str(path)); save()
    return str(path)


def check(page):
    seen = horde.snapshot(page)
    assert not seen['graphicsError'] and seen['renderCount'] > 0
    stats = seen['renderStats']
    assert stats['mapVertices'] < 100000 and stats['dynamicVertices'] < 72000 and stats['cachedMaps'] <= 3, stats
    state = seen['state']
    assert len(state['players']) <= state['capacity'] + 20 and len(state['events']) <= 256
    assert len(state['loot']) <= 20 and len(state['spawnWarnings']) <= 4
    for body in state['players']:
        assert all(math.isfinite(body[key]) for key in ('x', 'y', 'z', 'vx', 'vy', 'vz', 'hp', 'yaw', 'pitch'))
        if body.get('monsterType') == 'hound':
            assert body['radius'] == .5 and body['maxHp'] == 45
            assert body['hasGun'] is False and all(item is None for item in body['inventory'])
            assert body['shots'] == 0 and body['grenades'] == 0 and body['potions'] == 0
    return seen


def close_context(ctx, page, tag):
    if sys.exc_info()[0] is not None and not page.is_closed():
        try:
            (OUT / ('failure-' + tag + '.json')).write_text(json.dumps(horde.snapshot(page), indent=2))
            screenshot(page, 'failure-' + tag)
        except Exception as error:
            log('failure-evidence-unavailable', name=tag, error=str(error))
    ctx.close()


def dog(page):
    own = horde.actor(page)
    choices = [body for body in horde.snapshot(page)['state']['players']
               if body.get('monsterType') == 'hound' and body['alive'] and body.get('emergenceTicks', 0) == 0]
    return min(choices, key=lambda body: math.hypot(body['x'] - own['x'], body['z'] - own['z'])) if choices else None


def fast_aim(page, target, height=.43, head=False):
    """Calibrated real mouse movement lets a player react to a fast low body."""
    assert horde.snapshot(page)['controls']['pointerLocked']
    sx, sy = horde.CALIBRATION[id(page)]
    box = page.locator('#horde-canvas').bounding_box()
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    page.mouse.move(x, y)
    for _ in range(5):
        seen = horde.snapshot(page); own = seen['state']['players'][seen['playerId']]
        target = next((body for body in seen['state']['players'] if body['id'] == target['id'] and body['alive']), target)
        # At bite distance the head is visibly ahead of the torso. Aim at the
        # center of that real oriented box rather than the empty space above
        # the animal's center. This changes only actual native mouse movement.
        target_x = target['x'] + (.32 * math.sin(target['yaw']) if head else 0)
        target_z = target['z'] - (.32 * math.cos(target['yaw']) if head else 0)
        desired_yaw = math.atan2(target_x - own['x'], -(target_z - own['z']))
        desired_pitch = math.atan2(target['y'] + height - own['y'] - 1.62, math.hypot(target_x - own['x'], target_z - own['z'])) - own['recoil']
        dyaw = horde.native.angle_delta(desired_yaw, seen['aim']['yaw'])
        dpitch = desired_pitch - seen['aim']['pitch']
        if abs(dyaw) < .03 and abs(dpitch) < .03:
            return
        dx = max(-box['width'] * .4, min(box['width'] * .4, dyaw / sx))
        dy = max(-box['height'] * .4, min(box['height'] * .4, dpitch / sy))
        page.mouse.move(x + dx, y + dy, steps=1)
        x, y = x + dx, y + dy


def begin(browser, tag):
    ctx, page = context(browser, tag)
    horde.solo(page, weapon='carbine')
    horde.select_native(page, '#horde-melee', 'katana')
    page.locator('#horde-sound').click()
    horde.wait(page, 'window.semagHorde.getState().monsterAudio.enabled')
    horde.start_solo(page)
    horde.CALIBRATION.pop(id(page), None)
    horde.aim(page, 0, 0)
    return ctx, page


def hound_case(browser):
    ctx, page = begin(browser, 'hound')
    try:
        horde.wait(page, 'window.semagHorde.getState().state.players.some(p=>p.monsterType==="hound"&&p.alive&&p.emergenceTicks===0)', timeout=15000)
        target = dog(page); assert target
        start = check(page)
        before = {'x': target['x'], 'z': target['z'], 'id': target['id'], 'hp': horde.actor(page)['hp']}
        fast_aim(page, target)
        screenshot(page, 'grave-hound-approaching')
        deadline = time.monotonic() + 14
        bite = None; peak_speed = 0; close_image = None
        while time.monotonic() < deadline and horde.actor(page)['alive']:
            seen = check(page); target = dog(page)
            if target:
                peak_speed = max(peak_speed, math.hypot(target['vx'], target['vz']))
                own = horde.actor(page)
                distance = math.hypot(target['x'] - own['x'], target['z'] - own['z'])
                if distance < 4:
                    fast_aim(page, target)
                    if close_image is None:
                        close_image = screenshot(page, 'grave-hound-close-native')
            bite = next((event for event in reversed(seen['state']['events']) if event['type'] == 'damage'
                         and event.get('weapon') == 'hound' and event.get('targetId') == 0), None)
            if bite:
                break
            page.wait_for_timeout(50)
        assert bite and bite['damage'] == 12 and bite['attack'] == 'monster', ('No weak actual hound bite', bite)
        target = dog(page); assert target
        assert math.hypot(target['x'] - before['x'], target['z'] - before['z']) > .5
        assert 5.2 < peak_speed <= 6.8 + 1e-6, peak_speed
        body_bounds = page.evaluate('''async id=>{const {monsterMeshes}=await import('/voxel-renderer.js');
          const s=window.semagHorde.getState(),p=s.state.players.find(p=>p.id===id),v=monsterMeshes(p,s.state.tick*1000/120);
          let min=Infinity,max=-Infinity,r=0;for(let i=0;i<v.length;i+=10){min=Math.min(min,v[i+1]-p.y);max=Math.max(max,v[i+1]-p.y);r=Math.max(r,Math.hypot(v[i]-p.x,v[i+2]-p.z));}
          return{min,max,r,vertices:v.length/10};}''', target['id'])
        assert -.000001 <= body_bounds['min'] <= .05 and .7 < body_bounds['max'] <= .8 + 1e-6
        assert body_bounds['r'] <= .5 + 1e-6
        fast_aim(page, target, .65, head=True)
        event_id = horde.snapshot(page)['state']['eventId']
        page.mouse.down(button='left'); page.wait_for_timeout(40); page.mouse.up(button='left')
        horde.wait(page, '([id,before])=>window.semagHorde.getState().state.events.some(e=>e.id>before&&e.type==="kill"&&e.targetId===id&&e.playerId===0)', [target['id'], event_id], timeout=3000)
        final = check(page)
        hit = next(event for event in final['state']['events'] if event['id'] > event_id and event['type'] == 'damage' and event.get('targetId') == target['id'])
        assert hit['headshot'] and hit['hitKind'] == 'head' and hit['damage'] >= 45
        new_drops = [event for event in final['state']['events'] if event['id'] > event_id and event['type'] == 'hordeDrop']
        assert all(event.get('kind') not in ('weapon', 'melee') for event in new_drops), 'the actual animal kill cannot drop a gun or blade'
        assert final['monsterAudio']['played'] >= 1 and final['monsterAudio']['cachedBuffers'] >= 1
        assert final['monsterAudio']['activeVoices'] <= 24
        return {'actual_wave': 1, 'hound_first_sample': before, 'actual_bite': bite, 'low_model_bounds': body_bounds,
                'observed_peak_speed': peak_speed, 'native_headshot': hit, 'actual_kill_drops': new_drops,
                'opted_in_real_hound_audio': final['monsterAudio'], 'renderer': final['renderStats'], 'close_screenshot': close_image,
                'spawn_warning': next(event for event in start['state']['events'] if event['type'] == 'monsterRift' and event['monsterType'] == 'hound')}
    finally:
        close_context(ctx, page, 'hound')


def melee_case(browser):
    ctx, page = begin(browser, 'melee')
    try:
        horde.tap(page, '1', code='Digit1', duration=45)
        horde.wait(page, 'window.semagHorde.getState().state.players[0].inventoryIndex===0')
        deadline = time.monotonic() + 18
        kill = None; target = None
        while time.monotonic() < deadline and horde.actor(page)['alive']:
            target = dog(page)
            if target:
                own = horde.actor(page)
                distance = math.hypot(target['x'] - own['x'], target['z'] - own['z'])
                if distance < 2.65:
                    fast_aim(page, target, .40)
                    before = horde.snapshot(page)['state']['eventId']
                    page.mouse.down(button='left'); page.wait_for_timeout(40); page.mouse.up(button='left')
                    try:
                        horde.wait(page, '([id,before])=>window.semagHorde.getState().state.events.some(e=>e.id>before&&e.type==="kill"&&e.targetId===id&&e.playerId===0&&e.weapon==="katana")', [target['id'], before], timeout=800)
                    except Exception:
                        pass
                    seen = check(page)
                    kill = next((event for event in seen['state']['events'] if event['type'] == 'kill'
                                 and event.get('targetId') == target['id'] and event.get('weapon') == 'katana'), None)
                    if kill:
                        break
            page.wait_for_timeout(50)
        assert kill, 'The real low hound must be reachable by a committed native blade swing'
        seen = check(page); own = horde.actor(page)
        assert own['shots'] == 0 and seen['state']['horde']['wave'] == 1
        hit = next(event for event in seen['state']['events'] if event['type'] == 'damage' and event.get('targetId') == target['id'] and event.get('weapon') == 'katana')
        assert hit['damage'] == 45 and hit['hitKind'] == 'body', 'confirmed damage is capped by the real remaining hound HP'
        image = screenshot(page, 'grave-hound-katana-native-impact')
        return {'native_low_body_melee_contact': hit, 'native_kill': kill, 'gun_rounds': own['shots'], 'screenshot': image, 'renderer': seen['renderStats']}
    finally:
        close_context(ctx, page, 'melee')


def coop_case(browser):
    contexts, pages = [], []
    try:
        for index in range(2):
            ctx, page = context(browser, 'coop/' + str(index), scale=.6)
            contexts.append(ctx); pages.append(page)
        code = horde.create_room(pages[0])
        pages[1].goto(pages[0].url); horde.connected(pages[1])
        for page in pages:
            page.locator('#horde-ready').click()
        horde.wait(pages[0], '!document.querySelector("#horde-start").disabled')
        pages[0].locator('#horde-start').click()
        for page in pages:
            horde.phase(page, 'fight', timeout=20000)
        horde.wait(pages[0], 'window.semagHorde.getState().state.players.some(p=>p.monsterType==="hound"&&p.alive&&p.emergenceTicks===0)', timeout=15000)
        horde.wait(pages[1], 'window.semagHorde.getState().state.players.some(p=>p.monsterType==="hound"&&p.alive&&p.emergenceTicks===0)', timeout=15000)
        copies = [check(page) for page in pages]
        dogs = [next(body for body in seen['state']['players'] if body.get('monsterType') == 'hound' and body['alive']) for seen in copies]
        assert dogs[0]['id'] == dogs[1]['id'] and dogs[0]['lifeId'] == dogs[1]['lifeId']
        assert copies[0]['state']['horde']['participantIds'] == [0, 1]
        pages[0].bring_to_front(); horde.enter(pages[0]); horde.CALIBRATION.pop(id(pages[0]), None)
        horde.aim(pages[0], math.atan2(dogs[0]['x'] - horde.actor(pages[0])['x'], -(dogs[0]['z'] - horde.actor(pages[0])['z'])), -.25, precise=False)
        image = screenshot(pages[0], 'grave-hound-coop-native')
        return {'room': code, 'real_connected_survivors': 2, 'shared_id': dogs[0]['id'], 'shared_life': dogs[0]['lifeId'],
                'replicated_hounds': dogs, 'renderers': [seen['renderStats'] for seen in copies], 'screenshot': image}
    finally:
        for index, (ctx, page) in enumerate(zip(contexts, pages)):
            close_context(ctx, page, 'coop-' + str(index))


def main():
    OUT.mkdir(parents=True, exist_ok=True); horde.OUT.mkdir(parents=True, exist_ok=True)
    freeze('before')
    cases = {'hound': hound_case, 'melee': melee_case, 'coop': coop_case}
    requested = os.environ.get('SEMAG_MONSTER_CASES', 'hound,melee,coop').split(',')
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(**LAUNCH)
        try:
            for name in requested:
                try:
                    log('case-start', name=name)
                    result = cases[name](browser)
                    REPORT['cases'].append({'name': name, **result}); log('case-passed', name=name)
                except Exception as error:
                    REPORT['failures'].append({'name': name, 'error': str(error), 'traceback': traceback.format_exc()})
                    log('case-failed', name=name, error=str(error))
                save(); freeze('after-' + name)
        finally:
            browser.close()
    freeze('after'); save()
    assert not REPORT['failures'] and not REPORT['errors'] and not REPORT['failed_resources'], {
        'failures': REPORT['failures'], 'errors': REPORT['errors'], 'failed_resources': REPORT['failed_resources']}
    log('completed', cases=len(REPORT['cases']), screenshots=len(REPORT['screenshots']))


if __name__ == '__main__':
    main()
