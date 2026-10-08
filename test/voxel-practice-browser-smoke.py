"""Native solo FPS practice QA.

python test/voxel-practice-browser-smoke.py http://127.0.0.1:3000
Only real Start/select/keyboard/mouse/trusted touch events affect live games.
State and map geometry are read only; no engine, time, RAF or input injection.
Software WebGL is a regression check, not a hardware refresh-rate benchmark.
SEMAG_PRACTICE_CASES selects mouse,input,breach,combat,royale,responsive,touch.
"""
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3000').rstrip('/')
OUT = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', '/workspace/scratch/semag-voxel-practice-browser'))
REPORT = {'cases': [], 'screenshots': [], 'errors': [], 'failed_resources': [], 'websockets': []}
SOURCES = ['voxel-practice.html', 'voxel-practice.css', 'voxel-practice-client.js', 'voxel-practice-engine.js', 'voxel-practice-input.js', 'voxel-client.js', 'voxel-engine.js', 'voxel-royale-engine.js', 'voxel-renderer.js', 'voxel-presentation.js', 'voxel-damage-feedback.js', 'voxel-maps.js', 'voxel-royale-maps.js', 'voxel-weapons.js', 'voxel-melee.js', 'voxel-ordnance.js', 'voxel-projectiles.js', 'display-timing.js', 'keyboard-layout.js', 'keyboard-layout.css', 'audio.js', 'hub/dom.js']
spec = importlib.util.spec_from_file_location('royale_routes', ROOT / 'test/voxel-royale-browser-smoke.py')
routes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(routes)
CALIBRATION = {}


def hashes():
    return {name: hashlib.sha256((ROOT / 'public' / name).read_bytes()).hexdigest() for name in SOURCES}


def case(name, **details):
    REPORT['cases'].append({'name': name, **details})
    print(json.dumps({'case': name, **details}), flush=True)


def wait(page, expression, arg=None, **kwargs):
    kwargs.setdefault('polling', 25)
    kwargs.setdefault('timeout', 15000)
    return page.wait_for_function(expression, arg=arg, **kwargs)


def snapshot(page):
    return page.evaluate('window.firesidePractice.getState()')


def actor(page):
    return snapshot(page)['state']['players'][0]


def shot_state(page):
    return snapshot(page)['state']


def screenshot(page, name):
    path = OUT / (name + '.png')
    page.screenshot(path=str(path), full_page=True)
    REPORT['screenshots'].append(str(path))
    return str(path)


def observe(page, label):
    page.on('pageerror', lambda error: REPORT['errors'].append({'page': label, 'message': str(error)}))
    page.on('response', lambda response: REPORT['failed_resources'].append({'page': label, 'url': response.url, 'status': response.status}) if response.status >= 400 else None)
    page.on('websocket', lambda socket: REPORT['websockets'].append({'page': label, 'url': socket.url}))


def no_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Horizontal overflow'
    return page.locator('#practice-canvas').bounding_box()


def select(page, selector, value):
    index = page.locator(selector).evaluate('(element,value)=>[...element.options].findIndex(option=>option.value===value)', value)
    assert index >= 0, ('Unknown native select option', selector, value)
    page.locator(selector).click()
    page.keyboard.press('Home')
    for _ in range(index):
        page.keyboard.press('ArrowDown')
    page.keyboard.press('Enter')
    assert page.locator(selector).input_value() == value
    page.wait_for_timeout(80)


def ready(browser, game='voxel', **kwargs):
    context = browser.new_context(viewport={'width': 1365, 'height': 768}, **kwargs)
    page = context.new_page()
    observe(page, game)
    page.goto(URL + '/voxel-practice.html?game=' + game)
    wait(page, 'window.firesidePractice?.getState().state.phase === "ready" && !document.querySelector("#practice-start").disabled')
    initial = snapshot(page)
    page.wait_for_timeout(300)
    assert snapshot(page)['state']['tick'] == initial['state']['tick'] == 0, 'Practice auto-started'
    assert initial['graphicsError'] == '' and initial['renderStats']['mapVertices'] > 0, initial
    return context, page


def begin(page, touch=False):
    if touch:
        page.locator('#practice-start').tap()
    else:
        page.locator('#practice-start').click()
    wait(page, 'window.firesidePractice.getState().state.phase === "countdown"')
    wait(page, 'window.firesidePractice.getState().state.phase === "fight"')
    assert actor(page)['hp'] == 200
    return snapshot(page)


