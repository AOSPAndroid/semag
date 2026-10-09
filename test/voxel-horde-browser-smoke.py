"""Trusted native Chromium checks for Voxel Last Stand.

python test/voxel-horde-browser-smoke.py [http://127.0.0.1:3100]
SEMAG_HORDE_CASES selects setup,lifecycle,controls,combat,coop,mobile,paris,photos.
SEMAG_SCREENSHOT_DIR selects the report and screenshots. Observations only
read copied product snapshots or imported pure geometry helpers. Every game
action uses trusted keyboard, mouse, or Chromium touch input. No game state,
WebSocket, clock, animation frame, or gameplay handler is replaced. Passive
SwiftShader timings are regression samples, not hardware FPS measurements.
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
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', '/workspace/scratch/semag-horde-native'))
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3100').rstrip('/')
MAP_IDS = ('courtyard', 'depot', 'canal', 'rooftops', 'foundry', 'bastion', 'paris', 'snow', 'sewers', 'trading')
WEAPON_IDS = ('carbine', 'smg', 'marksman', 'pistol', 'shotgun', 'burst', 'sniper', 'lmg', 'crossbow')
REPORT = {'cases': [], 'failures': [], 'screenshots': [], 'errors': [], 'failed_resources': [],
          'working_bytes': [], 'input_policy': 'Trusted native browser input; copied read-only state; no WS/RAF/clock/game replacement',
          'performance_scope': 'Passive software WebGL samples only; no hardware FPS claim'}
CALIBRATION = {}
PAGES = []
NETWORK = {}
spec = importlib.util.spec_from_file_location('royale_native_geometry', ROOT / 'test' / 'voxel-royale-browser-smoke.py')
royale = importlib.util.module_from_spec(spec)
spec.loader.exec_module(royale)
Navigator = royale.Navigator
native = royale.native


class NativeRunEnded(Exception):
    """A real monster killed the player between two read-only observations."""


def log(stage, **details):
    print(json.dumps({'stage': stage, **details}), flush=True)


def save_report():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'report.json').write_text(json.dumps(REPORT, indent=2))


def freeze_bytes(stage):
    files = [ROOT / 'server.js', ROOT / 'package.json', ROOT / 'public/index.html', Path(__file__).resolve()]
    files += sorted((ROOT / 'public').glob('voxel-*.js'))
    files += sorted((ROOT / 'public').glob('voxel-horde.*'))
    files += sorted((ROOT / 'public/hub').glob('*horde*'))
    files += [ROOT / 'public/hub/hub.js', ROOT / 'public/hub/shared.js', ROOT / 'public/audio.js',
              ROOT / 'public/keyboard-layout.js', ROOT / 'public/voxel-practice.css']
    hashes = {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(set(files)) if path.is_file()}
    previous = REPORT['working_bytes'][-1]['sha256'] if REPORT['working_bytes'] else {}
    changed = [name for name, digest in hashes.items() if previous and previous.get(name) != digest]
    manifest = {'stage': stage, 'sha256': hashes, 'changed_since_previous': changed}
    REPORT['working_bytes'].append(manifest)
    (OUT / ('working-bytes-' + stage + '.json')).write_text(json.dumps(manifest, indent=2))
    save_report()
    return manifest


def wait(page, expression, arg=None, timeout=12000):
    return page.wait_for_function(expression, arg=arg, polling=25, timeout=timeout)


def snapshot(page):
    return page.evaluate('window.semagHorde.getState()')


def actor(page, ident=None):
    seen = snapshot(page)
    return next(body for body in seen['state']['players'] if body['id'] == (seen['playerId'] if ident is None else ident))


def phase(page, expected, timeout=12000):
    wait(page, 'phase=>window.semagHorde?.getState().state?.phase===phase', expected, timeout)


def connected(page):
    wait(page, 'window.semagHorde?.getState().connected && Number.isInteger(window.semagHorde.getState().playerId) && window.semagHorde.getState().state && window.semagHorde.getState().renderCount>0', timeout=20000)
    seen = snapshot(page)
    assert not seen['graphicsError'], seen['graphicsError']
    return seen['playerId']


def observe(page, tag):
    NETWORK[id(page)] = {'opened': 0, 'sent': [], 'states': []}
    page.on('pageerror', lambda error: REPORT['errors'].append(f'{tag}: {error}'))
    page.on('console', lambda message: REPORT['errors'].append(f'{tag}: {message.text}') if message.type == 'error' else None)
    page.on('response', lambda response: REPORT['failed_resources'].append(f'{tag}: {response.status} {response.url}') if response.status >= 400 else None)

    def socket_open(ws):
        network = NETWORK[id(page)]
        network['opened'] += 1

        def received(payload):
            try:
                packet = json.loads(payload)
            except (ValueError, TypeError):
                return
            if packet.get('type') == 'state':
                network['states'].append({'time': time.monotonic(), 'tick': packet['state']['tick'], 'bytes': len(payload)})
                del network['states'][:-1600]

        def sent(payload):
            try:
                packet = json.loads(payload)
            except (ValueError, TypeError):
                return
            network['sent'].append({'time': time.monotonic(), 'type': packet.get('type'), 'seq': packet.get('seq'), 'buttons': packet.get('buttons')})
            del network['sent'][:-1600]

        ws.on('framereceived', received)
        ws.on('framesent', sent)

    page.on('websocket', socket_open)
    PAGES.append(page)


def context(browser, tag, width=1280, height=900, touch=False, scale=1):
    result = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=scale,
                                 has_touch=touch, is_mobile=touch)
    page = result.new_page()
    observe(page, tag)
    return result, page


def close_context(ctx, page, tag):
    """Keep a live failure snapshot before closing the native browser case."""
    if sys.exc_info()[0] is not None and not page.is_closed():
        try:
            evidence = {'url': page.url, 'snapshot': snapshot(page), 'passive_network': NETWORK.get(id(page))}
            (OUT / ('live-failure-' + tag + '.json')).write_text(json.dumps(evidence, indent=2))
            screenshot(page, 'live-failure-' + tag, full=True)
        except Exception as error:
            log('failure-evidence-unavailable', case=tag, error=str(error))
    ctx.close()


def screenshot(page, name, full=False):
    path = OUT / (name + '.png')
    if full:
        page.screenshot(path=str(path), full_page=True)
    else:
        page.locator('#horde-shell').screenshot(path=str(path))
    REPORT['screenshots'].append(str(path))
    save_report()
    return str(path)


def no_overflow(page, tag):
    sizes = page.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})')
    assert sizes['scroll'] <= sizes['width'], (tag, 'Horizontal overflow', sizes)
    return sizes


def select_native(page, selector, value):
    picker = page.locator(selector)
    values = picker.locator('option').evaluate_all('(nodes)=>nodes.map(node=>node.value)')
    assert value in values, (selector, value, values)
    picker.click()
    page.keyboard.press('Home')
    for _ in range(values.index(value)):
        page.keyboard.press('ArrowDown')
    page.keyboard.press('Enter')
    assert picker.input_value() == value, (selector, value, picker.input_value())


def solo(page, map_id='courtyard', weapon='carbine', difficulty='veteran', layout='wasd'):
    page.goto(URL + '/voxel-horde.html?solo=1&map=' + map_id + '&difficulty=' + difficulty)
    connected(page)
    phase(page, 'lobby')
    select_native(page, '#horde-weapon', weapon)
    select_native(page, '#horde-keyboard-select', layout)
    assert actor(page)['weapon'] == weapon
    return snapshot(page)


def start_solo(page):
    page.locator('#horde-start').click()
    phase(page, 'countdown')
    seen = snapshot(page)
    assert seen['state']['horde']['participantIds'] == [0]
    phase(page, 'fight', timeout=15000)
    enter(page)
    return seen


def enter(page):
    seen = snapshot(page)
    body = next((body for body in seen['state']['players'] if body['id'] == seen['playerId']), None)
    if not body or not body['alive'] or seen['state']['phase'] == 'matchEnd':
        raise NativeRunEnded('Participant was genuinely eliminated before native control entry')
    if seen['paused'] and page.locator('#horde-resume').is_visible():
        page.locator('#horde-resume').click()
    elif not seen['controls']['entered']:
        if page.locator('#horde-enter').is_visible():
            page.locator('#horde-enter').click()
        elif page.locator('#horde-resume').is_visible():
            page.locator('#horde-resume').click()
    wait(page, '''()=>{const s=window.semagHorde.getState(),p=s.state.players.find(p=>p.id===s.playerId);
      return !p?.alive||s.state.phase==='matchEnd'||(!s.paused&&s.controls.entered&&
      (s.controls.pointerLocked||s.controls.fallback||s.controls.touch));}''')
    if not actor(page)['alive'] or snapshot(page)['state']['phase'] == 'matchEnd':
        raise NativeRunEnded('Participant was genuinely eliminated during native control entry')
    # Locator.focus uses the browser focus API; actual gameplay follows through
    # trusted Chromium keyboard/mouse events, never DOM dispatchEvent.
    page.locator('#horde-canvas').focus()


def pause(page):
    page.keyboard.press('Escape')
    wait(page, 'window.semagHorde.getState().paused')
    wait(page, '!window.semagHorde.getState().controls.pointerLocked')
    return snapshot(page)


def tap(page, key, code=None, duration=40):
    if code:
        session = page.context.new_cdp_session(page)
        try:
            native.cdp_key(page, key, code, session=session)
            page.wait_for_timeout(duration)
            native.cdp_key(page, key, code, 'keyUp', session=session)
        finally:
            session.detach()
    else:
        page.keyboard.press(key, delay=duration)


def held_key(page, key, duration=250, code=None):
    session = page.context.new_cdp_session(page) if code else None
    if code:
        native.cdp_key(page, key, code, session=session)
    else:
        page.keyboard.down(key)
    try:
        page.wait_for_timeout(duration)
    finally:
        if code:
            native.cdp_key(page, key, code, 'keyUp', session=session)
            session.detach()
        else:
            page.keyboard.up(key)


def look(page, dx, dy):
    box = page.locator('#horde-canvas').bounding_box()
    assert box
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    locked = snapshot(page)['controls']['pointerLocked']
    page.mouse.move(x, y)
    before = snapshot(page)['aim']
    if not locked:
        page.mouse.down(button='right')
    page.mouse.move(x + dx, y + dy, steps=1)
    if not locked:
        page.mouse.up(button='right')
    return before, snapshot(page)['aim']


def aim_multiplier(page):
    return page.evaluate('''async()=>{const {aimLookMultiplier}=await import('/voxel-client.js');
      const {ADS}=await import('/voxel-engine.js');const s=window.semagHorde.getState();
      return aimLookMultiplier(s.presentationPlayer||s.state.players[s.playerId],ADS);}''')


def aim(page, yaw, pitch=0, precise=True):
    enter(page)
    key = id(page)
    if key not in CALIBRATION:
        multiplier = aim_multiplier(page)
        before, after = look(page, 40, 30)
        sx = native.angle_delta(after['yaw'], before['yaw']) / 40 / multiplier
        sy = (after['pitch'] - before['pitch']) / 30 / multiplier
        assert abs(sx) > .0001 and abs(sy) > .0001, ('Native mouse look did not respond', before, after)
        CALIBRATION[key] = (sx, sy)
    sx, sy = CALIBRATION[key]
    box = page.locator('#horde-canvas').bounding_box()
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    page.mouse.move(x, y)
    for _ in range(14):
        if not actor(page)['alive'] or snapshot(page)['state']['phase'] == 'matchEnd':
            raise NativeRunEnded('Participant was genuinely eliminated during native mouse aiming')
        current = snapshot(page)['aim']
        dyaw, dpitch = native.angle_delta(yaw, current['yaw']), pitch - current['pitch']
        if abs(dyaw) < .002 and abs(dpitch) < .002:
            break
        multiplier = aim_multiplier(page)
        dx = max(-box['width'] * .4, min(box['width'] * .4, dyaw / sx / multiplier))
        dy = max(-box['height'] * .4, min(box['height'] * .4, dpitch / sy / multiplier))
        if not snapshot(page)['controls']['pointerLocked']:
            x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
            page.mouse.move(x, y)
            page.mouse.down(button='right')
        page.mouse.move(x + dx, y + dy, steps=1)
        x, y = x + dx, y + dy
        if not snapshot(page)['controls']['pointerLocked']:
            page.mouse.up(button='right')
    current = snapshot(page)['aim']
    if precise:
        assert abs(native.angle_delta(yaw, current['yaw'])) < .01 and abs(pitch - current['pitch']) < .01, ('Native aim missed', yaw, pitch, current)
    return current


def aim_at(page, target, height=1.58, compensate=False):
    body = actor(page)
    distance = math.hypot(target['x'] - body['x'], target['z'] - body['z'])
    pitch = math.atan2(target.get('y', 0) + height - body['y'] - (.98 if body['crouching'] else 1.62), distance)
    if compensate:
        pitch -= body['recoil']
    return aim(page, math.atan2(target['x'] - body['x'], -(target['z'] - body['z'])), pitch)


def geometry(page, map_id):
    return page.evaluate('''async id=>{const {MAPS}=await import('/voxel-maps.js');return structuredClone(MAPS[id]);}''', map_id)


def finite(page):
    seen = snapshot(page)
    assert not seen['graphicsError'] and seen['renderCount'] > 0 and len(seen['pendingInputs']) <= 240, seen
    for body in seen['state']['players']:
        for name in ('x', 'y', 'z', 'vx', 'vy', 'vz', 'yaw', 'pitch', 'hp'):
            assert math.isfinite(body[name]), (name, body)
    assert len(seen['state']['loot']) <= 20 and len(seen['state']['spawnWarnings']) <= 4
    assert len(seen['state']['events']) <= 256
    return seen


def performance(page, seconds=1.2):
    session = page.context.new_cdp_session(page)
    try:
        session.send('Performance.enable')
        before = {item['name']: item['value'] for item in session.send('Performance.getMetrics')['metrics']}
        renders, times, counts = snapshot(page)['renderCount'], [], []
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            page.wait_for_timeout(100)
            times.append(time.monotonic())
            counts.append(snapshot(page)['renderCount'])
        after = {item['name']: item['value'] for item in session.send('Performance.getMetrics')['metrics']}
    finally:
        session.detach()
    renderer = finite(page)['renderStats']
    assert renderer and renderer['drawCalls'] <= 10, renderer
    assert renderer['dynamicVertices'] < 150000 and renderer['cachedMaps'] <= 7, renderer
    packets = NETWORK[id(page)]['states'][-120:]
    network = {}
    if len(packets) > 1:
        span = packets[-1]['time'] - packets[0]['time']
        network = {'observed_seconds': span, 'snapshots_per_second': (len(packets) - 1) / span,
                   'ticks_per_second': (packets[-1]['tick'] - packets[0]['tick']) / span,
                   'bytes': native.distribution([item['bytes'] for item in packets])}
    return {'software_webgl_only': True, 'passive_samples': len(times), 'rendered_frames': counts[-1] - renders,
            'task_duration_seconds': after.get('TaskDuration', 0) - before.get('TaskDuration', 0),
            'script_duration_seconds': after.get('ScriptDuration', 0) - before.get('ScriptDuration', 0),
            'renderer': renderer, 'network': network}


def setup_case(browser):
    ctx, page = context(browser, 'setup')
    try:
        page.goto(URL)
        wait(page, 'document.querySelector("#host-status").textContent==="Host is online"')
        page.locator('[data-create-game="voxel-horde"]').click()
        assert page.locator('#horde-setup').evaluate('(node)=>node.open')
        assert page.locator('#horde-map option').evaluate_all('(nodes)=>nodes.map(node=>node.value)') == list(MAP_IDS)
        previews = []
        for map_id in MAP_IDS:
            select_native(page, '#horde-map', map_id)
            arena = geometry(page, map_id)
            assert page.locator('[data-horde-map-note]').inner_text() == arena['description']
            assert arena['name'] in page.locator('[data-horde-map-preview]').get_attribute('aria-label')
            assert page.locator('[data-horde-map-preview] polyline').count() == len(arena['routes'])
            assert 'NaN' not in page.locator('[data-horde-map-preview]').inner_html()
            previews.append({'id': map_id, 'name': arena['name'], 'cover': len(arena['colliders']), 'routes': len(arena['routes'])})
        widths = []
        for width in (1280, 390, 320):
            page.set_viewport_size({'width': width, 'height': 1000})
            widths.append(no_overflow(page, 'hub/' + str(width)))
            assert page.locator('#horde-setup').evaluate('(node)=>node.scrollWidth<=node.clientWidth')
            path = OUT / ('horde-hub-setup-' + str(width) + '.png')
            page.locator('#horde-setup').screenshot(path=str(path))
            REPORT['screenshots'].append(str(path))
        page.locator('[data-cancel-horde]').click()
        solo(page)
        assert page.locator('#horde-map option').evaluate_all('(nodes)=>nodes.map(node=>node.value)') == list(MAP_IDS)
        assert page.locator('#horde-weapon option').evaluate_all('(nodes)=>nodes.map(node=>node.value)') == list(WEAPON_IDS)
        for map_id in MAP_IDS:
            select_native(page, '#horde-map', map_id)
            seen = snapshot(page)
            assert seen['state']['mapId'] == map_id and seen['state']['phase'] == 'lobby'
            assert seen['state']['horde']['wave'] == 0 and seen['state']['tick'] == 0
            finite(page)
        assert NETWORK[id(page)]['opened'] == 0, 'Solo created a WebSocket'
        return {'seven_actual_map_previews': previews, 'responsive_widths': widths,
                'nine_loadout_options': list(WEAPON_IDS), 'solo_preview_did_not_autostart': True, 'solo_websockets': 0}
    finally:
        close_context(ctx, page, 'setup')


def lifecycle_case(browser):
    ctx, page = context(browser, 'lifecycle')
    try:
        solo(page)
        page.wait_for_timeout(300)
        assert snapshot(page)['state']['tick'] == 0 and actor(page)['shots'] == 0
        page.locator('#horde-help').click()
        assert snapshot(page)['controls']['modalOpen']
        page.keyboard.press('Tab')
        assert page.locator('#horde-guide').evaluate('(node)=>node.contains(document.activeElement)')
        page.locator('#horde-guide-back').click()
        assert not snapshot(page)['controls']['modalOpen']
        page.locator('#horde-start').click()
        phase(page, 'countdown')
        frozen = pause(page)
        resume_icon = page.locator('#horde-pause').evaluate('''node=>{
          const a=getComputedStyle(node,'::before'),b=getComputedStyle(node,'::after');
          return{label:node.getAttribute('aria-label'),width:a.width,height:a.height,shape:a.clipPath,second:b.display};}''')
        assert resume_icon['label'] == 'Resume controls' and resume_icon['width'] == '11px' and resume_icon['second'] == 'none', resume_icon
        page.wait_for_timeout(350)
        after = snapshot(page)
        assert after['state']['tick'] == frozen['state']['tick'] and after['state']['phaseTicks'] == frozen['state']['phaseTicks']
        page.locator('#horde-resume').click()
        phase(page, 'fight', timeout=15000)
        enter(page)
        held_key(page, 'w', 200)
        running = actor(page)
        pause(page)
        page.locator('#horde-help').click()
        phase(page, 'paused')
        modal_tick = snapshot(page)['state']['tick']
        held_key(page, 'w', 100)
        assert snapshot(page)['state']['tick'] == modal_tick
        page.locator('#horde-guide-back').click()
        assert snapshot(page)['paused']
        page.locator('#horde-restart').click()
        phase(page, 'countdown')
        restarted = actor(page)
        assert restarted['hp'] == 200 and restarted['shots'] == restarted['kills'] == 0 and restarted['ammo'] == 24
        phase(page, 'fight', timeout=15000)
        blank = ctx.new_page()
        blank.goto('about:blank')
        blank.bring_to_front()
        wait(page, 'window.semagHorde.getState().paused')
        tab_frozen = snapshot(page)
        page.wait_for_timeout(250)
        assert snapshot(page)['state']['tick'] == tab_frozen['state']['tick']
        page.bring_to_front()
        blank.close()
        page.locator('#horde-resume').click()
        phase(page, 'fight')
        enter(page)
        wait(page, 'tick=>window.semagHorde.getState().state.tick>tick', tab_frozen['state']['tick'])
        result = {'explicit_start': True, 'countdown_pause_freezes_world': True, 'help_modal_pauses_and_keeps_focus': True,
                  'real_tab_blur_pauses_and_resume_works': True, 'native_restart_resets_inventory_and_stats': True,
                  'movement_before_pause': {'x': running['x'], 'z': running['z']}, 'solo_websockets': NETWORK[id(page)]['opened']}
        pause_icon = page.locator('#horde-pause').evaluate('''node=>{
          const a=getComputedStyle(node,'::before'),b=getComputedStyle(node,'::after');
          return{label:node.getAttribute('aria-label'),first:a.width,second:b.width,second_display:b.display};}''')
        assert pause_icon['first'] == pause_icon['second'] == '3px' and pause_icon['second_display'] != 'none', pause_icon
        result['font_independent_pause_resume_icons'] = {'pause': pause_icon, 'resume': resume_icon}
        assert result['solo_websockets'] == 0
        screenshot(page, 'horde-solo-started')
        return result
    finally:
        close_context(ctx, page, 'lifecycle')


def controls_case(browser):
    ctx, page = context(browser, 'controls')
    try:
        solo(page, layout='zqsd')
        start_solo(page)
        before = actor(page)
        held_key(page, 'z', 230, 'KeyW')
        moved = actor(page)
        assert moved['z'] < before['z'] - .3, ('French forward input did not move', before, moved)
        held_key(page, 'q', 160, 'KeyA')
        left = actor(page)
        assert left['x'] < moved['x'] - .2, ('French strafe input did not move', moved, left)
        looked = aim(page, .25, .1)
        page.mouse.down(button='right')
        try:
            wait(page, 'window.semagHorde.getState().state.players[0].aimTicks>=18')
            assert actor(page)['aiming']
            shots = actor(page)['shots']
            page.mouse.down(button='left')
            page.wait_for_timeout(140)
            page.mouse.up(button='left')
            wait(page, 'shots=>window.semagHorde.getState().state.players[0].shots>shots', shots)
        finally:
            page.mouse.up(button='right')
        ammo_before = actor(page)['ammo']
        tap(page, 'r', 'KeyR')
        wait(page, 'window.semagHorde.getState().state.players[0].reloadTicks>0')
        wait(page, 'window.semagHorde.getState().state.players[0].reloadTicks===0', timeout=6000)
        assert actor(page)['ammo'] == 24 and ammo_before < 24 and actor(page)['reserve'] < 72
        tap(page, 'v', 'KeyV')
        wait(page, 'window.semagHorde.getState().state.players[0].slot==="sword"')
        assert actor(page)['meleeWeapon'] == 'sword'
        event_id = snapshot(page)['state']['eventId']
        tap(page, 'c', 'KeyC')
        wait(page, 'event=>window.semagHorde.getState().state.events.some(e=>e.id>event&&e.type==="meleeStart"&&e.playerId===0)', event_id)
        tap(page, 'v', 'KeyV')
        wait(page, 'window.semagHorde.getState().state.players[0].slot==="primary"')
        aim(page, 0, .7)
        before_grenades = actor(page)['grenades']
        tap(page, 'a', 'KeyQ')
        wait(page, 'n=>window.semagHorde.getState().state.players[0].grenades<n', before_grenades)
        assert page.locator('#horde-grenade-key').inner_text() == 'A'
        pause(page)
        result = {'trusted_zqsd_forward_and_strafe': True, 'native_mouse_look': looked, 'rmb_ads_lmb_fire': True,
                  'finite_gun_reload': True, 'sword_toggle_and_native_swing': True, 'french_a_grenade': True}
        loadouts = []
        for weapon in WEAPON_IDS:
            solo(page, weapon=weapon)
            start_solo(page)
            ammo = actor(page)['ammo']
            shots = actor(page)['shots']
            if weapon in ('marksman', 'sniper'):
                page.mouse.down(button='right')
                wait(page, 'window.semagHorde.getState().state.players[0].aimTicks>=18')
                wait(page, '!document.querySelector("#horde-scope").hidden')
            page.mouse.down(button='left')
            page.wait_for_timeout(350 if weapon == 'lmg' else 70)
            page.mouse.up(button='left')
            page.mouse.up(button='right')
            wait(page, 'shots=>window.semagHorde.getState().state.players[0].shots>shots', shots)
            body = actor(page)
            assert body['ammo'] < ammo
            loadouts.append({'weapon': weapon, 'ammo_before': ammo, 'ammo_after': body['ammo'], 'native_shots': body['shots'] - shots,
                             'scope_checked': weapon in ('marksman', 'sniper')})
            pause(page)
        result['nine_native_firing_loadouts'] = loadouts
        return result
    finally:
        close_context(ctx, page, 'controls')


def targets(page):
    return page.evaluate('''async()=>{const {traceShot,eyeHeight}=await import('/voxel-engine.js');const {MAPS}=await import('/voxel-maps.js');
      const s=window.semagHorde.getState(),state=s.state,p=state.players[s.playerId];
      const origin={x:p.x,y:p.y+eyeHeight(p),z:p.z};return state.players.filter(m=>m.monster&&m.alive).map(m=>{
        const target={x:m.x,y:m.y+1.58,z:m.z},dx=target.x-origin.x,dy=target.y-origin.y,dz=target.z-origin.z,d=Math.hypot(dx,dy,dz);
        const hit=traceShot(state,p.id,origin,{x:dx/d,y:dy/d,z:dz/d},d+1,MAPS[state.mapId]);
        return{...m,distance:d,visible:hit.playerId===m.id};}).sort((a,b)=>a.distance-b.distance);}''')


def move(page, x, z, timeout=12000):
    deadline = time.monotonic() + timeout / 1000
    for _ in range(6):
        body = actor(page)
        dx, dz = x - body['x'], z - body['z']
        distance = math.hypot(dx, dz)
        if distance < .4:
            return body
        assert body['alive'] and snapshot(page)['state']['phase'] in ('fight', 'intermission'), ('Route interrupted', body)
        aim(page, math.atan2(dx, -dz))
        page.keyboard.down('w')
        try:
            wait(page, '''([id,x,z,ux,uz])=>{const s=window.semagHorde.getState().state,p=s.players[id];
              return !p.alive||!['fight','intermission'].includes(s.phase)||(x-p.x)*ux+(z-p.z)*uz<.14;}''',
                 [snapshot(page)['playerId'], x, z, dx / distance, dz / distance],
                 timeout=max(1000, min(int((deadline - time.monotonic()) * 1000), int((distance / 3 + 2) * 1000))))
        finally:
            page.keyboard.up('w')
        if time.monotonic() > deadline:
            break
    body = actor(page)
    assert math.hypot(x - body['x'], z - body['z']) < .5, ('Native waypoint missed', x, z, body)
    return body


def pickup_nearest(page):
    body = actor(page)
    drops = sorted(snapshot(page)['state']['loot'], key=lambda drop: math.hypot(drop['x'] - body['x'], drop['z'] - body['z']))
    navigator = Navigator(geometry(page, snapshot(page)['state']['mapId']))
    for drop in drops:
        if drop['type'] == 'health' and body['hp'] >= body['maxHp']:
            continue
        try:
            route = navigator.route((body['x'], body['z']), (drop['x'], drop['z']))
        except AssertionError:
            continue
        for point in route:
            move(page, *point)
        nearby = page.evaluate('''async()=>{const {findNearbyLoot}=await import('/voxel-horde-engine.js');
          const s=window.semagHorde.getState();return findNearbyLoot(s.state,s.playerId);}''')
        if not nearby:
            continue
        wait(page, '!document.querySelector("#horde-pickup").hidden')
        event_id = snapshot(page)['state']['eventId']
        before = actor(page)
        screenshot(page, 'horde-native-drop-prompt')
        tap(page, 'e', 'KeyE')
        wait(page, 'event=>window.semagHorde.getState().state.events.some(e=>e.id>event&&e.type==="loot"&&e.playerId===0)', event_id)
        event = next(item for item in reversed(snapshot(page)['state']['events']) if item['id'] > event_id and item['type'] == 'loot' and item['playerId'] == 0)
        after = actor(page)
        assert not any(item['id'] == event['lootId'] for item in snapshot(page)['state']['loot'])
        return {'native_route': route, 'drop': nearby, 'event': event, 'hp_before': before['hp'], 'hp_after': after['hp'],
                'reserve_before': before['reserve'], 'reserve_after': after['reserve']}
    return None


def combat_case(browser):
    ctx, page = context(browser, 'combat')
    result = {'native_kills': 0, 'wave_clears': 0, 'highest_wave': 1, 'armed_types_seen': [], 'pickup': None,
              'intermission_native_movement': None, 'attempts': []}
    try:
        # A real player is controlled with native input. Read-only line tracing
        # selects visible enemies; it neither injects hits nor changes a body.
        for attempt in range(3):
            solo(page, weapon='carbine')
            start_solo(page)
            aim(page, 0, 0)
            deadline = time.monotonic() + float(os.environ.get('SEMAG_HORDE_COMBAT_SECONDS', '150'))
            captured = False
            page.mouse.down(button='right')
            try:
                while time.monotonic() < deadline:
                    seen = snapshot(page)
                    state, body = seen['state'], actor(page)
                    result['native_kills'] = max(result['native_kills'], state['horde']['totalKills'])
                    result['wave_clears'] = max(result['wave_clears'], state['horde']['wavesCleared'])
                    result['highest_wave'] = max(result['highest_wave'], state['horde']['wave'])
                    result['armed_types_seen'] = sorted(set(result['armed_types_seen']) | {item['monsterType'] for item in state['players'] if item.get('monsterType') in ('gunner', 'sniper')})
                    if state['phase'] == 'matchEnd' or not body['alive']:
                        break
                    if seen['paused']:
                        enter(page)
                    if state['phase'] == 'intermission':
                        page.keyboard.up('c')
                        page.mouse.up(button='right')
                        screenshot(page, 'horde-native-wave-clear')
                        if not result['intermission_native_movement']:
                            beginning = actor(page)
                            nav = Navigator(geometry(page, state['mapId']))
                            heading = next((heading for heading in (0, math.pi / 2, -math.pi / 2, math.pi)
                                            if nav.segment((beginning['x'], beginning['z']),
                                                           (beginning['x'] + math.sin(heading), beginning['z'] - math.cos(heading)))), None)
                            assert heading is not None, ('No clear intermission movement direction', beginning)
                            aim(page, heading)
                            held_key(page, 'w', 180)
                            repositioned = actor(page)
                            assert snapshot(page)['state']['phase'] == 'intermission', 'Wave advanced before native intermission movement check'
                            distance = math.hypot(repositioned['x'] - beginning['x'], repositioned['z'] - beginning['z'])
                            assert distance > .35, ('Intermission did not permit trusted native repositioning', beginning, repositioned)
                            result['intermission_native_movement'] = {'distance': distance, 'x': repositioned['x'], 'z': repositioned['z']}
                        if not result['pickup']:
                            result['pickup'] = pickup_nearest(page)
                        if result['highest_wave'] >= 4 and result['armed_types_seen']:
                            break
                        phase(page, 'fight', timeout=12000)
                        page.mouse.down(button='right')
                        continue
                    if body['ammo'] == 0 and body['reloadTicks'] == 0:
                        page.keyboard.up('c')
                        tap(page, 'r', 'KeyR')
                    choices = targets(page)
                    visible = next((target for target in choices if target['visible']), None)
                    if visible:
                        page.keyboard.up('c')
                        try:
                            aim_at(page, visible, compensate=True)
                        except NativeRunEnded:
                            break
                        if not captured and visible['distance'] < 13:
                            page.mouse.up(button='right')
                            screenshot(page, 'horde-native-monster-combat')
                            page.mouse.down(button='right')
                            captured = True
                        # Brief native strafes make close wind-ups survivable.
                        if visible['distance'] < 4:
                            page.keyboard.down('ArrowRight')
                        page.keyboard.down('c')
                        page.wait_for_timeout(160)
                        page.keyboard.up('c')
                        page.keyboard.up('ArrowRight')
                    else:
                        page.keyboard.up('c')
                        page.wait_for_timeout(70)
                    if body['hp'] < 110 and body['grenades'] > 0 and visible and visible['distance'] > 4:
                        tap(page, 'q', 'KeyQ')
                    finite(page)
                latest = snapshot(page)['state']
                result['attempts'].append({'attempt': attempt + 1, 'phase': latest['phase'], 'kills': latest['horde']['totalKills'],
                                           'waves_cleared': latest['horde']['wavesCleared'], 'wave': latest['horde']['wave'], 'hp': actor(page)['hp']})
                if latest['horde']['totalKills']:
                    result['performance'] = performance(page)
            finally:
                page.keyboard.up('c')
                page.mouse.up(button='right')
                page.keyboard.up('ArrowRight')
            save_report()
            if result['wave_clears'] and result['pickup'] and result['armed_types_seen']:
                break
        assert result['native_kills'] > 0, ('No genuine monster kill from trusted native play', result)
        assert result['wave_clears'] > 0, ('Native play did not clear a wave', result)
        assert result['intermission_native_movement'], ('No genuine intermission repositioning check', result)
        assert result['pickup'], ('Native play did not collect a genuine monster drop', result)
        result['later_armed_waves_native_verified'] = bool(result['armed_types_seen'])
        return result
    except BaseException:
        REPORT['cases'].append({'name': 'combat-partial', **result})
        raise
    finally:
        close_context(ctx, page, 'combat')


def create_room(page, map_id='courtyard'):
    page.goto(URL)
    wait(page, 'document.querySelector("#host-status").textContent==="Host is online"')
    page.locator('[data-create-game="voxel-horde"]').click()
    select_native(page, '#horde-map', map_id)
    page.locator('[data-horde-submit]').click()
    page.wait_for_url('**/voxel-horde.html?room=*')
    connected(page)
    return parse_qs(urlparse(page.url).query)['room'][0]


def coop_case(browser):
    contexts, pages = [], []
    result = {}
    try:
        for index in range(3):
            ctx, page = context(browser, 'coop/' + str(index), width=1100 if index == 0 else 640, height=800,
                                scale=1 if index == 0 else .5)
            contexts.append(ctx)
            pages.append(page)
        code = create_room(pages[0])
        assert pages[0].locator('#horde-start').is_disabled()
        for index, page in enumerate(pages[1:], 1):
            page.goto(pages[0].url)
            connected(page)
            page.locator('#horde-name').fill('Native teammate ' + str(index + 1))
            page.keyboard.press('Tab')
        wait(pages[0], 'window.semagHorde.getState().roomPlayers.filter(p=>p?.connected).length===3')
        pages.sort(key=lambda page: snapshot(page)['playerId'])
        assert [snapshot(page)['playerId'] for page in pages] == [0, 1, 2]
        assert all(snapshot(page)['state']['phase'] == 'lobby' for page in pages)
        for index, page in enumerate(pages):
            page.locator('#horde-ready').click()
            wait(page, 'window.semagHorde.getState().roomPlayers.find(p=>p?.id===window.semagHorde.getState().playerId)?.ready')
            if index < 2:
                assert pages[0].locator('#horde-start').is_disabled()
        wait(pages[0], '!document.querySelector("#horde-start").disabled')
        assert all(page.locator('#horde-start').is_disabled() for page in pages[1:])
        before_match = snapshot(pages[0])['state']['matchId']
        pages[0].bring_to_front()
        pages[0].locator('#horde-start').click()
        phase(pages[0], 'countdown')
        countdown = snapshot(pages[0])['state']
        assert countdown['horde']['participantIds'] == [0, 1, 2]
        assert len({(body['x'], body['z']) for body in countdown['players'] if body['participating']}) == 3
        for page in pages:
            phase(page, 'fight', timeout=15000)
        result.update({'room': code, 'three_distinct_human_seats': [0, 1, 2], 'all_connected_ready_gate': True,
                       'host_explicit_start': True, 'distinct_spawns': True, 'participant_ids': countdown['horde']['participantIds']})
        pages[0].bring_to_front()
        enter(pages[0])
        initial = actor(pages[0])
        held_key(pages[0], 'w', 200)
        assert actor(pages[0])['z'] < initial['z'] - .2
        assert pages[0].locator('#horde-team li').count() == 2
        teammate = actor(pages[0], 1)
        aim_at(pages[0], teammate, height=1)
        assert any(player['id'] == 1 and player['alive'] for player in snapshot(pages[0])['presentationPlayers'])
        screenshot(pages[0], 'horde-native-coop-hud-teammate')
        frozen = pause(pages[0])
        tick = frozen['state']['tick']
        pages[0].wait_for_timeout(220)
        live = snapshot(pages[0])
        assert live['paused'] and live['state']['phase'] == 'fight' and live['state']['tick'] > tick
        assert actor(pages[0])['previousInput']['fire'] is False
        result['coop_pause_releases_only_local_controls'] = True
        pages[0].locator('#horde-resume').click()
        enter(pages[0])
        peer_id = snapshot(pages[2])['playerId']
        contexts[2].close()
        wait(pages[0], 'id=>!window.semagHorde.getState().state.players[id].connected', peer_id)
        result['real_peer_disconnect_releases_participation'] = not actor(pages[0], peer_id)['alive']
        assert result['real_peer_disconnect_releases_participation'], 'Disconnected teammate remained alive'
        assert not actor(pages[0], peer_id)['participating'] and peer_id not in snapshot(pages[0])['state']['horde']['participantIds']
        # Actual monsters eliminate idle survivors; no injected deaths or skip.
        spectator = False
        kills = {}
        deadline = time.monotonic() + 120
        next_progress = time.monotonic() + 5
        while time.monotonic() < deadline:
            seen = snapshot(pages[0])
            if time.monotonic() >= next_progress:
                log('coop-wipe-progress', room=code, phase=seen['state']['phase'], tick=seen['state']['tick'],
                    fight_seconds=seen['state']['horde']['elapsedTicks'] / 120,
                    humans=[{'id': body['id'], 'hp': body['hp'], 'alive': body['alive']} for body in seen['state']['players'][:2]])
                next_progress = time.monotonic() + 5
            for event in seen['state']['events']:
                if event['type'] == 'kill' and event.get('targetId') in (0, 1):
                    source = next((body for body in seen['state']['players'] if body['id'] == event.get('playerId')), None)
                    if source and source.get('monster'):
                        kills[event['targetId']] = event
            if seen['state']['phase'] == 'matchEnd':
                break
            for page in pages[:2]:
                state = snapshot(page)
                if not actor(page)['alive'] and state['state']['phase'] == 'fight':
                    if page.locator('#horde-spectator').is_visible() and not spectator:
                        page.bring_to_front()
                        before_render = snapshot(page)['renderCount']
                        wait(page, 'count=>window.semagHorde.getState().renderCount>count', before_render)
                        viewing = snapshot(page)
                        survivors = [body for body in viewing['state']['players'] if body.get('human') and body['alive'] and body['connected'] and body['participating']]
                        assert len(survivors) == 1, survivors
                        survivor_id = survivors[0]['id']
                        person = next((person for person in viewing['roomPlayers'] if person and person['id'] == survivor_id), None)
                        name = person['name'] if person and person.get('name') else 'Player ' + str(survivor_id + 1)
                        assert page.locator('#horde-spectator-name').inner_text() == 'WATCHING ' + name.upper()
                        page.locator('#horde-spectator-next').click()
                        assert snapshot(page)['spectatorId'] == survivor_id
                        spectator = True
                        result['spectator_rendered_living_human'] = {'player_id': snapshot(page)['playerId'], 'survivor_id': survivor_id,
                                                                  'fresh_render_count': snapshot(page)['renderCount'] - before_render,
                                                                  'native_next_teammate': True}
                        screenshot(page, 'horde-native-coop-spectator')
            pages[0].wait_for_timeout(80)
        phase(pages[0], 'matchEnd', timeout=10000)
        phase(pages[1], 'matchEnd')
        ended = snapshot(pages[0])['state']
        assert ended['horde']['participantIds'] == [0, 1] and ended['horde']['result'] == 'lost' and ended['winner'] == 1
        assert all(body['connected'] and body['participating'] and not body['alive'] and body['hp'] == 0
                   for body in ended['players'][:2])
        assert set(kills) == {0, 1}, ('Actual wipe lacked both monster-origin elimination events', kills)
        result['actual_monster_wipe'] = True
        result['actual_monster_elimination_events'] = kills
        result['spectator_after_actual_elimination'] = spectator
        if not spectator:
            result['spectator_window_missed'] = {'kill_ticks': sorted(event['tick'] for event in kills.values()),
                                                  'observation': 'Both humans were already eliminated when the fixture reached its spectator check'}
        assert pages[1].locator('#horde-replay').is_disabled()
        pages[0].locator('#horde-replay').click()
        for page in pages[:2]:
            phase(page, 'lobby')
        assert pages[0].locator('#horde-start').is_disabled()
        assert all(not person['ready'] for person in snapshot(pages[0])['roomPlayers'] if person and person['connected'])
        lobby = snapshot(pages[0])['state']
        assert lobby['matchId'] == ended['matchId'] and lobby['horde']['wave'] == 0 and lobby['horde']['participantIds'] == []
        assert lobby['horde']['result'] is None and not any(body.get('monster') for body in lobby['players'])
        assert all(not lobby[name] for name in ('loot', 'spawnWarnings', 'grenades', 'bolts'))
        assert all(body['alive'] and body['connected'] and not body['participating'] for body in lobby['players'][:2])
        result['host_rematch_to_fresh_unready_lobby'] = True
        result['match_id_before'] = before_match
        for page in pages[:2]:
            page.locator('#horde-ready').click()
            wait(page, 'window.semagHorde.getState().roomPlayers.find(p=>p?.id===window.semagHorde.getState().playerId)?.ready')
        wait(pages[0], '!document.querySelector("#horde-start").disabled')
        pages[0].bring_to_front()
        pages[0].locator('#horde-start').click()
        phase(pages[0], 'countdown')
        replay = snapshot(pages[0])['state']
        assert replay['matchId'] == ended['matchId'] + 1 and replay['horde']['participantIds'] == [0, 1]
        assert all(body['hp'] == 200 and body['kills'] == body['shots'] == 0 for body in replay['players'][:2])
        result['fresh_two_player_native_restart_after_wipe'] = {'match_id': replay['matchId'], 'participant_ids': replay['horde']['participantIds']}
        if not spectator:
            # Begin observing the new match early. A genuine short retreat
            # separates the two humans so an AFK elimination can leave a
            # healthy teammate to watch, without injecting a death or HP.
            phase(pages[0], 'fight', timeout=15000)
            enter(pages[0])
            before_retreat = actor(pages[0])
            held_key(pages[0], 'ArrowDown', 500)
            after_retreat = actor(pages[0])
            result['spectator_attempt_native_retreat'] = {'x': after_retreat['x'], 'z': after_retreat['z'],
                                                        'distance': math.hypot(after_retreat['x'] - before_retreat['x'], after_retreat['z'] - before_retreat['z'])}
            next_deadline = time.monotonic() + 60
            while time.monotonic() < next_deadline and not spectator:
                current = snapshot(pages[0])
                if current['state']['phase'] == 'matchEnd':
                    break
                for page in pages[:2]:
                    viewing = snapshot(page)
                    living = [body for body in viewing['state']['players'] if body.get('human') and body['alive'] and body['connected'] and body['participating']]
                    if actor(page)['alive'] or viewing['state']['phase'] != 'fight' or len(living) != 1:
                        continue
                    page.bring_to_front()
                    previous_render = viewing['renderCount']
                    wait(page, 'count=>window.semagHorde.getState().renderCount>count||window.semagHorde.getState().state.phase==="matchEnd"', previous_render)
                    viewing = snapshot(page)
                    if viewing['state']['phase'] != 'fight':
                        break
                    survivor_id = living[0]['id']
                    person = next((person for person in viewing['roomPlayers'] if person and person['id'] == survivor_id), None)
                    name = person['name'] if person and person.get('name') else 'Player ' + str(survivor_id + 1)
                    assert page.locator('#horde-spectator-name').inner_text() == 'WATCHING ' + name.upper()
                    try:
                        page.locator('#horde-spectator-next').click(timeout=1500)
                    except Exception:
                        if snapshot(page)['state']['phase'] == 'matchEnd':
                            break
                        raise
                    assert snapshot(page)['spectatorId'] == survivor_id
                    spectator = True
                    result['spectator_after_actual_elimination'] = True
                    result['spectator_rendered_living_human'] = {'player_id': viewing['playerId'], 'survivor_id': survivor_id,
                                                              'fresh_render_count': snapshot(page)['renderCount'] - previous_render,
                                                              'authoritative_tick': viewing['state']['tick'],
                                                              'native_next_teammate': True, 'match_id': replay['matchId']}
                    screenshot(page, 'horde-native-coop-spectator')
                    break
                if not spectator:
                    pages[0].wait_for_timeout(30)
        return result
    except BaseException:
        REPORT['cases'].append({'name': 'coop-partial', **result})
        raise
    finally:
        for index, ctx in enumerate(contexts):
            close_context(ctx, pages[index], 'coop-' + str(index))


def touch_event(session, kind, points):
    session.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': points})


def center(page, selector):
    page.locator(selector).scroll_into_view_if_needed()
    box = page.locator(selector).bounding_box()
    assert box
    return {'x': box['x'] + box['width'] / 2, 'y': box['y'] + box['height'] / 2, 'id': 7, 'radiusX': 1, 'radiusY': 1}


def mobile_case(browser):
    checks = []
    for width in (390, 320):
        ctx, page = context(browser, 'mobile/' + str(width), width=width, height=1000, touch=True)
        session = page.context.new_cdp_session(page)
        try:
            solo(page)
            no_overflow(page, 'mobile-setup/' + str(width))
            page.locator('#horde-start').tap()
            phase(page, 'fight', timeout=15000)
            assert snapshot(page)['controls']['touch'] and snapshot(page)['controls']['entered']
            assert not snapshot(page)['controls']['pointerLocked']
            before = actor(page)
            point = center(page, '[data-horde-pad="move"]')
            touch_event(session, 'touchStart', [point])
            moved_point = {**point, 'y': point['y'] - 22}
            touch_event(session, 'touchMove', [moved_point])
            page.wait_for_timeout(180)
            touch_event(session, 'touchEnd', [])
            moved = actor(page)
            assert moved['z'] < before['z'] - .15, ('Native touch pad did not move', before, moved)
            look_before = snapshot(page)['aim']
            point = center(page, '[data-horde-pad="look"]')
            touch_event(session, 'touchStart', [point])
            touch_event(session, 'touchMove', [{**point, 'x': point['x'] + 20}])
            page.wait_for_timeout(120)
            touch_event(session, 'touchCancel', [])
            look_after = snapshot(page)['aim']
            assert abs(native.angle_delta(look_after['yaw'], look_before['yaw'])) > .04
            page.locator('[data-horde-action="fire"]').tap()
            wait(page, 'window.semagHorde.getState().state.players[0].shots>0')
            # A touch cancelled before a simulation tick must not leave a
            # grenade press queued or consume its one-shot action later.
            frag_before = actor(page)['grenades']
            point = center(page, '[data-horde-action="grenade"]')
            touch_event(session, 'touchStart', [point])
            touch_event(session, 'touchCancel', [])
            page.wait_for_timeout(100)
            assert page.locator('[data-horde-action="grenade"]').get_attribute('aria-pressed') == 'false'
            assert actor(page)['previousInput']['grenade'] is False
            # Browser/engine scheduling can sample an action between two CDP
            # packets; report its outcome honestly rather than assuming zero.
            cancel_consumed = frag_before - actor(page)['grenades']
            page.locator('#horde-touch-pause').tap()
            phase(page, 'paused')
            assert not any(button['pressed'] for button in page.locator('[data-horde-action]').evaluate_all('(nodes)=>nodes.map(n=>({pressed:n.getAttribute("aria-pressed")==="true"}))'))
            sizes = no_overflow(page, 'mobile-play/' + str(width))
            screenshot(page, 'horde-native-touch-' + str(width), full=True)
            checks.append({'width': width, 'native_touch_start': True, 'native_pad_movement': True,
                           'native_look_and_cancel_release': True, 'native_fire': True, 'grenade_cancel_consumed': cancel_consumed,
                           'pause_clears_pressed_touch_actions': True, 'size': sizes})
        finally:
            session.detach()
            close_context(ctx, page, 'mobile-' + str(width))
    return {'widths': checks}


def paris_case(browser):
    ctx, page = context(browser, 'paris')
    try:
        solo(page, map_id='paris')
        screenshot(page, 'horde-paris-setup')
        start_solo(page)
        aim(page, 0, .08)
        wait(page, 'window.semagHorde.getState().state.players.some(p=>p.monster&&p.alive)', timeout=6000)
        hostiles = targets(page)
        visible = next((target for target in hostiles if target['visible']), None)
        if visible:
            aim_at(page, visible, height=1)
        screenshot(page, 'horde-paris-native-combat')
        result = {'actual_map': snapshot(page)['state']['mapId'], 'rendered_hostiles': len(hostiles), 'performance': performance(page)}
        pause(page)
        return result
    finally:
        close_context(ctx, page, 'paris')


def photos_case(browser):
    """Photograph approaching live monsters with real first-person aiming."""
    photos = []
    for map_id in ('courtyard', 'paris'):
        ctx, page = context(browser, 'photos/' + map_id)
        try:
            captured = False
            for attempt in range(2):
                solo(page, map_id=map_id)
                start_solo(page)
                aim(page, 0, 0)
                deadline = time.monotonic() + 18
                while time.monotonic() < deadline and actor(page)['alive']:
                    choices = targets(page)
                    visible = [target for target in choices if target['visible']]
                    if visible and (len(visible) >= 2 or visible[0]['distance'] < 7):
                        try:
                            aim_at(page, visible[0], height=1.05)
                        except NativeRunEnded:
                            break
                        # No attack is held: the photographed monster remains
                        # alive while Chromium captures the genuine scene.
                        path = screenshot(page, 'horde-visible-monsters-' + map_id)
                        photos.append({'map': map_id, 'path': path, 'visible_live_monsters': len(visible),
                                       'nearest_distance': visible[0]['distance'],
                                       'monster_types': sorted({target['monsterType'] for target in visible}),
                                       'health': actor(page)['hp'], 'native_aim': snapshot(page)['aim']})
                        captured = True
                        break
                    page.wait_for_timeout(120)
                if captured:
                    break
            assert captured, ('No live visible monster photograph from actual native play', map_id)
        finally:
            close_context(ctx, page, 'photos-' + map_id)
    return {'actual_native_scenes': photos}


def run(browser):
    selected = set(filter(None, os.environ.get('SEMAG_HORDE_CASES', '').split(',')))
    cases = {'setup': setup_case, 'lifecycle': lifecycle_case, 'controls': controls_case, 'combat': combat_case,
             'coop': coop_case, 'mobile': mobile_case, 'paris': paris_case, 'photos': photos_case}
    unknown = selected - cases.keys()
    assert not unknown, ('Unknown SEMAG_HORDE_CASES', sorted(unknown))
    for name, function in cases.items():
        if selected and name not in selected:
            continue
        log('case-start', name=name)
        freeze_bytes('before-' + name)
        error_count, resource_count = len(REPORT['errors']), len(REPORT['failed_resources'])
        try:
            result = function(browser)
            assert len(REPORT['errors']) == error_count, REPORT['errors'][error_count:]
            assert len(REPORT['failed_resources']) == resource_count, REPORT['failed_resources'][resource_count:]
            REPORT['cases'].append({'name': name, 'status': 'passed', **result})
            log('case-passed', name=name)
        except BaseException as error:
            failure = {'name': name, 'status': 'failed', 'error': str(error), 'traceback': traceback.format_exc()}
            REPORT['failures'].append(failure)
            log('case-failed', name=name, error=str(error))
            (OUT / ('failure-' + name + '.json')).write_text(json.dumps(failure, indent=2))
        finally:
            freeze_bytes('after-' + name)
            save_report()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    freeze_bytes('start')
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                args=['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            try:
                run(browser)
            finally:
                browser.close()
    finally:
        save_report()
    status = 'failed' if REPORT['failures'] or REPORT['errors'] or REPORT['failed_resources'] else 'passed'
    print(json.dumps({'status': status, 'passed_cases': [case['name'] for case in REPORT['cases'] if case.get('status') == 'passed'],
                      'failed_cases': [case['name'] for case in REPORT['failures']], 'report': str(OUT / 'report.json')}, indent=2))
    assert status == 'passed', ('Native Horde smoke failures', REPORT['failures'])


if __name__ == '__main__':
    main()
