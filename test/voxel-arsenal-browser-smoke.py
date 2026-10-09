"""Trusted native QA for alternating guns, melee and confirmed hit reticles.

Run after the source freeze against a freshly started host:
  python test/voxel-arsenal-browser-smoke.py http://127.0.0.1:3135
SEMAG_ARSENAL_CASES selects guns,melee,reticles,scope,coop.
Only trusted mouse/keyboard input changes games. Read-only copied product
snapshots and immutable geometry guide observations; simulation state, input
handlers, sockets, clocks and animation frames are never replaced.
SwiftShader validates behavior and pixels, not hardware FPS performance.
"""
import base64
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
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3135').rstrip('/')
OUT = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', '/workspace/scratch/semag-arsenal-native'))
REPORT = {'cases': [], 'failures': [], 'errors': [], 'failed_resources': [], 'screenshots': [], 'working_bytes': [],
          'input_policy': 'Trusted native keyboard and mouse; copied state and geometry only',
          'performance_scope': 'Software WebGL behavioral and pixel checks; no hardware FPS claim'}
LAUNCH = {'executable_path': '/usr/bin/chromium', 'headless': True,
          'args': ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle',
                   '--use-angle=swiftshader', '--enable-unsafe-swiftshader']}


def helper(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'test' / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.URL = URL
    module.OUT = OUT / 'helper-evidence'
    return module


practice = helper('arsenal_practice_helpers', 'voxel-practice-browser-smoke.py')
horde = helper('arsenal_horde_helpers', 'voxel-horde-browser-smoke.py')


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


def context(browser, label, width=1200, height=760, scale=.8):
    ctx = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=scale)
    page = ctx.new_page()
    page.on('pageerror', lambda error: REPORT['errors'].append(f'{label}: {error}'))
    page.on('console', lambda msg: REPORT['errors'].append(f'{label}: {msg.text}') if msg.type == 'error' else None)
    page.on('response', lambda response: REPORT['failed_resources'].append(f'{label}: {response.status} {response.url}') if response.status >= 400 else None)
    return ctx, page


def screenshot(page, name, mode='practice', reticle=False):
    path = OUT / (name + '.png')
    bounds = page.locator('#' + mode + '-shell').bounding_box()
    assert bounds
    if reticle:
        canvas = page.locator('#' + mode + '-canvas').bounding_box()
        bounds = {'x': canvas['x'] + canvas['width'] / 2 - 80,
                  'y': canvas['y'] + canvas['height'] / 2 - 80, 'width': 160, 'height': 160}
    page.screenshot(path=str(path), clip=bounds, timeout=10000)
    REPORT['screenshots'].append(str(path)); save()
    return str(path)


def close_context(ctx, page, tag, mode='practice'):
    if sys.exc_info()[0] is not None and not page.is_closed():
        try:
            seen = practice.snapshot(page) if mode == 'practice' else horde.snapshot(page)
            (OUT / ('failure-' + tag + '.json')).write_text(json.dumps(seen, indent=2))
            screenshot(page, 'failure-' + tag, mode)
        except Exception as error:
            log('failure-evidence-unavailable', case=tag, error=str(error))
    ctx.close()


def check(seen, player_id=0):
    assert not seen['graphicsError'] and seen['renderCount'] > 0
    stats = seen['renderStats']
    assert stats['mapVertices'] < 100000 and stats['dynamicVertices'] < 72000 and stats['cachedMaps'] <= 3, stats
    body = next(player for player in seen['state']['players'] if player['id'] == player_id)
    assert body['maxHp'] == 200 and len(body['inventory']) == 4
    assert all(math.isfinite(body[key]) for key in ('x', 'y', 'z', 'vx', 'vy', 'vz', 'hp', 'yaw', 'pitch'))
    return body


