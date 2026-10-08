"""Trusted browser QA for the Voxel Breach map and weapon expansion.

python test/voxel-expansion-browser-smoke.py [http://127.0.0.1:3000]
Requires Playwright and Chromium. All gameplay comes from native keyboard,
mouse, or trusted Chromium CDP hardware events. Snapshots, immutable map
geometry, WebGL calls and network envelopes are observed, never replaced.
SEMAG_EXPANSION_CASES selects comma-separated map ids, teams, or weapons.
SEMAG_SCREENSHOT_DIR sets the inspectable JSON and screenshot destination.
"""
import importlib.util
import json
import math
import os
from pathlib import Path
import sys
import time
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', ROOT / 'test-results' / 'voxel-expansion'))
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3000').rstrip('/')
MAP_IDS = ('courtyard', 'depot', 'canal', 'rooftops', 'foundry', 'bastion')
CATALOG_MAP_IDS = (*MAP_IDS, 'paris')
WEAPON_IDS = ('carbine', 'smg', 'marksman', 'pistol', 'shotgun', 'burst', 'sniper', 'lmg', 'crossbow')
spec = importlib.util.spec_from_file_location('voxel_native_fixture', ROOT / 'test' / 'voxel-browser-smoke.py')
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)
native.OUT, native.URL = OUT, URL
REPORT = {'cases': [], 'screenshots': native.REPORT['screenshots'], 'errors': [], 'failed_resources': []}
SETUP_CAPTURED = os.environ.get('SEMAG_EXPANSION_SKIP_SETUP') == '1'

# Add bounded timing/byte observation to the established native fixture. This
# wraps transport observation without sending or changing any game message.
INSTRUMENT = native.INSTRUMENT.replace('glContexts:0,glResources:{}', 'glContexts:0,glResources:{},statePackets:[]')
INSTRUMENT = INSTRUMENT.replace("if(message.type==='state')stats.latestState=message;", """if(message.type==='state'){
  stats.latestState=message;stats.statePackets.push({time:performance.now(),tick:message.state.tick,bytes:new TextEncoder().encode(event.data).length});
  if(stats.statePackets.length>2400)stats.statePackets.shift();
}""")
native.INSTRUMENT = INSTRUMENT


def snapshot(page):
    return page.evaluate('window.SemagVoxel.getState()')


def wait(page, expression, arg=None, timeout=8000):
    return page.wait_for_function(expression, arg=arg, polling=20, timeout=timeout)


def actor(page, ident=None):
    observed = snapshot(page)
    return observed['state']['players'][observed['playerId'] if ident is None else ident]


def connected(page):
    wait(page, 'window.SemagVoxel?.getState().connected && Number.isInteger(window.SemagVoxel.getState().playerId) && window.SemagVoxel.getState().state', timeout=15000)


def settled(pages):
    deadline, previous = time.monotonic() + 20, None
    while time.monotonic() < deadline:
        seen = [snapshot(page) for page in pages]
        ids = [item['playerId'] for item in seen]
        if all(item['connected'] for item in seen) and sorted(ids) == list(range(len(pages))):
            if ids == previous:
                return [pages[ids.index(ident)] for ident in range(len(pages))]
            previous = ids
        else:
            previous = None
        pages[0].wait_for_timeout(80)
    raise AssertionError(('Seats did not settle', ids))


def select_native(page, selector, value):
    picker = page.locator(selector)
    values = picker.locator('option').evaluate_all('(nodes)=>nodes.map(node=>node.value)')
    assert value in values, (selector, value, values)
    picker.click()
    page.keyboard.press('Home')
    for _ in range(values.index(value)):
        page.keyboard.press('ArrowDown')
    page.keyboard.press('Enter')
    assert picker.input_value() == value


