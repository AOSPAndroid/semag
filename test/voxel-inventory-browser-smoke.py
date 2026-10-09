"""Trusted native checks for four-slot voxel FPS inventories and new arenas.

Run only against a freshly started, source-frozen host:
  python test/voxel-inventory-browser-smoke.py http://127.0.0.1:3133
SEMAG_EXPANSION_CASES selects maps,inventory,exchange,weapons,practice.
Only native keyboard/mouse input drives gameplay. Read-only copied product
snapshots and immutable imported map geometry inform assertions/navigation.
No clock, animation frame, socket, input handler or game state is replaced.
SwiftShader is used for reproducible screenshots, not hardware FPS claims.
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
OUT = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', '/workspace/scratch/semag-expansion-native'))
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3133').rstrip('/')
REPORT = {'cases': [], 'failures': [], 'errors': [], 'failed_resources': [], 'screenshots': [],
          'working_bytes': [], 'input_policy': 'Trusted keyboard and mouse; copied state and geometry only',
          'performance_scope': 'Software WebGL screenshots only; no hardware FPS claim'}
LAUNCH = {'executable_path': '/usr/bin/chromium', 'headless': True,
          'args': ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle',
                   '--use-angle=swiftshader', '--enable-unsafe-swiftshader']}

spec = importlib.util.spec_from_file_location('expansion_horde_helpers', ROOT / 'test/voxel-horde-browser-smoke.py')
horde = importlib.util.module_from_spec(spec)
spec.loader.exec_module(horde)
horde.URL = URL
horde.OUT = OUT / 'helper-observations'
spec_practice = importlib.util.spec_from_file_location('expansion_practice_helpers', ROOT / 'test/voxel-practice-browser-smoke.py')
practice = importlib.util.module_from_spec(spec_practice)
spec_practice.loader.exec_module(practice)
practice.URL = URL


def save():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'report.json').write_text(json.dumps(REPORT, indent=2))


def log(stage, **details):
    print(json.dumps({'stage': stage, **details}), flush=True)


def freeze(stage):
    paths = [ROOT / 'server.js', ROOT / 'package.json', Path(__file__).resolve()]
    paths += sorted((ROOT / 'public').glob('voxel*'))
    paths += sorted((ROOT / 'public/hub').glob('voxel*'))
    hashes = {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
              for path in paths if path.is_file()}
    before = REPORT['working_bytes'][0]['sha256'] if REPORT['working_bytes'] else {}
    changed = [name for name, digest in hashes.items() if before and before.get(name) != digest]
    REPORT['working_bytes'].append({'stage': stage, 'sha256': hashes, 'changed_since_start': changed})
    save()
    assert not changed, ('Production changed during native check', changed)


def context(browser, tag, compact=False, coarse=False):
    ctx = browser.new_context(viewport={'width': 760 if compact else 1200, 'height': 720},
                              device_scale_factor=.6 if compact else 1,
                              has_touch=coarse, is_mobile=coarse)
    page = ctx.new_page()
    page.on('pageerror', lambda error: REPORT['errors'].append(f'{tag}: {error}'))
    page.on('console', lambda msg: REPORT['errors'].append(f'{tag}: {msg.text}') if msg.type == 'error' else None)
    page.on('response', lambda response: REPORT['failed_resources'].append(f'{tag}: {response.status} {response.url}')
            if response.status >= 400 else None)
    return ctx, page


def selected(page, index, timeout=12000):
    horde.wait(page, '''index=>{const s=window.semagHorde.getState(),p=s.state.players[s.playerId];
      return p.inventoryIndex===index;}''', index, timeout)
    return horde.actor(page)


def key_slot(page, index):
    horde.enter(page)
    horde.tap(page, str(index + 1), code='Digit' + str(index + 1), duration=65)
    return selected(page, index)


def screenshot(page, name):
    path = OUT / (name + '.png')
    bounds = page.locator('#horde-shell').bounding_box()
    assert bounds
    page.screenshot(path=str(path), clip=bounds, timeout=7000)
    REPORT['screenshots'].append(str(path))
    save()
    return str(path)


def touch_click(page, selector):
    bounds = page.locator(selector).bounding_box()
    assert bounds
    page.touchscreen.tap(bounds['x'] + bounds['width'] / 2, bounds['y'] + bounds['height'] / 2)


def check_body(page):
    sample = horde.snapshot(page)
    body = sample['state']['players'][sample['playerId']]
    assert len(body['inventory']) == 4
    assert all(item is None or item['kind'] in ('weapon', 'melee', 'heal', 'grenade') for item in body['inventory'])
    assert all(item is None or item['kind'] not in ('heal', 'grenade') or 1 <= item['amount'] <= 2 for item in body['inventory'])
    assert all(math.isfinite(body[key]) for key in ('x', 'y', 'z', 'vx', 'vy', 'vz', 'hp'))
    assert not sample['graphicsError']
    return body


def inventory_case(browser):
    ctx, page = context(browser, 'inventory', coarse=True)
    try:
        horde.solo(page, map_id='snow', weapon='revolver', layout='zqsd')
        before = horde.actor(page)
        assert [item['kind'] for item in before['inventory']] == ['melee', 'weapon', 'heal', 'grenade']
        assert before['inventory'][0]['weapon'] == 'katana'
        assert before['inventory'][1]['weapon'] == 'revolver'
        touch_click(page, '#horde-start')
        horde.phase(page, 'fight', timeout=15000)
        horde.enter(page)
        for index in range(4):
            key_slot(page, index)
            assert page.locator(f'#horde-inventory [data-inventory-index="{index}"]').get_attribute('class').find('selected') >= 0
        key_slot(page, 2)
        horde.tap(page, 'x', code='KeyX', duration=65)
        horde.wait(page, '''()=>{const s=window.semagHorde.getState(),p=s.state.players[s.playerId];
          return p.inventory[2]===null&&s.state.loot.some(l=>l.kind==='heal'&&l.droppedBy===p.id);}''')
        after_drop = check_body(page)
        assert after_drop['potions'] == 0 and after_drop['slot'] == 'empty'
        page.wait_for_timeout(250)
        horde.tap(page, 'e', code='KeyE', duration=65)
        horde.wait(page, '''()=>{const s=window.semagHorde.getState(),p=s.state.players[s.playerId];
          return p.potions===1&&p.inventory.some(i=>i?.kind==='heal'&&i.amount===1);}''')
        after_pickup = check_body(page)
        # Per-item UI drop is deliberately targeted at a non-selected grenade.
        key_slot(page, 1)
        # A genuine coarse-pointer context supports live clickable hotbar
        # controls without pointer lock. No pointer-lock handler is replaced.
        assert horde.snapshot(page)['controls']['touch']
        touch_click(page, '#horde-inventory [data-inventory-drop="4"]')
        horde.wait(page, '''()=>{const s=window.semagHorde.getState(),p=s.state.players[s.playerId];
          return p.inventory[3]===null&&p.inventory[1]?.weapon==='revolver'&&p.inventory[2]?.kind==='heal';}''')
        result = {'initial': before['inventory'], 'native_physical_digit_layout': 'zqsd',
                  'selected_all_four': True, 'drop_and_pickup_potion': True,
                  'unselected_per_item_drop_preserved_gun_and_potion': True,
                  'after_pickup': after_pickup['inventory'], 'final': check_body(page)['inventory']}
        result['screenshot'] = screenshot(page, 'four-slot-snow-inventory')
        horde.pause(page)
        return result
    finally:
        ctx.close()


def maps_case(browser):
    result = {'maps': []}
    for map_id in ('snow', 'sewers', 'trading'):
        ctx, page = context(browser, 'map/' + map_id)
        try:
            horde.solo(page, map_id=map_id, weapon='pdw')
            arena = horde.geometry(page, map_id)
            horde.start_solo(page)
            start = check_body(page)
            # An ordinary connected floor direction is selected using copied
            # collision geometry. Actual movement still uses trusted W input.
            nav = horde.Navigator(arena)
            choices = []
            for angle in [0, math.pi / 2, math.pi, -math.pi / 2]:
                point = (start['x'] + math.sin(angle) * 2, start['z'] - math.cos(angle) * 2)
                if nav.segment((start['x'], start['z']), point):
                    choices.append(angle)
            assert choices, (map_id, 'spawn has no ordinary floor direction')
            horde.aim(page, choices[0])
            horde.held_key(page, 'w', duration=420)
            end = check_body(page)
            distance = math.hypot(end['x'] - start['x'], end['z'] - start['z'])
            assert distance > .6, (map_id, 'trusted travel did not occur', start, end)
            # View the interior toward map centre after releasing movement.
            # A bounded native screenshot keeps the genuine live HUD visible.
            horde.aim(page, math.atan2(-end['x'], end['z']), pitch=.025)
            frame = screenshot(page, 'voxel-' + map_id + '-arena')
            horde.pause(page)
            result['maps'].append({'id': map_id, 'native_distance': distance, 'screenshot': frame,
                                   'routes': len(arena.get('routes', [])), 'colliders': len(arena['colliders'])})
        finally:
            ctx.close()
    return result


def weapons_case(browser):
    result = {'weapons': []}
    for weapon in ('revolver', 'pdw', 'autoshotgun', 'battlerifle'):
        ctx, page = context(browser, 'weapon/' + weapon)
        try:
            horde.solo(page, map_id='trading', weapon=weapon)
            horde.start_solo(page)
            before = check_body(page)
            horde.aim(page, yaw=math.atan2(-before['x'], before['z']), pitch=.025)
            page.mouse.down(button='right')
            page.wait_for_timeout(220)
            page.mouse.down(button='left')
            page.wait_for_timeout(70)
            page.mouse.up(button='left')
            page.mouse.up(button='right')
            horde.wait(page, '''ammo=>{const s=window.semagHorde.getState();return s.state.players[s.playerId].ammo<ammo;}''', before['ammo'])
            after = check_body(page)
            assert after['weapon'] == weapon and after['shots'] > before['shots']
            assert after['inventory'][1]['ammo'] == after['ammo']
            result['weapons'].append({'id': weapon, 'shots': after['shots'] - before['shots'],
                                      'ammo_spent': before['ammo'] - after['ammo'],
                                      'screenshot': screenshot(page, 'voxel-new-' + weapon)})
            horde.pause(page)
        finally:
            ctx.close()
    return result


def exchange_case(browser):
    contexts, pages = [], []
    try:
        for index in range(2):
            ctx, page = context(browser, 'exchange/' + str(index), compact=index > 0)
            contexts.append(ctx)
            pages.append(page)
        code = horde.create_room(pages[0], map_id='snow')
        pages[1].goto(pages[0].url)
        horde.connected(pages[1])
        for index, page in enumerate(pages):
            with controls_panel(page, '#horde-weapon'):
                horde.select_native(page, '#horde-weapon', 'revolver' if index == 0 else 'battlerifle')
            page.locator('#horde-ready').click()
        horde.wait(pages[0], '!document.querySelector("#horde-start").disabled')
        pages[0].locator('#horde-start').click()
        for page in pages:
            horde.phase(page, 'fight', timeout=20000)
            horde.enter(page)
        host, mate = pages
        host_before = check_body(host)
        mate_before = check_body(mate)
        arena = horde.geometry(host, 'snow')
        # First genuine shot establishes a non-full gun to transfer.
        key_slot(host, 1)
        host.mouse.down(button='left')
        host.mouse.up(button='left')
        horde.wait(host, '''()=>{const s=window.semagHorde.getState();return s.state.players[s.playerId].shots>0;}''')
        used = check_body(host)['ammo']
        horde.tap(host, 'x', code='KeyX', duration=65)
        horde.wait(host, '''()=>{const s=window.semagHorde.getState();return s.state.players[s.playerId].inventory[1]===null;}''')
        key_slot(mate, 3)
        horde.tap(mate, 'x', code='KeyX', duration=65)
        horde.wait(mate, '''()=>{const s=window.semagHorde.getState();return s.state.players[s.playerId].inventory[3]===null;}''')
        # Walk away from the receiver's own dropped grenade toward the host's
        # genuine dropped gun, keeping the native pickup choice unambiguous.
        host_body = check_body(host)
        target = (host_body['x'] + .85, host_body['z'])
        nav = horde.Navigator(arena)
        for waypoint in nav.route((mate_before['x'], mate_before['z']), target):
            horde.move(mate, *waypoint)
        # Use read-only nearest-loot prompts to pick the actual gun, rather than
        # blindly assuming which of the two floor items is first.
        for _ in range(4):
            if any(item and item.get('weapon') == 'revolver' for item in check_body(mate)['inventory']):
                break
            horde.tap(mate, 'e', code='KeyE', duration=65)
            mate.wait_for_timeout(180)
        carried = check_body(mate)
        transferred = next((item for item in carried['inventory'] if item and item.get('weapon') == 'revolver'), None)
        assert transferred and transferred['ammo'] == used, ('real gun exchange refilled/lost rounds', used, carried)
        key_slot(host, 2)
        horde.tap(host, 'x', code='KeyX', duration=65)
        horde.wait(host, '''()=>{const s=window.semagHorde.getState();return s.state.players[s.playerId].potions===0;}''')
        for _ in range(4):
            if check_body(mate)['potions'] == 2:
                break
            horde.tap(mate, 'e', code='KeyE', duration=65)
            mate.wait_for_timeout(180)
        final = check_body(mate)
        assert final['potions'] == 2
        assert any(item and item['kind'] == 'heal' and item['amount'] == 2 for item in final['inventory'])
        return {'room': code, 'real_connected_players': 2, 'native_gun_exchange': True,
                'weapon_ammo_preserved': used, 'native_stacked_potion_exchange': True,
                'receiver_inventory': final['inventory']}
    finally:
        for ctx in contexts:
            ctx.close()


def practice_case(browser):
    """Shared Breach practice must render an actual dropped gun on the floor."""
    ctx, page = context(browser, 'practice-ground-drop')
    try:
        page.goto(URL + '/voxel-practice.html?game=voxel&map=snow')
        practice.wait(page, 'window.firesidePractice?.getState().state.phase === "ready" && !document.querySelector("#practice-start").disabled')
        horde.select_native(page, '#practice-count', '1')
        horde.select_native(page, '#practice-weapon', 'revolver')
        practice.begin(page)
        page.locator('#practice-canvas').focus()
        before = practice.actor(page)
        page.keyboard.press('x', delay=65)
        practice.wait(page, '''()=>{const s=window.firesidePractice.getState();return s.state.players[0].inventory[1]===null
          &&s.state.loot.length===1&&s.renderStats.lootItems===1;}''')
        dropped = practice.snapshot(page)
        assert dropped['state']['loot'][0]['weapon'] == 'revolver'
        assert dropped['state']['loot'][0]['ammo'] == before['ammo']
        page.keyboard.down('s')
        try:
            practice.wait(page, 'z=>window.firesidePractice.getState().state.players[0].z>z+.7', before['z'], timeout=5000)
        finally:
            page.keyboard.up('s')
        practice.aim(page, yaw=0, pitch=-.82)
        path = OUT / 'breach-practice-visible-ground-weapon.png'
        bounds = page.locator('#practice-shell').bounding_box()
        page.screenshot(path=str(path), clip=bounds, timeout=7000)
        REPORT['screenshots'].append(str(path))
        page.keyboard.press('e', delay=65)
        practice.wait(page, '''()=>{const s=window.firesidePractice.getState();return s.state.players[0].inventory[1]?.weapon==='revolver'
          &&s.state.loot.length===0&&s.renderStats.lootItems===0;}''')
        picked = practice.actor(page)
        assert picked['ammo'] == before['ammo'] and picked['shots'] == 0
        return {'game': 'voxel-breach', 'solo_practice_actual_drop_and_pickup': True,
                'actual_rendered_world_pickups': dropped['renderStats']['lootItems'],
                'ammo_preserved': picked['ammo'], 'screenshot': str(path)}
    finally:
        ctx.close()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    freeze('before')
    cases = {'maps': maps_case, 'inventory': inventory_case, 'weapons': weapons_case, 'exchange': exchange_case,
             'practice': practice_case}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(**LAUNCH)
        try:
            for name in os.environ.get('SEMAG_EXPANSION_CASES', 'maps,inventory,weapons,exchange,practice').split(','):
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
    assert not REPORT['failures'], [(item['name'], item['error']) for item in REPORT['failures']]
    log('native-expansion-passed', cases=len(REPORT['cases']), report=str(OUT / 'report.json'))


if __name__ == '__main__':
    main()