def begin_practice(browser, weapon, melee='katana'):
    ctx, page = context(browser, weapon + '/' + melee)
    page.goto(URL + '/voxel-practice.html?game=voxel')
    practice.wait(page, 'window.firesidePractice?.getState().state.phase==="ready"&&!document.querySelector("#practice-start").disabled')
    practice.select(page, '#practice-count', '1')
    practice.select(page, '#practice-mode', 'targets')
    practice.select(page, '#practice-map', 'courtyard')
    practice.select(page, '#practice-weapon', weapon)
    practice.select(page, '#practice-melee', melee)
    assert practice.actor(page)['inventory'][0]['weapon'] == melee
    practice.begin(page)
    page.locator('#practice-canvas').focus()
    practice.CALIBRATION.pop(id(page), None)
    return ctx, page


def native_round(page):
    before = practice.actor(page)['shots']
    page.mouse.down(button='left')
    try:
        practice.wait(page, 'shots=>window.firesidePractice.getState().state.players[0].shots>shots', before, timeout=3000)
    finally:
        page.mouse.up(button='left')
    seen = practice.snapshot(page)
    body = check(seen)
    events = [event for event in seen['state']['events'] if event['type'] == 'shot' and event['playerId'] == 0]
    return body, events[-1], seen


def guns_case(browser):
    entries = []
    for weapon in ('dualpistols', 'dualsmg', 'slugshotgun'):
        ctx, page = begin_practice(browser, weapon)
        try:
            practice.aim(page, 0, .55)
            initial = check(practice.snapshot(page))
            images = [screenshot(page, 'arsenal-' + weapon + '-ready')]
            first, event, seen = native_round(page)
            if weapon == 'dualpistols':
                assert first['shots'] == 1 and first['ammo'] == initial['ammo'] - 1 and event['hand'] == 0
                images.append(screenshot(page, 'arsenal-dual-pistols-right-fired'))
                practice.wait(page, 'window.firesidePractice.getState().state.players[0].shotCooldown===0')
                second, next_event, seen = native_round(page)
                assert next_event['hand'] == 1 and second['ammo'] == initial['ammo'] - 2
                images.append(screenshot(page, 'arsenal-dual-pistols-left-fired'))
            elif weapon == 'dualsmg':
                page.mouse.down(button='left')
                page.wait_for_timeout(220)
                page.mouse.up(button='left')
                seen = practice.snapshot(page)
                rounds = [event for event in seen['state']['events'] if event['type'] == 'shot' and event['playerId'] == 0]
                assert len(rounds) >= 3
                assert [event['hand'] for event in rounds] == [index % 2 for index in range(len(rounds))]
                first = check(seen)
                assert initial['ammo'] - first['ammo'] == first['shots']
            else:
                assert first['shots'] == 1 and first['ammo'] == initial['ammo'] - 1 and event['pelletCount'] == 1
            page.mouse.down(button='right')
            practice.wait(page, 'window.firesidePractice.getState().state.players[0].aimTicks===18')
            ads = check(practice.snapshot(page)); assert ads['aimTicks'] == 18
            images.append(screenshot(page, 'arsenal-' + weapon + '-ads'))
            page.mouse.up(button='right')
            reserve = ads['reserve']
            page.keyboard.press('r', delay=45)
            practice.wait(page, 'window.firesidePractice.getState().state.players[0].reloadTicks>0')
            reload_pose = check(practice.snapshot(page))
            images.append(screenshot(page, 'arsenal-' + weapon + '-reload'))
            practice.wait(page, 'window.firesidePractice.getState().state.players[0].reloadTicks===0')
            reloaded = check(practice.snapshot(page))
            assert reloaded['ammo'] == initial['ammo'] and reloaded['reserve'] == reserve - reloaded['shots']
            practice.aim(page, 0, 0)
            page.keyboard.press('x', delay=45)
            practice.wait(page, 'window.firesidePractice.getState().state.players[0].inventory[1]===null')
            dropped = check(practice.snapshot(page)); assert dropped['slot'] == 'empty'
            page.wait_for_timeout(200)
            page.keyboard.press('e', delay=45)
            practice.wait(page, 'weapon=>window.firesidePractice.getState().state.players[0].inventory.some(item=>item?.weapon===weapon)', weapon)
            picked = check(practice.snapshot(page)); assert picked['weapon'] == weapon and picked['ammo'] == reloaded['ammo']
            entries.append({'weapon': weapon, 'native_round': event, 'right_mouse_ads': True,
                            'native_reload': reload_pose['reloadTicks'], 'ammo_preserved_after_drop_pickup': True,
                            'final': picked, 'renderer': seen['renderStats'], 'screenshots': images})
        finally:
            close_context(ctx, page, 'guns-' + weapon)
    return {'weapons': entries}