def create_room(page, size, map_id):
    global SETUP_CAPTURED
    page.goto(URL)
    wait(page, 'document.querySelector("#host-status").textContent === "Host is online"')
    page.locator('[data-create-game="voxel-breach"]').click()
    page.locator(f'#voxel-setup [name=teamSize][value="{size}"]').check()
    assert page.locator('#voxel-map option').evaluate_all('(nodes)=>nodes.map(node=>node.value)') == list(CATALOG_MAP_IDS)
    if not SETUP_CAPTURED:
        checks = []
        for preview_id in CATALOG_MAP_IDS:
            select_native(page, '#voxel-map', preview_id)
            arena = geometry(page, preview_id)
            note = page.locator('[data-map-note]').inner_text()
            assert note.startswith(arena['description']) and f"{len(arena['routes'])} climb routes" in note
            assert arena['name'] in page.locator('[data-map-preview]').get_attribute('aria-label')
            assert page.locator('[data-map-preview] polyline').count() == len(arena['routes'])
            assert page.locator('[data-map-preview] circle').count() == 2
            assert 'NaN' not in page.locator('[data-map-preview]').inner_html()
            checks.append({'map': preview_id, 'route_count': len(arena['routes']), 'native_preview_switch': True})
        select_native(page, '#voxel-map', 'rooftops')
        for width in (1280, 390, 320):
            page.set_viewport_size({'width': width, 'height': 1000})
            native.no_overflow(page, 'map-setup/' + str(width))
            assert page.locator('#voxel-setup').evaluate('(node)=>node.scrollWidth<=node.clientWidth'), ('Setup dialog horizontal overflow', width)
            screenshot(page, 'voxel-six-map-setup-' + str(width))
        page.set_viewport_size({'width': 1280, 'height': 960})
        REPORT['hub_setup'] = {'maps': checks, 'responsive_widths': [1280, 390, 320]}
        SETUP_CAPTURED = True
    select_native(page, '#voxel-map', map_id)
    page.locator('#voxel-create').click()
    page.wait_for_url('**/voxel.html?room=*')
    connected(page)
    return parse_qs(urlparse(page.url).query)['room'][0]


def room(browser, map_id, size=1, weapon='sniper'):
    contexts = []
    for i in range(size * 2):
        if size > 1:
            # Six genuine clients need not render six high-resolution software
            # WebGL scenes. Native browser device settings reduce only the QA
            # peers' raster load; gameplay and Ready stay fully operational.
            context = browser.new_context(viewport={'width': 960 if i == 0 else 320, 'height': 800 if i == 0 else 600}, device_scale_factor=1 if i == 0 else .5)
            context.add_init_script('(' + INSTRUMENT + ')();')
        else:
            context = native.new_context(browser, 1280 if i == 0 else 640)
        contexts.append(context)
    pages = [context.new_page() for context in contexts]
    for i, page in enumerate(pages):
        native.observe(page, f'{map_id}/{size}v{size}/{i}')
    try:
        create_room(pages[0], size, map_id)
        for page in pages[1:]:
            page.goto(pages[0].url)
            connected(page)
        pages = settled(pages)
        select_native(pages[0], '#loadout-select', weapon)
        wait(pages[0], 'weapon=>window.SemagVoxel.getState().state.players[0].weapon===weapon', weapon)
        select_native(pages[0], 'select[data-keyboard-layout]', 'zqsd')
        return contexts, pages
    except BaseException as error:
        inspection = {'map': map_id, 'size': size, 'error': str(error), 'pages': []}
        for page in pages:
            try:
                inspection['pages'].append({'url': page.url, 'observed': page.evaluate('({game:window.SemagVoxel?.getState(),welcome:window.__voxelQA?.welcome,last:window.__voxelQA?.latestState,error:document.querySelector("#error-banner")?.textContent})')})
            except Exception as observation_error:
                inspection['pages'].append({'url': page.url, 'observation_error': str(observation_error)})
        (OUT / ('failure-room-' + str(size) + 'v' + str(size) + '.json')).write_text(json.dumps(inspection, indent=2))
        for context in contexts:
            context.close()
        raise


