"""Focused, trusted-native browser checks for the voxel combat polish.

python test/voxel-polish-browser-smoke.py http://127.0.0.1:3000
SEMAG_POLISH_CASES selects breach,royale. SEMAG_SCREENSHOT_DIR selects reports.
Gameplay uses native keyboard/mouse input only. Read-only map geometry,
snapshots, DOM cues and renderer statistics are recorded for evidence.
"""
import importlib.util
import json
import math
import os
from pathlib import Path
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', '/workspace/scratch/semag-voxel-polish-browser'))
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3000').rstrip('/')
spec = importlib.util.spec_from_file_location('polish_paris_native', ROOT / 'test' / 'voxel-paris-browser-smoke.py')
paris = importlib.util.module_from_spec(spec)
spec.loader.exec_module(paris)
native, royale = paris.native, paris.royale
REPORT = {'cases': [], 'screenshots': [], 'errors': [], 'failed_resources': []}

# The observer records only product output. It never writes game state or input.
OBSERVE_POLISH = r"""() => {
  const observations = window.__polishQA = [];
  setInterval(() => {
    const debug = window.SemagVoxel || window.SemagRoyale;
    if (!debug) return;
    const seen = debug.getState(), cue = document.querySelector('#damage-cue');
    const blood = seen.renderStats?.bloodParticles || 0;
    const opacity = cue && !cue.hidden ? Number(cue.style.getPropertyValue('--damage-opacity')) || 0 : 0;
    if (blood || opacity) {
      observations.push({time:performance.now(),bloodParticles:blood,opacity,
        kind:cue?.dataset.kind,subject:cue?.dataset.subject,direction:cue?.dataset.direction,
        bearing:document.querySelector('#damage-bearing')?.style.cssText,
        phase:seen.state?.phase,hp:seen.state?.players[seen.playerId]?.hp});
      if (observations.length > 2000) observations.shift();
    }
  }, 16);
}"""


def log(stage, **details):
    print(json.dumps({'stage': stage, **details}), flush=True)


def wait(page, expression, arg=None, timeout=12000):
    return page.wait_for_function(expression, arg=arg, polling=20, timeout=timeout)


def snapshot(page):
    return paris.snapshot(page)


def actor(page, ident=None):
    return paris.actor(page, ident)


def observation_count(page):
    return page.evaluate('window.__polishQA.length')


def observations(page, since=0):
    return page.evaluate('index=>window.__polishQA.slice(index)', since)


def screenshot(page, name):
    target = OUT / (name + '.png')
    page.locator('#viewport').screenshot(path=str(target))
    REPORT['screenshots'].append(str(target))
    return str(target)


def observe(page, name):
    page.on('pageerror', lambda error: REPORT['errors'].append(f'{name}: {error}'))
    page.on('console', lambda event: REPORT['errors'].append(f'{name}: {event.text}') if event.type == 'error' else None)
    page.on('response', lambda response: REPORT['failed_resources'].append(f'{name}: {response.status} {response.url}') if response.status >= 400 else None)


def room(browser, mode):
    contexts, pages = [], []
    config = paris.MODES[mode]
    for index in range(2):
        context = browser.new_context(viewport={'width': 960 if index == 0 else 390, 'height': 800 if index == 0 else 650},
                                      device_scale_factor=1 if index == 0 else .5)
        context.add_init_script('(' + paris.INSTRUMENT + ')();')
        context.add_init_script('(' + OBSERVE_POLISH + ')();')
        contexts.append(context)
        page = context.new_page()
        paris.ACTIVE_MODE[id(page)] = mode
        observe(page, mode + '/' + str(index))
        pages.append(page)
    try:
        host = pages[0]
        host.goto(URL)
        wait(host, 'document.querySelector("#host-status").textContent==="Host is online"')
        host.locator(f'[data-create-game="{config["game"]}"]').click()
        chosen = 'courtyard' if mode == 'breach' else 'forest'
        royale.select_native(host, config['select'], chosen)
        if mode == 'breach':
            host.locator('#voxel-setup [name=teamSize][value="1"]').check()
        host.locator(config['create']).click()
        host.wait_for_url('**/' + config['path'] + '?room=*')
        paris.connected(host)
        pages[1].goto(host.url)
        paris.connected(pages[1])
        wait(host, f'window.{paris.debug(host)}.getState().players.filter(person=>person?.connected).length===2')
        assert [snapshot(page)['playerId'] for page in pages] == [0, 1]
        royale.select_native(host, 'select[data-keyboard-layout]', 'zqsd')
        arena = host.evaluate('async ([url,id])=>(await import(url)).MAPS[id]', [config['maps'], chosen])
        return contexts, pages, arena
    except BaseException:
        for context in contexts:
            context.close()
        raise


