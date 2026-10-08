"""Trusted native browser checks for Voxel Royale.

python test/voxel-royale-browser-smoke.py http://127.0.0.1:3000
SEMAG_SCREENSHOT_DIR selects reports and screenshots. SEMAG_ROYALE_CASES
selects comma-separated forest,maze,desert. Geometry and live snapshots are
read only; movement, aiming, loot and lobby actions use genuine browser input.
Software WebGL timings are regression samples, not hardware benchmarks.
"""
import heapq
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
OUT = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', '/workspace/scratch/semag-royale-browser'))
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3000').rstrip('/')
MAP_IDS = ('forest', 'maze', 'desert')
CATALOG_MAP_IDS = (*MAP_IDS, 'paris')
spec = importlib.util.spec_from_file_location('voxel_native', ROOT / 'test' / 'voxel-browser-smoke.py')
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)
REPORT = {'cases': [], 'screenshots': [], 'errors': [], 'failed_resources': []}
INSTRUMENT = native.INSTRUMENT.replace('(?:client|view|renderer)', '(?:client|view|renderer|royale-client|royale-renderer)')
INSTRUMENT = INSTRUMENT.replace('glContexts:0,glResources:{}', 'glContexts:0,glResources:{},statePackets:[]')
INSTRUMENT = INSTRUMENT.replace("if(message.type==='state')stats.latestState=message;", """if(message.type==='state'){
  stats.latestState=message;stats.statePackets.push({time:performance.now(),tick:message.state.tick,bytes:new TextEncoder().encode(event.data).length});
  if(stats.statePackets.length>2400)stats.statePackets.shift();
}""")
CALIBRATION = {}
SETUP_CAPTURED = False


def log(stage, **details):
    print(json.dumps({'stage': stage, **details}), flush=True)


def wait(page, expression, arg=None, timeout=12000):
    return page.wait_for_function(expression, arg=arg, polling=25, timeout=timeout)


def snapshot(page):
    return page.evaluate('window.SemagRoyale.getState()')


def actor(page, ident=None):
    seen = snapshot(page)
    return seen['state']['players'][seen['playerId'] if ident is None else ident]


def connected(page):
    wait(page, 'window.SemagRoyale?.getState().connected && Number.isInteger(window.SemagRoyale.getState().playerId) && window.SemagRoyale.getState().state', timeout=20000)
    return snapshot(page)['playerId']


def observe(page, tag):
    page.on('pageerror', lambda error: REPORT['errors'].append(f'{tag}: {error}'))
    page.on('console', lambda message: REPORT['errors'].append(f'{tag}: {message.text}') if message.type == 'error' else None)
    page.on('response', lambda response: REPORT['failed_resources'].append(f'{tag}: {response.status} {response.url}') if response.status >= 400 else None)


def screenshot(page, name, viewport=True):
    path = OUT / (name + '.png')
    if viewport:
        page.locator('#royale-setup' if viewport == 'setup' else '#viewport').screenshot(path=str(path))
    else:
        page.screenshot(path=str(path), full_page=True)
    REPORT['screenshots'].append(str(path))
    return str(path)


def no_overflow(page, tag):
    sizes = page.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})')
    assert sizes['scroll'] <= sizes['width'], (tag, 'Horizontal overflow', sizes)


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


def enter(page):
    button = page.locator('#enter-arena')
    if button.is_visible():
        button.click()
    wait(page, '''()=>{const controls=window.SemagRoyale?.getState().controls;
      return controls&&!controls.paused&&(controls.pointerLocked||controls.fallback||controls.touch);}''')
    page.locator('#arena').focus()


def tap(page, key, code=None):
    if code:
        session = page.context.new_cdp_session(page)
        try:
            native.cdp_key(page, key, code, session=session)
            # Preserve a genuine press across several authoritative 120 Hz
            # ticks; a back-to-back down/up may coalesce to neutral input.
            page.wait_for_timeout(40)
            native.cdp_key(page, key, code, 'keyUp', session=session)
        finally:
            session.detach()
    else:
        page.keyboard.press(key, delay=30)


def look(page, dx, dy):
    box = page.locator('#arena').bounding_box()
    assert box
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    locked = snapshot(page)['controls']['pointerLocked']
    page.mouse.move(x, y)
    before = snapshot(page)['input']
    if not locked:
        page.mouse.down(button='right')
    page.mouse.move(x + dx, y + dy, steps=2)
    if not locked:
        page.mouse.up(button='right')
    return before, snapshot(page)['input']