def close_context(context):
    if sys.exc_info()[0] is not None:
        for index, page in enumerate(context.pages):
            try:
                name = 'failure-' + str(len(REPORT['screenshots'])) + '-' + str(index)
                screenshot(page, name)
                (OUT / (name + '.json')).write_text(json.dumps(snapshot(page), indent=2))
            except Exception:
                pass
    context.close()


def angle_delta(a, b):
    return math.atan2(math.sin(a - b), math.cos(a - b))


def tap(page, key):
    # Native press/release can both precede a frame; the controller must retain it.
    page.keyboard.press(key)


def look(page, dx, dy):
    box = page.locator('#practice-canvas').bounding_box()
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    page.mouse.move(x, y)
    locked = snapshot(page)['controls']['pointerLocked']
    if not locked:
        page.mouse.down(button='right')
    before = snapshot(page)['input']
    page.mouse.move(x + dx, y + dy, steps=2)
    after = snapshot(page)['input']
    if not locked:
        page.mouse.up(button='right')
    return before, after


def aim(page, yaw, pitch=0):
    if id(page) not in CALIBRATION:
        before, after = look(page, 40, 30)
        sx, sy = angle_delta(after['yaw'], before['yaw']) / 40, (after['pitch'] - before['pitch']) / 30
        assert abs(sx) > .0001 and abs(sy) > .0001, (before, after)
        CALIBRATION[id(page)] = sx, sy
    sx, sy = CALIBRATION[id(page)]
    box = page.locator('#practice-canvas').bounding_box()
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    page.mouse.move(x, y)
    for _ in range(18):
        current = snapshot(page)['input']
        dyaw, dpitch = angle_delta(yaw, current['yaw']), pitch - current['pitch']
        if abs(dyaw) < .003 and abs(dpitch) < .003:
            break
        dx, dy = max(-box['width'] * .33, min(box['width'] * .33, dyaw / sx)), max(-box['height'] * .33, min(box['height'] * .33, dpitch / sy))
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
    assert abs(angle_delta(yaw, actual['yaw'])) < .011 and abs(pitch - actual['pitch']) < .011, ('Native aim missed', yaw, pitch, actual)
    page.wait_for_timeout(35)


def move(page, x, z):
    for _ in range(5):
        body = actor(page)
        dx, dz = x - body['x'], z - body['z']
        distance = math.hypot(dx, dz)
        if distance < .4:
            return body
        assert body['alive'] and shot_state(page)['phase'] == 'fight', ('Route interrupted', body)
        aim(page, math.atan2(dx, -dz))
        key = 'z' if page.locator('#practice-keyboard-select').input_value() == 'zqsd' else 'w'
        if distance < 1.8:
            page.keyboard.down('Shift')
        page.keyboard.down(key)
        try:
            wait(page, '''([x,z,ux,uz]) => { const q=window.firesidePractice.getState(),p=q.state.players[0];
                return q.state.phase!=='fight'||!p.alive||(x-p.x)*ux+(z-p.z)*uz<.15; }''', [x, z, dx / distance, dz / distance], timeout=int(distance / 2 + 5) * 1000)
        finally:
            page.keyboard.up(key)
            page.keyboard.up('Shift')
        page.wait_for_timeout(75)
    body = actor(page)
    assert math.hypot(x - body['x'], z - body['z']) < .7, ('Missed waypoint', x, z, body)
    return body


def geometry(page, game):
    filename = 'voxel-royale-maps' if game == 'voxel-royale' else 'voxel-maps'
    return page.evaluate('''async ([filename,mapId]) => {
        const module=await import('/'+filename+'.js');const map=module.MAPS[mapId];
        return JSON.parse(JSON.stringify({bounds:map.bounds,colliders:map.colliders}));
    }''', [filename, shot_state(page)['mapId']])


def route_to(page, navigator, x, z, stop_distance=0):
    body = actor(page)
    path = navigator.route((body['x'], body['z']), (x, z))
    for target in path:
        if math.hypot(x - actor(page)['x'], z - actor(page)['z']) <= stop_distance:
            break
        move(page, *target)


