"""Trusted native browser QA for Voxel Wilds.

python test/voxel-survival-browser-smoke.py http://127.0.0.1:3000
SEMAG_SCREENSHOT_DIR selects the inspectable screenshots and report directory.
Gameplay uses native Playwright/CDP keyboard and mouse input only. Read-only
snapshots and terrain are inspected; no game state, time or RAF is injected.
The corrupt-save case writes only a deliberately invalid localStorage record
through the browser's DOMStorage protocol, then uses the normal loading UI.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import time
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', '/workspace/scratch/semag-voxel-survival-browser'))
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3000').rstrip('/')
SOURCES = ('index.html', 'solo.html', 'hub/shared.js', 'solo/solo.js', 'voxel-survival-world.js', 'voxel-survival-engine.js',
           'solo/survival-view.js', 'voxel-survival-renderer.js', 'solo/survival.css',
           'hub/survival-cover.svg', 'display-timing.js', 'keyboard-layout.js')
REPORT = {'cases': [], 'errors': [], 'failed_resources': [], 'screenshots': [], 'sources': {},
          'native_gameplay_only': True, 'software_webgl_only': True}
CALIBRATION = {}


def log(stage, **details):
    print(json.dumps({'stage': stage, **details}), flush=True)


def wait(page, expression, arg=None, timeout=15000):
    return page.wait_for_function(expression, arg=arg, polling=25, timeout=timeout)


def state(page):
    return page.evaluate('window.firesideSolo.getState()')


def observe(page, name):
    page.on('pageerror', lambda error: REPORT['errors'].append(f'{name}: {error}'))
    page.on('console', lambda message: REPORT['errors'].append(f'{name}: {message.text}') if message.type == 'error' else None)
    page.on('response', lambda response: REPORT['failed_resources'].append(f'{name}: {response.status} {response.url}') if response.status >= 400 else None)


def screenshot(page, name):
    path = OUT / (name + '.png')
    page.screenshot(path=str(path), full_page=True)
    REPORT['screenshots'].append(str(path))
    return str(path)


def cdp_key(page, key, code, kind='keyDown', repeat=False):
    session = page.context.new_cdp_session(page)
    try:
        payload = {'type': kind, 'key': key, 'code': code, 'windowsVirtualKeyCode': ord(key.upper()) if len(key) == 1 else 0}
        if kind == 'keyDown':
            payload['autoRepeat'] = repeat
            if len(key) == 1:
                payload['text'] = key
                payload['unmodifiedText'] = key
        session.send('Input.dispatchKeyEvent', payload)
    finally:
        session.detach()


def tap(page, key, code=None):
    if code:
        cdp_key(page, key, code)
        page.wait_for_timeout(45)
        cdp_key(page, key, code, 'keyUp')
    else:
        page.keyboard.press(key, delay=40)


def no_overflow(page, name):
    box = page.evaluate('''()=>({width:innerWidth,body:document.body.scrollWidth,
      html:document.documentElement.scrollWidth})''')
    assert max(box['body'], box['html']) <= box['width'] + 1, (name, box)
    return box


def angle_delta(target, current):
    return (target - current + math.pi) % (2 * math.pi) - math.pi


def hashes():
    return {name: hashlib.sha256((ROOT / 'public' / name).read_bytes()).hexdigest()
            for name in SOURCES if (ROOT / 'public' / name).exists()}


def sample(page, expression='window.firesideSolo.getState()', seconds=.6):
    views, deadline = [], time.monotonic() + seconds
    while time.monotonic() < deadline:
        views.append(page.evaluate(expression))
        page.wait_for_timeout(12)
    return views


def count_item(snapshot, item):
    return sum(slot['count'] for slot in snapshot['inventory'] if slot and slot['id'] == item)


def add_case(name, **details):
    REPORT['cases'].append({'name': name, **details})
    log('native-survival-pass', name=name, **details)


# Gameplay cases below use the public read-only controller snapshot.

def hub_case(page):
    page.goto(URL)
    wait(page, 'document.querySelector("[data-game-card=voxel-wilds]") && document.querySelector("#nav-game-count").textContent === "27"')
    cards = page.locator('[data-game-card]')
    assert cards.count() == 27
    assert page.locator('#library-game-count').inner_text() == '27'
    page.locator('[data-filter="voxel"]').click()
    visible = page.locator('[data-game-card]:visible').evaluate_all('nodes=>nodes.map(node=>node.dataset.gameCard)')
    assert set(visible) == {'voxel-breach', 'voxel-royale', 'voxel-wilds'}, visible
    assert page.locator('[data-filter="voxel"] span').inner_text() == '3'
    page.locator('[data-filter="solo"]').click()
    assert page.locator('[data-game-card="voxel-wilds"]').is_visible()
    assert not page.locator('[data-game-card="voxel-breach"]').is_visible()
    page.locator('#game-search').fill('wilds')
    assert page.locator('[data-game-card]:visible').count() == 1
    no_overflow(page, 'hub-desktop')
    screenshot(page, 'wilds-hub')
    page.locator('[data-play-solo="voxel-wilds"]').click()
    page.wait_for_url('**/solo.html?game=voxel-wilds')
    wait(page, 'window.firesideSolo?.gameId === "voxel-wilds"')
    assert state(page) is None, 'Opening a solo card immediately started survival'
    page.wait_for_timeout(250)
    assert state(page) is None
    assert page.locator('#solo-start').is_visible()
    assert page.locator('#solo-title').inner_text() == 'Voxel Wilds'
    screenshot(page, 'wilds-ready')
    add_case('hub-explicit-start', cards=27, voxel_filter=3, initial_state=None)


def enter(page):
    current = state(page)
    if current['phase'] == 'paused' and not current['menuOpen'] and not current['choosingSave']:
        page.locator('.wilds-pause-resume').click()
    wait(page, 'window.firesideSolo.getState().phase === "playing"')
    canvas = page.locator('.wilds-canvas')
    if not page.evaluate('Boolean(document.pointerLockElement)'):
        canvas.click()
        wait(page, 'Boolean(document.pointerLockElement)')
    canvas.focus()


def look_pose(page):
    return page.evaluate('''()=>{const s=window.firesideSolo.getState();
      return {yaw:s.controls?.lookYaw ?? s.player.yaw,pitch:s.controls?.lookPitch ?? s.player.pitch};}''')


def native_look(page, dx, dy):
    box = page.locator('.wilds-canvas').bounding_box()
    assert box
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    page.mouse.move(x, y)
    before = look_pose(page)
    page.mouse.move(x + dx, y + dy, steps=2)
    page.wait_for_timeout(90)
    return before, look_pose(page)


def aim(page, yaw, pitch=0):
    enter(page)
    key = id(page)
    if key not in CALIBRATION:
        before, after = native_look(page, 40, 30)
        sx = angle_delta(after['yaw'], before['yaw']) / 40
        sy = (after['pitch'] - before['pitch']) / 30
        assert abs(sx) > .0001 and abs(sy) > .0001, ('Native mouse look did not respond', before, after)
        CALIBRATION[key] = sx, sy
    sx, sy = CALIBRATION[key]
    box = page.locator('.wilds-canvas').bounding_box()
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    page.mouse.move(x, y)
    for _ in range(16):
        current = look_pose(page)
        dyaw, dpitch = angle_delta(yaw, current['yaw']), pitch - current['pitch']
        if abs(dyaw) < .003 and abs(dpitch) < .003:
            break
        dx = max(-box['width'] * .35, min(box['width'] * .35, dyaw / sx))
        dy = max(-box['height'] * .35, min(box['height'] * .35, dpitch / sy))
        page.mouse.move(x + dx, y + dy, steps=3)
        x, y = x + dx, y + dy
        page.wait_for_timeout(90)
    actual = look_pose(page)
    assert abs(angle_delta(yaw, actual['yaw'])) < .009 and abs(pitch - actual['pitch']) < .009, ('Native aim missed', yaw, pitch, actual)
    page.wait_for_timeout(120)


def aim_block(page, cell):
    body = state(page)['player']
    dx, dy, dz = cell['x'] + .5 - body['x'], cell['y'] + .5 - (body['y'] + 1.62), cell['z'] + .5 - body['z']
    aim(page, math.atan2(dx, -dz), math.atan2(dy, math.hypot(dx, dz)))


def open_inventory(page):
    enter(page)
    tap(page, 'Tab')
    wait(page, 'window.firesideSolo.getState().menuOpen && window.firesideSolo.getState().phase === "paused"')
    assert page.locator('.wilds-inventory').is_visible()
    assert not page.evaluate('Boolean(document.pointerLockElement)')


def close_inventory(page):
    page.locator('.wilds-close-inventory').click()
    wait(page, '!window.firesideSolo.getState().menuOpen && window.firesideSolo.getState().phase === "playing"')
    enter(page)


def block_at(world, cell):
    return world['blocks'][cell['x'] + world['width'] * (cell['z'] + world['depth'] * cell['y'])]


def finite_player(snapshot):
    body = snapshot['player']
    world = {**(snapshot.get('world') or {'width': 40, 'depth': 40, 'height': 20}), 'blocks': blocks(snapshot)}
    assert all(math.isfinite(body[key]) for key in ('x', 'y', 'z')), body
    radius, height = .3, 1.8
    assert radius - .001 <= body['x'] <= world['width'] - radius + .001, body
    assert radius - .001 <= body['z'] <= world['depth'] - radius + .001, body
    assert body['y'] >= -.001, body
    for y in range(max(0, math.floor(body['y'] + .001)), min(world['height'], math.ceil(body['y'] + height - .001))):
        for z in range(max(0, math.floor(body['z'] - radius + .001)), min(world['depth'], math.ceil(body['z'] + radius - .001))):
            for x in range(max(0, math.floor(body['x'] - radius + .001)), min(world['width'], math.ceil(body['x'] + radius - .001))):
                cell = {'x': x, 'y': y, 'z': z}
                assert block_at(world, cell) == 0, ('Player penetrated a solid voxel', body, cell, block_at(world, cell))
    for foe in snapshot.get('enemies', []):
        vertical_overlap = body['y'] < foe['y'] + foe['height'] - .001 and body['y'] + height > foe['y'] + .001
        gap = math.hypot(body['x'] - foe['x'], body['z'] - foe['z'])
        assert not vertical_overlap or gap >= body.get('radius', radius) + foe['radius'] - .001, ('Player and creature bodies overlapped', body, foe, gap)


def blocks(snapshot):
    return snapshot.get('world', {}).get('blocks', snapshot.get('blocks'))


def gameplay_case(context, page):
    page.locator('#solo-start').click()
    wait(page, 'window.firesideSolo.getState() !== null')
    assert state(page)['graphicsAvailable'], 'WebGL world did not initialize'
    enter(page)
    wait(page, 'window.firesideSolo.getState().target?.id === 5')
    initial = state(page)
    finite_player(initial)
    assert len(initial['inventory']) == 8
    assert initial['inventory'][0]['id'] == 'wood-pick'
    target = initial['target']
    page.mouse.down(button='left')
    try:
        wait(page, 'window.firesideSolo.getState().mining?.progress > 0', timeout=4000)
        screenshot(page, 'wilds-mining')
        wait(page, 'window.firesideSolo.getState().stats.mined > 0', timeout=5000)
    finally:
        page.mouse.up(button='left')
    mined = state(page)
    assert count_item(mined, 'wood') == 1
    assert blocks(mined)[target['x'] + 40 * (target['z'] + 40 * target['y'])] == 0
    assert mined['inventory'][0]['durability'] == initial['inventory'][0]['durability'] - 1
    assert mined['displayTiming']['physicsSamples'] > 0 and mined['displayTiming']['interpolatedSamples'] > 0
    add_case('mine-cedar', cell={key: target[key] for key in ('x', 'y', 'z')}, wood=1, tool_wear=1)

    open_inventory(page)
    paused = state(page)
    page.wait_for_timeout(350)
    still = state(page)
    assert still['time'] == paused['time'] and still['tick'] == paused['tick']
    assert still['player']['hunger'] == paused['player']['hunger']
    assert still['displayTiming']['lastFraction'] == 1
    assert page.locator('[data-recipe="planks"]').is_enabled(), 'Gathered cedar cannot craft in the paused inventory'
    page.locator('[data-recipe="planks"]').click()
    crafted = state(page)
    assert count_item(crafted, 'plank') == 4 and count_item(crafted, 'wood') == 0
    assert crafted['stats']['crafted'] == 1 and crafted['time'] == paused['time']
    assert page.locator('[data-recipe="iron-pick"]').is_disabled()
    page.locator('.wilds-inventory [data-pack-slot="2"]').click()
    page.locator('.wilds-discard').click()
    discarded = state(page)
    assert discarded['inventory'][2] is None and discarded['time'] == paused['time']
    assert page.locator('.wilds-discard').is_disabled()
    screenshot(page, 'wilds-inventory')
    no_overflow(page, 'inventory-desktop')
    add_case('paused-crafting', frozen_ticks=still['tick'], planks=4, unavailable_recipe_disabled=True)
    add_case('pack-selection-discard', selected_slot=2, empty_slot_freed=True, paused_clock_unchanged=True)
    close_inventory(page)

    plank_slot = next(index for index, slot in enumerate(crafted['inventory']) if slot and slot['id'] == 'plank')
    tap(page, str(plank_slot + 1), 'Digit' + str(plank_slot + 1))
    wait(page, 'slot=>window.firesideSolo.getState().selectedSlot===slot', plank_slot)
    aim_block(page, {'x': 20, 'y': 4, 'z': 16})
    wait(page, 'window.firesideSolo.getState().target?.id === 5')
    before_build = state(page)
    face = before_build['target']
    cell = {key: face[key] + face['normal'][key] for key in ('x', 'y', 'z')}
    assert blocks(before_build)[cell['x'] + 40 * (cell['z'] + 40 * cell['y'])] == 0
    tap(page, 'e', 'KeyE')
    wait(page, 'window.firesideSolo.getState().stats.built === 1')
    built = state(page)
    assert count_item(built, 'plank') == 3
    assert blocks(built)[cell['x'] + 40 * (cell['z'] + 40 * cell['y'])] == 9
    finite_player(built)
    screenshot(page, 'wilds-gameplay')
    add_case('face-building', cell=cell, planks_remaining=3, changed_block=9)

    # Select every slot with actual French number-row characters and codes.
    for index, symbol in enumerate('&é"\'(§è!'):
        tap(page, symbol, 'Digit' + str(index + 1))
        wait(page, 'slot=>window.firesideSolo.getState().selectedSlot===slot', index)
        wait(page, 'slot=>document.querySelector(`[data-slot="${slot}"]`).getAttribute("aria-pressed")==="true"', index)
    page.mouse.wheel(0, 100)
    wait(page, 'window.firesideSolo.getState().selectedSlot===0')
    add_case('eight-slot-azerty-hotbar', physical_slots=8, wheel_wrap=True)

    # Move into a real trunk, inspecting actual voxel occupancy along the path.
    aim(page, 0, 0)
    start = state(page)['player']
    cdp_key(page, 'w', 'KeyW')
    try:
        seen = sample(page, seconds=1.6)
    finally:
        cdp_key(page, 'w', 'KeyW', 'keyUp')
    assert seen[-1]['player']['z'] < start['z'] - .5
    for item in seen:
        finite_player(item)
    # The built front block is the first collision, before the cedar.
    assert state(page)['player']['z'] >= cell['z'] + 1.3 - .001
    jump_from_y = state(page)['player']['y']
    tap(page, 'Space')
    wait(page, 'y=>window.firesideSolo.getState().player.y>y+.08', jump_from_y, timeout=2000)
    jump_seen = sample(page, seconds=.65)
    for item in jump_seen:
        finite_player(item)
    wait(page, 'window.firesideSolo.getState().player.grounded', timeout=3500)
    add_case('native-move-wall-jump', collision_samples=len(seen) + len(jump_seen), no_solid_penetration=True)

    tap(page, 'Escape')
    wait(page, 'window.firesideSolo.getState().phase === "paused"')
    page.locator('select[data-keyboard-layout]').select_option('zqsd')
    assert 'Z Q S D' in page.locator('.wilds-controls-hint').inner_text()
    enter(page)
    before = state(page)['player']
    cdp_key(page, 'q', 'KeyA')
    page.wait_for_timeout(350)
    cdp_key(page, 'q', 'KeyA', 'keyUp')
    after = state(page)['player']
    assert after['x'] < before['x'] - .4, ('French Q did not strafe left', before, after)
    cdp_key(page, 'z', 'KeyW')
    page.wait_for_timeout(350)
    cdp_key(page, 'z', 'KeyW', 'keyUp')
    assert state(page)['player']['z'] < after['z'] - .2
    finite_player(state(page))
    add_case('zqsd-native-controls', french_key_code_mismatches=True)

    # Food acts on the selected stack and cannot be spent while nourished.
    wait(page, 'window.firesideSolo.getState().player.hunger < 99', timeout=10000)
    tap(page, 'é', 'Digit2')
    berries_before = state(page)
    tap(page, 'f', 'KeyF')
    wait(page, 'window.firesideSolo.getState().inventory[1].count === 3')
    fed = state(page)
    assert fed['player']['hunger'] > berries_before['player']['hunger']
    tap(page, 'f', 'KeyF')
    page.wait_for_timeout(100)
    assert state(page)['inventory'][1]['count'] == 3
    add_case('native-eat-selected-stack', berries_remaining=3, full_food_prevents_waste=True)

    # Switching focus uses the native browser; returning does not auto-resume.
    cdp_key(page, 'd', 'KeyD')
    page.wait_for_timeout(100)
    other = context.new_page()
    other.goto('about:blank')
    other.bring_to_front()
    wait(page, 'window.firesideSolo.getState().phase === "paused"')
    paused = state(page)
    page.wait_for_timeout(250)
    assert state(page)['tick'] == paused['tick']
    page.bring_to_front()
    assert state(page)['phase'] == 'paused'
    cdp_key(page, 'd', 'KeyD', 'keyUp')
    other.close()
    enter(page)
    before = state(page)['player']
    page.wait_for_timeout(250)
    after = state(page)['player']
    assert math.hypot(after['x'] - before['x'], after['z'] - before['z']) < .001, 'Blur left a held movement key'
    tap(page, 'Escape')
    wait(page, 'window.firesideSolo.getState().phase === "paused"')
    paused = state(page)
    assert not page.evaluate('Boolean(document.pointerLockElement)')
    page.wait_for_timeout(220)
    assert state(page)['tick'] == paused['tick']
    page.locator('#solo-pause').click()
    wait(page, 'window.firesideSolo.getState().phase === "playing"')
    add_case('focus-and-explicit-pause', no_stuck_keys=True, no_auto_resume=True, escape_releases_mouse=True)

    responsive_case(page)
    saved_run_case(page, cell)
    night_case(page)
    add_case('renderer-budget', stats=state(page)['renderer'])
    stats = state(page)['renderer']
    assert stats['cachedChunks'] <= 25 and stats['chunks'] <= 25
    assert stats['drawCalls'] <= 29 and stats['particles'] <= stats['maxParticles'] == 64
    assert stats['dynamicVertices'] <= 20000 and stats['staticVertices'] <= 80000
    assert stats['pixelWidth'] * stats['pixelHeight'] <= 1800000


def responsive_case(page):
    sizes = [(1280, 960), (844, 390), (390, 844), (320, 740)]
    checks = []
    for width, height in sizes:
        page.set_viewport_size({'width': width, 'height': height})
        enter(page)
        page.wait_for_timeout(120)
        no_overflow(page, f'world-{width}')
        boxes = page.locator('.wilds-hotbar,.wilds-hud,.wilds-compass').evaluate_all('''nodes=>nodes.map(node=>{
          const r=node.getBoundingClientRect(),v=document.querySelector('.wilds-board').getBoundingClientRect();
          return {cls:node.className,x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width,
                  world:{x:v.x,right:v.right,y:v.y,bottom:v.bottom}};})''')
        assert all(item['width'] > 0 and item['x'] >= item['world']['x'] - 1 and item['right'] <= item['world']['right'] + 1
                   and item['y'] >= item['world']['y'] - 1 and item['bottom'] <= item['world']['bottom'] + 1 for item in boxes), (width, boxes)
        open_inventory(page)
        no_overflow(page, f'pack-{width}')
        assert page.locator('.wilds-close-inventory').is_visible()
        screenshot(page, f'wilds-pack-{width}')
        close_inventory(page)
        checks.append({'width': width, 'height': height, 'hud_inside_world': True, 'pack_no_page_overflow': True})
    page.set_viewport_size({'width': 1280, 'height': 960})
    enter(page)
    add_case('responsive-world-inventory', viewports=checks)


def saved_run_case(page, built_cell):
    tap(page, 'Escape')
    wait(page, 'window.firesideSolo.getState().phase === "paused"')
    before = state(page)
    assert before['saveAvailable']
    page.reload()
    wait(page, 'window.firesideSolo?.gameId === "voxel-wilds"')
    assert state(page) is None
    page.locator('#solo-start').click()
    wait(page, 'window.firesideSolo.getState()?.choosingSave')
    waiting = state(page)
    assert waiting['phase'] == 'paused'
    page.wait_for_timeout(250)
    assert state(page)['tick'] == waiting['tick']
    page.locator('.wilds-continue-save').click()
    wait(page, '!window.firesideSolo.getState().choosingSave')
    restored = state(page)
    assert restored['inventory'] == before['inventory'] and restored['stats'] == before['stats']
    assert blocks(restored) == blocks(before)
    assert abs(restored['elapsed'] - before['elapsed']) < .25
    assert abs(restored['player']['x'] - before['player']['x']) < .001
    assert abs(restored['player']['z'] - before['player']['z']) < .001
    finite_player(restored)
    add_case('saved-expedition-explicit-continue', elapsed=before['elapsed'], inventory_preserved=True, world_preserved=True)

    # A restart is a real new expedition and removes all mined/built edits.
    page.locator('#solo-restart').click()
    wait(page, 'window.firesideSolo.getState().stats.mined === 0 && window.firesideSolo.getState().stats.built === 0')
    fresh = state(page)
    assert fresh['inventory'][0]['id'] == 'wood-pick'
    assert count_item(fresh, 'plank') == 0 and fresh['selectedSlot'] == 0
    assert fresh['elapsed'] < .25
    finite_player(fresh)
    add_case('native-restart', initial_pack_restored=True, edits_removed=True)

    # Corruption setup changes browser storage only, never a running game.
    page.goto(URL)
    session = page.context.new_cdp_session(page)
    try:
        session.send('DOMStorage.enable')
        session.send('DOMStorage.setDOMStorageItem', {'storageId': {'securityOrigin': URL, 'isLocalStorage': True},
                     'key': 'semag-voxel-wilds-world:v1', 'value': '{invalid expedition'})
    finally:
        session.detach()
    page.goto(URL + '/solo.html?game=voxel-wilds')
    wait(page, 'window.firesideSolo?.gameId === "voxel-wilds"')
    assert state(page) is None
    page.locator('#solo-start').click()
    wait(page, 'window.firesideSolo.getState() !== null')
    fallback = state(page)
    assert not fallback['choosingSave'] and fallback['stats']['mined'] == fallback['stats']['built'] == 0
    assert fallback['graphicsAvailable']
    finite_player(fallback)
    screenshot(page, 'wilds-fresh-after-corrupt-save')
    add_case('invalid-save-fallback', invalid_json_rejected=True, new_world_playable=True)


def night_case(page):
    enter(page)
    tap(page, '&', 'Digit1')
    wait(page, 'window.firesideSolo.getState().selectedSlot===0')
    clock, deadline, last_notice = [], time.monotonic() + 180, -10
    while time.monotonic() < deadline:
        current = state(page)
        assert current['phase'] == 'playing', current['phase']
        finite_player(current)
        if current['elapsed'] >= last_notice + 20:
            last_notice = current['elapsed']
            clock.append({'elapsed': current['elapsed'], 'day': current['day'], 'night': current['night'], 'hp': current['player']['hp']})
            log('native-night-wait', **clock[-1])
        if current['night'] and current['enemies']:
            break
        page.wait_for_timeout(800)
    else:
        raise AssertionError(('Natural night/enemy spawn did not arrive', clock))
    assert current['elapsed'] >= 80 and current['day'] == 1
    assert all(enemy['type'] == 'crawler' for enemy in current['enemies'])
    first_enemy_active_seconds = current['elapsed']
    spawned = [enemy['id'] for enemy in current['enemies']]
    aim(page, math.pi, .2)
    screenshot(page, 'wilds-first-night')
    log('native-night-spawn', elapsed=current['elapsed'], ids=spawned)

    observations, hits, damage, killed, captured = [], False, False, False, False
    deadline = time.monotonic() + 90
    held = False
    try:
        while time.monotonic() < deadline:
            current = state(page)
            assert current['phase'] == 'playing', ('Expedition ended before native combat proof', current['player'], observations[-10:])
            finite_player(current)
            enemies = sorted(current['enemies'], key=lambda foe: math.hypot(foe['x'] - current['player']['x'], foe['z'] - current['player']['z']))
            observations.append({'elapsed': current['elapsed'], 'hp': current['player']['hp'], 'kills': current['stats']['kills'],
                                 'enemies': [{'id': foe['id'], 'hp': foe['hp'], 'distance': math.hypot(foe['x'] - current['player']['x'], foe['z'] - current['player']['z'])} for foe in enemies]})
            hits |= any(foe['hp'] < foe['maxHp'] for foe in enemies)
            damage |= current['player']['hp'] < 100
            killed |= current['stats']['kills'] > 0
            if hits and killed and damage:
                break
            if enemies:
                foe, body = enemies[0], current['player']
                distance = math.hypot(foe['x'] - body['x'], foe['z'] - body['z'])
                if distance < 4.5:
                    dx, dz = foe['x'] - body['x'], foe['z'] - body['z']
                    dy = foe['y'] + foe['height'] * .65 - body['y'] - body['eyeHeight']
                    aim(page, math.atan2(dx, -dz), max(-1.4, min(1.4, math.atan2(dy, max(.01, distance)))))
                    finite_player(state(page))
                    if not held:
                        cdp_key(page, 'c', 'KeyC')
                        held = True
                    if not captured and distance < 3.5:
                        screenshot(page, 'wilds-night-visible-crawler')
                        captured = True
            page.wait_for_timeout(180 if held else 650)
        else:
            raise AssertionError(('Native crawler combat did not resolve', observations[-15:]))
    finally:
        if held:
            cdp_key(page, 'c', 'KeyC', 'keyUp')
    screenshot(page, 'wilds-night-combat')
    assert hits and killed and damage and captured
    assert current['player']['hp'] > 0
    assert current['player']['hunger'] < 90
    add_case('natural-first-night-combat', first_enemy_active_seconds=first_enemy_active_seconds, wait_clock_observations=clock,
             natural_spawns=spawned, native_mouse_aim_and_held_c=True, enemy_health_reduced=True,
             kills=current['stats']['kills'], player_health=current['player']['hp'], hunger=current['player']['hunger'],
             physical_creature_separation_checked=True, visible_crawler_captured=captured,
             observed_combat=observations[-15:])
    tap(page, 'Escape')
    wait(page, 'window.firesideSolo.getState().phase === "paused"')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    REPORT['sources'] = hashes()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                args=['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader',
                      '--enable-unsafe-swiftshader', '--disable-background-timer-throttling',
                      '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
            try:
                context = browser.new_context(viewport={'width': 1280, 'height': 960})
                page = context.new_page()
                observe(page, 'wilds/main')
                try:
                    hub_case(page)
                    gameplay_case(context, page)
                except BaseException:
                    screenshot(page, 'wilds-failure')
                    if page.evaluate('Boolean(window.firesideSolo)'):
                        (OUT / 'failure-state.json').write_text(json.dumps(state(page), indent=2))
                    raise
                finally:
                    context.close()
            finally:
                browser.close()
    finally:
        (OUT / 'report.json').write_text(json.dumps(REPORT, indent=2))
    assert not REPORT['errors'], ('Browser errors', REPORT['errors'])
    assert not REPORT['failed_resources'], ('Failed resources', REPORT['failed_resources'])
    assert hashes() == REPORT['sources'], 'Production sources changed during native proof'
    log('passed', native_cases=len(REPORT['cases']), report=str(OUT / 'report.json'))


if __name__ == '__main__':
    main()
