"""Trusted native visual QA for the shared voxel asset refinement.

python test/voxel-assets-browser-smoke.py http://127.0.0.1:3000
SEMAG_ASSET_CASES selects comma-separated weapon ids or royale map ids.
SEMAG_SCREENSHOT_DIR selects the inspectable report and screenshot directory.
All gameplay uses native browser/CDP keyboard and mouse events. Immutable
geometry, read-only game snapshots, transport and WebGL calls are observed.
No gameplay input, position, inventory, time or server state is injected.
"""
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import sys

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', '/workspace/scratch/semag-voxel-assets-browser'))
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3000').rstrip('/')
SPEC = importlib.util.spec_from_file_location('voxel_asset_native_fixture', ROOT / 'test' / 'voxel-paris-browser-smoke.py')
fixture = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(fixture)
native, royale = fixture.native, fixture.royale
fixture.OUT = native.OUT = royale.OUT = OUT
fixture.URL = native.URL = royale.URL = URL
royale.SETUP_CAPTURED = True
WEAPONS = ('carbine', 'smg', 'marksman', 'pistol', 'shotgun', 'burst', 'sniper', 'lmg', 'crossbow')
THEMES = ('forest', 'maze', 'desert', 'paris')
REPORT = {'cases': [], 'screenshots': [], 'errors': [], 'failed_resources': [],
          'renderer_sha256': hashlib.sha256((ROOT / 'public' / 'voxel-renderer.js').read_bytes()).hexdigest()}
snapshot, actor, debug, wait = fixture.snapshot, fixture.actor, fixture.debug, fixture.wait
enter, aim, tap, select = fixture.enter, fixture.aim, fixture.tap, fixture.select


def log(stage, **details):
    print(json.dumps({'stage': stage, **details}), flush=True)


def screenshot(page, name):
    path = OUT / (name + '.png')
    page.locator('#viewport').screenshot(path=str(path))
    REPORT['screenshots'].append(str(path))
    return str(path)


def observe(page, tag):
    page.on('pageerror', lambda error: REPORT['errors'].append(f'{tag}: {error}'))
    page.on('console', lambda message: REPORT['errors'].append(f'{tag}: {message.text}') if message.type == 'error' else None)
    page.on('response', lambda response: REPORT['failed_resources'].append(f'{tag}: {response.status} {response.url}') if response.status >= 400 else None)


def room(browser, mode, map_id, weapon='carbine'):
    config = fixture.MODES[mode]
    contexts, pages = [], []
    for index in range(2):
        context = browser.new_context(viewport={'width': 1280 if index == 0 else 320, 'height': 960 if index == 0 else 500},
                                      device_scale_factor=1 if index == 0 else .35)
        context.add_init_script('(' + fixture.INSTRUMENT + ')();')
        contexts.append(context)
        page = context.new_page()
        fixture.ACTIVE_MODE[id(page)] = mode
        native.LOOK_CALIBRATION.pop(id(page), None)
        royale.CALIBRATION.pop(id(page), None)
        observe(page, f'{mode}/{map_id}/{weapon}/{index}')
        pages.append(page)
    try:
        host, peer = pages
        host.goto(URL)
        wait(host, 'document.querySelector("#host-status").textContent==="Host is online"')
        host.locator(f'[data-create-game="{config["game"]}"]').click()
        select(host, config['select'], map_id)
        if mode == 'breach':
            host.locator('#voxel-setup [name=teamSize][value="1"]').check()
        else:
            select(host, '#royale-capacity', '10')
        arena = host.evaluate('async ([url,id])=>(await import(url)).MAPS[id]', [config['maps'], map_id])
        host.locator(config['create']).click()
        host.wait_for_url('**/' + config['path'] + '?room=*')
        fixture.connected(host)
        peer.goto(host.url)
        fixture.connected(peer)
        wait(host, f'window.{debug(host)}.getState().players.filter(person=>person?.connected).length===2')
        pages.sort(key=lambda page: snapshot(page)['playerId'])
        assert [snapshot(page)['playerId'] for page in pages] == [0, 1]
        select(host, 'select[data-keyboard-layout]', 'zqsd')
        if mode == 'breach':
            select(host, '#loadout-select', weapon)
            wait(host, f'id=>window.{debug(host)}.getState().state.players[0].weapon===id', weapon)
        assert all(snapshot(page)['state']['phase'] == 'lobby' for page in pages)
        return contexts, pages, arena
    except BaseException:
        for context in contexts:
            context.close()
        raise