def closest_horde(page, maximum=100):
    seen = horde.snapshot(page); human = horde.actor(page)
    targets = sorted((player for player in seen['state']['players'] if player.get('monster') and player['alive'] and player.get('emergenceTicks', 0) == 0),
                     key=lambda player: math.hypot(player['x'] - human['x'], player['z'] - human['z']))
    if targets and math.hypot(targets[0]['x'] - human['x'], targets[0]['z'] - human['z']) < maximum:
        return targets[0]
    return None


def aim_horde_target(page, target, height):
    own = horde.actor(page)
    dx, dz = target['x'] - own['x'], target['z'] - own['z']
    horde.aim(page, math.atan2(dx, -dz), math.atan2(target['y'] + height - own['y'] - 1.62, math.hypot(dx, dz)) - own['recoil'])


def fast_melee_aim(page, target):
    """Use the calibrated native mouse slope during a short enemy windup."""
    seen = horde.snapshot(page)
    assert seen['controls']['pointerLocked']
    sx, sy = horde.CALIBRATION[id(page)]
    box = page.locator('#horde-canvas').bounding_box()
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    page.mouse.move(x, y)
    for _ in range(6):
        seen = horde.snapshot(page); own = seen['state']['players'][seen['playerId']]
        desired_yaw = math.atan2(target['x'] - own['x'], -(target['z'] - own['z']))
        desired_pitch = math.atan2(target['y'] + 1.23 - own['y'] - 1.62, math.hypot(target['x'] - own['x'], target['z'] - own['z']))
        dyaw = horde.native.angle_delta(desired_yaw, seen['aim']['yaw'])
        dpitch = desired_pitch - seen['aim']['pitch']
        if abs(dyaw) < .025 and abs(dpitch) < .025:
            return
        dx = max(-box['width'] * .4, min(box['width'] * .4, dyaw / sx))
        dy = max(-box['height'] * .4, min(box['height'] * .4, dpitch / sy))
        page.mouse.move(x + dx, y + dy, steps=1)
        x, y = x + dx, y + dy