def ready(pages, azerty=False):
    before = actor(pages[0])
    pages[0].locator('#arena').focus()
    native.cdp_key(pages[0], 'z', 'KeyW')
    pages[0].wait_for_timeout(80)
    native.cdp_key(pages[0], 'z', 'KeyW', 'keyUp')
    assert native.horizontal_distance(before, actor(pages[0])) < .001
    for page in pages[:-1]:
        page.locator('#ready-button').click()
    pages[0].wait_for_timeout(150)
    assert snapshot(pages[0])['state']['phase'] == 'lobby'
    pages[-1].locator('#ready-button').click()
    wait(pages[0], 'window.SemagVoxel.getState().state.phase === "countdown"', timeout=9000)
    assert len(snapshot(pages[0])['state']['players']) == len(pages)
    if azerty:
        for width in (390, 320):
            pages[0].set_viewport_size({'width': width, 'height': 1000})
            native.no_overflow(pages[0], 'nine-loadout-setup/' + str(width))
            boxes = pages[0].evaluate('''()=>{
                const rect=node=>{const r=node.getBoundingClientRect();return{x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width}};
                return{viewport:rect(document.querySelector('#viewport')),buttons:Array.from(document.querySelectorAll('[data-arena-loadout]')).map(rect),
                    horizontal:Array.from(document.querySelectorAll('[data-arena-loadout],#overlay-title,#overlay-subtitle')).map(node=>({width:node.clientWidth,scroll:node.scrollWidth}))};
            }''')
            assert len(boxes['buttons']) == 9
            for box in boxes['buttons']:
                assert box['width'] > 0 and box['x'] >= boxes['viewport']['x']-1 and box['right'] <= boxes['viewport']['right']+1, ('Setup button clipped', width, boxes)
            assert all(box['scroll'] <= box['width']+1 for box in boxes['horizontal']), ('Setup text overflow', width, boxes)
            screenshot(pages[0], 'voxel-nine-loadout-setup-' + str(width))
        pages[0].set_viewport_size({'width': 1280, 'height': 960})
        for weapon in ('sniper', 'lmg', 'crossbow'):
            pages[0].locator('[data-arena-loadout="' + weapon + '"]').click()
            wait(pages[0], 'weapon=>window.SemagVoxel.getState().state.players[0].weapon===weapon', weapon)
        native.enter_arena(pages[0])
        symbols = ('&', 'é', '"', "'", '(', '-', 'è', '_', 'ç')
        for i, (symbol, weapon) in enumerate(zip(symbols, WEAPON_IDS), 1):
            native.cdp_key(pages[0], symbol, 'Digit' + str(i))
            native.cdp_key(pages[0], symbol, 'Digit' + str(i), 'keyUp')
            wait(pages[0], 'weapon=>window.SemagVoxel.getState().state.players[0].weapon===weapon', weapon)
        # Restore the explicitly chosen scope loadout using its native shortcut.
        native.cdp_key(pages[0], 'è', 'Digit7')
        native.cdp_key(pages[0], 'è', 'Digit7', 'keyUp')
        wait(pages[0], 'window.SemagVoxel.getState().state.players[0].weapon==="sniper"')
    wait(pages[0], 'window.SemagVoxel.getState().state.phase === "fight"', timeout=14000)
    for page in pages:
        wait(page, 'window.SemagVoxel.getState().state.phase === "fight"')
    return {'all_ready_required': True, 'prestart_movement_blocked': True, 'capacity': len(pages),
            'trusted_azerty_nine_loadouts': azerty, 'native_three_new_loadout_buttons': azerty}


def geometry(page, map_id):
    return page.evaluate('async id=>(await import("/voxel-maps.js")).MAPS[id]', map_id)


def finite_state(page):
    seen = snapshot(page)
    assert seen['graphicsError'] == ''
    assert seen['renderCount'] > 0
    assert seen['queueLength'] <= 240
    for body in seen['state']['players']:
        for key in ('x', 'y', 'z', 'vx', 'vy', 'vz', 'yaw', 'pitch'):
            assert math.isfinite(body[key]), (key, body)
    for bolt in seen['state'].get('bolts', []):
        for key in ('x', 'y', 'z', 'vx', 'vy', 'vz'):
            assert math.isfinite(bolt[key]), (key, bolt)
    return seen