def begin(pages, mode):
    host, peer = pages
    name = debug(host)
    if mode == 'breach':
        host.locator('#ready-button').click()
        host.wait_for_timeout(80)
        assert snapshot(host)['state']['phase'] == 'lobby', 'One Ready started the game'
        peer.locator('#ready-button').click()
    else:
        assert peer.locator('#start-button').is_disabled()
        host.locator('#overlay-start').click()
    wait(host, f'window.{name}.getState().state.phase==="countdown"')
    countdown = snapshot(host)['state']
    wait(host, f'window.{name}.getState().state.phase==="fight"', timeout=20000)
    wait(peer, f'window.{debug(peer)}.getState().state.phase==="fight"')
    participants = countdown['participantIds'] if mode == 'royale' else range(len(countdown['players']))
    for ident in participants:
        body = countdown['players'][ident]
        assert body['hp'] == body['maxHp'] == 200
        if mode == 'royale':
            assert body['meleeWeapon'] == 'knife' and body['slot'] == 'sword' and not body['hasGun']
            assert body['ammo'] == body['reserve'] == body['potions'] == body['grenades'] == 0
    enter(host)
    return {'native_two_client_start': True, 'health': 200, 'knife_only_start': mode == 'royale'}


def performance(page, arena):
    fixture.finite(page, arena)
    seen, observed = snapshot(page), page.evaluate('window.__voxelQA')
    renderer = seen['renderStats']
    assert seen['connected'] and seen['graphicsError'] == '' and seen['renderCount'] > 0
    assert renderer['mapVertices'] <= 100000 and renderer['dynamicVertices'] <= 72000 and renderer['cachedMaps'] <= 3, renderer
    assert renderer['drawCalls'] <= 7 and max(observed['drawCalls'] or [0]) <= 7
    assert observed['glResources']['buffers']['live'] <= 10 and observed['glResources']['programs']['live'] <= 2
    assert not any(event['type'] == 'close' for event in observed['socketLifecycle']), observed['socketLifecycle']
    assert 'map' not in observed['latestState']['state'], 'Network repeated static geometry'
    return {'renderer': renderer, 'gpu_resources': observed['glResources'],
            'cpu_ms': native.distribution(observed['cpu']), 'frame_ms': native.distribution(observed['gaps']),
            'draw_calls': native.distribution(observed['drawCalls']), 'socket_lifecycle': observed['socketLifecycle'],
            'software_webgl_only': True}


def responsive(page, mode, name):
    checks = []
    for width in (1280, 390, 320):
        page.set_viewport_size({'width': width, 'height': 960 if width == 1280 else 1000})
        enter(page)
        royale.no_overflow(page, name + '/' + str(width))
        boxes = page.locator('#health-readout,#weapon-readout,#tactical-map,' + ('#objective-hud' if mode == 'breach' else '#storm-hud')).evaluate_all('''nodes=>nodes.map(node=>{
          const r=node.getBoundingClientRect(),v=document.querySelector('#viewport').getBoundingClientRect();
          return{id:node.id,x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width,height:r.height,
            viewport:{x:v.x,right:v.right,y:v.y,bottom:v.bottom}};})''')
        assert all(box['width'] > 0 and box['x'] >= box['viewport']['x'] - 1 and box['right'] <= box['viewport']['right'] + 1
                   and box['y'] >= box['viewport']['y'] - 1 and box['bottom'] <= box['viewport']['bottom'] + 1 for box in boxes), (width, boxes)
        cards = {box['id']: box for box in boxes}
        assert cards['health-readout']['right'] <= cards['weapon-readout']['x'], (width, boxes)
        assert int(page.locator('#health-meter').get_attribute('aria-valuenow')) == actor(page)['hp']
        assert not page.locator('#game-overlay').is_visible()
        screenshot(page, name + '-' + str(width))
        checks.append({'width': width, 'compact_hud_inside_viewport': True})
    page.set_viewport_size({'width': 1280, 'height': 960})
    enter(page)
    return checks