def aim(page, yaw, pitch=0):
    enter(page)
    key = id(page)
    if key not in CALIBRATION:
        before, after = look(page, 40, 30)
        sx = native.angle_delta(after['yaw'], before['yaw']) / 40
        sy = (after['pitch'] - before['pitch']) / 30
        assert abs(sx) > .0001 and abs(sy) > .0001, ('Native mouse look did not respond', before, after)
        CALIBRATION[key] = (sx, sy)
    sx, sy = CALIBRATION[key]
    box = page.locator('#arena').bounding_box()
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    page.mouse.move(x, y)
    for _ in range(16):
        current = snapshot(page)['input']
        dyaw, dpitch = native.angle_delta(yaw, current['yaw']), pitch - current['pitch']
        if abs(dyaw) < .002 and abs(dpitch) < .002:
            break
        dx = max(-box['width'] * .35, min(box['width'] * .35, dyaw / sx))
        dy = max(-box['height'] * .35, min(box['height'] * .35, dpitch / sy))
        locked = snapshot(page)['controls']['pointerLocked']
        if not locked:
            x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
            page.mouse.move(x, y)
            page.mouse.down(button='right')
        page.mouse.move(x + dx, y + dy, steps=3)
        x, y = x + dx, y + dy
        if not locked:
            page.mouse.up(button='right')
    actual = snapshot(page)['input']
    assert abs(native.angle_delta(yaw, actual['yaw'])) < .009 and abs(pitch - actual['pitch']) < .009, ('Native aim missed', yaw, pitch, actual)
    page.wait_for_timeout(70)
    return {'yaw': actual['yaw'], 'pitch': actual['pitch']}


def move(page, x, z, timeout=20000):
    """Walk one collision-free world segment through trusted French input."""
    enter(page)
    key = 'z' if page.locator('select[data-keyboard-layout]').input_value() == 'zqsd' else 'w'
    deadline = time.monotonic() + timeout / 1000
    for _ in range(5):
        body = actor(page)
        dx, dz = x - body['x'], z - body['z']
        distance = math.hypot(dx, dz)
        if distance < .35:
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
            wait(page, '''([id,x,z,ux,uz])=>{const s=window.SemagRoyale.getState().state,p=s.players[id];
              return s.phase!=='fight'||!p.alive||(x-p.x)*ux+(z-p.z)*uz<.12;}''',
                 [snapshot(page)['playerId'], x, z, dx / distance, dz / distance],
                 timeout=max(1800, min(int((deadline - time.monotonic()) * 1000), int((distance / 2.2 + 4) * 1000))))
        finally:
            session.send('Input.dispatchKeyEvent', {'type': 'keyUp', **payload})
            session.detach()
            if walking:
                page.keyboard.up('Shift')
        page.wait_for_timeout(100)
        if time.monotonic() > deadline:
            break
    body = actor(page)
    assert math.hypot(x - body['x'], z - body['z']) < .45, ('Native waypoint missed', x, z, body)
    return body