def screenshot(page, name, canvas=False):
    path = OUT / (name + '.png')
    (page.locator('#viewport') if canvas else page).screenshot(path=str(path), **({} if canvas else {'full_page': True}))
    REPORT['screenshots'].append(str(path))


def responsive(page, map_id):
    samples = []
    for width in (1280, 390, 320):
        page.set_viewport_size({'width': width, 'height': 960 if width == 1280 else 1000})
        page.wait_for_timeout(120)
        native.no_overflow(page, map_id + '/' + str(width))
        finite_state(page)
        screenshot(page, f'voxel-{map_id}-{width}')
        samples.append(width)
    page.set_viewport_size({'width': 960, 'height': 800})
    return samples


def native_move(page, x, z, timeout=20000):
    """World waypoints are navigated through genuine hardware key pairs."""
    native.enter_arena(page)
    french = page.locator('select[data-keyboard-layout]').input_value() == 'zqsd'
    key = 'z' if french else 'w'
    deadline = time.monotonic() + timeout / 1000
    for _ in range(5):
        current = actor(page)
        dx, dz = x - current['x'], z - current['z']
        distance = math.hypot(dx, dz)
        if distance < .25:
            return current
        assert snapshot(page)['state']['phase'] == 'fight' and current['alive'], ('Route interrupted', current)
        native.native_aim(page, math.atan2(dx, -dz), 0)
        walking = distance < 1.4
        if walking:
            page.keyboard.down('Shift')
        session = page.context.new_cdp_session(page)
        move_key = key.upper() if walking else key
        key_payload = {'key': move_key, 'code': 'KeyW', 'windowsVirtualKeyCode': ord(key.upper()), 'modifiers': 8 if walking else 0}
        session.send('Input.dispatchKeyEvent', {'type': 'keyDown', 'text': move_key, 'unmodifiedText': key, **key_payload})
        try:
            wait(page, """([id,x,z,ux,uz])=>{
                const s=window.SemagVoxel.getState().state,p=s.players[id];
                return s.phase!=='fight'||!p.alive||(x-p.x)*ux+(z-p.z)*uz<.12;
            }""", [snapshot(page)['playerId'], x, z, dx/distance, dz/distance],
                timeout=max(1500, min(int((deadline-time.monotonic())*1000), int((distance/2.2+4)*1000))))
        finally:
            session.send('Input.dispatchKeyEvent', {'type': 'keyUp', **key_payload})
            session.detach()
            if walking:
                page.keyboard.up('Shift')
        page.wait_for_timeout(120)
        if time.monotonic() > deadline:
            break
    current = actor(page)
    assert math.hypot(x-current['x'],z-current['z']) < .35, ('Native waypoint missed', x, z, current)
    return current


def native_hop(page, step, collider):
    body = actor(page)
    expected_y = collider['y'] + collider['h']
    assert expected_y > body['y'] and expected_y - body['y'] <= 1.12
    dx, dz = step['x'] - body['x'], step['z'] - body['z']
    if abs(dz) >= abs(dx):
        near_z = collider['z'] + collider['d'] + .4 if dz < 0 else collider['z'] - .4
        native_move(page, step['x'], near_z)
    else:
        near_x = collider['x'] + collider['w'] + .4 if dx < 0 else collider['x'] - .4
        native_move(page, near_x, step['z'])
    body = actor(page)
    native.native_aim(page, math.atan2(step['x'] - body['x'], -(step['z'] - body['z'])), 0)
    native.enter_arena(page)
    native.cdp_key(page, 'z', 'KeyW')
    native.cdp_key(page, ' ', 'Space')
    try:
        wait(page, '([height,id])=>{const p=window.SemagVoxel.getState().state.players[id];return p.grounded && Math.abs(p.y-height)<.001}', [expected_y, 0], timeout=3500)
    finally:
        native.cdp_key(page, ' ', 'Space', 'keyUp')
        native.cdp_key(page, 'z', 'KeyW', 'keyUp')
    page.wait_for_timeout(100)
    landed = actor(page)
    assert landed['grounded'] and abs(landed['y'] - expected_y) < .001, ('Native hop missed support', step, collider, landed)
    # Centre on the real reached support using native walk input before the
    # next fresh Space press; no held-key auto-hop or state changes are used.
    native_move(page, step['x'], step['z'])
    return {'collider': collider['id'], 'expected_y': expected_y,
            'landed': {key: landed[key] for key in ('x', 'y', 'z', 'grounded')}}