def ads(page, name):
    enter(page)
    page.mouse.down(button='right')
    try:
        wait(page, f'id=>window.{debug(page)}.getState().state.players[id].aimTicks===18', snapshot(page)['playerId'])
        body = actor(page)
        screenshot(page, name + '-ads')
        if body['weapon'] in ('marksman', 'sniper'):
            assert page.locator('#scope-reticle').is_visible(), (body['weapon'], 'Scope missing')
        return {'native_rmb_ads': True, 'authoritative_aim_ticks': body['aimTicks'], 'scope_visible': body['weapon'] in ('marksman', 'sniper')}
    finally:
        page.mouse.up(button='right')
        wait(page, f'id=>window.{debug(page)}.getState().state.players[id].aimTicks===0', snapshot(page)['playerId'])


def discharge_and_reload(page, name):
    # A real shot toward the perimeter cannot alter the peer's health.
    aim(page, math.pi, -.06)
    before, event_id = actor(page), snapshot(page)['state']['eventId']
    page.mouse.down(button='left')
    try:
        wait(page, f'([id,ammo])=>window.{debug(page)}.getState().state.players[id].ammo<ammo', [snapshot(page)['playerId'], before['ammo']], timeout=2500)
    finally:
        page.mouse.up(button='left')
    page.wait_for_timeout(150)
    after_shot = actor(page)
    tap(page, 'r', 'KeyR')
    wait(page, f'id=>window.{debug(page)}.getState().state.players[id].reloadTicks>0', snapshot(page)['playerId'])
    screenshot(page, name + '-reload')
    wait(page, f'id=>window.{debug(page)}.getState().state.players[id].reloadTicks===0', snapshot(page)['playerId'], timeout=7000)
    after_reload = actor(page)
    assert after_reload['ammo'] > after_shot['ammo'] and after_reload['reserve'] < after_shot['reserve']
    return {'native_shot_ammo_spent': before['ammo'] - after_shot['ammo'], 'native_reload_transferred_finite_reserve': True,
            'event_id_before': event_id, 'ammo_after': after_reload['ammo'], 'reserve_after': after_reload['reserve']}


def near_cover(page, arena, name):
    aim(page, math.pi, -.06)
    enter(page)
    key = 'z' if page.locator('select[data-keyboard-layout]').input_value() == 'zqsd' else 'w'
    native.cdp_key(page, key, 'KeyW')
    try:
        wait(page, f'z=>window.{debug(page)}.getState().state.players[0].z>=z', arena['bounds']['maxZ'] - .36, timeout=3500)
    finally:
        native.cdp_key(page, key, 'KeyW', 'keyUp')
    page.wait_for_timeout(100)
    body = actor(page)
    assert abs(body['z'] - (arena['bounds']['maxZ'] - body['radius'])) < .035, ('Native contact did not stop at the real wall', body)
    fixture.finite(page, arena)
    screenshot(page, name + '-wall-hip')
    aimed = ads(page, name + '-wall')
    return {'native_body_stopped_at_drawn_boundary': {key: body[key] for key in ('x', 'y', 'z', 'radius')},
            'native_near_wall_ads': aimed}