def melee_case(browser):
    entries = []
    for weapon in os.environ.get('SEMAG_ARSENAL_BLADES', 'katana,axe,tonfas').split(','):
        ctx, page = context(browser, 'melee/' + weapon)
        try:
            horde.solo(page, weapon='dualpistols')
            horde.select_native(page, '#horde-melee', weapon)
            assert horde.actor(page)['inventory'][0]['weapon'] == weapon
            horde.start_solo(page)
            horde.tap(page, '1', code='Digit1', duration=55)
            horde.wait(page, 'window.semagHorde.getState().state.players[0].inventoryIndex===0')
            images = [screenshot(page, 'arsenal-' + weapon + '-equipped', 'horde')]
            # Calibrate trusted mouse movement before a close enemy windup.
            # A hit during recovery deliberately deals damage without a stun.
            horde.CALIBRATION.pop(id(page), None)
            horde.aim(page, 0, 0)
            deadline = time.monotonic() + 20
            damage_events = []
            observed_ids = set()
            initial_event = horde.snapshot(page)['state']['eventId']
            while time.monotonic() < deadline and horde.actor(page)['alive']:
                current = horde.snapshot(page)
                for event in current['state']['events']:
                    if event['id'] > initial_event and event['type'] == 'damage' and event.get('playerId') == 0 and event.get('weapon') == weapon and event['id'] not in observed_ids:
                        damage_events.append(event); observed_ids.add(event['id'])
                staggered = any(event['type'] == 'monsterStagger' and event.get('playerId') == 0 for event in current['state']['events'])
                if damage_events and (weapon == 'axe' or staggered and (weapon != 'tonfas' or len(damage_events) >= 2)):
                    images.append(screenshot(page, 'arsenal-' + weapon + '-actual-wave-one-impact', 'horde'))
                    break
                target = closest_horde(page, {'katana': 3.2, 'axe': 3.0, 'tonfas': 3.0}[weapon])
                if not target:
                    page.wait_for_timeout(60)
                    continue
                fast_melee_aim(page, target)
                if not damage_events:
                    # Close the gap before the enemy has completed its attack.
                    # Short-reach tonfas need a little more forward movement.
                    page.keyboard.down('w')
                    page.wait_for_timeout(200 if weapon == 'tonfas' else 100)
                    page.keyboard.up('w')
                current = horde.snapshot(page)
                brain = current['state']['horde']['brains'][target['id']]
                windup_margin = {'katana': 22, 'axe': 38, 'tonfas': 17}[weapon]
                if weapon != 'axe' and not damage_events and (brain['recoverTicks'] > 0 or current['state']['tick'] < brain['staggerReadyTick'] or 0 < brain['attackTicks'] < windup_margin):
                    page.keyboard.down('s'); page.wait_for_timeout(130); page.keyboard.up('s')
                    continue
                before = current['state']['eventId']
                page.mouse.down(button='left'); page.wait_for_timeout(40); page.mouse.up(button='left')
                try:
                    horde.wait(page, '([before,weapon])=>window.semagHorde.getState().state.events.some(event=>event.id>before&&event.type==="damage"&&event.playerId===0&&event.weapon===weapon)', [before, weapon], timeout=900)
                except Exception:
                    # A real swing may miss a moving body. Retry through native
                    # controls and retain every accepted event across the loop.
                    pass
                seen = horde.snapshot(page)
                hits = [event for event in seen['state']['events'] if event['id'] > initial_event and event['type'] == 'damage' and event.get('playerId') == 0 and event.get('weapon') == weapon and event['id'] not in observed_ids]
                damage_events.extend(hits); observed_ids.update(event['id'] for event in hits)
                if hits:
                    staggered = any(event['type'] == 'monsterStagger' and event.get('playerId') == 0 for event in seen['state']['events'])
                    if weapon == 'axe' or staggered and (weapon != 'tonfas' or len(damage_events) >= 2):
                        images.append(screenshot(page, 'arsenal-' + weapon + '-actual-wave-one-impact', 'horde'))
                        break
                page.wait_for_timeout(120)
            assert damage_events, ('No real native close contact', weapon, horde.actor(page)['hp'])
            seen = horde.snapshot(page); body = check(seen, seen['playerId'])
            assert seen['state']['horde']['wave'] == 1 and body['shots'] == 0
            starts = [event for event in seen['state']['events'] if event['type'] == 'meleeStart' and event.get('playerId') == 0]
            assert all(event['damage'] > 0 and event['hitKind'] == 'body' and not event['headshot'] for event in damage_events)
            staggered = any(event['type'] == 'monsterStagger' and event.get('playerId') == 0 for event in seen['state']['events'])
            if weapon == 'axe':
                assert body['kills'] >= 1 and any(event['type'] == 'kill' and event.get('playerId') == 0 and event.get('weapon') == 'axe' for event in seen['state']['events']), 'early axe must finish its real one-hit stalker punish'
            else:
                assert staggered, 'a living katana/tonfa contact opens a real eligible punish window'
            if weapon == 'tonfas':
                assert [event['hand'] for event in starts[:2]] == [0, 1]
            entries.append({'weapon': weapon, 'real_wave': 1, 'gun_rounds_fired': 0, 'native_melee_contacts': damage_events,
                            'actual_stagger': staggered, 'actual_kills': body['kills'], 'starter_persisted': body['inventory'][0]['weapon'],
                            'renderer': seen['renderStats'], 'screenshots': images})
            REPORT.setdefault('melee_observations', []).append(entries[-1]); save()
        finally:
            close_context(ctx, page, 'melee-' + weapon, 'horde')
    return {'blades': entries}