def begin(pages, mode):
    detail = paris.begin(pages, mode)
    for page in pages:
        assert actor(page)['hp'] == actor(page)['maxHp'] == 200, actor(page)
        wait(page, 'document.querySelector("#health-meter").getAttribute("aria-valuemax")==="200"')
    detail['initial_health'] = 200
    return detail


def health_layout(page, mode, arena):
    checks = []
    for width in (1280, 390, 320):
        page.set_viewport_size({'width': width, 'height': 960 if width == 1280 else 1000})
        page.wait_for_timeout(80)
        paris.enter(page)
        royale.no_overflow(page, mode + '/polish/' + str(width))
        boxes = page.locator('#health-readout,#weapon-readout').evaluate_all('''nodes=>nodes.map(node=>{
          const r=node.getBoundingClientRect(),v=document.querySelector('#viewport').getBoundingClientRect();
          return{id:node.id,x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width,
            viewport:{x:v.x,right:v.right,y:v.y,bottom:v.bottom}};})''')
        assert all(item['width'] > 0 and item['x'] >= item['viewport']['x'] - 1 and item['right'] <= item['viewport']['right'] + 1
                   and item['y'] >= item['viewport']['y'] - 1 and item['bottom'] <= item['viewport']['bottom'] + 1 for item in boxes), boxes
        assert boxes[0]['right'] <= boxes[1]['x'], boxes
        assert int(page.locator('#health-meter').get_attribute('aria-valuenow')) == actor(page)['hp']
        assert int(page.locator('#health-meter').get_attribute('aria-valuemax')) == 200
        paris.finite(page, arena)
        screenshot(page, f'voxel-{mode}-polish-{width}')
        checks.append({'width': width, 'health_and_weapon_boxes': boxes})
    page.set_viewport_size({'width': 960, 'height': 800})
    paris.enter(page)
    return checks


def event(page, kind, after, player_id=None):
    ident = snapshot(page)['playerId'] if player_id is None else player_id
    wait(page, f'''([kind,after,id])=>window.{paris.debug(page)}.getState().state.events.some(
      item=>item.id>after&&item.type===kind&&item.playerId===id)''', [kind, after, ident])
    return next(item for item in reversed(snapshot(page)['state']['events']) if item['id'] > after and item['type'] == kind and item['playerId'] == ident)


def single_shot(page, target, head=True):
    body = actor(page)
    dx, dz = target['x'] - body['x'], target['z'] - body['z']
    height = target['y'] + (1.62 if head else .95)
    native.native_aim(page, math.atan2(dx, -dz), math.atan2(height - body['y'] - 1.62, math.hypot(dx, dz)))
    page.mouse.down(button='right')
    try:
        wait(page, 'window.SemagVoxel.getState().state.players[0].aimTicks>=18')
        before = snapshot(page)['state']['eventId']
        page.mouse.down(button='left')
        page.wait_for_timeout(40)
        page.mouse.up(button='left')
        return event(page, 'shot', before)
    finally:
        page.mouse.up(button='left')
        page.mouse.up(button='right')