def remote_operative(pages, arena):
    host, peer = pages
    body = actor(host)
    frozen_host = royale.freeze(host)
    try:
        navigator = royale.Navigator(arena)
        targets = [(body['x'], body['z'] - 4), (body['x'] + 4, body['z']), (body['x'] - 4, body['z'])]
        target = next(point for point in targets if navigator.free(*point) and navigator.segment((body['x'], body['z']), point))
        route = fixture.route_to(peer, arena, *target)
    finally:
        royale.thaw(frozen_host)
    wait(host, f'([id,x,z])=>{{const p=window.{debug(host)}.getState().state.players[id];return Math.hypot(p.x-x,p.z-z)<.4}}', [snapshot(peer)['playerId'], *target])
    opponent, viewer = actor(peer), actor(host)
    yaw = math.atan2(opponent['x'] - viewer['x'], -(opponent['z'] - viewer['z']))
    aim(host, yaw, math.atan2(opponent['y'] + .94 - viewer['y'] - 1.62, native.horizontal_distance(viewer, opponent)))
    screenshot(host, 'voxel-assets-operative-back')
    # The final route yaw faces away after its fine-position correction.
    # Turn the real peer through native mouse look to show its front kit.
    aim(peer, math.atan2(viewer['x'] - opponent['x'], -(viewer['z'] - opponent['z'])), 0)
    peer_yaw = actor(peer)['yaw']
    wait(host, f'([id,yaw])=>Math.abs(Math.atan2(Math.sin(window.{debug(host)}.getState().state.players[id].yaw-yaw),Math.cos(window.{debug(host)}.getState().state.players[id].yaw-yaw)))<.02', [snapshot(peer)['playerId'], peer_yaw])
    enter(host)
    screenshot(host, 'voxel-assets-operative-standing')
    enter(peer)
    native.cdp_key(peer, 'Control', 'ControlLeft')
    try:
        wait(host, f'id=>window.{debug(host)}.getState().state.players[id].crouching', snapshot(peer)['playerId'])
        screenshot(host, 'voxel-assets-operative-crouched')
    finally:
        native.cdp_key(peer, 'Control', 'ControlLeft', 'keyUp')
    wait(host, f'id=>!window.{debug(host)}.getState().state.players[id].crouching', snapshot(peer)['playerId'])
    # Confirm the visual body remains the authoritative body hitbox.
    opponent, viewer = actor(peer), actor(host)
    aim(host, yaw, math.atan2(opponent['y'] + 1 - viewer['y'] - 1.62, native.horizontal_distance(viewer, opponent)))
    before = opponent['hp']
    event_id = snapshot(host)['state']['eventId']
    host.mouse.down(button='left')
    host.wait_for_timeout(30)
    host.mouse.up(button='left')
    wait(host, f'([id,event])=>window.{debug(host)}.getState().state.events.some(e=>e.id>event&&e.type==="damage"&&e.targetId===id)', [snapshot(peer)['playerId'], event_id])
    event = next(event for event in snapshot(host)['state']['events'] if event['id'] > event_id and event['type'] == 'damage' and event['targetId'] == snapshot(peer)['playerId'])
    assert event['hitKind'] == 'body' and event['damage'] == 28, event
    wait(peer, f'([id,hp])=>window.{debug(peer)}.getState().state.players[id].hp===hp', [snapshot(peer)['playerId'], before - 28])
    screenshot(host, 'voxel-assets-operative-body-contact')
    return {'real_peer_native_ground_route': route, 'native_standing_and_crouched_operative': True, 'native_authoritative_body_damage': event}


def breach_case(browser, weapon):
    contexts, pages, arena = room(browser, 'breach', 'paris', weapon)
    details = {'game': 'voxel-breach', 'map': 'paris', 'weapon': weapon}
    frozen = None
    try:
        details['start'] = begin(pages, 'breach')
        frozen = royale.freeze(pages[1])
        aim(pages[0], -.25, .02)
        screenshot(pages[0], 'voxel-assets-' + weapon + '-hip')
        details['ads'] = ads(pages[0], 'voxel-assets-' + weapon)
        details['reload'] = discharge_and_reload(pages[0], 'voxel-assets-' + weapon)
        details['wall_clipping'] = near_cover(pages[0], arena, 'voxel-assets-' + weapon)
        if weapon == 'carbine':
            # Return from physical wall contact into the conservative .43 m
            # navigation clearance using real movement before planning paths.
            fixture.move(pages[0], actor(pages[0])['x'], arena['bounds']['maxZ'] - 1.5, arena)
            royale.thaw(frozen)
            frozen = None
            details['operative'] = remote_operative(pages, arena)
            frozen = royale.freeze(pages[1])
            cafe = next(building for building in arena['buildings'] if building['id'] == 'paris-cafe')
            doorway = cafe['doorways'][1]
            details['native_paris_interior'] = fixture.route_to(pages[0], arena, doorway['inside']['x'], doorway['inside']['z'])
            aim(pages[0], 0, -.08)
            screenshot(pages[0], 'voxel-assets-paris-interior')
        details['performance'] = performance(pages[0], arena)
        royale.thaw(frozen)
        frozen = None
        wait(pages[1], f'weapon=>window.{debug(pages[1])}.getState().state.players[0].weapon===weapon', weapon)
        assert snapshot(pages[1])['graphicsError'] == ''
        REPORT['cases'].append(details)
        log('native-weapon-assets-pass', weapon=weapon, renderer=details['performance']['renderer'])
    except BaseException as error:
        if frozen:
            royale.thaw(frozen)
            frozen = None
        failure(pages, 'breach-' + weapon, details, error)
        raise
    finally:
        if frozen:
            royale.thaw(frozen)
        for context in contexts:
            context.close()