class Navigator:
    """Read-only map geometry plans paths; every segment is physically walked."""
    def __init__(self, arena, clearance=.43, step=.8):
        self.arena, self.clearance, self.step = arena, clearance, step
        self.boxes = [box for box in arena['colliders'] if box['y'] < 1.8 and box['y'] + box['h'] > .01]
        bounds = arena['bounds']
        self.min_x, self.min_z = bounds['minX'] + clearance, bounds['minZ'] + clearance
        self.max_x, self.max_z = bounds['maxX'] - clearance, bounds['maxZ'] - clearance
        self.nx, self.nz = int((self.max_x - self.min_x) / step), int((self.max_z - self.min_z) / step)
        self.cache = {}

    def free(self, x, z):
        if not self.min_x <= x <= self.max_x or not self.min_z <= z <= self.max_z:
            return False
        for box in self.boxes:
            gap = math.hypot(x - max(box['x'], min(box['x'] + box['w'], x)), z - max(box['z'], min(box['z'] + box['d'], z)))
            if gap < self.clearance:
                return False
        return True

    def point(self, node):
        return self.min_x + node[0] * self.step, self.min_z + node[1] * self.step

    def valid(self, node):
        if node not in self.cache:
            self.cache[node] = 0 <= node[0] <= self.nx and 0 <= node[1] <= self.nz and self.free(*self.point(node))
        return self.cache[node]

    def segment(self, a, b):
        distance = math.dist(a, b)
        steps = max(1, math.ceil(distance / .15))
        return all(self.free(a[0] + (b[0] - a[0]) * i / steps, a[1] + (b[1] - a[1]) * i / steps) for i in range(steps + 1))

    def closest(self, point):
        base = (round((point[0] - self.min_x) / self.step), round((point[1] - self.min_z) / self.step))
        for radius in range(9):
            choices = [(base[0] + dx, base[1] + dz) for dx in range(-radius, radius + 1) for dz in range(-radius, radius + 1)]
            choices = [node for node in choices if self.valid(node) and self.segment(point, self.point(node))]
            if choices:
                return min(choices, key=lambda node: math.dist(point, self.point(node)))
        raise AssertionError(('No connected grid anchor', point))

    def route(self, start, target, radius=.5):
        # A grid anchor can be .566 m from a free point on an .8 m grid.
        # The final segment still walks the exact target after this search.
        radius = max(radius, self.step / math.sqrt(2) + .001)
        source = self.closest(start)
        queue, costs, parents = [(math.dist(self.point(source), target), 0, source)], {source: 0}, {}
        goal = None
        while queue:
            _, cost, node = heapq.heappop(queue)
            if cost != costs.get(node):
                continue
            if math.dist(self.point(node), target) <= radius and self.segment(self.point(node), target):
                goal = node
                break
            for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
                neighbor = (node[0] + dx, node[1] + dz)
                if not self.valid(neighbor) or not self.segment(self.point(node), self.point(neighbor)):
                    continue
                next_cost = cost + math.hypot(dx, dz) * self.step
                if next_cost < costs.get(neighbor, float('inf')):
                    costs[neighbor], parents[neighbor] = next_cost, node
                    heapq.heappush(queue, (next_cost + math.dist(self.point(neighbor), target), next_cost, neighbor))
        if goal is None:
            raise AssertionError(('No ground route', start, target))
        path = [self.point(goal)]
        while goal != source:
            goal = parents[goal]
            path.append(self.point(goal))
        path = [start, *reversed(path), target]
        compressed, index = [path[0]], 0
        while index < len(path) - 1:
            next_index = len(path) - 1
            while next_index > index + 1 and not self.segment(path[index], path[next_index]):
                next_index -= 1
            compressed.append(path[next_index])
            index = next_index
        return compressed[1:]


def geometry(page, map_id):
    return page.evaluate('async id=>(await import("/voxel-royale-maps.js")).MAPS[id]', map_id)


def route_to(page, arena, x, z):
    before = actor(page)
    route = Navigator(arena).route((before['x'], before['z']), (x, z))
    for target in route:
        move(page, *target)
    return {'start': {key: before[key] for key in ('x', 'y', 'z')}, 'waypoints': route,
            'finish': {key: actor(page)[key] for key in ('x', 'y', 'z')}}


def finite(page):
    seen = snapshot(page)
    assert not seen['graphicsError'] and seen['renderCount'] > 0 and seen['queueLength'] <= 240, seen
    for body in seen['state']['players']:
        for key in ('x', 'y', 'z', 'vx', 'vy', 'vz', 'yaw', 'pitch'):
            assert math.isfinite(body[key]), (key, body)
    for bolt in seen['state'].get('bolts', []):
        assert all(math.isfinite(bolt[key]) for key in ('x', 'y', 'z', 'vx', 'vy', 'vz')), bolt
    assert 0 <= seen['state']['aliveCount'] <= len(seen['state']['participantIds']) <= 10
    assert len(seen['state']['loot']) <= 128 and len(seen['state']['events']) <= 256
    return seen


def performance(page):
    page.wait_for_timeout(1200)
    stats, seen = page.evaluate('window.__voxelQA'), finite(page)
    renderer = seen.get('renderStats') or seen.get('renderer')
    assert renderer, 'Renderer diagnostics missing'
    assert stats['glContexts'] > 0 and stats['drawCalls'], 'WebGL rendering was not observed'
    assert max(stats['drawCalls']) <= 10, stats['drawCalls'][-30:]
    assert renderer['cachedMaps'] <= 3 and renderer['mapVertices'] <= 100000, renderer
    assert renderer['dynamicVertices'] <= 100000, renderer
    assert renderer['lootItems'] <= 128 and renderer['stormVertices'] <= 768, renderer
    assert stats['glResources']['buffers']['live'] <= 10 and stats['glResources']['programs']['live'] <= 2
    packets = stats['statePackets'][-120:]
    network = {}
    if len(packets) > 1:
        span = (packets[-1]['time'] - packets[0]['time']) / 1000
        network = {'sample_seconds': span, 'snapshots_per_second': (len(packets) - 1) / span,
                   'ticks_per_second': (packets[-1]['tick'] - packets[0]['tick']) / span,
                   'bytes': native.distribution([packet['bytes'] for packet in packets])}
    return {'software_webgl_only': True, 'cpu_ms': native.distribution(stats['cpu']),
            'frame_ms': native.distribution(stats['gaps']), 'draw_calls': native.distribution(stats['drawCalls']),
            'renderer': renderer, 'resources': stats['glResources'], 'network': network}