def run_breach(pages, arena, details, frozen):
    host, peer = pages
    # The physical central arch screens the entire initial gun line.
    peer_hp, marker = actor(peer)['hp'], observation_count(host)
    native.native_aim(host, 0, 0)
    cover = single_shot(host, {'x': actor(host)['x'], 'y': 0, 'z': -4})
    assert cover['hitKind'] == 'wall' and not cover['damage'], cover
    host.wait_for_timeout(400)
    assert actor(peer)['hp'] == peer_hp and not observations(host, marker), 'Blocked shot emitted blood or incoming damage'
    details['cover_shot_has_no_blood'] = cover
    frozen['session'] = royale.freeze(peer)
    # Walk the authored outer ground lane, then approach the stationary peer.
    target = actor(host, 1)
    details['physical_flank'] = []
    for x, z in [(-20, actor(host)['z']), (-20, target['z']), (-5, target['z'])]:
        walked = paris.move(host, x, z, arena)
        details['physical_flank'].append({key: walked[key] for key in ('x', 'y', 'z')})
    paris.resume_peer(frozen)
    paris.enter(peer)
    # Aim the victim at the shooter so its incoming bearing should be front.
    rival, shooter = actor(peer), actor(host)
    native.native_aim(peer, math.atan2(shooter['x'] - rival['x'], -(shooter['z'] - rival['z'])))
    marker_host, marker_peer = observation_count(host), observation_count(peer)
    shot = single_shot(host, actor(host, 1))
    assert shot['hitKind'] == 'head' and shot['targetId'] == 1 and shot['damage'] == 84, shot
    wait(peer, 'window.SemagVoxel.getState().state.players[1].hp===116')
    assert actor(peer)['alive'] and snapshot(host)['state']['phase'] == 'fight'
    screenshot(peer, 'voxel-breach-incoming-blood')
    host.wait_for_timeout(100)
    blood = observations(host, marker_host)
    incoming = observations(peer, marker_peer)
    assert any(item['bloodParticles'] > 0 for item in blood), ('Confirmed headshot had no world blood', blood)
    assert any(item['kind'] == 'blood' and item['subject'] == '1' and item['opacity'] > 0 and item['direction'] == 'front' for item in incoming), incoming
    assert all(not item['opacity'] for item in blood), 'Outgoing damage painted incoming cue'
    details['survived_precise_headshot'] = {'shot': shot, 'health_remaining': actor(peer)['hp'], 'world_blood': blood, 'incoming_feedback': incoming}
    log('native-breach-headshot-survived-blood-confirmed', hp=actor(peer)['hp'])
    # A real potion restores sixty health after its uninterrupted two seconds.
    before = snapshot(peer)['state']['eventId']
    paris.tap(peer, 'f', 'KeyF')
    start = event(peer, 'healStart', before)
    completed = event(peer, 'healComplete', before)
    assert completed['amount'] == 60 and actor(peer)['hp'] == 176 and actor(peer)['potions'] == 0, completed
    wait(peer, 'document.querySelector("#health-meter").getAttribute("aria-valuenow")==="176"')
    host.wait_for_timeout(650)
    assert snapshot(host)['renderStats']['bloodParticles'] == snapshot(peer)['renderStats']['bloodParticles'] == 0
    assert peer.locator('#damage-cue').is_hidden()
    screenshot(peer, 'voxel-breach-healed-176hp')
    details['native_sixty_hp_heal'] = {'start': start, 'complete': completed, 'health': actor(peer)['hp']}
    details['responsive'] = health_layout(host, 'breach', arena)
    # Finish the genuine duel, then observe the normal round reset.
    finish = []
    while actor(host, 1)['alive']:
        host.wait_for_timeout(160)
        finish.append(single_shot(host, actor(host, 1)))
        assert len(finish) <= 5, finish
    wait(host, 'window.SemagVoxel.getState().state.phase==="roundEnd"')
    wait(peer, 'window.SemagVoxel.getState().state.players[1].hp===0')
    wait(host, 'window.SemagVoxel.getState().state.phase==="fight"', timeout=20000)
    wait(peer, 'window.SemagVoxel.getState().state.phase==="fight"')
    assert all(body['hp'] == body['maxHp'] == 200 and body['potions'] == 1 for body in snapshot(host)['state']['players'])
    assert snapshot(host)['renderStats']['bloodParticles'] == snapshot(peer)['renderStats']['bloodParticles'] == 0
    details['native_round_reset'] = {'finishing_shots': finish, 'round': snapshot(host)['state']['round'], 'reset_hp': 200}
    details['performance'] = paris.performance(host, arena)


def swing(page):
    paris.enter(page)
    before = snapshot(page)['state']['eventId']
    page.mouse.down(button='left')
    page.wait_for_timeout(40)
    page.mouse.up(button='left')
    started = event(page, 'meleeStart', before)
    assert started['weapon'] == 'knife', started
    return started