def route_case(first, second, arena):
    routes = [route for route in arena['routes'] if route.get('side', 0) in (0, 'south')]
    assert routes, ('No attacker-side route', arena['id'])
    route = next((item for item in routes if 'west-south' in item['id']), routes[0])
    points = route.get('approach', []) + [route['start']]
    for point in points:
        native_move(first, point['x'], point['z'])
    hops = []
    for step in route['steps']:
        collider = next(box for box in arena['colliders'] if box['id'] == step['colliderId'])
        hops.append(native_hop(first, step, collider))
    first.wait_for_timeout(180)
    top = actor(first)
    assert top['grounded'] and top['y'] >= 2.4
    wait(second, 'height=>Math.abs(window.SemagVoxel.getState().state.players[0].y-height)<.001', top['y'])
    peer = actor(second, 0)
    assert native.horizontal_distance(top, peer) < .05
    native.native_aim(first, math.atan2(-top['x'], top['z']), -.13)
    screenshot(first, f'voxel-{arena["id"]}-climbed-perch', canvas=True)
    return {'route': route['id'], 'real_native_space_hops': hops,
            'perch_y': top['y'], 'second_client_y': peer['y'], 'authoritative_clients_agree': True}


def rooftop_counterplay(first, second):
    """An actual floor opponent can contest the climbed perch; supplies and
    traversal still collide with the same upper slabs and roof cover."""
    native_move(second, -13, -10)
    target, shooter = actor(first), actor(second)
    yaw = math.atan2(target['x'] - shooter['x'], -(target['z'] - shooter['z']))
    distance = native.horizontal_distance(target, shooter)
    pitch = math.atan2(target['y'] + 1.51 - (shooter['y'] + 1.62), distance)
    native.native_aim(second, yaw, pitch)
    second.mouse.down(button='right')
    try:
        wait(second, 'window.SemagVoxel.getState().state.players[1].aimTicks>=18')
        second.mouse.down(button='left')
        second.wait_for_timeout(40)
        second.mouse.up(button='left')
        wait(first, 'window.SemagVoxel.getState().state.players[0].hp<200')
    finally:
        second.mouse.up(button='right')
    contested = actor(first)
    assert contested['alive'] and contested['hp'] < 200
    native.native_aim(first, math.atan2(-16.1 - contested['x'], -(-1.1 - contested['z'])), -.35)
    event_id = snapshot(first)['state']['eventId']
    # Printed A on unshifted AZERTY is canonical Q: grenade, while printed Q
    # remains left movement. Both physical key/code combinations are trusted.
    native.cdp_key(first, 'a', 'KeyQ')
    first.wait_for_timeout(40)
    native.cdp_key(first, 'a', 'KeyQ', 'keyUp')
    wait(first, 'id=>window.SemagVoxel.getState().state.events.some(event=>event.id>id&&event.type==="grenadeBounce"&&event.colliderId==="roofline-west-cover")', event_id, timeout=2500)
    bounce = next(event for event in snapshot(first)['state']['events'] if event['id'] > event_id and event['type'] == 'grenadeBounce' and event['colliderId'] == 'roofline-west-cover')
    assert bounce['y'] > 3.2
    # Walk off the real western edge before the finite frag fuse. The upper
    # cover does not touch this southern line across the top of the slab.
    native_move(first, -18, .35)
    wait(first, 'window.SemagVoxel.getState().state.players[0].grounded && window.SemagVoxel.getState().state.players[0].y===0')
    screenshot(first, 'voxel-roofline-real-grenade-escape', canvas=True)
    native_move(first, -18, -1)
    first.keyboard.down('Control')
    try:
        native_move(first, -13, -1)
        underneath = actor(first)
        assert underneath['crouching'] and underneath['grounded'] and underneath['y'] == 0
        screenshot(first, 'voxel-roofline-walk-under', canvas=True)
    finally:
        first.keyboard.up('Control')
    wait(first, '!window.SemagVoxel.getState().state.players[0].crouching')
    first.keyboard.down('Space')
    try:
        wait(first, 'window.SemagVoxel.getState().state.players[0].y>.8')
        head_contact = actor(first)
        assert head_contact['y'] <= 1.00001
        wait(first, 'window.SemagVoxel.getState().state.players[0].grounded')
    finally:
        first.keyboard.up('Space')
    assert actor(first)['y'] == 0
    return {'native_floor_counterfire_hp': contested['hp'], 'elevated_grenade_bounce': bounce,
            'azerty_nearby_grenade': True, 'walk_off_and_crouched_underpass': underneath,
            'underside_head_collision_y': head_contact['y'], 'returned_to_real_floor': True}