def tint_snapshot(page, mode, role='crosshair'):
    return page.locator('#' + mode + '-' + role).evaluate('''element => ({kind:element.dataset.hitKind,pulse:element.dataset.hitPulse,
      hidden:element.hidden, color:getComputedStyle(element.querySelector('i')||element.querySelector('svg')||element.querySelector('strong')).backgroundColor,
      stroke:element.querySelector('svg')?getComputedStyle(element.querySelector('svg')).stroke:null,
      textColor:element.querySelector('strong')?getComputedStyle(element.querySelector('strong')).color:null,
      animations:element.getAnimations({subtree:true}).map(animation=>({state:animation.playState,duration:animation.effect.getTiming().duration})),
      rect:element.getBoundingClientRect().toJSON()})''')


def reticles_case(browser, scoped=False):
    ctx, page = context(browser, 'scope' if scoped else 'reticles', scale=.7)
    session = None
    try:
        horde.solo(page, weapon='marksman' if scoped else 'carbine')
        horde.start_solo(page)
        deadline = time.monotonic() + 18
        captures = []
        for kind, height in [('body', .92), ('headshot', 1.67)]:
            hit = None
            while time.monotonic() < deadline and horde.actor(page)['alive']:
                target = closest_horde(page, 8)
                if not target:
                    page.wait_for_timeout(65)
                    continue
                aim_horde_target(page, target, height)
                page.mouse.down(button='right')
                horde.wait(page, 'window.semagHorde.getState().state.players[0].aimTicks===18')
                before = horde.snapshot(page)['state']['eventId']
                if session is None:
                    session = page.context.new_cdp_session(page)
                shot_bounds = page.locator('#horde-shell').bounding_box()
                page.mouse.down(button='left')
                try:
                    role = 'scope' if scoped else 'crosshair'
                    observation = horde.wait(page, '''([before,kind,role])=>{
                      const seen=window.semagHorde.getState(),event=seen.state.events.findLast(event=>event.id>before&&event.type==='damage'&&event.playerId===0&&event.damage>0&&(kind==='headshot'?event.headshot:!event.headshot));
                      const element=document.querySelector('#horde-'+role);if(!event||element.dataset.hitKind!==kind)return false;
                      const marker=document.querySelector('#horde-hit');return {event,tint:{kind:element.dataset.hitKind,pulse:element.dataset.hitPulse,hidden:element.hidden,
                        color:getComputedStyle(element.querySelector('i')||element.querySelector('svg')||element.querySelector('strong')).backgroundColor,
                        stroke:element.querySelector('svg')?getComputedStyle(element.querySelector('svg')).stroke:null,
                        textColor:element.querySelector('strong')?getComputedStyle(element.querySelector('strong')).color:null,
                        animations:element.getAnimations({subtree:true}).map(animation=>({state:animation.playState,duration:animation.effect.getTiming().duration})),
                        markerAnimations:marker.getAnimations({subtree:true}).map(animation=>({state:animation.playState,duration:animation.effect.getTiming().duration}))}};
                    }''', [before, kind, role], timeout=2000).json_value()
                    image = OUT / (('scope-' if scoped else '') + 'confirmed-' + kind + '-reticle.png')
                    # Read native pixels immediately; locator screenshot waits can
                    # outlast a deliberately small 180/240 ms confirmation.
                    capture = session.send('Page.captureScreenshot', {'format': 'png', 'fromSurface': True,
                                           'clip': {**shot_bounds, 'scale': 1}})
                    image.write_bytes(base64.b64decode(capture['data']))
                    REPORT['screenshots'].append(str(image))
                finally:
                    page.mouse.up(button='left')
                tint = observation['tint']
                assert tint['kind'] == kind and not tint['hidden']
                expected = 'rgb(255, 212, 90)' if kind == 'headshot' else 'rgb(244, 119, 56)'
                assert (tint['stroke'] or tint['textColor'] if scoped else tint['color']) == expected, tint
                marker_animations = tint['markerAnimations']
                assert tint['animations'] or marker_animations, ('No small confirmation animation', tint)
                seen = horde.snapshot(page)
                hit = observation['event']
                captures.append({'kind': kind, 'authoritative_damage': hit, 'actual_dom_tint': tint, 'screenshot': str(image)})
                page.mouse.up(button='right')
                horde.wait(page, 'window.semagHorde.getState().state.players[0].shotCooldown===0')
                break
            assert hit, ('Could not observe native confirmed reticle', kind, horde.snapshot(page))
        page.wait_for_timeout(330)
        assert page.locator('#horde-crosshair').get_attribute('data-hit-kind') == ''
        seen = horde.snapshot(page); check(seen, seen['playerId'])
        horde.pause(page)
        assert page.locator('#horde-crosshair').get_attribute('data-hit-kind') == ''
        return {'scoped': scoped, 'confirmed_hits': captures, 'expired_and_cleared_on_pause': True,
                'renderer': seen['renderStats']}
    finally:
        if session:
            session.detach()
        close_context(ctx, page, 'scope' if scoped else 'reticles', 'horde')