def clear_sight(navigator, source, target):
    # Read-only slab test plans a legal viewing angle through authored cover.
    start = (source['x'], source.get('y', 0) + 1.62, source['z'])
    end = (target['x'], target.get('y', 0) + 1.2, target['z'])
    for box in navigator.arena['colliders']:
        near, far = 0, 1
        for axis, extent, origin, finish in zip(('x', 'y', 'z'), ('w', 'h', 'd'), start, end):
            delta = finish - origin
            if abs(delta) < 1e-9:
                if not box[axis] <= origin <= box[axis] + box[extent]:
                    near = 2
                    break
            else:
                first, second = (box[axis] - origin) / delta, (box[axis] + box[extent] - origin) / delta
                near, far = max(near, min(first, second)), min(far, max(first, second))
        if near <= far and far > 1e-6 and near < 1 - 1e-6:
            return False
    return True


def approach_target(page, navigator, target_id=1):
    local, target = actor(page), shot_state(page)['players'][target_id]
    choices = []
    for ix in range(navigator.nx + 1):
        for iz in range(navigator.nz + 1):
            node = (ix, iz)
            x, z = navigator.point(node)
            distance = math.hypot(x - target['x'], z - target['z'])
            if 3 <= distance <= 7 and navigator.valid(node) and clear_sight(navigator, {'x': x, 'z': z}, target):
                choices.append((math.hypot(x - local['x'], z - local['z']), x, z))
    for _, x, z in sorted(choices):
        try:
            planned = navigator.route((local['x'], local['z']), (x, z))
        except AssertionError:
            continue
        for point in planned:
            move(page, *point)
        return
    raise AssertionError(('No legal firing approach', local, target))


def input_case(browser):
    context, page = ready(browser, has_touch=True)
    try:
        assert page.evaluate('navigator.maxTouchPoints > 0'), 'Hybrid fixture lacks secondary touch hardware'
        select(page, '#practice-count', '1'); select(page, '#practice-weapon', 'pistol')
        page.locator('#practice-start').click()
        wait(page, 'window.firesidePractice.getState().state.phase==="countdown"')
        page.keyboard.down('Space'); page.keyboard.down('c')
        wait(page, 'window.firesidePractice.getState().state.phase==="fight"')
        tick = shot_state(page)['tick']; wait(page, 'tick=>window.firesidePractice.getState().state.tick>tick+12', tick)
        blocked = snapshot(page)
        assert blocked['state']['players'][0]['shots'] == 0 and blocked['state']['players'][0]['y'] == 0
        assert blocked['presentationPlayer']['y'] == 0, 'Held countdown jump appeared only in the render camera'
        assert blocked['controls']['pointerLocked'] and not blocked['controls']['touch'], blocked['controls']
        page.keyboard.up('Space'); page.keyboard.up('c')
        tap(page, 'Space'); wait(page, 'window.firesidePractice.getState().state.players[0].y>.1')
        wait(page, 'window.firesidePractice.getState().state.players[0].grounded')
        tap(page, 'c'); wait(page, 'window.firesidePractice.getState().state.players[0].shots===1')
        tap(page, 'v'); tap(page, 'v')
        wait(page, 'window.firesidePractice.getState().state.events.filter(e=>e.type==="swap"&&e.playerId===0).length===2')
        assert actor(page)['slot'] == 'primary'
        before, after = look(page, 40, 20); assert abs(angle_delta(after['yaw'], before['yaw'])) > .03
        wait(page, 'window.firesidePractice.getState().state.players[0].shotCooldown===0')
        page.mouse.down(); page.mouse.up(); wait(page, 'window.firesidePractice.getState().state.players[0].shots===2')
        page.mouse.down(button='right'); wait(page, 'window.firesidePractice.getState().state.players[0].aimTicks===18')
        page.mouse.up(button='right'); wait(page, 'window.firesidePractice.getState().state.players[0].aimTicks===0')
        wait(page, 'window.firesidePractice.getState().state.players[0].shotCooldown===0')
        screenshot(page, 'practice-hybrid-fast-input')
        page.keyboard.press('Escape'); wait(page, 'window.firesidePractice.getState().state.phase==="paused"')
        assert not any(snapshot(page)['queuedActions'].values())
        page.locator('#practice-resume').click(); tap(page, 'c')
        wait(page, 'window.firesidePractice.getState().state.players[0].shots===3')
        case('hybrid-mouse-native-fast-taps-countdown-render-fence-semi-fire-swap-resume', shots=actor(page)['shots'], swaps=2, secondary_touch=True)
    finally:
        close_context(context)


