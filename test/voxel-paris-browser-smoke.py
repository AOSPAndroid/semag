"""Native browser QA for Paris in both voxel games.

python test/voxel-paris-browser-smoke.py http://127.0.0.1:3000
SEMAG_PARIS_CASES selects breach,royale. SEMAG_SCREENSHOT_DIR selects reports.
All gameplay uses genuine keyboard/mouse/CDP input. Immutable maps, copied
snapshots, transport and WebGL calls are observed without changing game state.
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
OUT = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', '/workspace/scratch/semag-paris-browser'))
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3000').rstrip('/')


def fixture(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'test' / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


native = fixture('paris_native', 'voxel-browser-smoke.py')
royale = fixture('paris_royale', 'voxel-royale-browser-smoke.py')
REPORT = {'cases': [], 'screenshots': [], 'errors': [], 'failed_resources': []}
INSTRUMENT = royale.INSTRUMENT.replace('messages:[],sent:[]', 'messages:[],sent:[],socketLifecycle:[]')
INSTRUMENT = INSTRUMENT.replace("super(...args);this.addEventListener('message'", """super(...args);
      this.addEventListener('open',()=>stats.socketLifecycle.push({type:'open',time:performance.now()}));
      this.addEventListener('close',event=>stats.socketLifecycle.push({type:'close',time:performance.now(),code:event.code,reason:event.reason}));
      this.addEventListener('message'""")
MODES = {
    'breach': {'debug': 'SemagVoxel', 'game': 'voxel-breach', 'dialog': '#voxel-setup', 'select': '#voxel-map',
               'create': '#voxel-create', 'path': 'voxel.html', 'maps': '/voxel-maps.js',
               'note': '[data-map-note]', 'preview': '[data-map-preview]'},
    'royale': {'debug': 'SemagRoyale', 'game': 'voxel-royale', 'dialog': '#royale-setup', 'select': '#royale-map',
               'create': '#royale-create', 'path': 'voxel-royale.html', 'maps': '/voxel-royale-maps.js',
               'note': '[data-royale-map-note]', 'preview': '[data-royale-map-preview]'},
}
ACTIVE_MODE = {}


def log(stage, **details):
    print(json.dumps({'stage': stage, **details}), flush=True)


def wait(page, expression, arg=None, timeout=12000):
    return page.wait_for_function(expression, arg=arg, polling=25, timeout=timeout)


def debug(page):
    return MODES[ACTIVE_MODE[id(page)]]['debug']


def snapshot(page):
    return page.evaluate('window.' + debug(page) + '.getState()')


def actor(page, ident=None):
    seen = snapshot(page)
    return seen['state']['players'][seen['playerId'] if ident is None else ident]


def connected(page):
    name = debug(page)
    wait(page, f'window.{name}?.getState().connected && Number.isInteger(window.{name}.getState().playerId) && window.{name}.getState().state', timeout=20000)
    return snapshot(page)['playerId']


def observe(page, tag):
    page.on('pageerror', lambda error: REPORT['errors'].append(f'{tag}: {error}'))
    page.on('console', lambda message: REPORT['errors'].append(f'{tag}: {message.text}') if message.type == 'error' else None)
    page.on('response', lambda response: REPORT['failed_resources'].append(f'{tag}: {response.status} {response.url}') if response.status >= 400 else None)


def screenshot(page, name, target='#viewport'):
    path = OUT / (name + '.png')
    if target:
        page.locator(target).screenshot(path=str(path))
    else:
        page.screenshot(path=str(path), full_page=True)
    REPORT['screenshots'].append(str(path))
    return str(path)


def select(page, selector, value):
    royale.select_native(page, selector, value)


def enter(page):
    name = debug(page)
    button = page.locator('#enter-arena')
    if button.is_visible():
        button.click()
    wait(page, f'''()=>{{const c=window.{name}?.getState().controls;
      return c&&!c.paused&&(c.pointerLocked||c.fallback||c.touch);}}''')
    page.locator('#arena').focus()


def aim(page, yaw, pitch=0):
    return native.native_aim(page, yaw, pitch) if ACTIVE_MODE[id(page)] == 'breach' else royale.aim(page, yaw, pitch)


def tap(page, key, code):
    session = page.context.new_cdp_session(page)
    try:
        native.cdp_key(page, key, code, session=session)
        page.wait_for_timeout(45)
        native.cdp_key(page, key, code, 'keyUp', session=session)
    finally:
        session.detach()


def finite(page, arena):
    seen = snapshot(page)
    assert not seen['graphicsError'] and seen['renderCount'] > 0 and seen['queueLength'] <= 240, seen
    bounds = arena['bounds']
    for body in seen['state']['players']:
        assert all(math.isfinite(body[key]) for key in ('x', 'y', 'z', 'vx', 'vy', 'vz', 'yaw', 'pitch')), body
        if not body['alive']:
            continue
        r, height = body['radius'], 1.15 if body['crouching'] else 1.8
        assert bounds['minX'] + r - .0001 <= body['x'] <= bounds['maxX'] - r + .0001
        assert bounds['minZ'] + r - .0001 <= body['z'] <= bounds['maxZ'] - r + .0001
        assert body['y'] >= -.0001
        supported = body['y'] <= .0001
        for box in arena['colliders']:
            gap = math.hypot(body['x'] - max(box['x'], min(box['x'] + box['w'], body['x'])),
                             body['z'] - max(box['z'], min(box['z'] + box['d'], body['z'])))
            overlap = body['y'] < box['y'] + box['h'] - .0001 and body['y'] + height > box['y'] + .0001
            assert not overlap or gap >= r - .0001, ('Solid penetration', body, box, gap)
            supported |= abs(body['y'] - box['y'] - box['h']) < .0001 and gap <= r + .0001
        assert not body['grounded'] or supported, ('Grounded without physical support', body)
    return seen


def move(page, x, z, arena, timeout=20000):
    """Walk one planned collision-free segment with real French-layout input."""
    enter(page)
    key = 'z' if page.locator('select[data-keyboard-layout]').input_value() == 'zqsd' else 'w'
    deadline = time.monotonic() + timeout / 1000
    for _ in range(5):
        body = actor(page)
        dx, dz = x - body['x'], z - body['z']
        distance = math.hypot(dx, dz)
        if distance < .3:
            finite(page, arena)
            return body
        assert snapshot(page)['state']['phase'] == 'fight' and body['alive'], ('Route interrupted', body)
        aim(page, math.atan2(dx, -dz))
        walking = distance < 1.5
        if walking:
            page.keyboard.down('Shift')
        session = page.context.new_cdp_session(page)
        move_key = key.upper() if walking else key
        payload = {'key': move_key, 'code': 'KeyW', 'windowsVirtualKeyCode': ord(key.upper()), 'modifiers': 8 if walking else 0}
        session.send('Input.dispatchKeyEvent', {'type': 'keyDown', 'text': move_key, 'unmodifiedText': key, **payload})
        try:
            wait(page, f'''([id,x,z,ux,uz])=>{{const s=window.{debug(page)}.getState().state,p=s.players[id];
                return s.phase!=='fight'||!p||!p.alive||(x-p.x)*ux+(z-p.z)*uz<.12;}}''',
                 [snapshot(page)['playerId'], x, z, dx / distance, dz / distance],
                 timeout=max(1800, min(int((deadline - time.monotonic()) * 1000), int((distance / 2.2 + 4) * 1000))))
        finally:
            session.send('Input.dispatchKeyEvent', {'type': 'keyUp', **payload})
            session.detach()
            if walking:
                page.keyboard.up('Shift')
        page.wait_for_timeout(100)
        assert snapshot(page)['connected'] and snapshot(page)['state']['phase'] == 'fight', ('Connection or round interrupted during native walk', snapshot(page))
        finite(page, arena)
        if time.monotonic() > deadline:
            break
    body = actor(page)
    assert math.hypot(x - body['x'], z - body['z']) < .4, ('Native waypoint missed', x, z, body)
    return body


def route_to(page, arena, x, z):
    before = actor(page)
    route = royale.Navigator(arena).route((before['x'], before['z']), (x, z))
    log('native-ground-route-planned', mode=ACTIVE_MODE[id(page)], start=[before['x'], before['z']], target=[x,z], waypoints=route)
    for target in route:
        move(page, *target, arena)
        log('native-ground-waypoint-reached', mode=ACTIVE_MODE[id(page)], target=target)
    return {'start': {key: before[key] for key in ('x', 'y', 'z')}, 'waypoints': route,
            'finish': {key: actor(page)[key] for key in ('x', 'y', 'z')}}


def hop(page, step, collider, arena):
    body, expected_y = actor(page), collider['y'] + collider['h']
    if abs(expected_y - body['y']) < .001:
        move(page, step['x'], step['z'], arena)
        return {'collider': collider['id'], 'expected_y': expected_y, 'level_walk': True}
    assert 0 < expected_y - body['y'] <= 1.12, (step, collider, body)
    dx, dz = step['x'] - body['x'], step['z'] - body['z']
    if abs(dz) >= abs(dx):
        near_z = collider['z'] + collider['d'] + .4 if dz < 0 else collider['z'] - .4
        move(page, step['x'], near_z, arena)
    else:
        near_x = collider['x'] + collider['w'] + .4 if dx < 0 else collider['x'] - .4
        move(page, near_x, step['z'], arena)
    body = actor(page)
    aim(page, math.atan2(step['x'] - body['x'], -(step['z'] - body['z'])))
    enter(page)
    key = 'z' if page.locator('select[data-keyboard-layout]').input_value() == 'zqsd' else 'w'
    session = page.context.new_cdp_session(page)
    try:
        native.cdp_key(page, key, 'KeyW', session=session)
        native.cdp_key(page, ' ', 'Space', session=session)
        wait(page, f'([height,id])=>{{const p=window.{debug(page)}.getState().state.players[id];return p.grounded&&Math.abs(p.y-height)<.001;}}', [expected_y, snapshot(page)['playerId']], timeout=4500)
    finally:
        native.cdp_key(page, ' ', 'Space', 'keyUp', session=session)
        native.cdp_key(page, key, 'KeyW', 'keyUp', session=session)
        session.detach()
    page.wait_for_timeout(100)
    landed = actor(page)
    assert landed['grounded'] and abs(landed['y'] - expected_y) < .001, (step, collider, landed)
    finite(page, arena)
    move(page, step['x'], step['z'], arena)
    return {'collider': collider['id'], 'expected_y': expected_y,
            'landed': {key: landed[key] for key in ('x', 'y', 'z', 'grounded')}}


def climb(page, arena, route):
    approach = route_to(page, arena, route['start']['x'], route['start']['z'])
    hops = [hop(page, step, next(box for box in arena['colliders'] if box['id'] == step['colliderId']), arena) for step in route['steps']]
    body = actor(page)
    assert body['grounded'] and body['y'] >= 2.4
    return {'route': route['id'], 'ground_approach': approach, 'native_fresh_space_hops': hops,
            'perch': {key: body[key] for key in ('x', 'y', 'z')}}


def map_geometry(page, mode):
    return page.evaluate('async url=>(await import(url)).MAPS.paris', MODES[mode]['maps'])


def setup(page, mode):
    config = MODES[mode]
    page.goto(URL)
    wait(page, 'document.querySelector("#host-status").textContent === "Host is online"')
    page.locator(f'[data-create-game="{config["game"]}"]').click()
    options = page.locator(config['select'] + ' option').evaluate_all('(nodes)=>nodes.map(node=>node.value)')
    assert options[-1] == 'paris' and len(set(options)) == len(options), options
    select(page, config['select'], 'paris')
    arena = map_geometry(page, mode)
    assert arena['id'] == 'paris' and arena['theme'] == 'paris' and 'Paris' in arena['name']
    assert page.locator(config['note']).inner_text().startswith(arena['description'])
    assert arena['name'] in page.locator(config['preview']).get_attribute('aria-label')
    assert page.locator(config['preview'] + ' polyline').count() == len(arena['routes'])
    assert 'NaN' not in page.locator(config['preview']).inner_html()
    assert page.locator(config['preview'] + ' circle').count() == (2 if mode == 'breach' else 0)
    for width in (1280, 390, 320):
        page.set_viewport_size({'width': width, 'height': 960 if width == 1280 else 1000})
        royale.no_overflow(page, mode + '-paris-setup/' + str(width))
        assert page.locator(config['dialog']).evaluate('(node)=>node.scrollWidth<=node.clientWidth'), (mode, width)
        screenshot(page, f'voxel-{mode}-paris-setup-{width}', target=config['dialog'])
    page.set_viewport_size({'width': 960, 'height': 800})
    if mode == 'breach':
        page.locator('#voxel-setup [name=teamSize][value="1"]').check()
    else:
        assert page.locator('#royale-capacity').input_value() == '10'
    page.locator(config['create']).click()
    page.wait_for_url('**/' + config['path'] + '?room=*')
    connected(page)
    assert snapshot(page)['state']['mapId'] == 'paris'
    return arena, {'native_map_selection': True, 'map_name': arena['name'], 'all_options': options,
                   'responsive_setup_widths': [1280, 390, 320], 'room': parse_qs(urlparse(page.url).query)['room'][0]}


def room(browser, mode):
    contexts, pages = [], []
    for index in range(2):
        context = browser.new_context(viewport={'width': 960 if index == 0 else 320, 'height': 800 if index == 0 else 500}, device_scale_factor=1 if index == 0 else .35)
        context.add_init_script('(' + INSTRUMENT + ')();')
        contexts.append(context)
        page = context.new_page()
        ACTIVE_MODE[id(page)] = mode
        observe(page, mode + '/' + str(index))
        pages.append(page)
    try:
        arena, detail = setup(pages[0], mode)
        pages[1].goto(pages[0].url)
        connected(pages[1])
        wait(pages[0], f'window.{debug(pages[0])}.getState().players.filter(person=>person?.connected).length===2')
        pages.sort(key=lambda page: snapshot(page)['playerId'])
        assert [snapshot(page)['playerId'] for page in pages] == [0, 1]
        select(pages[0], 'select[data-keyboard-layout]', 'zqsd')
        return contexts, pages, arena, detail
    except BaseException:
        for context in contexts:
            context.close()
        raise


def begin(pages, mode):
    name = debug(pages[0])
    assert all(snapshot(page)['state']['phase'] == 'lobby' for page in pages)
    before = actor(pages[0])
    pages[0].locator('#arena').focus()
    tap(pages[0], 'z', 'KeyW')
    assert native.horizontal_distance(before, actor(pages[0])) < .001
    if mode == 'breach':
        select(pages[0], '#loadout-select', 'carbine')
        pages[0].locator('#ready-button').click()
        pages[0].wait_for_timeout(100)
        assert snapshot(pages[0])['state']['phase'] == 'lobby'
        pages[1].locator('#ready-button').click()
    else:
        assert snapshot(pages[0])['state']['capacity'] == 10
        assert pages[1].locator('#start-button').is_disabled()
        pages[0].locator('#overlay-start').click()
    wait(pages[0], f'window.{name}.getState().state.phase==="countdown"')
    before_fight = snapshot(pages[0])['state']
    wait(pages[0], f'window.{name}.getState().state.phase==="fight"', timeout=20000)
    wait(pages[1], f'window.{debug(pages[1])}.getState().state.phase==="fight"')
    if mode == 'royale':
        assert before_fight['participantIds'] == [0, 1] and before_fight['aliveCount'] == 2
        for ident in (0, 1):
            body = before_fight['players'][ident]
            assert body['hp'] == body['maxHp'] == 200 and not body['hasGun'] and body['slot'] == 'sword'
            assert body['meleeWeapon'] == 'knife' and body['ammo'] == body['reserve'] == body['potions'] == body['grenades'] == 0
    enter(pages[0])
    return {'prestart_movement_blocked': True, 'all_ready_required': mode == 'breach',
            'host_starts_two_in_ten': mode == 'royale', 'phase': 'fight'}


def responsive(page, mode, arena):
    checks = []
    for width in (1280, 390, 320):
        page.set_viewport_size({'width': width, 'height': 960 if width == 1280 else 1000})
        page.wait_for_timeout(80)
        enter(page)
        royale.no_overflow(page, mode + '-paris/' + str(width))
        selector = '#health-readout,#weapon-readout,#tactical-map,' + ('#objective-hud' if mode == 'breach' else '#storm-hud')
        boxes = page.locator(selector).evaluate_all('''nodes=>nodes.map(node=>{
          const r=node.getBoundingClientRect(),v=document.querySelector('#viewport').getBoundingClientRect();
          return{id:node.id,x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width,height:r.height,
            visible:!!node.getClientRects().length,viewport:{x:v.x,right:v.right,y:v.y,bottom:v.bottom}};})''')
        assert all(box['visible'] and box['width'] > 0 and box['x'] >= box['viewport']['x'] - 1 and box['right'] <= box['viewport']['right'] + 1 and box['y'] >= box['viewport']['y'] - 1 and box['bottom'] <= box['viewport']['bottom'] + 1 for box in boxes), (width, boxes)
        cards = {box['id']: box for box in boxes}
        assert cards['health-readout']['right'] <= cards['weapon-readout']['x'], (width, boxes)
        assert int(page.locator('#health-meter').get_attribute('aria-valuenow')) == actor(page)['hp']
        finite(page, arena)
        screenshot(page, f'voxel-{mode}-paris-{width}')
        checks.append({'width': width, 'compact_hud_inside_viewport': boxes})
    page.set_viewport_size({'width': 960, 'height': 800})
    enter(page)
    return checks


def performance(page, arena):
    page.wait_for_timeout(1200)
    stats, seen = page.evaluate('window.__voxelQA'), finite(page, arena)
    renderer = seen.get('renderStats')
    assert stats['glContexts'] > 0 and stats['drawCalls'] and max(stats['drawCalls']) <= 10
    assert renderer and renderer['mapVertices'] <= 100000 and renderer['dynamicVertices'] <= 100000 and renderer['cachedMaps'] <= 3, renderer
    assert stats['glResources']['buffers']['live'] <= 10 and stats['glResources']['programs']['live'] <= 2
    if ACTIVE_MODE[id(page)] == 'royale':
        assert renderer['lootItems'] == len(seen['state']['loot']) <= 128
        assert 'map' not in stats['latestState']['state'], 'Snapshot repeated static map geometry'
    assert not any(event['type'] == 'close' for event in stats['socketLifecycle']), stats['socketLifecycle']
    packets = stats['statePackets'][-120:]
    network = {}
    if len(packets) > 1:
        span = (packets[-1]['time'] - packets[0]['time']) / 1000
        network = {'sample_seconds': span, 'snapshots_per_second': (len(packets) - 1) / span,
                   'ticks_per_second': (packets[-1]['tick'] - packets[0]['tick']) / span,
                   'bytes': native.distribution([packet['bytes'] for packet in packets])}
    return {'software_webgl_only': True, 'cpu_ms': native.distribution(stats['cpu']),
            'frame_ms': native.distribution(stats['gaps']), 'draw_calls': native.distribution(stats['drawCalls']),
            'renderer': renderer, 'resources': stats['glResources'], 'network': network,
            'socket_lifecycle': stats['socketLifecycle']}


def cover_shot(page, arena):
    body = actor(page)
    # Observe the shared pure ray trace to choose a real drawn solid. Aim and
    # trigger still use native input; no test-side damage or input is injected.
    choices = sorted((box for box in arena['colliders'] if box['y'] + box['h'] > body['y'] + .5),
                     key=lambda box: math.hypot(box['x'] + box['w'] / 2 - body['x'], box['z'] + box['d'] / 2 - body['z']))
    for collider in choices:
        target = {'x': collider['x'] + collider['w'] / 2, 'y': max(body['y'] + 1, collider['y'] + collider['h'] * .5), 'z': collider['z'] + collider['d'] / 2}
        distance = math.hypot(target['x'] - body['x'], target['z'] - body['z'])
        if distance < .5:
            continue
        aim(page, math.atan2(target['x'] - body['x'], -(target['z'] - body['z'])), math.atan2(target['y'] - body['y'] - 1.62, distance))
        traced = page.evaluate(f'''async()=>{{const s=window.{debug(page)}.getState(),{{traceShot}}=await import('/voxel-engine.js'),{{MAPS}}=await import('{MODES[ACTIVE_MODE[id(page)]]['maps']}');
          const p=s.state.players[s.playerId],{{yaw,pitch}}=s.input,c=Math.cos(pitch);
          return traceShot({{...s.state,map:MAPS.paris}},s.playerId,{{x:p.x,y:p.y+1.62,z:p.z}},{{x:Math.sin(yaw)*c,y:Math.sin(pitch),z:-Math.cos(yaw)*c}});}}''')
        if traced.get('kind') == 'wall':
            break
    else:
        raise AssertionError('No visible collision cover for native shot')
    before, event_id = actor(page), snapshot(page)['state']['eventId']
    page.mouse.down(button='right')
    try:
        wait(page, f'id=>window.{debug(page)}.getState().state.players[id].aimTicks>=18', snapshot(page)['playerId'])
        page.mouse.down(button='left')
        page.wait_for_timeout(40)
        page.mouse.up(button='left')
        wait(page, f'([id,event])=>window.{debug(page)}.getState().state.events.some(item=>item.id>event&&item.type==="shot"&&item.playerId===id)', [snapshot(page)['playerId'], event_id])
    finally:
        page.mouse.up(button='right')
        page.mouse.up(button='left')
    fired = next(event for event in reversed(snapshot(page)['state']['events']) if event['id'] > event_id and event['type'] == 'shot' and event['playerId'] == snapshot(page)['playerId'])
    assert fired['hitKind'] == 'wall' and actor(page)['ammo'] < before['ammo'], fired
    finite(page, arena)
    return {'native_right_mouse_ads': True, 'native_left_mouse_shot': fired, 'drawn_cover_blocks': True}


def pickup(page, arena, chosen):
    nearby = royale.nearby(page)
    assert nearby and nearby['id'] == chosen['id'], (chosen, nearby)
    wait(page, '!document.querySelector("#loot-prompt").hidden')
    label = page.locator('#loot-name').inner_text()
    before, event_id = actor(page), snapshot(page)['state']['eventId']
    screenshot(page, 'voxel-royale-paris-' + chosen['kind'] + '-' + ('roof' if chosen['y'] else 'house') + '-pickup')
    tap(page, 'e', 'KeyE')
    wait(page, '([id,event])=>window.SemagRoyale.getState().state.events.some(item=>item.id>event&&item.type==="lootPickup"&&item.playerId===id)', [snapshot(page)['playerId'], event_id])
    event = next(item for item in snapshot(page)['state']['events'] if item['id'] > event_id and item['type'] == 'lootPickup' and item['playerId'] == snapshot(page)['playerId'])
    assert event['lootId'] == chosen['id']
    assert not any(item['id'] == chosen['id'] for item in snapshot(page)['state']['loot'])
    after = actor(page)
    if chosen['kind'] == 'weapon':
        assert after['hasGun'] and after['weapon'] == chosen['weapon'] and after['slot'] == 'primary'
    elif chosen['kind'] == 'heal':
        assert after['potions'] == before['potions'] + chosen['amount']
    finite(page, arena)
    return {'loot': chosen, 'visible_prompt': label, 'fresh_native_e_pickup': event}


def paris_views(page, arena, mode):
    body = actor(page)
    landmark = {'x': (arena['bounds']['minX'] + arena['bounds']['maxX']) / 2 - 9,
                'z': arena['bounds']['minZ'] - 24, 'y': 15}
    neighbor = min((building for building in arena['buildings']
                    if not building['interior']['minX'] < body['x'] < building['interior']['maxX']),
                   key=lambda building: math.hypot((building['interior']['minX'] + building['interior']['maxX']) / 2 - body['x'],
                                                   (building['interior']['minZ'] + building['interior']['maxZ']) / 2 - body['z']))
    targets = [('facades', {'x': (neighbor['interior']['minX'] + neighbor['interior']['maxX']) / 2,
                           'z': (neighbor['interior']['minZ'] + neighbor['interior']['maxZ']) / 2, 'y': 2.5}),
               ('landmark', landmark)]
    images = []
    for name, target in targets:
        distance = math.hypot(target['x'] - body['x'], target['z'] - body['z'])
        aim(page, math.atan2(target['x'] - body['x'], -(target['z'] - body['z'])),
            math.atan2(target['y'] - body['y'] - 1.62, distance))
        path = screenshot(page, f'voxel-{mode}-paris-{name}')
        log('native-roof-view-saved', mode=mode, view=name, path=path)
        images.append({'view': name, 'path': path,
                       'actual_position': {key: body[key] for key in ('x', 'y', 'z')}, 'look_target': target})
    return images


def resume_peer(frozen):
    session = frozen.pop('session', None)
    if session:
        royale.thaw(session)


def run_breach(pages, arena, details, frozen):
    host, peer = pages
    body = actor(host)
    site = min(arena['sites'], key=lambda site: math.hypot(site['x'] - body['x'], site['z'] - body['z']))
    details['site_approach'] = route_to(host, arena, site['x'], site['z'])
    assert actor(host)['y'] == 0 and math.hypot(actor(host)['x'] - site['x'], actor(host)['z'] - site['z']) <= site['radius']
    assert 'SITE ' + site['id'] in host.locator('#objective-detail').inner_text()
    screenshot(host, 'voxel-breach-paris-real-site-approach')
    log('breach-native-ground-site-reached', site=site['id'])
    route = min(arena['routes'], key=lambda route: math.hypot(route['start']['x'] - actor(host)['x'], route['start']['z'] - actor(host)['z']))
    details['climb'] = climb(host, arena, route)
    resume_peer(frozen)
    wait(peer, f'height=>Math.abs(window.SemagVoxel.getState().state.players[0].y-height)<.001', actor(host)['y'])
    details['cover'] = cover_shot(host, arena)
    details['views'] = paris_views(host, arena, 'breach')
    details['responsive'] = responsive(host, 'breach', arena)
    details['performance'] = performance(host, arena)
    log('breach-native-climb-cover-layout-pass', route=route['id'])


def run_royale(pages, arena, details, frozen):
    host, peer = pages
    body = actor(host)
    buildings = [building for building in arena['buildings'] if building['interior']['minZ'] > arena['stormCenter']['z']]
    # Southern roofs stay near the natural safe circle. Loot kinds genuinely
    # shuffle; an optional nearby house gun/heal and any usable roof cache
    # avoid a test-only trip to a far corner after it has left the storm.
    choices = []
    for building in buildings:
        interior = building['interior']
        guns = [item for item in snapshot(host)['state']['loot'] if item['kind'] == 'weapon' and item['y'] == 0 and interior['minX'] < item['x'] < interior['maxX'] and interior['minZ'] < item['z'] < interior['maxZ']]
        heals = [item for item in snapshot(host)['state']['loot'] if item['kind'] == 'heal' and item['y'] == 0 and interior['minX'] < item['x'] < interior['maxX'] and interior['minZ'] < item['z'] < interior['maxZ']]
        roof = next(box for box in arena['colliders'] if box['id'] == building['roofId'])
        roof_caches = [item for item in snapshot(host)['state']['loot'] if item['kind'] in ('weapon', 'heal', 'grenade') and abs(item['y'] - roof['y'] - roof['h']) < .001 and roof['x'] < item['x'] < roof['x'] + roof['w'] and roof['z'] < item['z'] < roof['z'] + roof['d']]
        route = next((route for route in arena['routes'] if route['id'].endswith('-inner') and route['steps'][-1]['colliderId'] == roof['id']), None)
        if roof_caches and route:
            choices.append((math.hypot(route['start']['x'] - body['x'], route['start']['z'] - body['z']), building, guns, heals, roof_caches[0], route))
    assert choices, ('No safe southern roof supplies', buildings)
    _, building, guns, heals, roof_cache, route = min(choices, key=lambda choice: choice[0])
    if guns:
        gun = guns[0]
        details['house_walk'] = route_to(host, arena, gun['x'], gun['z'])
        details['house_gun'] = pickup(host, arena, gun)
    if heals:
        heal = heals[0]
        details['house_heal_walk'] = route_to(host, arena, heal['x'], heal['z'])
        details['house_heal'] = pickup(host, arena, heal)
    log('royale-native-southern-house-supplies-picked-up', house=building['id'], gun=bool(guns), heal=bool(heals))
    details['climb'] = climb(host, arena, route)
    move(host, roof_cache['x'], roof_cache['z'], arena)
    details['roof_cache'] = pickup(host, arena, roof_cache)
    resume_peer(frozen)
    wait(peer, '([weapon,height,hasGun])=>{const p=window.SemagRoyale.getState().state.players[0];return p.weapon===weapon&&Math.abs(p.y-height)<.001&&p.hasGun===hasGun}', [actor(host)['weapon'], actor(host)['y'], actor(host)['hasGun']])
    details['views'] = paris_views(host, arena, 'royale')
    details['responsive'] = responsive(host, 'royale', arena)
    details['performance'] = performance(host, arena)
    assert host.locator('#map-plan .map-player').count() == 0, 'Royale minimap disclosed enemies'
    log('royale-native-roof-pickup-layout-pass', house=building['id'], route=route['id'], cache=roof_cache['kind'])


def map_case(browser, mode):
    contexts, pages, arena, setup_detail = room(browser, mode)
    details = {'mode': mode, 'map': 'paris', 'setup': setup_detail}
    frozen = {}
    try:
        details['start'] = begin(pages, mode)
        log('native-paris-live', mode=mode, name=arena['name'])
        if mode == 'royale':
            details['rival_native_safe_center_walk'] = route_to(pages[1], arena, arena['stormCenter']['x'], arena['stormCenter']['z'])
            log('royale-native-rival-safe-center-reached', player=snapshot(pages[1])['playerId'])
        frozen['session'] = royale.freeze(pages[1])
        details['passive_peer_renderer_frozen_only_during_host_traversal'] = True
        if mode == 'breach':
            run_breach(pages, arena, details, frozen)
        else:
            run_royale(pages, arena, details, frozen)
        REPORT['cases'].append(details)
        log('native-paris-case-passed', mode=mode)
    except BaseException as error:
        failure = {'mode': mode, 'error': str(error), 'details': details, 'pages': []}
        for index, page in enumerate(pages):
            try:
                failure['pages'].append({'index': index, 'url': page.url, 'snapshot': snapshot(page),
                                        'transport': page.evaluate('window.__voxelQA')})
                screenshot(page, f'failure-paris-{mode}-{index}', target=None)
            except Exception as detail_error:
                failure['pages'].append({'index': index, 'observation_error': str(detail_error)})
        (OUT / ('failure-' + mode + '.json')).write_text(json.dumps(failure, indent=2))
        raise
    finally:
        resume_peer(frozen)
        for context in contexts:
            context.close()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    selected = set(filter(None, os.environ.get('SEMAG_PARIS_CASES', '').split(',')))
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                args=['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            try:
                for mode in MODES:
                    if not selected or mode in selected:
                        map_case(browser, mode)
            finally:
                browser.close()
    finally:
        (OUT / 'report.json').write_text(json.dumps(REPORT, indent=2))
    assert not REPORT['errors'], ('Browser errors', REPORT['errors'])
    assert not REPORT['failed_resources'], ('Failed resources', REPORT['failed_resources'])
    print(json.dumps({'status': 'passed', 'cases': len(REPORT['cases']), 'report': str(OUT / 'report.json')}, indent=2))


if __name__ == '__main__':
    main()