def coop_case(browser):
    contexts, pages = [], []
    try:
        for index in range(2):
            ctx, page = context(browser, 'coop/' + str(index), width=1050, height=720, scale=.6)
            contexts.append(ctx); pages.append(page)
        code = horde.create_room(pages[0], map_id='courtyard')
        pages[1].goto(pages[0].url); horde.connected(pages[1])
        for index, page in enumerate(pages):
            horde.select_native(page, '#horde-weapon', 'dualpistols' if index == 0 else 'dualsmg')
            horde.select_native(page, '#horde-melee', 'katana' if index == 0 else 'axe')
            page.locator('#horde-ready').click()
        horde.wait(pages[0], '!document.querySelector("#horde-start").disabled')
        pages[0].locator('#horde-start').click()
        for page in pages:
            horde.phase(page, 'fight', timeout=20000); horde.enter(page)
        host, mate = pages
        horde.aim(host, 0, .55)
        before = horde.actor(host)
        host.mouse.down(button='left'); host.wait_for_timeout(55); host.mouse.up(button='left')
        horde.wait(host, 'window.semagHorde.getState().state.players[0].shots===1')
        horde.wait(mate, 'window.semagHorde.getState().state.players[0].shots===1')
        shared = horde.actor(mate, 0)
        assert shared['ammo'] == before['ammo'] - 1 and shared['lastShotHand'] == 0
        assert shared['inventory'][0]['weapon'] == 'katana' and horde.actor(mate)['inventory'][0]['weapon'] == 'axe'
        image = screenshot(host, 'arsenal-coop-two-distinct-loadouts', 'horde')
        a, b = horde.snapshot(host), horde.snapshot(mate)
        check(a, a['playerId']); check(b, b['playerId'])
        return {'room': code, 'actual_connected_players': 2, 'native_dual_round_replicated': shared,
                'distinct_human_blades': ['katana', 'axe'], 'screenshots': [image]}
    finally:
        for index, (ctx, page) in enumerate(zip(contexts, pages)):
            close_context(ctx, page, 'coop-' + str(index), 'horde')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    freeze('before')
    requested = os.environ.get('SEMAG_ARSENAL_CASES', 'guns,melee,reticles,scope,coop').split(',')
    cases = {'guns': guns_case, 'melee': melee_case, 'reticles': reticles_case,
             'scope': lambda browser: reticles_case(browser, scoped=True), 'coop': coop_case}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(**LAUNCH)
        try:
            for name in requested:
                try:
                    log('case-start', name=name)
                    result = cases[name](browser)
                    REPORT['cases'].append({'name': name, **result})
                    log('case-passed', name=name)
                except Exception as error:
                    REPORT['failures'].append({'name': name, 'error': str(error), 'traceback': traceback.format_exc()})
                    log('case-failed', name=name, error=str(error))
                save(); freeze('after-' + name)
        finally:
            browser.close()
    freeze('after')
    save()
    assert not REPORT['failures'] and not REPORT['errors'] and not REPORT['failed_resources'], {
        'failures': REPORT['failures'], 'errors': REPORT['errors'], 'failed_resources': REPORT['failed_resources']}
    log('completed', cases=len(REPORT['cases']), screenshots=len(REPORT['screenshots']))


if __name__ == '__main__':
    main()