def mouse_case(browser):
    context, page = ready(browser)
    try:
        select(page, '#practice-count', '1'); begin(page)
        box = page.locator('#practice-canvas').bounding_box()
        page.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
        page.mouse.down(button='right'); wait(page, 'window.firesidePractice.getState().state.players[0].aimTicks===18')
        before = actor(page)['shots']; page.mouse.down(button='left')
        wait(page, 'shots=>window.firesidePractice.getState().state.players[0].shots>shots', before)
        assert snapshot(page)['input']['fire'] and snapshot(page)['input']['aim']
        screenshot(page, 'practice-native-ads-and-fire-chord')
        page.mouse.up(button='left')
        wait(page, '!window.firesidePractice.getState().state.players[0].previousInput.fire')
        released = snapshot(page); assert not released['input']['fire'] and released['input']['aim']
        tick = released['state']['tick']; wait(page, 'tick=>window.firesidePractice.getState().state.tick>tick+20', tick)
        assert actor(page)['shots'] == released['state']['players'][0]['shots'] and actor(page)['aimTicks'] == 18
        page.mouse.up(button='right'); wait(page, 'window.firesidePractice.getState().state.players[0].aimTicks===0')
        before = actor(page)['shots']; page.mouse.down(button='left')
        wait(page, 'shots=>window.firesidePractice.getState().state.players[0].shots>shots', before)
        page.mouse.down(button='right'); wait(page, 'window.firesidePractice.getState().state.players[0].aimTicks===18')
        assert snapshot(page)['input']['fire'] and snapshot(page)['input']['aim']
        before = actor(page)['shots']; page.mouse.up(button='right')
        wait(page, 'window.firesidePractice.getState().input.fire&&!window.firesidePractice.getState().input.aim')
        wait(page, 'shots=>window.firesidePractice.getState().state.players[0].shots>=shots+2', before)
        assert actor(page)['aimTicks'] == 0
        page.mouse.up(button='left'); wait(page, '!window.firesidePractice.getState().state.players[0].previousInput.fire')
        stopped = snapshot(page); tick = stopped['state']['tick']
        wait(page, 'tick=>window.firesidePractice.getState().state.tick>tick+20', tick)
        assert actor(page)['shots'] == stopped['state']['players'][0]['shots']
        page.mouse.down(button='left'); page.mouse.down(button='right')
        wait(page, 'window.firesidePractice.getState().input.fire&&window.firesidePractice.getState().input.aim')
        page.keyboard.press('Escape'); wait(page, 'window.firesidePractice.getState().state.phase==="paused"')
        paused = snapshot(page); assert not paused['input']['fire'] and not paused['input']['aim'] and not any(paused['queuedActions'].values())
        page.mouse.up(button='left'); page.mouse.up(button='right')
        page.locator('#practice-resume').click(); wait(page, 'window.firesidePractice.getState().state.phase==="fight"')
        tick = shot_state(page)['tick']; wait(page, 'tick=>window.firesidePractice.getState().state.tick>tick+20', tick)
        assert actor(page)['shots'] == paused['state']['players'][0]['shots']
        assert not snapshot(page)['input']['fire'] and not snapshot(page)['input']['aim']
        case('mouse-native-ads-fire-both-orders-independent-releases-pause-resume', shots=actor(page)['shots'], releases={'fire_preserves_ads': True, 'ads_preserves_fire': True, 'pause_clears_both': True})
    finally:
        close_context(context)


