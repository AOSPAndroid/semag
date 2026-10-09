"""Trusted native checks of authored voxel arena identity and traversal.

Run after production freeze against a freshly started host:
  python test/voxel-map-identity-browser-smoke.py http://127.0.0.1:3134
SEMAG_MAP_IDENTITY_CASES selects trading,sewers,snow,legacy.
Only actual browser keyboard and mouse events affect gameplay. Copied debug
snapshots and immutable map geometry guide navigation; game state, network,
clocks, animation frames and gameplay handlers are never replaced.
SwiftShader captures validate pixels and geometry, not hardware FPS.
"""
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import sys
import traceback

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', '/workspace/scratch/semag-map-identity-native'))
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3134').rstrip('/')
REPORT = {'cases': [], 'failures': [], 'screenshots': [], 'errors': [], 'failed_resources': [], 'working_bytes': [],
          'input_policy': 'Trusted keyboard and mouse; copied state and geometry only',
          'performance_scope': 'Software WebGL pixels; no hardware refresh-rate claim'}
LAUNCH = {'executable_path': '/usr/bin/chromium', 'headless': True,
          'args': ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle',
                   '--use-angle=swiftshader', '--enable-unsafe-swiftshader']}

spec = importlib.util.spec_from_file_location('identity_practice_helpers', ROOT / 'test/voxel-practice-browser-smoke.py')
practice = importlib.util.module_from_spec(spec)
spec.loader.exec_module(practice)
practice.URL = URL
practice.OUT = OUT


def log(stage, **details):
    print(json.dumps({'stage': stage, **details}), flush=True)


def save():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'report.json').write_text(json.dumps(REPORT, indent=2))


def freeze(stage):
    files = sorted(path for path in (ROOT / 'public').rglob('*') if path.is_file())
    files += [ROOT / 'server.js', ROOT / 'package.json', ROOT / 'package-lock.json', ROOT / 'README.md']
    hashes = {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in files}
    old = REPORT['working_bytes'][0]['sha256'] if REPORT['working_bytes'] else {}
    changed = [name for name, digest in hashes.items() if old and old.get(name) != digest]
    REPORT['working_bytes'].append({'stage': stage, 'sha256': hashes, 'changed_since_start': changed})
    save()
    assert not changed, ('Production changed during native checks', changed)


def screenshot(page, name):
    path = OUT / (name + '.png')
    bounds = page.locator('#practice-shell').bounding_box()
    assert bounds
    page.screenshot(path=str(path), clip=bounds, timeout=10000)
    REPORT['screenshots'].append(str(path)); save()
    return str(path)


def geometry(page, map_id):
    return page.evaluate('async id => structuredClone((await import("/voxel-maps.js")).MAPS[id])', map_id)


def finite(page):
    seen = practice.snapshot(page)
    assert not seen['graphicsError'] and seen['renderCount'] > 0
    for player in seen['state']['players']:
        assert all(math.isfinite(player[key]) for key in ('x', 'y', 'z', 'vx', 'vy', 'vz', 'yaw', 'pitch', 'hp'))
    stats = seen['renderStats']
    assert stats['mapVertices'] < 100000 and stats['dynamicVertices'] < 72000 and stats['cachedMaps'] <= 3, stats
    assert len(seen['state']['players'][0]['inventory']) == 4
    return seen


def begin(browser, map_id):
    context, page = practice.ready(browser)
    page.on('pageerror', lambda error: REPORT['errors'].append({'map': map_id, 'message': str(error)}))
    page.on('response', lambda response: REPORT['failed_resources'].append({'map': map_id, 'url': response.url, 'status': response.status}) if response.status >= 400 else None)
    practice.select(page, '#practice-map', map_id)
    practice.select(page, '#practice-mode', 'targets')
    practice.select(page, '#practice-count', '1')
    practice.select(page, '#practice-weapon', 'carbine')
    practice.CALIBRATION.pop(id(page), None)
    arena = geometry(page, map_id)
    practice.begin(page)
    page.locator('#practice-canvas').focus()
    practice.aim(page, 0, -.05)
    finite(page)
    return context, page, arena


def ground_navigator(arena, point):
    # The authored snow approach lies between a raised face and the perimeter.
    # A coarse 0.8 m grid can omit every valid row in that real standing lane.
    # Keep the conservative 0.43 m body margin, resolving exact endpoints on
    # a finer planning grid. Actual movement still uses browser keyboard input.
    navigator = practice.routes.Navigator(arena, clearance=.43, step=.25)
    # Some valid conservative approach bands are thinner than a grid cell.
    # Align the grid to the exact clear destination rather than pretending the
    # player is narrower or changing the authored game position.
    navigator.min_x += (point['x'] - navigator.min_x) % navigator.step
    navigator.min_z += (point['z'] - navigator.min_z) % navigator.step
    navigator.nx = int((navigator.max_x - navigator.min_x) / navigator.step)
    navigator.nz = int((navigator.max_z - navigator.min_z) / navigator.step)
    return navigator


