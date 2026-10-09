"""Trusted native browser checks for the shared human voxel player assets.

python test/voxel-human-browser-smoke.py http://127.0.0.1:3111
SEMAG_HUMAN_CASES selects breach,breachposes,royale,horde,lifecycle. SEMAG_SCREENSHOT_DIR
selects artifacts. Real Semag rooms and native keyboard/mouse input exercise
teammate walking, running, crouching, jumping and weapon handling. Product
snapshots and pure map geometry are copied read only. No game state, input
handler, WebSocket, clock or animation frame is replaced. The lifecycle case
uses the real WebGL context-loss extension as a separate graphics fault.
The two passive Breach opponents are natively lifecycle-suspended after their
real ready gate; the viewer and its moving teammate remain live throughout.
Breach's viewer and teammate use independent Chromium instances, each with
one active game page, to model colleagues on separate PCs.
Software WebGL timings are not hardware frame-rate measurements.
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
from browser_controls import click_control, controls_panel

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', '/workspace/scratch/semag-human-native'))
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3111').rstrip('/')
REPORT = {'cases': [], 'failures': [], 'errors': [], 'failed_resources': [],
          'screenshots': [], 'videos': [], 'working_bytes': [],
          'input_policy': 'Trusted browser input; copied snapshots and pure geometry; no game/WS/RAF/clock replacement',
          'passive_page_policy': 'Only idle Breach opponents use native Page.setWebLifecycleState frozen after actual Ready; real viewer and teammate remain live',
          'graphics_fault_policy': 'Only the real WEBGL_lose_context extension in the separate lifecycle case'}
MODES = {
    'breach': {'debug': 'SemagVoxel', 'game': 'voxel-breach', 'path': 'voxel.html', 'map': '/voxel-maps.js',
               'select': '#voxel-map', 'create': '#voxel-create', 'canvas': '#arena', 'view': '#viewport'},
    'royale': {'debug': 'SemagRoyale', 'game': 'voxel-royale', 'path': 'voxel-royale.html', 'map': '/voxel-royale-maps.js',
               'select': '#royale-map', 'create': '#royale-create', 'canvas': '#arena', 'view': '#viewport'},
    'horde': {'debug': 'semagHorde', 'game': 'voxel-horde', 'path': 'voxel-horde.html', 'map': '/voxel-maps.js',
              'select': '#horde-map', 'create': '[data-horde-submit]', 'canvas': '#horde-canvas', 'view': '#horde-shell'},
}
MODE_BY_PAGE = {}
CALIBRATION = {}
VIDEO_START = {}
OWN_BROWSERS = {}
LAUNCH = {'executable_path': '/usr/bin/chromium', 'headless': True,
          'args': ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']}
spec = importlib.util.spec_from_file_location('human_native_royale_geometry', ROOT / 'test' / 'voxel-royale-browser-smoke.py')
geometry = importlib.util.module_from_spec(spec)
spec.loader.exec_module(geometry)
Navigator = geometry.Navigator


def log(stage, **details):
    print(json.dumps({'stage': stage, **details}), flush=True)


def save_report():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'report.json').write_text(json.dumps(REPORT, indent=2))


def freeze(stage):
    paths = [ROOT / 'server.js', ROOT / 'package.json', Path(__file__).resolve()]
    paths += sorted((ROOT / 'public').glob('voxel*'))
    hashes = {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
              for path in paths if path.is_file()}
    previous = REPORT['working_bytes'][-1]['sha256'] if REPORT['working_bytes'] else {}
    manifest = {'stage': stage, 'sha256': hashes,
                'changed_since_previous': [name for name in hashes if previous and previous.get(name) != hashes[name]]}
    REPORT['working_bytes'].append(manifest)
    (OUT / ('working-bytes-' + stage + '.json')).write_text(json.dumps(manifest, indent=2))
    save_report()
    return manifest


def config(page):
    return MODES[MODE_BY_PAGE[id(page)]]


def debug(page):
    return config(page)['debug']


def snapshot(page):
    return page.evaluate('window.' + debug(page) + '.getState()')


def actor(page, ident=None):
    seen = snapshot(page)
    return next(player for player in seen['state']['players']
                if player['id'] == (seen['playerId'] if ident is None else ident))


def wait(page, expression, arg=None, timeout=12000):
    return page.wait_for_function(expression, arg=arg, polling=25, timeout=timeout)


def phase(page, wanted, timeout=22000):
    return wait(page, 'value=>window.' + debug(page) + '.getState().state.phase===value', wanted, timeout)


def connected(page):
    wait(page, 'window.' + debug(page) + '?.getState().connected && Number.isInteger(window.' + debug(page) + '.getState().playerId) && window.' + debug(page) + '.getState().state && window.' + debug(page) + '.getState().renderCount>0', timeout=22000)
    seen = snapshot(page)
    assert not seen['graphicsError'], seen['graphicsError']
    return seen['playerId']


def observe(page, tag):
    page.on('pageerror', lambda error: REPORT['errors'].append(f'{tag}: {error}'))
    page.on('console', lambda message: REPORT['errors'].append(f'{tag}: {message.text}') if message.type == 'error' else None)
    page.on('response', lambda response: REPORT['failed_resources'].append(f'{tag}: {response.status} {response.url}') if response.status >= 400 else None)


def new_context(browser, mode, index, video=False):
    kwargs = {'viewport': {'width': 1280 if index == 0 else 320, 'height': 850 if index == 0 else 500},
              'device_scale_factor': .75 if index == 0 and video else 1 if index == 0 else .35}
    if video:
        kwargs.update(record_video_dir=str(OUT / 'raw-video'), record_video_size={'width': 1280, 'height': 850})
    ctx = browser.new_context(**kwargs)
    page = ctx.new_page()
    if video:
        VIDEO_START[id(page)] = time.monotonic()
    MODE_BY_PAGE[id(page)] = mode
    observe(page, f'{mode}/{index}')
    return ctx, page


def select(page, selector, value):
    with controls_panel(page, selector):
        picker = page.locator(selector)
        values = picker.locator('option').evaluate_all('nodes=>nodes.map(node=>node.value)')
        assert value in values, (selector, value, values)
        picker.click()
        page.keyboard.press('Home')
        for _ in range(values.index(value)):
            page.keyboard.press('ArrowDown')
        page.keyboard.press('Enter')
        assert picker.input_value() == value


def screenshot(page, name):
    path = OUT / (name + '.png')
    box = page.locator(config(page)['view']).bounding_box()
    assert box
    page.screenshot(path=str(path), clip=box, timeout=5000)
    REPORT['screenshots'].append(str(path))
    log('native-frame', name=name, path=str(path))
    save_report()
    return str(path)


def enter(page):
    if MODE_BY_PAGE[id(page)] == 'horde':
        button = page.locator('#horde-resume')
        if not button.is_visible():
            button = page.locator('#horde-enter')
    else:
        button = page.locator('#enter-arena')
    if button.is_visible():
        button.click()
    wait(page, '''()=>{const s=window.''' + debug(page) + '''.getState(),c=s.controls;
      return !s.paused&&!c.paused&&c.entered&&(c.pointerLocked||c.fallback||c.touch);}''')
    page.locator(config(page)['canvas']).focus()


def input_aim(page):
    seen = snapshot(page)
    return seen['aim'] if MODE_BY_PAGE[id(page)] == 'horde' else seen['input']


def aim_multiplier(page):
    client = '/voxel-royale-client.js' if MODE_BY_PAGE[id(page)] == 'royale' else '/voxel-client.js'
    return page.evaluate('''async([client,name])=>{const {aimLookMultiplier}=await import(client),{ADS}=await import('/voxel-engine.js');
      const s=window[name].getState();return aimLookMultiplier(s.presentationPlayer||s.state.players.find(p=>p.id===s.playerId),ADS);}''', [client, debug(page)])


def angle_delta(wanted, actual):
    return math.atan2(math.sin(wanted - actual), math.cos(wanted - actual))


def mouse_look(page, dx, dy):
    box = page.locator(config(page)['canvas']).bounding_box()
    assert box
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    page.mouse.move(x, y)
    before = input_aim(page)
    locked = snapshot(page)['controls']['pointerLocked']
    if not locked:
        page.mouse.down(button='right')
    page.mouse.move(x + dx, y + dy, steps=1)
    if not locked:
        page.mouse.up(button='right')
    return before, input_aim(page)


def aim(page, yaw, pitch=0):
    enter(page)
    if id(page) not in CALIBRATION:
        multiplier = aim_multiplier(page)
        before, after = mouse_look(page, 40, 30)
        sx = angle_delta(after['yaw'], before['yaw']) / 40 / multiplier
        sy = (after['pitch'] - before['pitch']) / 30 / multiplier
        assert abs(sx) > .0001 and abs(sy) > .0001, (before, after)
        CALIBRATION[id(page)] = (sx, sy)
    sx, sy = CALIBRATION[id(page)]
    box = page.locator(config(page)['canvas']).bounding_box()
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    page.mouse.move(x, y)
    for _ in range(20):
        current = input_aim(page)
        dyaw, dpitch = angle_delta(yaw, current['yaw']), pitch - current['pitch']
        if abs(dyaw) < .004 and abs(dpitch) < .004:
            break
        multiplier = aim_multiplier(page)
        dx = max(-box['width'] * .34, min(box['width'] * .34, dyaw / sx / multiplier))
        dy = max(-box['height'] * .34, min(box['height'] * .34, dpitch / sy / multiplier))
        locked = snapshot(page)['controls']['pointerLocked']
        if not locked:
            x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
            page.mouse.move(x, y)
            page.mouse.down(button='right')
        page.mouse.move(x + dx, y + dy, steps=1)
        x, y = x + dx, y + dy
        if not locked:
            page.mouse.up(button='right')
    current = input_aim(page)
    assert abs(angle_delta(yaw, current['yaw'])) < .012 and abs(pitch - current['pitch']) < .012, (yaw, pitch, current)
    page.wait_for_timeout(75)


def face(viewer, peer, torso=True):
    origin, target = actor(viewer), actor(peer)
    height = .97 if torso else 1.55
    aim(viewer, math.atan2(target['x'] - origin['x'], -(target['z'] - origin['z'])),
        math.atan2(target['y'] + height - origin['y'] - 1.62,
                   math.hypot(target['x'] - origin['x'], target['z'] - origin['z'])))


def make_room(browser, mode, count=2, map_id='paris', video=False):
    contexts, pages = [], []
    additional_browsers = []
    try:
        for index in range(count):
            participant_browser = browser
            if mode == 'breach' and index == 1:
                participant_browser = browser.browser_type.launch(**LAUNCH)
                additional_browsers.append(participant_browser)
            ctx, page = new_context(participant_browser, mode, index, video and index == 0)
            if participant_browser is not browser:
                OWN_BROWSERS[id(page)] = participant_browser
            contexts.append(ctx)
            pages.append(page)
        host = pages[0]
        host.goto(URL)
        wait(host, 'document.querySelector("#host-status").textContent==="Host is online"')
        host.locator('[data-create-game="' + config(host)['game'] + '"]').click()
        select(host, config(host)['select'], map_id)
        if mode == 'breach':
            host.locator('#voxel-setup [name=teamSize][value="2"]').check()
        elif mode == 'royale':
            select(host, '#royale-capacity', '10')
        host.locator(config(host)['create']).click()
        host.wait_for_url('**/' + config(host)['path'] + '?room=*')
        connected(host)
        for peer in pages[1:]:
            peer.goto(host.url)
            connected(peer)
        wait(host, 'n=>{const s=window.' + debug(host) + '.getState();return (s.players||s.roomPlayers||[]).filter(p=>p?.connected).length===n;}', count)
        ids = [snapshot(page)['playerId'] for page in pages]
        assert len(set(ids)) == count, ('Room assigned duplicate participant seats', ids)
        arena = host.evaluate('async([url,mapId])=>(await import(url)).MAPS[mapId]', [config(host)['map'], map_id])
        assert all(snapshot(page)['state']['phase'] == 'lobby' for page in pages)
        log('native-room-created', mode=mode, room=host.url, players=ids)
        return contexts, pages, arena
    except BaseException:
        for ctx in contexts:
            ctx.close()
        for extra in additional_browsers:
            extra.close()
        raise


def begin(pages):
    host, mode = pages[0], MODE_BY_PAGE[id(pages[0])]
    if mode == 'breach':
        for page in pages[:-1]:
            click_control(page, '#ready-button')
            phase(host, 'lobby')
        click_control(pages[-1], '#ready-button')
    elif mode == 'royale':
        assert pages[1].locator('#start-button').is_disabled()
        host.locator('#overlay-start').click()
    else:
        for page in pages:
            page.locator('#horde-ready').click()
        phase(host, 'lobby')
        host.locator('#horde-start').click()
    phase(host, 'fight', timeout=25000)
    for page in pages:
        phase(page, 'fight')
    log('native-match-fighting', mode=mode, tick=snapshot(host)['state']['tick'])
    return {'native_room': host.url, 'player_ids': [snapshot(page)['playerId'] for page in pages],
            'explicit_ready_start': True}


def human_stats(page):
    stats = snapshot(page)['renderStats']
    assert stats and stats['drawCalls'] <= 7 and stats['dynamicVertices'] <= 72000, stats
    result = stats.get('humanAnimation')
    assert result is not None, ('Human pose diagnostics missing', stats)
    return result


def pose(page, ident):
    stats = human_stats(page)
    poses = stats.get('poses', [])
    if isinstance(poses, dict):
        return poses.get(str(ident), poses.get(ident))
    return next((item for item in poses if item.get('id') == ident), None)


def human_sample(page, ident):
    """One copied product snapshot keeps the body, pose and frame coherent."""
    result = page.evaluate('''([name,id])=>{const s=window[name].getState(),stats=s.renderStats;
      return {body:s.state.players.find(p=>p.id===id), presented:s.presentationPlayers?.find(p=>p.id===id),
        human:stats.humanAnimation,renderCount:s.renderCount,drawCalls:stats.drawCalls,dynamicVertices:stats.dynamicVertices,
        visibility:{state:document.visibilityState,hidden:document.hidden,focused:document.hasFocus()}};}''',
                           [debug(page), ident])
    result['pose'] = next((item for item in result['human']['poses'] if item['id'] == ident), None)
    assert result['drawCalls'] <= 7 and result['dynamicVertices'] <= 72000
    return result


def sample_movement(viewer, peer, keys, label, duration=.7, capture=False):
    enter(peer)
    enter(viewer)
    start = actor(peer)
    actor_render_before = snapshot(peer)['renderCount']
    actor_visibility = peer.evaluate('({state:document.visibilityState,hidden:document.hidden,focused:document.hasFocus()})')
    assert not actor_visibility['hidden'], ('Moving participant is in a hidden browser page', actor_visibility)
    seen = []
    captured = False
    for key in keys:
        peer.keyboard.down(key)
    try:
        deadline = time.monotonic() + duration
        while time.monotonic() < deadline:
            sample = human_sample(viewer, start['id'])
            sample['time'] = time.monotonic()
            assert not sample['visibility']['hidden'], ('Viewer is in a hidden browser page', sample['visibility'])
            seen.append(sample)
            current_pose = sample['pose']
            feet = current_pose.get('feet', []) if current_pose else []
            foot_lift = abs(feet[0][1] - feet[1][1]) if len(feet) == 2 else 0
            if capture and not captured and foot_lift > (.05 if label.endswith('running') else .025):
                screenshot(viewer, label)
                captured = True
            viewer.wait_for_timeout(40)
    finally:
        for key in reversed(keys):
            peer.keyboard.up(key)
    peer.wait_for_timeout(150)
    end = actor(peer)
    actor_render_after = snapshot(peer)['renderCount']
    distance = math.hypot(end['x'] - start['x'], end['z'] - start['z'])
    assert distance > .35, ('Trusted teammate input did not move', label, start, end)
    assert any(sample['pose'] and sample['pose'].get('speed', 0) > .3 and sample['pose'].get('stride', 0) > .05
               for sample in seen), ('Moving teammate kept idle animation', label, seen)
    phases = [sample['pose'].get('phase') for sample in seen if sample['pose'] and isinstance(sample['pose'].get('phase'), (int, float))]
    assert phases and max(phases) - min(phases) > .12, ('Gait phase did not follow movement', label, seen)
    assert len({sample['renderCount'] for sample in seen}) >= 2, ('Motion was observed in only one rendered frame', label, seen)
    assert actor_render_after >= actor_render_before + 2, ('Moving participant has no fresh rendered frames', actor_render_before, actor_render_after)
    assert not capture or captured, ('No visibly raised foot during real teammate movement', label, seen)
    return {'native_horizontal_distance': distance, 'start': start, 'finish': end, 'samples': seen,
            'actor_visibility': actor_visibility, 'actor_render_counts': [actor_render_before, actor_render_after]}


def move_to(page, arena, x, z):
    navigator = Navigator(arena)
    body = actor(page)
    route = navigator.route((body['x'], body['z']), (x, z))
    for tx, tz in route:
        body = actor(page)
        distance = math.hypot(tx - body['x'], tz - body['z'])
        if distance < .3:
            continue
        aim(page, math.atan2(tx - body['x'], -(tz - body['z'])))
        page.keyboard.down('Shift')
        page.keyboard.down('w')
        try:
            wait(page, '''([id,x,z,dx,dz])=>{const p=window.''' + debug(page) + '''.getState().state.players.find(p=>p.id===id);
              return (x-p.x)*dx+(z-p.z)*dz<.13;}''',
                 [body['id'], tx, tz, (tx-body['x']) / distance, (tz-body['z']) / distance], timeout=int((distance / 2 + 4) * 1000))
        finally:
            page.keyboard.up('w')
            page.keyboard.up('Shift')
    body = actor(page)
    assert math.hypot(body['x'] - x, body['z'] - z) < .5, (x, z, body)
    return route


def close_contexts(contexts, pages, mode):
    if sys.exc_info()[0] is not None:
        for index, page in enumerate(pages):
            if page.is_closed():
                continue
            try:
                (OUT / f'{mode}-failure-{index}.json').write_text(json.dumps(snapshot(page), indent=2))
                screenshot(page, f'{mode}-failure-{index}')
            except Exception as error:
                log('failure-evidence-unavailable', mode=mode, error=str(error))
    video = pages[0].video if pages else None
    for ctx in contexts:
        ctx.close()
    for page in pages:
        extra = OWN_BROWSERS.pop(id(page), None)
        if extra:
            extra.close()
    if video:
        target = OUT / (mode + '-human-walking.webm')
        video.save_as(str(target))
        REPORT['videos'].append(str(target))
        save_report()


def breach_case(browser, movement=True):
    contexts, pages, arena = make_room(browser, 'breach', count=4, video=movement)
    result = {}
    suspended = []
    try:
        result['start'] = begin(pages)
        viewer = pages[0]
        peer = next(page for page in pages[1:] if actor(page)['team'] == actor(viewer)['team'])
        assert id(peer) in OWN_BROWSERS, 'The visible teammate must have its own browser instance'
        result['independent_active_browser_instances'] = True
        result['same_team_ids'] = [actor(viewer)['id'], actor(peer)['id']]
        result['native_suspended_opponent_ids'] = []
        for opponent in pages:
            if opponent is viewer or opponent is peer:
                continue
            result['native_suspended_opponent_ids'].append(actor(opponent)['id'])
            session = opponent.context.new_cdp_session(opponent)
            session.send('Page.setWebLifecycleState', {'state': 'frozen'})
            suspended.append(session)
        anchor = actor(peer)
        navigator = Navigator(arena)
        assert navigator.segment((anchor['x'], anchor['z']), (anchor['x']+5, anchor['z'])), ('Native gait route blocked', anchor)
        face(peer, viewer, torso=False)
        face(viewer, peer)
        viewer.wait_for_timeout(350)
        if movement:
            result['video_human_section_start_seconds'] = time.monotonic() - VIDEO_START[id(viewer)]
        result['idle_start'] = pose(viewer, anchor['id'])
        screenshot(viewer, 'human-paris-teammate-standing')
        face(viewer, peer, torso=False)
        screenshot(viewer, 'human-paris-teammate-face')
        face(viewer, peer)
        viewer.wait_for_timeout(200)
        result['idle_end'] = pose(viewer, anchor['id'])
        assert result['idle_start'] and result['idle_end']
        assert abs(result['idle_end']['phase'] - result['idle_start']['phase']) < .04, ('Idle player marched in place', result)
        if movement:
            result['walking'] = sample_movement(viewer, peer, ['Shift', 's'], 'human-paris-teammate-walking', duration=1.45, capture=True)
            result['return_after_walk'] = move_to(peer, arena, anchor['x'], anchor['z'])
            face(peer, viewer, torso=False)
            face(viewer, peer)
            result['running'] = sample_movement(viewer, peer, ['s'], 'human-paris-teammate-running', duration=.7, capture=True)
            result['return_after_run'] = move_to(peer, arena, anchor['x'], anchor['z'])
            face(peer, viewer, torso=False)
            face(viewer, peer)
        enter(peer)
        enter(viewer)
        peer.keyboard.down('Control')
        try:
            wait(viewer, 'id=>window.SemagVoxel.getState().state.players.find(p=>p.id===id).crouching', anchor['id'])
            wait(viewer, 'id=>window.SemagVoxel.getState().renderStats.humanAnimation.poses.find(p=>p.id===id)?.crouch>.8', anchor['id'])
            result['crouched'] = pose(viewer, anchor['id'])
            assert result['crouched'].get('crouch', 0) > .8, result['crouched']
            screenshot(viewer, 'human-paris-teammate-crouching')
        finally:
            peer.keyboard.up('Control')
        wait(viewer, 'id=>!window.SemagVoxel.getState().state.players.find(p=>p.id===id).crouching', anchor['id'])
        wait(viewer, 'id=>window.SemagVoxel.getState().renderStats.humanAnimation.poses.find(p=>p.id===id)?.crouch<.05', anchor['id'])
        peer.keyboard.down('Space')
        try:
            wait(viewer, 'id=>{const s=window.SemagVoxel.getState(),p=s.state.players.find(p=>p.id===id);return !p.grounded&&p.y>.25&&s.renderStats.humanAnimation.poses.find(p=>p.id===id)?.airborne;}', anchor['id'], timeout=3000)
            result['airborne'] = {'body': actor(viewer, anchor['id']), 'pose': pose(viewer, anchor['id'])}
            screenshot(viewer, 'human-paris-teammate-jumping')
        finally:
            peer.keyboard.up('Space')
        wait(viewer, 'id=>window.SemagVoxel.getState().state.players.find(p=>p.id===id).grounded', anchor['id'], timeout=3500)
        result['landing'] = pose(viewer, anchor['id'])
        peer.mouse.down(button='right')
        try:
            wait(viewer, 'id=>window.SemagVoxel.getState().state.players.find(p=>p.id===id).aimTicks===18', anchor['id'])
            result['aiming'] = pose(viewer, anchor['id'])
            screenshot(viewer, 'human-paris-teammate-aiming')
        finally:
            peer.mouse.up(button='right')
        result['final_stats'] = human_stats(viewer)
        if movement:
            result['video_human_section_end_seconds'] = time.monotonic() - VIDEO_START[id(viewer)]
        result['human_appearances'] = viewer.evaluate('''async()=>{const {humanAppearance}=await import('/voxel-renderer.js');
          return window.SemagVoxel.getState().state.players.map(p=>({id:p.id,appearance:humanAppearance(p)}));}''')
        assert all(person['appearance']['face']['exposed'] for person in result['human_appearances'])
        assert len({person['appearance']['skin'] for person in result['human_appearances']}) >= 3
        return result
    except BaseException:
        REPORT['cases'].append({'name': 'breach-partial' if movement else 'breachposes-partial', 'status': 'partial', **result})
        raise
    finally:
        for session in suspended:
            session.send('Page.setWebLifecycleState', {'state': 'active'})
            session.detach()
        close_contexts(contexts, pages, 'breach')


def shared_case(browser, mode):
    contexts, pages, arena = make_room(browser, mode, map_id='courtyard' if mode == 'horde' else 'forest')
    result = {}
    try:
        result['start'] = begin(pages)
        viewer, peer = pages
        enter(viewer)
        enter(peer)
        if mode == 'royale':
            origin = actor(viewer)
            navigator = Navigator(arena)
            offsets = [(0, -3.8), (3.8, 0), (0, 3.8), (-3.8, 0), (2.7, -2.7), (-2.7, -2.7)]
            target = next((origin['x'] + dx, origin['z'] + dz) for dx, dz in offsets
                          if navigator.segment((origin['x'], origin['z']), (origin['x'] + dx, origin['z'] + dz)))
            result['native_close_peer_route'] = move_to(peer, arena, *target)
            face(peer, viewer, torso=False)
            face(viewer, peer)
            screenshot(viewer, 'royale-human-close-peer')
        body = actor(peer)
        navigator = Navigator(arena)
        directions = [(0,-2), (2,0), (0,2), (-2,0)]
        dx, dz = next((dx,dz) for dx,dz in directions if navigator.segment((body['x'],body['z']), (body['x']+dx,body['z']+dz)))
        aim(peer, math.atan2(dx,-dz))
        if mode == 'horde':
            face(viewer, peer)
        else:
            face(viewer, peer, torso=False)
        result['movement'] = sample_movement(viewer, peer, ['w'], mode + '-human-moving', duration=.35, capture=True)
        result['stats'] = human_stats(viewer)
        assert result['stats'].get('cachedPlayers', 0) >= 2
        screenshot(viewer, mode + '-shared-human-renderer')
        if mode == 'horde':
            viewer.keyboard.press('Escape')
            wait(viewer, 'window.semagHorde.getState().paused')
            tick = snapshot(viewer)['state']['tick']
            wait(viewer, 'tick=>window.semagHorde.getState().state.tick>tick+12', tick)
            enter(viewer)
            result['coop_pause_releases_only_local_controls'] = True
        return result
    finally:
        close_contexts(contexts, pages, mode)


def lifecycle_case(browser):
    ctx, page = new_context(browser, 'horde', 0)
    result = {}
    try:
        page.goto(URL + '/voxel-horde.html?solo=1&map=courtyard')
        connected(page)
        phase(page, 'lobby')
        page.wait_for_timeout(200)
        assert snapshot(page)['state']['phase'] == 'lobby'
        page.locator('#horde-start').click()
        phase(page, 'fight')
        enter(page)
        before = snapshot(page)
        page.keyboard.press('Escape')
        wait(page, 'window.semagHorde.getState().paused && window.semagHorde.getState().state.phase==="paused"')
        paused = snapshot(page)
        page.wait_for_timeout(250)
        assert snapshot(page)['state']['tick'] == paused['state']['tick']
        enter(page)
        wait(page, 'tick=>window.semagHorde.getState().state.tick>tick+12', paused['state']['tick'])
        page.keyboard.press('Escape')
        wait(page, 'window.semagHorde.getState().paused')
        page.locator('#horde-restart').click()
        phase(page, 'countdown')
        restarted = snapshot(page)
        assert restarted['state']['horde']['totalKills'] == 0 and actor(page)['hp'] == 200
        assert restarted['state']['mapId'] == before['state']['mapId']
        phase(page, 'fight')
        enter(page)
        page.keyboard.press('Escape')
        wait(page, 'window.semagHorde.getState().paused')
        page.locator('#horde-change-setup').click()
        phase(page, 'lobby')
        fresh = snapshot(page)
        assert fresh['state']['horde']['wave'] == 0 and not fresh['controls']['entered']
        result['native_pause_resume_restart'] = {'tick_before': before['state']['tick'], 'paused_tick': paused['state']['tick'],
                                                'restart_phase': restarted['state']['phase'], 'setup_phase': fresh['state']['phase']}
        extension = page.locator('#horde-canvas').evaluate('canvas=>Boolean(canvas.getContext("webgl").getExtension("WEBGL_lose_context"))')
        assert extension, 'Native graphics fault fixture needs WEBGL_lose_context'
        page.locator('#horde-canvas').evaluate('''canvas=>{canvas.__humanRecoveryExtension=canvas.getContext('webgl').getExtension('WEBGL_lose_context');canvas.__humanRecoveryExtension.loseContext();}''')
        wait(page, 'Boolean(window.semagHorde.getState().graphicsError)')
        assert snapshot(page)['connected']
        page.wait_for_timeout(150)
        page.locator('#horde-canvas').evaluate('canvas=>canvas.__humanRecoveryExtension.restoreContext()')
        wait(page, '!window.semagHorde.getState().graphicsError', timeout=15000)
        restored = snapshot(page)
        assert restored['connected'] and restored['state']['phase'] == 'lobby'
        page.locator('#horde-start').click()
        phase(page, 'fight')
        enter(page)
        result['native_graphics_context_recovery'] = {'same_player_id': snapshot(page)['playerId'] == fresh['playerId'], 'render_count': snapshot(page)['renderCount'], 'human': human_stats(page)}
        return result
    finally:
        close_contexts([ctx], [page], 'lifecycle')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    freeze('before')
    selected = os.environ.get('SEMAG_HUMAN_CASES', 'breach,royale,horde,lifecycle').split(',')
    cases = {'breach': breach_case, 'breachposes': lambda browser: breach_case(browser, movement=False),
             'royale': lambda browser: shared_case(browser, 'royale'),
             'horde': lambda browser: shared_case(browser, 'horde'), 'lifecycle': lifecycle_case}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(**LAUNCH)
        try:
            for name in selected:
                log('case-start', name=name)
                try:
                    result = cases[name](browser)
                    REPORT['cases'].append({'name': name, 'status': 'passed', **result})
                    log('case-passed', name=name)
                except Exception as error:
                    REPORT['failures'].append({'name': name, 'error': str(error), 'traceback': traceback.format_exc()})
                    log('case-failed', name=name, error=str(error)[:250])
                save_report()
        finally:
            browser.close()
    changed = freeze('after')['changed_since_previous']
    assert not changed, ('Source bytes changed during native QA', changed)
    assert not REPORT['errors'], REPORT['errors']
    assert not REPORT['failed_resources'], REPORT['failed_resources']
    assert not REPORT['failures'], [(item['name'], item['error'][:250]) for item in REPORT['failures']]
    log('native-human-passed', cases=len(REPORT['cases']), report=str(OUT / 'report.json'))


if __name__ == '__main__':
    main()