def breach_case(browser):
    context, page = ready(browser)
    try:
        select(page, '#practice-count', '1')
        select(page, '#practice-keyboard-select', 'zqsd')
        assert shot_state(page)['practice']['config']['bots'] == 1
        screenshot(page, 'breach-practice-ready')
        begin(page)
        before = actor(page)
        page.keyboard.down('z')
        wait(page, 'before=>{const p=window.firesidePractice.getState().state.players[0];return Math.hypot(p.x-before.x,p.z-before.z)>.6}', before)
        page.keyboard.up('z')
        after = actor(page)
        assert after['z'] < before['z'], (before, after)
        page.keyboard.down('Control'); wait(page, 'window.firesidePractice.getState().state.players[0].crouching'); page.keyboard.up('Control')
        wait(page, '!window.firesidePractice.getState().state.players[0].crouching')
        tap(page, 'Space'); wait(page, 'window.firesidePractice.getState().state.players[0].y>.1'); wait(page, 'window.firesidePractice.getState().state.players[0].grounded')
        before, after = look(page, 48, 18)
        assert abs(angle_delta(after['yaw'], before['yaw'])) > .03
        page.mouse.down(button='right'); wait(page, 'window.firesidePractice.getState().state.players[0].aimTicks===18')
        page.mouse.up(button='right'); wait(page, 'window.firesidePractice.getState().state.players[0].aimTicks===0')
        tap(page, 'v'); wait(page, 'window.firesidePractice.getState().state.players[0].slot==="sword"'); tap(page, 'v'); wait(page, 'window.firesidePractice.getState().state.players[0].slot==="primary"')
        ammo = actor(page)['ammo']; tap(page, 'c'); wait(page, 'ammo=>window.firesidePractice.getState().state.players[0].ammo<ammo', ammo)
        tap(page, 'r'); wait(page, 'window.firesidePractice.getState().state.players[0].reloadTicks>0'); wait(page, 'window.firesidePractice.getState().state.players[0].reloadTicks===0')
        assert actor(page)['ammo'] == 24
        page.keyboard.press('Escape'); wait(page, 'window.firesidePractice.getState().state.phase==="paused"'); paused = shot_state(page)
        page.wait_for_timeout(250); assert shot_state(page) == paused, 'Paused game advanced'
        assert not any(value for key, value in snapshot(page)['input'].items() if key not in ('yaw', 'pitch'))
        page.locator('#practice-help').click(); assert page.locator('#practice-guide').is_visible(); page.keyboard.press('Escape'); assert page.locator('#practice-guide').is_hidden(); assert shot_state(page)['phase'] == 'paused'
        page.locator('#practice-fullscreen').click(); wait(page, 'document.fullscreenElement?.id==="practice-shell"'); assert page.locator('#practice-fullscreen').is_visible()
        page.locator('#practice-fullscreen').click(); wait(page, '!document.fullscreenElement')
        page.locator('#practice-resume').click(); wait(page, 'window.firesidePractice.getState().state.phase==="fight"')
        case('breach-native-start-layout-input-ads-jump-crouch-blade-reload-pause-help-fullscreen', movement=[before, after], display=snapshot(page)['displayTiming'])
        # Genuine wall contact and a downward frag exercise self damage and healing.
        navigator = routes.Navigator(geometry(page, 'voxel'))
        route_to(page, navigator, -22.4, 18)
        aim(page, -math.pi / 2, 0)
        page.keyboard.down('z'); page.wait_for_timeout(700); page.keyboard.up('z')
        body = actor(page); bounds = navigator.arena['bounds']; assert body['x'] >= bounds['minX'] + .319
        aim(page, -math.pi / 2, -1.3)
        tap(page, 'a')  # French printed A maps to the shared Q grenade action.
        wait(page, 'window.firesidePractice.getState().state.players[0].grenades===0')
        wait(page, 'window.firesidePractice.getState().state.players[0].hp<200', timeout=12000)
        injured = actor(page)['hp']; assert injured > 0
        tap(page, 'f'); wait(page, 'window.firesidePractice.getState().state.players[0].healTicks>0')
        wait(page, 'hp=>window.firesidePractice.getState().state.players[0].hp>hp', injured)
        assert actor(page)['potions'] == 0
        case('breach-native-wall-frag-self-damage-healing', hp_before=injured, hp_after=actor(page)['hp'], position=body)
        # Leave the legal tight contact before routing on the navigator's
        # deliberately wider ground clearance.
        page.keyboard.down('s'); page.wait_for_timeout(220); page.keyboard.up('s')
        page.wait_for_timeout(80)
        # Aim from legal, physically walked cover routes at an actual moving bot.
        approach_target(page, navigator)
        deadline = time.monotonic() + 60
        while shot_state(page)['phase'] == 'fight' and time.monotonic() < deadline:
            local, target = actor(page), shot_state(page)['players'][1]
            distance = math.hypot(target['x'] - local['x'], target['z'] - local['z'])
            if distance > 24 or not clear_sight(navigator, local, target):
                approach_target(page, navigator)
                continue
            yaw = math.atan2(target['x'] - local['x'], -(target['z'] - local['z']))
            pitch = math.atan2(target['y'] + 1.2 - (local['y'] + 1.62), distance) - local['recoil']
            aim(page, yaw, pitch)
            page.keyboard.press('c', delay=110)
            if actor(page)['ammo'] == 0:
                tap(page, 'r'); wait(page, 'window.firesidePractice.getState().state.players[0].reloadTicks===0')
        wait(page, 'window.firesidePractice.getState().state.phase==="matchEnd"', timeout=3000)
        result = snapshot(page)['stats']; assert result['result'] == 'won' and result['kills'] == 1 and result['damageDealt'] >= 200, result
        screenshot(page, 'breach-practice-cleared')
        page.locator('#practice-replay').click(); wait(page, 'window.firesidePractice.getState().state.phase==="countdown"'); assert actor(page)['hp'] == 200
        page.keyboard.press('Escape'); page.locator('#practice-change-setup').click(); wait(page, 'window.firesidePractice.getState().state.phase==="ready"')
        case('breach-native-moving-target-kill-replay-setup', result=result)
    finally:
        close_context(context)