def create_room(page, map_id, capacity=10):
    global SETUP_CAPTURED
    page.goto(URL)
    wait(page, 'document.querySelector("#host-status").textContent === "Host is online"')
    page.locator('[data-create-game="voxel-royale"]').click()
    assert page.locator('#royale-map option').evaluate_all('(nodes)=>nodes.map(node=>node.value)') == list(CATALOG_MAP_IDS)
    if not SETUP_CAPTURED:
        previews = []
        for ident in CATALOG_MAP_IDS:
            select_native(page, '#royale-map', ident)
            arena = geometry(page, ident)
            assert page.locator('[data-royale-map-note]').inner_text() == arena['description']
            assert arena['name'] in page.locator('[data-royale-map-preview]').get_attribute('aria-label')
            assert page.locator('[data-royale-map-preview] polyline').count() == len(arena['routes'])
            assert not page.locator('[data-royale-map-preview] circle').count(), 'Preview disclosed randomized loot or player positions'
            assert 'NaN' not in page.locator('[data-royale-map-preview]').inner_html()
            previews.append({'id': ident, 'name': arena['name'], 'colliders': len(arena['colliders']), 'routes': len(arena['routes'])})
        for width in (1280, 390, 320):
            page.set_viewport_size({'width': width, 'height': 960 if width == 1280 else 1000})
            no_overflow(page, 'royale-setup/' + str(width))
            assert page.locator('#royale-setup').evaluate('(node)=>node.scrollWidth<=node.clientWidth'), ('Setup dialog clipped', width)
            screenshot(page, 'voxel-royale-setup-' + str(width), viewport='setup')
        page.set_viewport_size({'width': 960, 'height': 800})
        REPORT['cases'].append({'name': 'hub-map-setup', 'three_native_previews': previews, 'widths': [1280, 390, 320]})
        SETUP_CAPTURED = True
    select_native(page, '#royale-map', map_id)
    select_native(page, '#royale-capacity', str(capacity))
    page.locator('#royale-create').click()
    page.wait_for_url('**/voxel-royale.html?room=*')
    connected(page)
    return parse_qs(urlparse(page.url).query)['room'][0]


def room(browser, map_id, count, capacity=10):
    contexts = []
    for index in range(count):
        context = browser.new_context(viewport={'width': 960 if index == 0 else 320, 'height': 800 if index == 0 else 500},
                                      device_scale_factor=1 if index == 0 else .35)
        context.add_init_script('(' + INSTRUMENT + ')();')
        contexts.append(context)
    pages = [context.new_page() for context in contexts]
    for index, page in enumerate(pages):
        observe(page, f'{map_id}/{index}')
    try:
        code = create_room(pages[0], map_id, capacity)
        assert snapshot(pages[0])['state']['capacity'] == capacity
        assert pages[0].locator('#start-button').is_disabled(), 'A lone host could start'
        for index, page in enumerate(pages[1:], 1):
            page.goto(pages[0].url)
            connected(page)
            page.locator('#player-name').fill(f'Rival {index + 1}')
            page.keyboard.press('Tab')
        wait(pages[0], 'count=>window.SemagRoyale.getState().players.filter(player=>player?.connected).length===count', count)
        pages.sort(key=lambda page: snapshot(page)['playerId'])
        assert [snapshot(page)['playerId'] for page in pages] == list(range(count))
        pages[0].wait_for_timeout(200)
        assert all(snapshot(page)['state']['phase'] == 'lobby' for page in pages), 'Game auto-started before host action'
        assert not pages[0].locator('#start-button').is_disabled()
        assert pages[1].locator('#start-button').is_disabled(), 'A rival could start the host room'
        assert pages[0].locator('#player-roster .roster-slot').count() == capacity
        assert pages[0].locator('#seat-count').inner_text() == f'{count} / {capacity} PLAYERS'
        assert pages[0].locator('#alive-label').inner_text().strip() == f'/ {capacity} PLAYERS'
        select_native(pages[0], 'select[data-keyboard-layout]', 'zqsd')
        return contexts, pages, code
    except BaseException:
        for context in contexts:
            context.close()
        raise