def breach_world_case(browser):
    # A separate genuine round leaves the complete roof route inside the
    # normal 100-second match clock; no simulation values are extended.
    contexts, pages, arena = room(browser, 'breach', 'paris', 'carbine')
    details = {'fresh_native_room': True}
    frozen = None
    try:
        details['start'] = begin(pages, 'breach')
        frozen = royale.freeze(pages[1])
        details['climb'] = fixture.climb(pages[0], arena, next(route for route in arena['routes'] if route['id'] == 'paris-cafe-outer'))
        body = actor(pages[0])
        for label, target in [('paris-rooftops', {'x': 14, 'y': 3, 'z': 5}), ('paris-bus', {'x': 0, 'y': 2, 'z': 0}), ('paris-landmark', {'x': -9, 'y': 16, 'z': arena['bounds']['minZ'] - 24})]:
            distance = math.hypot(target['x'] - body['x'], target['z'] - body['z'])
            aim(pages[0], math.atan2(target['x'] - body['x'], -(target['z'] - body['z'])), math.atan2(target['y'] - body['y'] - 1.62, distance))
            screenshot(pages[0], 'voxel-assets-' + label)
        details['responsive'] = responsive(pages[0], 'breach', 'voxel-assets-breach')
        details['performance'] = performance(pages[0], arena)
        assert snapshot(pages[0])['state']['phase'] == 'fight'
        royale.thaw(frozen)
        frozen = None
        wait(pages[1], f'height=>Math.abs(window.{debug(pages[1])}.getState().state.players[0].y-height)<.001', body['y'])
        carbine = next(case for case in REPORT['cases'] if case.get('weapon') == 'carbine')
        carbine['fresh_world_room'] = details
        log('native-paris-world-assets-pass', renderer=details['performance']['renderer'])
    except BaseException as error:
        if frozen:
            royale.thaw(frozen)
            frozen = None
        failure(pages, 'breach-world', details, error)
        raise
    finally:
        if frozen:
            royale.thaw(frozen)
        for context in contexts:
            context.close()


def knife_cut(page, map_id):
    event_id = snapshot(page)['state']['eventId']
    page.mouse.down(button='left')
    try:
        wait(page, f'([id,event])=>window.{debug(page)}.getState().state.events.some(e=>e.id>event&&e.type==="meleeStart"&&e.playerId===id)', [snapshot(page)['playerId'], event_id])
        screenshot(page, 'voxel-assets-royale-' + map_id + '-knife-cut')
        page.wait_for_timeout(550)
    finally:
        page.mouse.up(button='left')
    wait(page, f'id=>window.{debug(page)}.getState().state.players[id].meleeTicks===0', snapshot(page)['playerId'])
    events = [event for event in snapshot(page)['state']['events'] if event['id'] > event_id and event['type'] == 'meleeStart' and event['playerId'] == snapshot(page)['playerId']]
    assert len(events) == 1, ('Holding knife cut repeated the attack', events)
    return {'native_lmb_small_knife_cut': events[0], 'held_press_did_not_repeat': True}