def run_royale(pages, arena, details, frozen):
    host, peer = pages
    for page in pages:
        body = actor(page)
        assert body['slot'] == 'sword' and body['meleeWeapon'] == 'knife' and not body['hasGun']
        assert all(body[key] == 0 for key in ('ammo', 'reserve', 'potions', 'grenades')), body
    assert 'KNIFE' in host.locator('#weapon-readout').inner_text()
    assert 'SWORD' not in host.locator('#weapon-readout').inner_text()
    details['knife_only_start'] = [{key: actor(page)[key] for key in ('hp', 'maxHp', 'slot', 'meleeWeapon', 'hasGun', 'ammo', 'reserve', 'potions', 'grenades')} for page in pages]
    screenshot(host, 'voxel-royale-small-starter-knife')
    details['native_starter_cut'] = swing(host)
    frozen['session'] = royale.freeze(peer)
    # Find the nearest ground gun by real navigable path length, avoiding roofs.
    body = actor(host)
    navigator = royale.Navigator(arena)
    choices = []
    for item in snapshot(host)['state']['loot']:
        if item['kind'] != 'weapon' or item['y'] != 0:
            continue
        route = navigator.route((body['x'], body['z']), (item['x'], item['z']))
        length, previous = 0, (body['x'], body['z'])
        for point in route:
            length += math.dist(previous, point)
            previous = point
        choices.append((length, item, route))
    assert choices
    distance, chosen, path = min(choices, key=lambda choice: choice[0])
    for point in path:
        paris.move(host, *point, arena)
    nearby = royale.nearby(host)
    assert nearby and nearby['id'] == chosen['id'], (chosen, nearby)
    before = snapshot(host)['state']['eventId']
    paris.tap(host, 'e', 'KeyE')
    picked = event(host, 'lootPickup', before)
    assert picked['lootId'] == chosen['id'] and actor(host)['hasGun'] and actor(host)['slot'] == 'primary'
    assert actor(host)['meleeWeapon'] == 'knife'
    details['native_gun_scavenging'] = {'loot': chosen, 'walk_distance': distance, 'route': path, 'pickup': picked}
    paris.tap(host, 'v', 'KeyV')
    wait(host, 'window.SemagRoyale.getState().state.players[0].slot==="sword"')
    wait(host, 'document.querySelector("#weapon-readout").textContent.includes("KNIFE")')
    royale.CALIBRATION.pop(id(host), None)
    details['native_v_returns_to_small_knife'] = swing(host)
    screenshot(host, 'voxel-royale-scavenged-gun-knife-toggle')
    paris.resume_peer(frozen)
    wait(peer, '([weapon])=>{const p=window.SemagRoyale.getState().state.players[0];return p.hasGun&&p.weapon===weapon&&p.slot==="sword"&&p.meleeWeapon==="knife"}', [actor(host)['weapon']])
    details['responsive'] = health_layout(host, 'royale', arena)
    details['performance'] = paris.performance(host, arena)
    assert host.locator('#map-plan .map-player').count() == 0
    log('native-royale-knife-start-scavenge-toggle-pass', gun=chosen['weapon'])


def run_case(browser, mode):
    contexts, pages, arena = room(browser, mode)
    details, frozen = {'mode': mode, 'map': arena['id']}, {}
    try:
        details['start'] = begin(pages, mode)
        log('native-polish-live', mode=mode)
        (run_breach if mode == 'breach' else run_royale)(pages, arena, details, frozen)
        REPORT['cases'].append(details)
        (OUT / ('report-' + mode + '.json')).write_text(json.dumps({'case': details, 'screenshots': list(REPORT['screenshots']),
                                                                'errors': list(REPORT['errors']), 'failed_resources': list(REPORT['failed_resources'])}, indent=2))
        log('native-polish-case-pass', mode=mode)
    except BaseException as error:
        failure = {'mode': mode, 'error': str(error), 'details': details, 'pages': []}
        paris.resume_peer(frozen)
        for index, page in enumerate(pages):
            try:
                failure['pages'].append({'index': index, 'snapshot': snapshot(page), 'transport': page.evaluate('window.__voxelQA'), 'polish': observations(page)})
                screenshot(page, f'failure-voxel-{mode}-polish-{index}')
            except Exception as detail_error:
                failure['pages'].append({'index': index, 'error': str(detail_error)})
        (OUT / ('failure-' + mode + '.json')).write_text(json.dumps(failure, indent=2))
        raise
    finally:
        paris.resume_peer(frozen)
        for context in contexts:
            context.close()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    selected = set(filter(None, os.environ.get('SEMAG_POLISH_CASES', '').split(',')))
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                args=['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            try:
                for mode in ('breach', 'royale'):
                    if not selected or mode in selected:
                        run_case(browser, mode)
            finally:
                browser.close()
    finally:
        (OUT / 'report.json').write_text(json.dumps(REPORT, indent=2))
    assert not REPORT['errors'], REPORT['errors']
    assert not REPORT['failed_resources'], REPORT['failed_resources']
    log('native-polish-pass', cases=len(REPORT['cases']), report=str(OUT / 'report.json'))


if __name__ == '__main__':
    main()