def start(pages):
    before = snapshot(pages[0])['state']['matchId']
    pages[0].locator('#overlay-start').click()
    wait(pages[0], 'window.SemagRoyale.getState().state.phase==="countdown"')
    countdown = snapshot(pages[0])['state']
    assert countdown['participantIds'] == list(range(len(pages)))
    assert countdown['aliveCount'] == len(pages)
    spawns = []
    for ident in countdown['participantIds']:
        body = countdown['players'][ident]
        assert body['alive'] and body['hp'] == body['maxHp'] == 200 and not body['hasGun'] and body['slot'] == 'sword'
        assert body['meleeWeapon'] == 'knife', ('Royale must start with only the small knife', body)
        assert body['ammo'] == body['reserve'] == body['potions'] == body['grenades'] == 0
        spawns.append({'id': ident, 'x': body['x'], 'y': body['y'], 'z': body['z']})
    assert len({(body['x'], body['z']) for body in spawns}) == len(pages), 'Random starts overlapped'
    wait(pages[0], 'window.SemagRoyale.getState().state.phase==="fight"', timeout=15000)
    for page in pages:
        wait(page, 'window.SemagRoyale.getState().state.phase==="fight"')
    assert snapshot(pages[0])['state']['matchId'] == before + 1
    return {'capacity': countdown['capacity'], 'started_with': len(pages), 'host_only_explicit_start': True,
            'knife_empty_inventory': True, 'separate_random_spawn_points': spawns}


def freeze(page):
    session = page.context.new_cdp_session(page)
    session.send('Page.setWebLifecycleState', {'state': 'frozen'})
    return session


def thaw(session):
    session.send('Page.setWebLifecycleState', {'state': 'active'})
    session.detach()


def nearby(page):
    return page.evaluate('''async()=>{const {findNearbyLoot}=await import('/voxel-royale-engine.js');
      const seen=window.SemagRoyale.getState();return findNearbyLoot(seen.state,seen.playerId);}''')


def scavenge(page, arena, kind, weapons=None):
    seen, body = snapshot(page)['state'], actor(page)
    navigator = Navigator(arena)
    candidates = [loot for loot in seen['loot'] if loot['kind'] == kind and loot['y'] == 0
                  and (not weapons or loot.get('weapon') in weapons) and navigator.free(loot['x'], loot['z'])]
    assert candidates, ('No suitable ground supplies', kind, seen['loot'])
    candidates.sort(key=lambda loot: math.hypot(loot['x'] - body['x'], loot['z'] - body['z']))
    chosen, planned = None, None
    for candidate in candidates:
        try:
            planned = navigator.route((body['x'], body['z']), (candidate['x'], candidate['z']))
            chosen = candidate
            break
        except AssertionError:
            continue
    assert chosen, ('No reachable supply', kind, candidates)
    for point in planned:
        move(page, *point)
    assert nearby(page)['id'] == chosen['id'], ('Prompt did not select physically reached supply', chosen, nearby(page))
    wait(page, '!document.querySelector("#loot-prompt").hidden')
    label = page.locator('#loot-name').inner_text()
    assert label
    before, event_id = actor(page), snapshot(page)['state']['eventId']
    screenshot(page, 'voxel-royale-' + arena['id'] + '-' + kind + '-pickup')
    tap(page, 'e', 'KeyE')
    wait(page, '([id,event])=>window.SemagRoyale.getState().state.events.some(item=>item.id>event&&item.type==="lootPickup"&&item.playerId===id)', [snapshot(page)['playerId'], event_id])
    event = next(event for event in snapshot(page)['state']['events'] if event['id'] > event_id and event['type'] == 'lootPickup'
                 and event['playerId'] == snapshot(page)['playerId'])
    after = actor(page)
    assert event['lootId'] == chosen['id'] and not any(loot['id'] == chosen['id'] for loot in snapshot(page)['state']['loot']), (chosen, event)
    if kind == 'weapon':
        assert after['hasGun'] and after['weapon'] == chosen['weapon'] and after['slot'] == 'primary'
        assert after['ammo'] == chosen['ammo'] and after['reserve'] == chosen['reserve']
    elif kind == 'heal':
        assert after['potions'] == before['potions'] + chosen['amount']
    return {'loot': chosen, 'native_route': planned, 'visible_prompt': label, 'confirmed_event': event,
            'inventory': {key: after[key] for key in ('hasGun', 'weapon', 'slot', 'ammo', 'reserve', 'potions', 'grenades')}}