def pickup(page, arena, chosen, planned):
    # Preserve the real route but stop one metre before a cache when its last
    # straight segment permits it, so the ground asset fills a useful view.
    visual_route = list(planned)
    if visual_route:
        prior = visual_route[-2] if len(visual_route) > 1 else (actor(page)['x'], actor(page)['z'])
        end = visual_route[-1]
        length = math.dist(prior, end)
        if length > 2:
            visual_route[-1] = (end[0] + (prior[0] - end[0]) / length, end[1] + (prior[1] - end[1]) / length)
    for point in visual_route:
        fixture.move(page, *point, arena)
    nearest = royale.nearby(page)
    assert nearest and nearest['id'] == chosen['id'], (chosen, nearest)
    wait(page, '!document.querySelector("#loot-prompt").hidden')
    # Look down using genuine mouse motion at the physically reached cache.
    body = actor(page)
    dx, dz = chosen['x'] - body['x'], chosen['z'] - body['z']
    distance = math.hypot(dx, dz)
    look_yaw = actor(page)['yaw'] if distance < .25 else math.atan2(dx, -dz)
    aim(page, look_yaw, math.atan2(chosen['y'] + .35 - body['y'] - 1.62, max(.45, distance)))
    screenshot(page, 'voxel-assets-royale-' + arena['id'] + '-' + chosen['kind'] + '-pickup')
    before, event_id = actor(page), snapshot(page)['state']['eventId']
    tap(page, 'e', 'KeyE')
    wait(page, f'([id,event])=>window.{debug(page)}.getState().state.events.some(e=>e.id>event&&e.type==="lootPickup"&&e.playerId===id)', [snapshot(page)['playerId'], event_id])
    event = next(event for event in snapshot(page)['state']['events'] if event['id'] > event_id and event['type'] == 'lootPickup' and event['playerId'] == snapshot(page)['playerId'])
    after = actor(page)
    assert event['lootId'] == chosen['id'] and not any(item['id'] == chosen['id'] for item in snapshot(page)['state']['loot'])
    if chosen['kind'] == 'weapon':
        assert after['hasGun'] and after['weapon'] == chosen['weapon'] and after['slot'] == 'primary'
    elif chosen['kind'] == 'heal':
        assert after['potions'] == before['potions'] + chosen['amount']
    elif chosen['kind'] == 'ammo':
        assert after['reserve'] > before['reserve'], (chosen, before, after)
    royale.CALIBRATION.pop(id(page), None)
    return {'actual_loot': chosen, 'native_ground_route': visual_route, 'fresh_native_e_pickup': event}


def supplies(page, arena):
    navigator = royale.Navigator(arena)
    proofs = []
    body, loot = actor(page), snapshot(page)['state']['loot']
    guns = [item for item in loot if item['y'] == 0 and item['kind'] == 'weapon' and navigator.free(item['x'], item['z'])]
    ammo = [item for item in loot if item['y'] == 0 and item['kind'] == 'ammo' and navigator.free(item['x'], item['z'])]
    # Ammunition is genuinely weapon-specific. Choose an observed compatible
    # pair, then walk both paths; random caches must never be manufactured.
    pairs = [(gun, rounds) for gun in guns for rounds in ammo if gun['weapon'] == rounds.get('weapon')]
    pairs.sort(key=lambda pair: math.hypot(pair[0]['x'] - body['x'], pair[0]['z'] - body['z'])
               + math.hypot(pair[0]['x'] - pair[1]['x'], pair[0]['z'] - pair[1]['z']))
    assert pairs, ('No matching ground gun/ammunition', loot)
    chosen_pair, route = None, None
    for pair in pairs:
        try:
            route = navigator.route((body['x'], body['z']), (pair[0]['x'], pair[0]['z']))
            navigator.route((pair[0]['x'], pair[0]['z']), (pair[1]['x'], pair[1]['z']))
            chosen_pair = pair
            break
        except AssertionError:
            continue
    assert chosen_pair, ('No connected compatible gun/ammunition pair', pairs)
    gun, rounds = chosen_pair
    proofs.append(pickup(page, arena, gun, route))
    body = actor(page)
    heals = sorted((item for item in snapshot(page)['state']['loot'] if item['y'] == 0 and item['kind'] == 'heal'
                   and navigator.free(item['x'], item['z'])),
                   key=lambda item: math.hypot(item['x'] - body['x'], item['z'] - body['z']))
    assert heals, ('No ground healing supplies', snapshot(page)['state']['loot'])
    heal = heals[0]
    route = navigator.route((body['x'], body['z']), (heal['x'], heal['z']))
    proofs.append(pickup(page, arena, heal, route))
    body = actor(page)
    route = navigator.route((body['x'], body['z']), (rounds['x'], rounds['z']))
    proofs.append(pickup(page, arena, rounds, route))
    assert actor(page)['hasGun'] and actor(page)['potions'] > 0 and actor(page)['reserve'] > 0
    tap(page, 'v', 'KeyV')
    wait(page, f'id=>window.{debug(page)}.getState().state.players[id].slot==="sword"', snapshot(page)['playerId'])
    screenshot(page, 'voxel-assets-royale-' + arena['id'] + '-knife-after-scavenge')
    tap(page, 'v', 'KeyV')
    wait(page, f'id=>window.{debug(page)}.getState().state.players[id].slot==="primary"', snapshot(page)['playerId'])
    aim(page, 0, 0)
    screenshot(page, 'voxel-assets-royale-' + arena['id'] + '-scavenged-gun')
    return {'native_ground_weapon_heal_matching_ammo': proofs, 'native_v_knife_and_gun': True}