def performance(page, duration=1800):
    page.wait_for_timeout(duration)
    stats = page.evaluate('window.__voxelQA')
    render = snapshot(page).get('renderer', snapshot(page).get('renderStats'))
    packets = stats['statePackets'][-120:]
    observed = {}
    if len(packets) > 1:
        span = (packets[-1]['time'] - packets[0]['time']) / 1000
        observed = {'sample_seconds': span, 'snapshots_per_second': (len(packets) - 1) / span,
                    'observed_ticks_per_second': (packets[-1]['tick'] - packets[0]['tick']) / span,
                    'bytes_per_snapshot': native.distribution([item['bytes'] for item in packets]),
                    'tick_gaps': native.distribution([b['tick']-a['tick'] for a,b in zip(packets, packets[1:])]),
                    'pump_drop_count_available': False}
    assert stats['drawCalls'] and max(stats['drawCalls']) <= 16, ('Batch count grew', stats['drawCalls'][-30:])
    assert stats['glResources']['buffers']['live'] <= 8
    assert stats['glResources']['programs']['live'] <= 2
    assert stats['glContexts'] > 0
    assert render and render['cachedMaps'] <= 3 and render['mapVertices'] <= 150000, ('Map cache/vertex budget grew', render)
    assert math.isfinite(render['dynamicVertices']) and render['dynamicVertices'] <= 100000
    inputs = stats['inputTimes'][-240:]
    input_hz = (len(inputs)-1) / ((inputs[-1]-inputs[0])/1000) if len(inputs)>1 and inputs[-1]>inputs[0] else 0
    assert input_hz <= 155, ('Excessive input packet budget', input_hz)
    finite_state(page)
    return {'software_webgl_sample': True, 'cpu_ms': native.distribution(stats['cpu']),
            'frame_gap_ms': native.distribution(stats['gaps']), 'draw_calls': native.distribution(stats['drawCalls']),
            'webgl_resources': stats['glResources'], 'observed_network': observed,
            'input_packets_per_second': input_hz, 'renderer': render}


def ads(page, weapon):
    native.enter_arena(page)
    before = actor(page)
    page.mouse.down(button='right')
    try:
        wait(page, 'window.SemagVoxel.getState().state.players[0].aimTicks>=18')
        aimed = actor(page)
        assert aimed['aiming']
        if weapon == 'sniper':
            page.locator('#scope-reticle').wait_for(state='visible')
            assert 'SNIPER' in page.locator('#scope-reticle').inner_text()
        screenshot(page, 'voxel-new-' + weapon + '-ads', canvas=True)
    finally:
        page.mouse.up(button='right')
    wait(page, '!window.SemagVoxel.getState().input.aim')
    return {'before_ticks': before['aimTicks'], 'aimed_ticks': aimed['aimTicks'], 'native_rmb': True}