def route_to(page, arena, point):
    navigator = ground_navigator(arena, point)
    practice.route_to(page, navigator, point['x'], point['z'])
    body = practice.actor(page)
    assert math.hypot(body['x'] - point['x'], body['z'] - point['z']) < .7
    assert body['grounded'] and abs(body['y']) < 1e-5 and not body['crouching'], body
    return {key: body[key] for key in ('x', 'y', 'z', 'grounded')}


def hop(page, step, collider):
    body = practice.actor(page)
    expected_y = collider['y'] + collider['h']
    assert 0 < expected_y - body['y'] <= 1.01
    face = {'x': max(collider['x'], min(body['x'], collider['x'] + collider['w'])),
            'z': max(collider['z'], min(body['z'], collider['z'] + collider['d']))}
    dx, dz = face['x'] - body['x'], face['z'] - body['z']
    distance = math.hypot(dx, dz)
    assert distance > .32
    practice.move(page, face['x'] - dx / distance * .4, face['z'] - dz / distance * .4)
    body = practice.actor(page)
    practice.aim(page, math.atan2(step['x'] - body['x'], -(step['z'] - body['z'])), 0)
    page.keyboard.down('w'); page.keyboard.down('Space')
    try:
        practice.wait(page, 'height => {const p=window.firesidePractice.getState().state.players[0]; return p.grounded && Math.abs(p.y-height)<.001}', expected_y, timeout=4500)
    finally:
        page.keyboard.up('Space'); page.keyboard.up('w')
    page.wait_for_timeout(100)
    landed = practice.actor(page)
    assert landed['grounded'] and abs(landed['y'] - expected_y) < .001, (step, landed)
    practice.move(page, step['x'], step['z'])
    return {'collider': collider['id'], 'expected_y': expected_y,
            'landed': {key: landed[key] for key in ('x', 'y', 'z', 'grounded')}}


def climb_route(page, arena, route):
    route_to(page, arena, route['start'])
    hops = [hop(page, step, next(box for box in arena['colliders'] if box['id'] == step['colliderId'])) for step in route['steps']]
    assert len(hops) >= 4
    body = practice.actor(page)
    practice.aim(page, math.atan2(-body['x'], body['z']), -.16)
    return {'id': route['id'], 'trusted_space_hops': hops, 'perch_y': body['y']}


def trading_case(browser):
    context, page, arena = begin(browser, 'trading')
    try:
        initial = screenshot(page, 'barclays-trading-floor-start')
        desks = [prop for prop in arena['landmarks'] if prop['kind'] == 'desk-pod']
        monitors = [prop for prop in arena['landmarks'] if prop['kind'] == 'monitor']
        assert len(desks) >= 8 and len(monitors) >= 8
        navigator = practice.routes.Navigator(arena)
        choice = None
        for prop in monitors:
            box = next(box for box in arena['colliders'] if box['id'] == prop['collisionIds'][0])
            for side in (-1, 1):
                target = {'x': box['x'] + box['w'] / 2, 'z': box['z'] + box['d'] / 2 + side * 2.8}
                if navigator.free(target['x'], target['z']):
                    choice = box, target
                    break
            if choice:
                break
        assert choice, 'No walkable viewpoint near a real trading monitor'
        box, target = choice
        route_to(page, arena, target)
        body = practice.actor(page)
        practice.aim(page, math.atan2(box['x'] + box['w'] / 2 - body['x'], -(box['z'] + box['d'] / 2 - body['z'])), 0)
        previous = practice.shot_state(page)['eventId']
        page.mouse.down(button='left'); page.wait_for_timeout(55); page.mouse.up(button='left')
        practice.wait(page, '([previous,collider]) => window.firesidePractice.getState().state.events.some(e => e.id>previous && e.type==="shot" && e.playerId===0 && e.hitKind==="wall" && e.colliderId===collider)', [previous, box['id']])
        event = next(event for event in practice.shot_state(page)['events'] if event['id'] > previous and event['type'] == 'shot' and event['colliderId'] == box['id'])
        cover = screenshot(page, 'barclays-desk-and-monitor-cover')
        route = next(route for route in arena['routes'] if route['side'] == 'south')
        climb = climb_route(page, arena, route)
        upper = screenshot(page, 'barclays-upper-trading-gallery')
        return {'desks': len(desks), 'monitors': len(monitors), 'actual_native_screen_impact': event,
                'gallery_climb': climb, 'renderer': finite(page)['renderStats'], 'screenshots': [initial, cover, upper]}
    finally:
        practice.close_context(context)