def royale_case(browser, map_id):
    contexts, pages, arena = room(browser, 'royale', map_id)
    details = {'game': 'voxel-royale', 'map': map_id}
    frozen = None
    try:
        details['start'] = begin(pages, 'royale')
        frozen = royale.freeze(pages[1])
        aim(pages[0], actor(pages[0])['yaw'], -.06)
        screenshot(pages[0], 'voxel-assets-royale-' + map_id + '-world-knife')
        details['knife'] = knife_cut(pages[0], map_id)
        if map_id == 'forest':
            details['supplies'] = supplies(pages[0], arena)
            details['ads'] = ads(pages[0], 'voxel-assets-royale-forest-scavenged')
            details['responsive'] = responsive(pages[0], 'royale', 'voxel-assets-royale-forest')
        details['performance'] = performance(pages[0], arena)
        body = actor(pages[0])
        royale.thaw(frozen)
        frozen = None
        wait(pages[1], f'([weapon,gun])=>{{const p=window.{debug(pages[1])}.getState().state.players[0];return p.weapon===weapon&&p.hasGun===gun}}', [body['weapon'], body['hasGun']])
        assert pages[0].locator('#map-plan .map-player').count() == 0, 'Royale minimap exposed enemies'
        assert snapshot(pages[1])['graphicsError'] == ''
        REPORT['cases'].append(details)
        log('native-royale-assets-pass', map=map_id, renderer=details['performance']['renderer'])
    except BaseException as error:
        if frozen:
            royale.thaw(frozen)
            frozen = None
        failure(pages, 'royale-' + map_id, details, error)
        raise
    finally:
        if frozen:
            royale.thaw(frozen)
        for context in contexts:
            context.close()


def failure(pages, case, details, error):
    seen = {'case': case, 'error': str(error), 'details': details, 'pages': []}
    for index, page in enumerate(pages):
        try:
            seen['pages'].append({'index': index, 'url': page.url, 'snapshot': snapshot(page), 'transport': page.evaluate('window.__voxelQA')})
            screenshot(page, 'failure-assets-' + case + '-' + str(index))
        except Exception as observation_error:
            seen['pages'].append({'index': index, 'observation_error': str(observation_error)})
    (OUT / ('failure-' + case + '.json')).write_text(json.dumps(seen, indent=2))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    selected = set(filter(None, os.environ.get('SEMAG_ASSET_CASES', '').split(',')))
    if selected and os.environ.get('SEMAG_ASSET_APPEND') == '1' and (OUT / 'report.json').exists():
        previous = json.loads((OUT / 'report.json').read_text())
        assert previous.get('renderer_sha256') == REPORT['renderer_sha256'], 'Cannot merge native proof from a different renderer source'
        REPORT['cases'] = [case for case in previous['cases'] if (case.get('weapon') or case['map']) not in selected]
        REPORT['screenshots'] = previous['screenshots']
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                args=['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            try:
                for weapon in WEAPONS:
                    if not selected or weapon in selected:
                        breach_case(browser, weapon)
                        if weapon == 'carbine':
                            breach_world_case(browser)
                for theme in THEMES:
                    if not selected or theme in selected:
                        royale_case(browser, theme)
            finally:
                browser.close()
    finally:
        (OUT / 'report.json').write_text(json.dumps(REPORT, indent=2))
    assert not REPORT['errors'], ('Browser errors', REPORT['errors'])
    assert not REPORT['failed_resources'], ('Failed resources', REPORT['failed_resources'])
    print(json.dumps({'status': 'passed', 'native_cases': len(REPORT['cases']), 'report': str(OUT / 'report.json')}, indent=2))


if __name__ == '__main__':
    main()