def responsive(page, map_id):
    checks = []
    for width in (1280, 390, 320):
        page.set_viewport_size({'width': width, 'height': 960 if width == 1280 else 1000})
        page.wait_for_timeout(60)
        enter(page)
        assert not page.locator('#game-overlay').is_visible(), ('Responsive photo still showed pause overlay', width)
        no_overflow(page, map_id + '/' + str(width))
        boxes = page.locator('#health-readout,#weapon-readout,#tactical-map,#storm-hud').evaluate_all('''nodes=>nodes.map(node=>{
          const r=node.getBoundingClientRect(),v=document.querySelector('#viewport').getBoundingClientRect();
          return{id:node.id,x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width,height:r.height,
            visible:!!node.getClientRects().length,viewport:{x:v.x,right:v.right,y:v.y,bottom:v.bottom}};})''')
        assert all(box['visible'] and box['width'] > 0 and box['x'] >= box['viewport']['x'] - 1
                   and box['right'] <= box['viewport']['right'] + 1 and box['y'] >= box['viewport']['y'] - 1
                   and box['bottom'] <= box['viewport']['bottom'] + 1 for box in boxes), (width, boxes)
        cards = {box['id']: box for box in boxes}
        assert cards['health-readout']['right'] <= cards['weapon-readout']['x'], ('Health and ammunition cards overlapped', width, boxes)
        assert page.locator('#map-plan .map-self').count() == 1
        assert page.locator('#map-plan .map-player').count() == 0, 'Minimap exposed rivals'
        meter = page.locator('#health-meter').get_attribute('aria-valuenow')
        assert int(meter) == actor(page)['hp']
        finite(page)
        screenshot(page, f'voxel-royale-{map_id}-{width}')
        checks.append({'width': width, 'hud_inside_viewport': boxes, 'rivals_hidden': True})
    page.set_viewport_size({'width': 960, 'height': 800})
    enter(page)
    return checks


def controls(page):
    enter(page)
    tap(page, 'v', 'KeyV')
    wait(page, 'id=>window.SemagRoyale.getState().state.players[id].slot==="sword"', snapshot(page)['playerId'])
    assert actor(page)['meleeWeapon'] == 'knife'
    wait(page, 'document.querySelector("#weapon-label").textContent==="KNIFE"')
    tap(page, 'v', 'KeyV')
    wait(page, 'id=>window.SemagRoyale.getState().state.players[id].slot==="primary"', snapshot(page)['playerId'])
    page.mouse.down(button='right')
    try:
        wait(page, 'id=>window.SemagRoyale.getState().state.players[id].aimTicks>=18', snapshot(page)['playerId'])
        assert actor(page)['aiming'], 'Right mouse did not aim the picked-up gun'
    finally:
        page.mouse.up(button='right')
    tap(page, ' ', 'Space')
    wait(page, 'id=>window.SemagRoyale.getState().state.players[id].y>.15', snapshot(page)['playerId'])
    apex = actor(page)['y']
    wait(page, 'id=>window.SemagRoyale.getState().state.players[id].grounded', snapshot(page)['playerId'])
    return {'native_knife_gun_toggle': True, 'right_mouse_ads': True, 'jump_y': apex}


def aim_at(page, target, height=1):
    body = actor(page)
    distance = math.hypot(target['x'] - body['x'], target['z'] - body['z'])
    eye = .98 if body['crouching'] else 1.62
    return aim(page, math.atan2(target['x'] - body['x'], -(target['z'] - body['z'])),
               math.atan2(target['y'] + height - body['y'] - eye, distance))


def shot(page):
    enter(page)
    before, event_id = actor(page), snapshot(page)['state']['eventId']
    page.mouse.down(button='left')
    page.wait_for_timeout(35)
    page.mouse.up(button='left')
    wait(page, '([id,event])=>window.SemagRoyale.getState().state.events.some(item=>item.id>event&&item.type==="shot"&&item.playerId===id)', [snapshot(page)['playerId'], event_id])
    assert actor(page)['ammo'] < before['ammo'], 'Real LMB did not consume finite ammunition'
    return next(event for event in reversed(snapshot(page)['state']['events']) if event['id'] > event_id
                and event['type'] == 'shot' and event['playerId'] == snapshot(page)['playerId'])


