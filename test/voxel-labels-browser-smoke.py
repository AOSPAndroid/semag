"""Real world-marker checks, using only trusted native game input.

python test/voxel-labels-browser-smoke.py http://127.0.0.1:3137
SEMAG_LABEL_CASES selects coop,cover,monster.
SEMAG_SCREENSHOT_DIR controls artifacts.
Copied product diagnostics and immutable authored geometry guide observation;
simulation, socket, timers, animation and input handlers are never replaced.
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

ROOT = Path(__file__).resolve().parents[1]
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3137').rstrip('/')
OUT = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', '/workspace/scratch/semag-labels-release/native'))
REPORT = {'cases': [], 'failures': [], 'errors': [], 'failed_resources': [], 'screenshots': [], 'working_bytes': [],
          'input_policy': 'Trusted native keyboard/mouse; copied diagnostics and immutable map geometry only',
          'performance_scope': 'Software WebGL behavior; no hardware FPS claim'}
LAUNCH = {'executable_path': '/usr/bin/chromium', 'headless': True,
          'args': ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']}
spec = importlib.util.spec_from_file_location('labels_native_horde', ROOT / 'test/voxel-horde-browser-smoke.py')
horde = importlib.util.module_from_spec(spec); spec.loader.exec_module(horde)
horde.URL = URL; horde.OUT = OUT / 'helper-evidence'


def save():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'report.json').write_text(json.dumps(REPORT, indent=2))


def log(stage, **details):
    print(json.dumps({'stage': stage, **details}), flush=True)


def freeze(stage):
    files = sorted(path for path in (ROOT / 'public').rglob('*') if path.is_file())
    files += [ROOT / 'server.js', ROOT / 'package.json', ROOT / 'package-lock.json', ROOT / 'README.md']
    hashes = {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in files}
    original = REPORT['working_bytes'][0]['sha256'] if REPORT['working_bytes'] else {}
    changed = [name for name, digest in hashes.items() if original and original.get(name) != digest]
    REPORT['working_bytes'].append({'stage': stage, 'sha256': hashes, 'changed_since_start': changed})
    save(); assert not changed, ('Production changed during native checks', changed)


def context(browser, tag):
    ctx = browser.new_context(viewport={'width': 1200, 'height': 780}, device_scale_factor=.7)
    page = ctx.new_page()
    page.on('pageerror', lambda error: REPORT['errors'].append(f'{tag}: {error}'))
    page.on('console', lambda msg: REPORT['errors'].append(f'{tag}: {msg.text}') if msg.type == 'error' else None)
    page.on('response', lambda response: REPORT['failed_resources'].append(f'{tag}: {response.status} {response.url}') if response.status >= 400 else None)
    return ctx, page


def seen(page):
    # Return a compact copy: avoid repeatedly serializing the full events,
    # inventory and presentation histories while real enemies keep advancing.
    return page.evaluate('''()=>{const d=window.semagHorde.getState();return{
      playerId:d.playerId,phase:d.state.phase,aim:d.aim,controls:d.controls,
      labels:d.worldLabels,stats:d.renderStats,error:d.graphicsError,
      players:d.state.players.map(p=>({id:p.id,lifeId:p.lifeId,alive:p.alive,hp:p.hp,maxHp:p.maxHp,
      x:p.x,y:p.y,z:p.z,yaw:p.yaw,recoil:p.recoil,monster:p.monster,monsterType:p.monsterType,
      emergenceTicks:p.emergenceTicks,crouching:p.crouching})),
      events:d.state.events.slice(-32),eventId:d.state.eventId,roomPlayers:d.roomPlayers};}''')


def label(page, ident):
    return next((item for item in seen(page)['labels']['visible'] if item['id'] == ident), None)


def current(page, ident=None):
    s = seen(page); ident = s['playerId'] if ident is None else ident
    return next(item for item in s['players'] if item['id'] == ident)


def screenshot(page, name):
    path = OUT / (name + '.png'); box = page.locator('#horde-shell').bounding_box()
    # Whole-page screenshots with an exact native clip do not wait for two
    # stable element animation frames while live enemies continue attacking.
    page.screenshot(path=str(path), clip=box, timeout=10000)
    REPORT['screenshots'].append(str(path)); save(); return str(path)


def check(page):
    s = seen(page); assert not s['error']; assert s['stats']['mapVertices'] < 100000 and s['stats']['dynamicVertices'] < 72000
    assert s['labels']['poolSize'] <= 23 and len(s['labels']['visible']) <= 23
    for item in s['labels']['visible']:
        assert 0 <= item['x'] <= 1 and 0 <= item['y'] <= 1
    assert page.locator('[data-voxel-label-overlay]').count() == 1
    assert page.locator('[data-voxel-label-overlay]').evaluate('(e)=>getComputedStyle(e).pointerEvents') == 'none'
    return s


def close(ctx, page, tag):
    if sys.exc_info()[0] is not None and not page.is_closed():
        try:
            (OUT / ('failure-' + tag + '.json')).write_text(json.dumps(seen(page), indent=2))
            screenshot(page, 'failure-' + tag)
        except Exception as error:
            log('failure-evidence-unavailable', tag=tag, error=str(error))
    ctx.close()


def aim_live(page, ident, height):
    """Short calibrated mouse movements track current real, moving anatomy."""
    sx, sy = horde.CALIBRATION[id(page)]; box = page.locator('#horde-canvas').bounding_box()
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2; page.mouse.move(x, y)
    for _ in range(5):
        s = seen(page); own = next(p for p in s['players'] if p['id'] == s['playerId']); target = next(p for p in s['players'] if p['id'] == ident)
        yaw = math.atan2(target['x'] - own['x'], -(target['z'] - own['z']))
        pitch = math.atan2(target['y'] + height - own['y'] - 1.62, math.hypot(target['x'] - own['x'], target['z'] - own['z'])) - own['recoil']
        dyaw = horde.native.angle_delta(yaw, s['aim']['yaw']); dpitch = pitch - s['aim']['pitch']
        if abs(dyaw) < .018 and abs(dpitch) < .018:
            return
        dx = max(-box['width'] * .4, min(box['width'] * .4, dyaw / sx)); dy = max(-box['height'] * .4, min(box['height'] * .4, dpitch / sy))
        page.mouse.move(x + dx, y + dy, steps=1); x += dx; y += dy


def quick_calibration(page):
    """Measure actual trusted mouse motion once, using compact snapshots."""
    horde.enter(page); box = page.locator('#horde-canvas').bounding_box()
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    page.mouse.move(x, y); page.wait_for_timeout(30); before = seen(page)['aim']
    page.mouse.move(x + 40, y + 30); page.wait_for_timeout(50); after = seen(page)['aim']
    sx = horde.native.angle_delta(after['yaw'], before['yaw']) / 40; sy = (after['pitch'] - before['pitch']) / 30
    assert abs(sx) > .0001 and abs(sy) > .0001
    horde.CALIBRATION[id(page)] = (sx, sy)


def quick_angle(page, yaw, pitch=0):
    sx, sy = horde.CALIBRATION[id(page)]; box = page.locator('#horde-canvas').bounding_box()
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2; page.mouse.move(x, y)
    for _ in range(5):
        aim = seen(page)['aim']; dyaw = horde.native.angle_delta(yaw, aim['yaw']); dpitch = pitch - aim['pitch']
        if abs(dyaw) < .02 and abs(dpitch) < .02:
            return
        dx = max(-box['width'] * .4, min(box['width'] * .4, dyaw / sx)); dy = max(-box['height'] * .4, min(box['height'] * .4, dpitch / sy))
        page.mouse.move(x + dx, y + dy); x += dx; y += dy


def quick_walk(page, route):
    for x, z in route:
        body = current(page); dx, dz = x - body['x'], z - body['z']; distance = math.hypot(dx, dz)
        if distance < .35:
            continue
        quick_angle(page, math.atan2(dx, -dz)); page.keyboard.down('w')
        try:
            horde.wait(page, '''([x,z,ux,uz])=>{const d=window.semagHorde.getState(),p=d.state.players[d.playerId];
              return !p.alive||(x-p.x)*ux+(z-p.z)*uz<.12;}''', [x, z, dx / distance, dz / distance], timeout=int(distance / 3 * 1000 + 2000))
        finally:
            page.keyboard.up('w')
        body = current(page); assert body['alive'] and math.hypot(x - body['x'], z - body['z']) < .6, ('Actual short waypoint missed', x, z, body)


def cover_case(browser):
    """A nearby real office screen avoids waiting under live enemy attacks."""
    contexts, pages = [], []
    try:
        for index in range(2):
            ctx, page = context(browser, 'cover-' + str(index)); contexts.append(ctx); pages.append(page)
        room = horde.create_room(pages[0], map_id='trading'); pages[1].goto(pages[0].url); horde.connected(pages[1])
        for page, name in zip(pages, ['Camille', 'Élodie']):
            page.locator('#horde-name').fill(name); page.keyboard.press('Tab')
        arena = horde.geometry(pages[0], 'trading'); navigator = horde.Navigator(arena)
        covered_point, peek_point = (-4.5, 12.1), (-6, 12.1)
        route = navigator.route((0, 18), covered_point); peek_route = navigator.route(covered_point, peek_point)
        assert navigator.free(*covered_point) and navigator.free(*peek_point)
        horde.wait(pages[0], "window.semagHorde.getState().roomPlayers.some(p=>p?.name==='Élodie')")
        for page in pages:
            page.locator('#horde-ready').click()
        horde.wait(pages[0], '!document.querySelector("#horde-start").disabled'); pages[0].locator('#horde-start').click()
        for page in pages:
            horde.phase(page, 'fight', timeout=20000)
        peer, host = pages[1], pages[0]
        peer.bring_to_front(); quick_calibration(peer); quick_walk(peer, route)
        host.bring_to_front(); quick_calibration(host); aim_live(host, 1, 1.3)
        horde.wait(host, "!window.semagHorde.getState().worldLabels.visible.some(l=>l.kind==='teammate'&&l.id===1)", timeout=2000)
        hidden = check(host); assert current(host)['alive'] and current(host, 1)['alive']
        assert math.dist((current(host)['x'], current(host)['z']), (-3, 18)) < .1, 'the observer remains its own original camera, alive at spawn'
        hidden_image = screenshot(host, 'office-teammate-name-hidden-by-screen-native')
        peer.bring_to_front(); horde.enter(peer); quick_walk(peer, peek_route)
        host.bring_to_front(); horde.enter(host); aim_live(host, 1, 1.3)
        revealed = assert_native_name(host, 1, 'Élodie'); assert current(host)['alive'] and current(host, 1)['alive']; check(host)
        peek_image = screenshot(host, 'office-teammate-name-peek-native')
        return {'room': room, 'map': 'trading', 'preplanned_legal_cover_point': covered_point, 'preplanned_legal_peek_point': peek_point,
                'actual_walked_route': route, 'actual_walked_peek_route': peek_route, 'observing_alive_player': current(host),
                'hidden_labels': hidden['labels'], 'revealed': revealed, 'screenshots': [hidden_image, peek_image]}
    finally:
        for index, (ctx, page) in enumerate(zip(contexts, pages)):
            close(ctx, page, 'cover-' + str(index))


def assert_native_name(page, ident, expected):
    horde.wait(page, '''id=>window.semagHorde.getState().worldLabels.visible.some(l=>l.kind==='teammate'&&l.id===id)''', ident, timeout=3000)
    observed = page.evaluate('''id=>{const s=window.semagHorde.getState(),label=s.worldLabels.visible.find(l=>l.id===id&&l.kind==='teammate');
      const nodes=[...document.querySelectorAll('[data-voxel-label="teammate"]')].filter(n=>!n.hidden&&Number(n.dataset.playerId)===id);
      const n=nodes[0],r=n?.getBoundingClientRect(),c=document.querySelector('#horde-canvas').getBoundingClientRect();
      return {label,ownAlive:s.state.players[s.playerId].alive,targetAlive:s.state.players[id].alive,nodeCount:nodes.length,
      text:n?.querySelector('.voxel-world-name')?.textContent,nodeHidden:n?.parentElement?.hidden,
      rect:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,canvas:{x:c.x,y:c.y,width:c.width,height:c.height}};}''', ident)
    assert observed['label']['name'] == expected and observed['ownAlive'] and observed['targetAlive'], observed
    assert observed['nodeCount'] == 1 and observed['text'] == expected and not observed['nodeHidden'], observed
    pos, canvas = observed['rect'], observed['canvas']
    assert canvas['x'] <= pos['x'] + pos['width'] / 2 <= canvas['x'] + canvas['width']
    assert canvas['y'] <= pos['y'] + pos['height'] <= canvas['y'] + canvas['height']
    return observed['label']


def coop_case(browser):
    contexts, pages = [], []
    try:
        for index in range(2):
            ctx, page = context(browser, 'names-' + str(index)); contexts.append(ctx); pages.append(page)
        room = horde.create_room(pages[0], map_id='trading'); pages[1].goto(pages[0].url); horde.connected(pages[1])
        for page, name in zip(pages, ['Camille', 'Élodie']):
            page.locator('#horde-name').fill(name); page.keyboard.press('Tab')
        horde.wait(pages[0], "window.semagHorde.getState().roomPlayers.some(p=>p?.name==='Élodie')")
        assert all(not seen(page)['labels']['visible'] for page in pages)
        for page in pages:
            page.locator('#horde-ready').click()
        horde.wait(pages[0], '!document.querySelector("#horde-start").disabled'); pages[0].locator('#horde-start').click()
        for page in pages:
            horde.phase(page, 'fight', timeout=20000)
        reciprocal = []
        for index, page in enumerate(pages):
            page.bring_to_front(); quick_calibration(page); aim_live(page, 1 - index, 1.3)
            reciprocal.append(assert_native_name(page, 1 - index, ['Élodie', 'Camille'][index])); check(page)
        image = screenshot(pages[1], 'office-teammate-name-camille-native')
        pages[0].bring_to_front(); horde.enter(pages[0]); aim_live(pages[0], 1, 1.3)
        image_host = screenshot(pages[0], 'office-teammate-name-elodie-native')
        return {'room': room, 'actual_connected_humans': 2, 'lobby_markers_hidden': True,
                'actual_names_both_views': reciprocal, 'screenshots': [image, image_host]}
    finally:
        for index, (ctx, page) in enumerate(zip(contexts, pages)):
            close(ctx, page, 'names-' + str(index))


def monster_case(browser):
    ctx, page = context(browser, 'monster')
    try:
        horde.solo(page, weapon='pistol'); horde.start_solo(page); horde.CALIBRATION.pop(id(page), None); horde.aim(page, 0, 0)
        horde.wait(page, 'window.semagHorde.getState().state.players.some(p=>p.monster&&p.alive&&p.emergenceTicks===0)', timeout=15000)
        target = next(p for p in seen(page)['players'] if p.get('monster') and p['alive'] and p.get('emergenceTicks') == 0)
        height = .46 if target.get('monsterType') == 'hound' else 1.1
        aim_live(page, target['id'], height)
        horde.wait(page, 'id=>window.semagHorde.getState().worldLabels.visible.some(l=>l.kind==="monster"&&l.id===id)', target['id'], timeout=3000)
        before = label(page, target['id']); assert before['hp'] == target['hp'] and before['maxHp'] == target['maxHp']; check(page)
        before_image = screenshot(page, 'monster-health-full-native')
        hit = None; damaged = None
        for _ in range(4):
            aim_live(page, target['id'], height); event_id = seen(page)['eventId']
            page.mouse.down(button='left'); page.wait_for_timeout(35); page.mouse.up(button='left')
            try:
                horde.wait(page, '([id,e])=>window.semagHorde.getState().state.events.some(v=>v.id>e&&v.type==="damage"&&v.targetId===id&&v.playerId===0)', [target['id'], event_id], timeout=700)
            except Exception:
                continue
            state = seen(page); hit = next(event for event in state['events'] if event['id'] > event_id and event['type'] == 'damage' and event.get('targetId') == target['id'])
            target = current(page, target['id']); assert target['alive'], 'one true pistol body shot should leave this first-wave monster alive'
            horde.wait(page, '([id,hp])=>window.semagHorde.getState().worldLabels.visible.some(l=>l.id===id&&l.hp===hp)', [target['id'], target['hp']], timeout=2000)
            damaged = label(page, target['id']); break
        assert hit and damaged and 0 < damaged['hp'] < before['hp']
        node = page.locator(f'[data-voxel-label="monster"][data-player-id="{target["id"]}"]:visible')
        assert node.count() == 1 and float(node.get_attribute('data-hp')) == damaged['hp']
        fill = node.locator('.voxel-world-health-fill').evaluate('(e)=>new DOMMatrix(getComputedStyle(e).transform).a')
        assert abs(fill - damaged['hp'] / damaged['maxHp']) < .01
        damaged_image = screenshot(page, 'monster-health-damaged-native'); check(page)
        # Corpses may be immediately reused by genuine later rifts. Preserve
        # the accepted kill and original lifetime key instead of testing only ID.
        kill = None
        for _ in range(6):
            body = current(page, target['id'])
            if not body['alive'] or body['lifeId'] != target['lifeId']:
                kill = next((e for e in seen(page)['events'] if e['type'] == 'kill' and e.get('targetId') == target['id'] and e.get('playerId') == 0), None)
                break
            aim_live(page, target['id'], height); event_id = seen(page)['eventId']
            page.mouse.down(button='left'); page.wait_for_timeout(35); page.mouse.up(button='left')
            try:
                horde.wait(page, '([id,e])=>window.semagHorde.getState().state.events.some(v=>v.id>e&&v.type==="kill"&&v.targetId===id&&v.playerId===0)', [target['id'], event_id], timeout=450)
                kill = next(e for e in seen(page)['events'] if e['id'] > event_id and e['type'] == 'kill' and e.get('targetId') == target['id']); break
            except Exception:
                pass
        assert kill, 'real native shots eliminate the actual original target life'
        horde.wait(page, 'key=>!window.semagHorde.getState().worldLabels.visible.some(l=>l.key===key)', before['key'], timeout=2000)
        final = check(page)
        animal = next((p for p in final['players'] if p.get('monsterType') == 'hound' and p['alive'] and p.get('emergenceTicks') == 0), None)
        low_hound = None
        if animal:
            aim_live(page, animal['id'], .66)
            horde.wait(page, 'id=>window.semagHorde.getState().worldLabels.visible.some(l=>l.kind==="monster"&&l.id===id)', animal['id'], timeout=2000)
            low_hound = label(page, animal['id']); assert low_hound['maxHp'] == 45
            screenshot(page, 'hound-low-health-bar-native')
        horde.pause(page); assert not seen(page)['labels']['visible'], 'solo pause immediately hides world labels'
        return {'target_life': {'id': target['id'], 'lifeId': target['lifeId'], 'type': target['monsterType']}, 'full_bar': before,
                'actual_pistol_damage': hit, 'damaged_bar': damaged, 'observed_fill_scale': fill, 'actual_kill': kill, 'dead_bar_removed': True,
                'naturally_emerged_hound_bar': low_hound, 'pause_markers_cleared': True,
                'renderer': final['stats'], 'screenshots': [before_image, damaged_image]}
    finally:
        close(ctx, page, 'monster')


def main():
    OUT.mkdir(parents=True, exist_ok=True); horde.OUT.mkdir(parents=True, exist_ok=True); freeze('before')
    cases = {'coop': coop_case, 'cover': cover_case, 'monster': monster_case}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(**LAUNCH)
        try:
            for name in os.environ.get('SEMAG_LABEL_CASES', 'coop,cover,monster').split(','):
                try:
                    log('case-start', name=name); result = cases[name](browser)
                    REPORT['cases'].append({'name': name, **result}); log('case-passed', name=name)
                except Exception as error:
                    REPORT['failures'].append({'name': name, 'error': str(error), 'traceback': traceback.format_exc()}); log('case-failed', name=name, error=str(error))
                save(); freeze('after-' + name)
        finally:
            browser.close()
    freeze('after'); save()
    assert not REPORT['failures'] and not REPORT['errors'] and not REPORT['failed_resources'], {'failures': REPORT['failures'], 'errors': REPORT['errors'], 'failed_resources': REPORT['failed_resources']}
    log('completed', cases=len(REPORT['cases']), screenshots=len(REPORT['screenshots']))


if __name__ == '__main__':
    main()