def combat_case(browser):
    context, page = ready(browser)
    try:
        select(page, '#practice-mode', 'combat'); select(page, '#practice-count', '1'); select(page, '#practice-difficulty', 'regular')
        begin(page)
        # Move to an open flank using real keys, then leave the weapon silent.
        navigator = routes.Navigator(geometry(page, 'voxel'))
        route_to(page, navigator, -20, 18)
        wait(page, 'window.firesidePractice.getState().state.players[0].hp<200', timeout=30000)
        seen = snapshot(page); assert seen['stats']['damageTaken'] > 0 and seen['state']['players'][1]['shots'] > 0
        screenshot(page, 'breach-practice-return-fire')
        page.keyboard.press('Escape'); paused = shot_state(page); page.wait_for_timeout(180); assert shot_state(page) == paused
        case('combat-bots-native-reaction-shot-hp-loss-pause', stats=seen['stats'], bot_shots=seen['state']['players'][1]['shots'])
    finally:
        close_context(context)


def royale_case(browser):
    context, page = ready(browser, 'voxel-royale')
    try:
        select(page, '#practice-count', '1')
        screenshot(page, 'royale-practice-ready')
        started = begin(page); player = started['state']['players'][0]
        assert player['slot'] == 'sword' and player['meleeWeapon'] == 'knife' and not player['hasGun'] and player['ammo'] == player['potions'] == player['grenades'] == 0
        assert started['state']['loot'] and started['state']['storm']['active']
        navigator = routes.Navigator(geometry(page, 'voxel-royale'))
        acquired = None
        for _ in range(5):
            body = actor(page)
            loot = sorted((item for item in shot_state(page)['loot'] if item['kind'] == 'weapon' and abs(item['y'] - body['y']) < 1.2), key=lambda item: math.hypot(item['x'] - body['x'], item['z'] - body['z']))
            for item in loot:
                try:
                    route_to(page, navigator, item['x'], item['z']); acquired = item
                    break
                except AssertionError as error:
                    if 'No ground route' not in str(error):
                        raise
            if acquired:
                tap(page, 'e'); page.wait_for_timeout(100)
                if actor(page)['hasGun']:
                    break
                acquired = None
        assert actor(page)['hasGun'], ('Native scavenging found no gun', snapshot(page))
        assert any(event['type'] == 'lootPickup' and event['playerId'] == 0 for event in shot_state(page)['events'])
        wait(page, 'window.firesidePractice.getState().state.players[1].hasGun', timeout=25000)
        assert shot_state(page)['players'][1]['ammo'] > 0, 'Bot did not scavenge a genuine weapon'
        screenshot(page, 'royale-practice-scavenged')
        page.keyboard.press('Escape'); paused = shot_state(page); page.wait_for_timeout(200); assert shot_state(page) == paused
        page.locator('#practice-restart').click(); wait(page, 'window.firesidePractice.getState().state.phase==="countdown"'); assert not actor(page)['hasGun'] and actor(page)['meleeWeapon'] == 'knife'
        case('royale-native-knife-loot-bot-scavenging-storm-pause-restart', gun=acquired['weapon'], bot_gun=paused['players'][1]['weapon'])
    finally:
        close_context(context)