def combat(first, second, arena):
    # The forest safe center is a broad clear meadow. Both participants get
    # there using authored collision paths before native shots, never teleports.
    center = arena['stormCenter']
    routes = [route_to(second, arena, center['x'] + 1, center['z']), route_to(first, arena, center['x'] - 4, center['z'])]
    victim_id = snapshot(second)['playerId']
    before_hp = actor(second)['hp']
    aim_at(first, actor(second), .27)
    first.mouse.down(button='right')
    try:
        wait(first, 'id=>window.SemagRoyale.getState().state.players[id].aimTicks>=18', snapshot(first)['playerId'])
        fired = shot(first)
    finally:
        first.mouse.up(button='right')
    wait(second, '([id,hp])=>window.SemagRoyale.getState().state.players[id].hp<hp', [victim_id, before_hp])
    wait(first, '!document.querySelector("#combat-feedback").hidden', timeout=1500)
    confirmed = first.locator('#combat-feedback').inner_text()
    wait(first, 'id=>{const player=window.SemagRoyale.getState().state.players[id];return player.burstRemaining===0&&player.shotCooldown===0;}', snapshot(first)['playerId'], timeout=5000)
    damaged = actor(second)['hp']
    assert 0 < damaged < before_hp and actor(second)['alive'], ('First leg shot failed to preserve a healing target', fired, before_hp, damaged)
    assert fired['hitKind'] == 'leg', fired
    enter(second)
    heal_event_id = snapshot(second)['state']['eventId']
    tap(second, 'f', 'KeyF')
    wait(second, 'id=>window.SemagRoyale.getState().state.players[id].healTicks>0', victim_id)
    assert actor(second)['potions'] == 0
    wait(second, '([id,hp])=>window.SemagRoyale.getState().state.players[id].hp===hp', [victim_id, min(200, damaged + 60)], timeout=6000)
    healed = actor(second)['hp']
    heal_event = next(event for event in snapshot(second)['state']['events']
                      if event['id'] > heal_event_id and event['type'] == 'healComplete' and event['playerId'] == victim_id)
    assert heal_event['amount'] == min(60, 200 - damaged) and heal_event['hp'] == healed, heal_event
    screenshot(second, 'voxel-royale-native-damage-heal')
    kill_shots = []
    for _ in range(12):
        if not actor(second)['alive']:
            break
        wait(first, 'id=>window.SemagRoyale.getState().state.players[id].shotCooldown===0', snapshot(first)['playerId'], timeout=5000)
        aim_at(first, actor(second), 1.0)
        first.mouse.down(button='right')
        try:
            wait(first, 'id=>window.SemagRoyale.getState().state.players[id].aimTicks>=18', snapshot(first)['playerId'])
            kill_shots.append(shot(first))
        finally:
            first.mouse.up(button='right')
        first.wait_for_timeout(180)
    wait(first, 'window.SemagRoyale.getState().state.phase==="matchEnd"', timeout=5000)
    ended = snapshot(first)['state']
    assert ended['winnerId'] == snapshot(first)['playerId'] and ended['aliveCount'] == 1
    assert not actor(second)['alive'] and actor(second)['hp'] == 0
    assert sorted((placement['playerId'], placement['place']) for placement in ended['placements']) == [(0, 1), (1, 2)]
    screenshot(first, 'voxel-royale-last-survivor', viewport=False)
    first.locator('#rematch-button').click()
    wait(first, 'window.SemagRoyale.getState().state.phase==="lobby"')
    wait(second, 'window.SemagRoyale.getState().state.phase==="lobby"')
    replay = start([first, second])
    assert snapshot(first)['state']['matchId'] == ended['matchId'] + 1
    assert all(actor(page)['hp'] == actor(page)['maxHp'] == 200 and not actor(page)['hasGun']
               and actor(page)['meleeWeapon'] == 'knife' and actor(page)['slot'] == 'sword'
               and actor(page)['ammo'] == actor(page)['reserve'] == actor(page)['potions'] == actor(page)['grenades'] == 0
               for page in (first, second))
    return {'rendezvous_native_routes': routes, 'leg_shot': fired, 'confirmed_feedback': confirmed,
            'hp_before': before_hp, 'hp_damaged': damaged, 'hp_healed': healed, 'confirmed_native_heal': heal_event, 'body_kill_shots': kill_shots,
            'winner': ended['winnerId'], 'placements': ended['placements'], 'host_native_rematch': replay}