def blocked_weapon(first, second, weapon):
    arena = geometry(first, 'courtyard')
    # The central wall is reached by native floor movement; point the gun into
    # its drawn face. The second player remains behind the actual obstacle.
    native_move(first, -4, 18)
    native.native_aim(first, 0, 0)
    aim = ads(first, weapon)
    before = actor(first)
    event_id = snapshot(first)['state']['eventId']
    first.mouse.down(button='left')
    try:
        if weapon == 'lmg':
            winding = wait(first, 'ammo=>{const p=window.SemagVoxel.getState().state.players[0];return p.spinTicks>0&&p.spinTicks<24&&p.ammo===ammo?p:false}', before['ammo']).json_value()
            assert winding['ammo'] == before['ammo'], ('LMG fired before winding up', winding, before)
            wait(first, 'window.SemagVoxel.getState().state.players[0].ammo<=45', timeout=3500)
        elif weapon == 'crossbow':
            flight = wait(first, '()=>window.SemagVoxel.getState().state.bolts.find(bolt=>bolt.playerId===0&&bolt.ageTicks>0&&bolt.traveledDistance>0)||false', timeout=1500).json_value()
            assert flight['ageTicks'] > 0 and flight['traveledDistance'] > 0
        else:
            wait(first, 'window.SemagVoxel.getState().state.players[0].ammo<5')
            first.wait_for_timeout(450)
    finally:
        first.mouse.up(button='left')
    kind = 'boltHit' if weapon == 'crossbow' else 'shot'
    wait(first, '([id,kind])=>window.SemagVoxel.getState().state.events.some(event=>event.id>id&&event.type===kind&&event.playerId===0)', [event_id, kind])
    after = actor(first)
    impacts = [event for event in snapshot(first)['state']['events'] if event['id'] > event_id and event['type'] == kind and event['playerId'] == 0]
    assert impacts and impacts[0]['hitKind'] == 'wall', (weapon, impacts)
    assert actor(second, 1)['hp'] == 200
    if weapon == 'sniper':
        assert before['ammo'] - after['ammo'] == 1, ('Held sniper trigger repeated', before, after)
    if weapon == 'lmg':
        wait(first, 'window.SemagVoxel.getState().state.players[0].spinTicks===0')
        assert len(impacts) >= 3
        assert all(b['tick'] - a['tick'] == 12 for a,b in zip(impacts, impacts[1:])), impacts
    if weapon == 'crossbow':
        assert impacts[0]['ageTicks'] > 0
        assert snapshot(first)['state']['bolts'] == []
    first.keyboard.press('r', delay=40)
    wait(first, 'window.SemagVoxel.getState().state.players[0].reloadTicks>0')
    screenshot(first, 'voxel-new-' + weapon + '-reload', canvas=True)
    wait(first, 'window.SemagVoxel.getState().state.players[0].reloadTicks===0', timeout=6000)
    reloaded = actor(first)
    assert reloaded['ammo'] > after['ammo'] and reloaded['reserve'] < after['reserve']
    return {'weapon': weapon, 'native_ads': aim, 'shots': impacts,
            'native_spinup_before_fire': weapon == 'lmg', 'native_travelling_bolt': weapon == 'crossbow',
            'cover_blocked': True, 'finite_manual_reload': True}