def responsive_case(browser):
    context, page = ready(browser)
    try:
        sizes = []
        for width, height in [(1365, 768), (800, 390), (390, 844), (320, 740)]:
            page.set_viewport_size({'width': width, 'height': height}); page.wait_for_timeout(100)
            sizes.append({'browser': [width, height], 'canvas': no_overflow(page)})
            assert page.locator('#practice-start').is_visible()
            screenshot(page, 'practice-ready-' + str(width))
        for map_id in ('paris', 'rooftops', 'depot'):
            select(page, '#practice-map', map_id); wait(page, 'id=>window.firesidePractice.getState().renderStats.mapId===id', map_id)
            assert shot_state(page)['phase'] == 'ready' and shot_state(page)['tick'] == 0
        case('responsive-native-setup-320-390-landscape-desktop-real-map-preview', layouts=sizes)
    finally:
        close_context(context)


def touch_case(browser):
    context, page = ready(browser, has_touch=True, is_mobile=True)
    try:
        page.set_viewport_size({'width': 800, 'height': 390})
        select(page, '#practice-count', '1')
        page.locator('#practice-fullscreen').tap(); wait(page, 'document.fullscreenElement?.id==="practice-shell"')
        begin(page, touch=True)
        assert not snapshot(page)['controls']['pointerLocked']
        box = page.locator('[data-practice-pad="move"]').bounding_box(); before = actor(page)
        session = context.new_cdp_session(page)
        point = {'x': box['x'] + box['width'] / 2, 'y': box['y'] + box['height'] / 2, 'id': 0}
        try:
            session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [point]})
            session.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{**point, 'x': point['x'] + 18}]})
            wait(page, 'before=>{const p=window.firesidePractice.getState().state.players[0];return Math.hypot(p.x-before.x,p.z-before.z)>.4}', before)
        finally:
            session.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); session.detach()
        wait(page, '!window.firesidePractice.getState().input.right')
        aim_box = page.locator('[data-practice-action="aim"]').bounding_box()
        session = context.new_cdp_session(page)
        try:
            session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': aim_box['x'] + aim_box['width'] / 2, 'y': aim_box['y'] + aim_box['height'] / 2, 'id': 0}]})
            wait(page, 'window.firesidePractice.getState().state.players[0].aimTicks===18')
        finally:
            session.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); session.detach()
        wait(page, 'window.firesidePractice.getState().state.players[0].aimTicks===0')
        page.locator('#practice-touch-pause').tap(); wait(page, 'window.firesidePractice.getState().state.phase==="paused"')
        screenshot(page, 'practice-touch-landscape-paused')
        assert not any(value for key, value in snapshot(page)['input'].items() if key not in ('yaw', 'pitch'))
        case('trusted-touch-native-move-release-actions-pause', before=before, after=actor(page), canvas=no_overflow(page))
    finally:
        close_context(context)


def main():
    OUT.mkdir(parents=True, exist_ok=True); REPORT['sources'] = hashes(); REPORT['fixture_sha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
            try:
                selected = os.environ.get('SEMAG_PRACTICE_CASES', 'mouse,input,breach,combat,royale,responsive,touch').split(',')
                for name, callback in [('mouse', mouse_case), ('input', input_case), ('breach', breach_case), ('combat', combat_case), ('royale', royale_case), ('responsive', responsive_case), ('touch', touch_case)]:
                    if name in selected:
                        callback(browser)
            except BaseException:
                for context_index, context in enumerate(browser.contexts):
                    for page_index, page in enumerate(context.pages):
                        try:
                            screenshot(page, f'failure-{context_index}-{page_index}')
                            (OUT / f'failure-{context_index}-{page_index}.json').write_text(json.dumps(snapshot(page), indent=2))
                        except Exception:
                            pass
                raise
            finally:
                browser.close()
        assert REPORT['sources'] == hashes(), 'Practice sources changed during native QA'
        assert not REPORT['errors'], REPORT['errors']
        assert not REPORT['failed_resources'], REPORT['failed_resources']
        assert not REPORT['websockets'], 'Local practice opened a multiplayer connection'
        REPORT['passed'] = True
    except BaseException as error:
        REPORT['passed'] = False; REPORT['failure'] = repr(error)
        raise
    finally:
        (OUT / 'report.json').write_text(json.dumps(REPORT, indent=2)); print(json.dumps({'report': str(OUT / 'report.json'), 'passed': REPORT.get('passed'), 'cases': len(REPORT['cases'])}), flush=True)


if __name__ == '__main__':
    main()