def rejection(browser, url, expected):
    context = browser.new_context(viewport={'width': 320, 'height': 500}, device_scale_factor=.25)
    context.add_init_script('(' + INSTRUMENT + ')();')
    page = context.new_page()
    observe(page, expected + '/rejection')
    try:
        page.goto(url)
        wait(page, '!document.querySelector("#error-banner").hidden')
        message = page.locator('#error-banner').inner_text()
        assert expected.lower() in message.lower(), (expected, message)
        wait(page, '!window.SemagRoyale.getState().connected')
        assert not snapshot(page)['connected'], 'Rejected late/full participant was connected'
        return {'real_native_page_rejected': True, 'message': message}
    finally:
        context.close()


def map_case(browser, map_id):
    count = 10 if map_id == 'desert' else 2
    capacity = 2 if map_id == 'maze' else 10
    contexts, pages, code = room(browser, map_id, count, capacity)
    frozen = []
    try:
        details = {'name': map_id, 'room_code': code, 'capacity_roster_and_labels_verified': capacity}
        if count == 10:
            details['capacity_rejection'] = rejection(browser, pages[0].url, '10 players')
        details['start'] = start(pages)
        log('host-start-confirmed', map=map_id, participants=count, capacity=capacity)
        details['late_join_rejection'] = rejection(browser, pages[0].url, 'started')
        if count == 10:
            for page in pages[2:]:
                frozen.append(freeze(page))
            details['eight_inactive_browser_peers_frozen_after_native_start'] = True
        arena = geometry(pages[0], map_id)
        details['gun'] = scavenge(pages[0], arena, 'weapon', weapons=('carbine', 'smg', 'pistol', 'marksman', 'burst'))
        log('native-gun-pickup', map=map_id, weapon=details['gun']['loot']['weapon'])
        details['controls'] = controls(pages[0])
        if map_id == 'forest':
            details['heal'] = scavenge(pages[1], arena, 'heal')
            log('native-heal-pickup', map=map_id)
            victim = actor(pages[1])
            wait(pages[0], '([id,potions])=>window.SemagRoyale.getState().state.players[id].potions===potions', [snapshot(pages[1])['playerId'], victim['potions']])
            details['inventory_synced'] = True
            center = arena['stormCenter']
            details['healer_safe_route'] = route_to(pages[1], arena, center['x'] + 1, center['z'])
            details['view_route'] = route_to(pages[0], arena, center['x'] - 4, center['z'])
            aim(pages[0], 0)
        elif map_id == 'maze':
            details['view_route'] = route_to(pages[0], arena, 0, 0)
            aim(pages[0], 0)
        else:
            details['view_route'] = route_to(pages[0], arena, 0, 9)
            aim(pages[0], 0)
        details['responsive'] = responsive(pages[0], map_id)
        details['performance'] = performance(pages[0])
        if map_id == 'forest':
            details['combat_heal_winner_rematch'] = combat(pages[0], pages[1], arena)
        REPORT['cases'].append(details)
        log('case-passed', name=map_id, participants=count)
    except BaseException as error:
        failure = {'case': map_id, 'error': str(error), 'pages': []}
        for index, page in enumerate(pages[:2]):
            try:
                failure['pages'].append({'index': index, 'url': page.url, 'snapshot': snapshot(page)})
                screenshot(page, f'failure-{map_id}-{index}', viewport=False)
            except Exception as detail_error:
                failure['pages'].append({'index': index, 'observation_error': str(detail_error)})
        (OUT / ('failure-' + map_id + '.json')).write_text(json.dumps(failure, indent=2))
        raise
    finally:
        for session in frozen:
            thaw(session)
        for context in contexts:
            context.close()


def run(browser):
    selected = set(filter(None, os.environ.get('SEMAG_ROYALE_CASES', '').split(',')))
    for map_id in MAP_IDS:
        if not selected or map_id in selected:
            log('case-start', name=map_id)
            map_case(browser, map_id)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                args=['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            try:
                run(browser)
            finally:
                browser.close()
    finally:
        (OUT / 'report.json').write_text(json.dumps(REPORT, indent=2))
    assert not REPORT['errors'], ('Browser errors', REPORT['errors'])
    assert not REPORT['failed_resources'], ('Failed resources', REPORT['failed_resources'])
    print(json.dumps({'status': 'passed', 'cases': len(REPORT['cases']), 'report': str(OUT / 'report.json')}, indent=2))


if __name__ == '__main__':
    main()