def run_map(browser, map_id):
    contexts, pages = room(browser, map_id)
    try:
        gate = ready(pages, azerty=map_id == 'courtyard')
        native.enter_arena(pages[0])
        widths = responsive(pages[0], map_id)
        climb = route_case(pages[0], pages[1], geometry(pages[0], map_id)) if map_id in ('courtyard', 'rooftops', 'foundry') else None
        counterplay = rooftop_counterplay(pages[0], pages[1]) if map_id == 'rooftops' else None
        perf = performance(pages[0])
        REPORT['cases'].append({'map': map_id, 'mode': '1v1', 'ready': gate,
                                'responsive_widths': widths, 'climb': climb, 'counterplay': counterplay, 'performance': perf})
        print('PASS map ' + map_id + ': native Ready, real WebGL, responsive widths' + (', multihop perch' if climb else ''), flush=True)
    except BaseException:
        screenshot(pages[0], 'failure-' + map_id)
        (OUT / ('failure-' + map_id + '.json')).write_text(json.dumps(snapshot(pages[0]), indent=2))
        raise
    finally:
        for context in contexts:
            context.close()


def run_team(browser, size):
    contexts, pages = room(browser, 'bastion' if size == 3 else 'foundry', size=size, weapon='lmg')
    sessions = []
    try:
        gate = ready(pages)
        expected = [0] * size + [1] * size
        for page in pages:
            assert [body['team'] for body in snapshot(page)['state']['players']] == expected
        # Every client first reaches the real fight. Only passive renderer
        # lifecycles then freeze to keep software WebGL QA meaningful; real
        # sockets and the authoritative simulation stay intact.
        for page in pages[1:]:
            session = page.context.new_cdp_session(page)
            session.send('Page.setWebLifecycleState', {'state': 'frozen'})
            sessions.append(session)
        native.enter_arena(pages[0])
        native.cdp_key(pages[0], 'z', 'KeyW')
        pages[0].wait_for_timeout(150)
        native.cdp_key(pages[0], 'z', 'KeyW', 'keyUp')
        finite_state(pages[0])
        screenshot(pages[0], 'voxel-new-' + str(size) + 'v' + str(size), canvas=True)
        REPORT['cases'].append({'mode': str(size) + 'v' + str(size), 'ready': gate, 'teams': expected,
                                'performance': performance(pages[0]), 'passive_renderers_frozen_after_real_ready': len(sessions)})
        print('PASS real ' + str(size) + 'v' + str(size) + ' Ready/team gate', flush=True)
    finally:
        for session in sessions:
            try:
                session.send('Page.setWebLifecycleState', {'state': 'active'})
                session.detach()
            except Exception:
                pass
        for context in contexts:
            context.close()


def run_weapon(browser, weapon):
    contexts, pages = room(browser, 'courtyard', weapon=weapon)
    try:
        ready(pages)
        evidence = blocked_weapon(pages[0], pages[1], weapon)
        evidence['performance'] = performance(pages[0])
        REPORT['cases'].append(evidence)
        print('PASS new weapon ' + weapon + ': native ADS, distinct trigger, blocked impact, finite reload', flush=True)
    except BaseException:
        screenshot(pages[0], 'failure-weapon-' + weapon)
        (OUT / ('failure-weapon-' + weapon + '.json')).write_text(json.dumps(snapshot(pages[0]), indent=2))
        raise
    finally:
        for context in contexts:
            context.close()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    selected = os.environ.get('SEMAG_EXPANSION_CASES', 'all').split(',')
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                args=['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            try:
                for map_id in MAP_IDS:
                    if 'all' in selected or map_id in selected:
                        run_map(browser, map_id)
                for size in (2, 3):
                    if 'all' in selected or 'teams' in selected or str(size) + 'v' + str(size) in selected:
                        run_team(browser, size)
                for weapon in ('sniper', 'lmg', 'crossbow'):
                    if 'all' in selected or 'weapons' in selected or weapon in selected:
                        run_weapon(browser, weapon)
            finally:
                browser.close()
    finally:
        REPORT['errors'] = native.ERRORS
        REPORT['failed_resources'] = native.RESOURCES
        (OUT / 'report.json').write_text(json.dumps(REPORT, indent=2))
    assert not native.ERRORS, native.ERRORS
    assert not native.RESOURCES, native.RESOURCES
    print(json.dumps({'status': 'passed', 'cases': len(REPORT['cases']), 'report': str(OUT / 'report.json')}), flush=True)


if __name__ == '__main__':
    main()