def sewers_case(browser):
    context, page, arena = begin(browser, 'sewers')
    try:
        images = [screenshot(page, 'sewers-drainage-start')]
        tunnels = arena['tunnels']
        assert len(tunnels) >= 6
        traversed = []
        for tunnel in tunnels[:2]:
            route_to(page, arena, tunnel['entry'])
            points = []
            for key in ('midpoint', 'exit'):
                practice.move(page, tunnel[key]['x'], tunnel[key]['z'])
                body = practice.actor(page)
                assert body['grounded'] and abs(body['y']) < .001 and not body['crouching']
                points.append({key: body[key] for key in ('x', 'y', 'z', 'grounded')})
            images.append(screenshot(page, 'sewers-standing-' + tunnel['id']))
            traversed.append({'id': tunnel['id'], 'standing_native_centerline': points})
        drain = next(tunnel for tunnel in tunnels if tunnel['id'] == 'sewers-west-drain')
        route_to(page, arena, drain['entry'])
        practice.aim(page, math.atan2(drain['exit']['x'] - drain['entry']['x'], -(drain['exit']['z'] - drain['entry']['z'])), -.12)
        images.append(screenshot(page, 'sewers-west-drain-pipes-water-arch'))
        practice.move(page, drain['midpoint']['x'], drain['midpoint']['z'])
        practice.move(page, drain['exit']['x'], drain['exit']['z'])
        drain_end = practice.actor(page)
        assert drain_end['grounded'] and abs(drain_end['y']) < .001 and not drain_end['crouching']
        traversed.append({'id': drain['id'], 'standing_native_centerline': [
            {key: drain_end[key] for key in ('x', 'y', 'z', 'grounded')}]})
        overhead = next(prop for prop in arena['landmarks'] if prop['kind'] == 'pipe' and 'underpass' in prop)
        route_to(page, arena, overhead['underpass']['entry'])
        practice.move(page, overhead['underpass']['midpoint']['x'], overhead['underpass']['midpoint']['z'])
        practice.aim(page, 0, .25)
        images.append(screenshot(page, 'sewers-pressure-feed-standing-underpass'))
        practice.move(page, overhead['underpass']['exit']['x'], overhead['underpass']['exit']['z'])
        underneath = practice.actor(page)
        assert underneath['grounded'] and abs(underneath['y']) < .001 and not underneath['crouching']
        route = next(route for route in arena['routes'] if route['side'] == 'south')
        climb = climb_route(page, arena, route)
        images.append(screenshot(page, 'sewers-inspection-gallery'))
        return {'branching_tunnels': len(tunnels), 'traversed': traversed, 'native_standing_pipe_underpass':
                {key: underneath[key] for key in ('x', 'y', 'z', 'grounded')}, 'gallery_climb': climb,
                'renderer': finite(page)['renderStats'], 'screenshots': images}
    finally:
        practice.close_context(context)


def snow_case(browser):
    context, page, arena = begin(browser, 'snow')
    try:
        initial = screenshot(page, 'frostline-research-start')
        assert not arena['ceilings']
        route = next(route for route in arena['routes'] if route['side'] == 'south')
        climb = climb_route(page, arena, route)
        upper = screenshot(page, 'frostline-research-radar-rooftops')
        return {'asymmetric_building_shapes': [[building['interior']['minX'], building['interior']['maxX'], building['interior']['minZ'], building['interior']['maxZ']] for building in arena['buildings']],
                'roof_climb': climb, 'renderer': finite(page)['renderStats'], 'screenshots': [initial, upper]}
    finally:
        practice.close_context(context)


def legacy_case(browser):
    entries = []
    for map_id in ('courtyard', 'depot', 'canal', 'rooftops', 'foundry', 'bastion', 'paris'):
        context, page, arena = begin(browser, map_id)
        try:
            body = practice.actor(page)
            practice.aim(page, math.atan2(-body['x'], body['z']), -.08)
            path = screenshot(page, 'legacy-' + map_id + '-identity')
            entries.append({'id': map_id, 'renderer': finite(page)['renderStats'], 'screenshot': path})
        finally:
            practice.close_context(context)
    return {'maps': entries}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    freeze('before')
    cases = {'trading': trading_case, 'sewers': sewers_case, 'snow': snow_case, 'legacy': legacy_case}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(**LAUNCH)
        try:
            for name in os.environ.get('SEMAG_MAP_IDENTITY_CASES', 'trading,sewers,snow,legacy').split(','):
                log('case-start', name=name)
                try:
                    result = cases[name](browser)
                    REPORT['cases'].append({'name': name, 'status': 'passed', **result})
                    log('case-passed', name=name)
                except Exception as error:
                    REPORT['failures'].append({'name': name, 'error': str(error), 'traceback': traceback.format_exc()})
                    log('case-failed', name=name, error=str(error)[:300])
                save()
        finally:
            browser.close()
    freeze('after')
    assert not REPORT['errors'], REPORT['errors']
    assert not REPORT['failed_resources'], REPORT['failed_resources']
    assert not REPORT['failures'], [(failure['name'], failure['error']) for failure in REPORT['failures']]
    log('native-map-identity-passed', cases=len(REPORT['cases']), report=str(OUT / 'report.json'))


if __name__ == '__main__':
    main()
