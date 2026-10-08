"""Trusted native QA for Voxel Breach health and weapon identity.

python test/voxel-health-browser-smoke.py http://127.0.0.1:3100
SEMAG_SCREENSHOT_DIR sets the report and screenshot destination.
SEMAG_HEALTH_SKIP_TEAMS=1 omits the compact four-client spectator case.
SEMAG_HEALTH_CASES=teams retries only the team probe, preserving core results.
Gameplay uses native keyboard/mouse events. Network, immutable catalogs,
DOM meters and read-only game snapshots are observed, never replaced.
"""
import importlib.util
import json
import math
import os
from pathlib import Path
import sys

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', ROOT / 'test-results' / 'voxel-health'))
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3100').rstrip('/')
spec = importlib.util.spec_from_file_location('voxel_expansion_fixture', ROOT / 'test' / 'voxel-expansion-browser-smoke.py')
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)
native = fixture.native
fixture.OUT = native.OUT = OUT
fixture.URL = native.URL = URL
fixture.SETUP_CAPTURED = True
REPORT = {'cases': [], 'screenshots': native.REPORT['screenshots'], 'errors': [], 'failed_resources': []}
snapshot, actor, wait = fixture.snapshot, fixture.actor, fixture.wait


def log(stage, **details):
    print(json.dumps({'stage': stage, **details}), flush=True)


def room(browser, size=1):
    contexts = []
    for i in range(size * 2):
        active = i in (0, size)
        context = browser.new_context(viewport={'width': (960 if size > 1 else 1280) if i == 0 else 320,
                                               'height': (720 if size > 1 else 960) if i == 0 else 500 if active else 400},
                                      device_scale_factor=1 if i == 0 else .5 if active else .25)
        context.add_init_script('(' + fixture.INSTRUMENT + ')();')
        contexts.append(context)
    pages = [context.new_page() for context in contexts]
    for i, page in enumerate(pages):
        native.observe(page, f'health/{size}v{size}/{i}')
    try:
        fixture.create_room(pages[0], size, 'courtyard')
        for page in pages[1:]:
            page.goto(pages[0].url)
            fixture.connected(page)
        pages = fixture.settled(pages)
        fixture.select_native(pages[0], 'select[data-keyboard-layout]', 'zqsd')
        return contexts, pages
    except BaseException:
        for context in contexts:
            context.close()
        raise


def screenshot(page, name, viewport=True):
    path = OUT / (name + '.png')
    target = page.locator('#viewport') if viewport else page
    target.screenshot(path=str(path), **({} if viewport else {'full_page': True}))
    REPORT['screenshots'].append(str(path))
    return str(path)


def meter(page, hp, visible=True):
    wait(page, 'hp=>document.querySelector("#health-meter").getAttribute("aria-valuenow")===String(hp)', hp)
    shown = page.evaluate('''()=>{
      const meter=document.querySelector('#health-meter'), fill=document.querySelector('#health-fill'),trail=document.querySelector('#health-trail');
      const rect=node=>{const r=node.getBoundingClientRect();return{x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width,height:r.height}};
      return{hp:Number(meter.getAttribute('aria-valuenow')),max:Number(meter.getAttribute('aria-valuemax')),
        label:meter.getAttribute('aria-label'),number:document.querySelector('#health').textContent,
        fill:parseFloat(fill.style.width),trail:parseFloat(trail.style.width),
        low:document.querySelector('#health-readout').classList.contains('low-health'),
        spectating:document.querySelector('#health-readout').classList.contains('is-spectating'),
        status:document.querySelector('#health-status').textContent,subject:document.querySelector('#health-subject').textContent,
        hpFont:parseFloat(getComputedStyle(document.querySelector('#health')).fontSize),
        meter:rect(meter),health:rect(document.querySelector('#health-readout')),weapon:rect(document.querySelector('#weapon-readout')),
        viewport:rect(document.querySelector('#viewport'))};
    }''')
    assert shown['hp'] == hp and shown['number'] == str(hp) and shown['max'] == 200, shown
    shown['percent'] = hp / shown['max'] * 100
    shown['trail_hp'] = shown['trail'] / 100 * shown['max']
    assert shown['fill'] == shown['percent'], ('HP fill disagrees with authoritative HP', shown)
    assert hp <= shown['trail_hp'] <= shown['max'], ('Damage trail outside real HP history', shown)
    if visible:
        assert page.locator('#health-meter').is_visible()
        assert shown['meter']['height'] >= 6, ('Compact health bar too thin to read', shown)
        assert shown['hpFont'] >= 20, ('Health number too small to read', shown)
        assert shown['health']['right'] <= shown['weapon']['x'] + 1, ('Health overlaps ammunition', shown)
        assert shown['health']['x'] >= shown['viewport']['x'] and shown['weapon']['right'] <= shown['viewport']['right'], shown
    return shown


def responsive_health(page, hp, name):
    results = []
    for width in (1280, 390, 320):
        page.set_viewport_size({'width': width, 'height': 960 if width == 1280 else 1000})
        page.wait_for_timeout(60)
        # Native viewport resizing releases pointer capture. Re-enter through
        # the real button so screenshots show health in play, not below blur.
        if actor(page)['alive']:
            native.enter_arena(page)
        assert not page.locator('#game-overlay').is_visible(), ('Combat obscured by controls-release overlay', width)
        native.no_overflow(page, f'{name}/{width}')
        observed = meter(page, hp)
        if observed['spectating']:
            spectator_boxes = page.locator('#spectator-hud,#spectator-hud>span,#next-spectator').evaluate_all('''nodes=>nodes
              .filter(node=>node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden')
              .map(node=>{const r=node.getBoundingClientRect();return{id:node.id||'spectator-label',x:r.x,right:r.right,y:r.y,bottom:r.bottom}})''')
            for box in spectator_boxes:
                for card in ('health', 'weapon'):
                    other = observed[card]
                    overlaps = box['x'] < other['right'] - 1 and box['right'] > other['x'] + 1 and box['y'] < other['bottom'] - 1 and box['bottom'] > other['y'] + 1
                    assert not overlaps, ('Spectator controls overlap combat readout', width, box, card, other)
            observed['spectator_boxes_without_overlap'] = spectator_boxes
        # Status, numerals and meter remain inside the readable health card.
        text_sizes = page.locator('#health-subject,#health-status,#health-max').evaluate_all(
            '(nodes)=>nodes.map(node=>({width:node.clientWidth,scroll:node.scrollWidth}))')
        assert all(item['scroll'] <= item['width'] + 1 for item in text_sizes), (width, text_sizes)
        screenshot(page, f'voxel-health-{name}-{width}')
        results.append({'width': width, 'meter': observed})
    page.set_viewport_size({'width': 1280, 'height': 960})
    if actor(page)['alive']:
        native.enter_arena(page)
    return results


def loadout_stats(page):
    catalog = page.evaluate('''async()=>{
      const {WEAPONS,WEAPON_IDS,weaponStats}=await import('/voxel-weapons.js');
      return WEAPON_IDS.map(id=>({id,name:WEAPONS[id].name,description:WEAPONS[id].description,stats:weaponStats(id)}));
    }''')
    assert len(catalog) == 9
    results = []
    for weapon in catalog:
        fixture.select_native(page, '#loadout-select', weapon['id'])
        wait(page, 'id=>document.querySelector("#weapon-comparison").dataset.weapon===id', weapon['id'])
        assert snapshot(page)['state']['phase'] == 'lobby'
        seen = page.evaluate('''()=>({name:document.querySelector('#comparison-name').textContent,
          body:Number(document.querySelector('#comparison-body').textContent),head:Number(document.querySelector('#comparison-head').textContent),
          leg:Number(document.querySelector('#comparison-leg').textContent),rate:document.querySelector('#comparison-rate').textContent,
          reload:document.querySelector('#comparison-reload').textContent,range:document.querySelector('#comparison-range').textContent,
          handling:document.querySelector('#comparison-handling').textContent,damageLabel:document.querySelector('#comparison-damage-label').textContent})''')
        stats = weapon['stats']
        assert seen['name'] == weapon['name']
        assert {key: seen[key] for key in ('body', 'head', 'leg')} == {key: stats[key] for key in ('body', 'head', 'leg')}, (weapon, seen)
        assert seen['rate'] == stats['fireRateLabel'] and seen['reload'] == f"{stats['reloadSeconds']:.2f} s", (weapon, seen)
        assert seen['leg'] < seen['body'] < seen['head'] and seen['range'] and seen['handling'], seen
        if weapon['id'] == 'shotgun':
            assert 'PELLET' in seen['damageLabel'] and str(stats['pellets']) in seen['damageLabel'], seen
        if weapon['id'] in ('smg', 'shotgun'):
            assert str(stats['falloffStart']) in seen['range'] and 'Falls after' in seen['range'], seen
        if weapon['id'] == 'crossbow':
            assert 'gravity' in seen['handling'] and '48 m/s' in seen['handling'], seen
        results.append({'weapon': weapon['id'], 'display': seen})
    # Native shortcut guards remain in effect while the setup select has focus.
    selected = page.locator('#loadout-select').input_value()
    page.keyboard.press('f')
    assert not snapshot(page)['input']['heal'] and actor(page)['potions'] == 1
    assert page.locator('#loadout-select').input_value() == selected
    for width in (1280, 390, 320):
        page.set_viewport_size({'width': width, 'height': 960 if width == 1280 else 1000})
        native.no_overflow(page, f'weapon-comparison/{width}')
        sizes = page.locator('#weapon-comparison,#comparison-rate,#comparison-range,#comparison-handling').evaluate_all(
            '(nodes)=>nodes.map(node=>({width:node.clientWidth,scroll:node.scrollWidth}))')
        assert all(item['scroll'] <= item['width'] + 1 for item in sizes), (width, sizes)
        screenshot(page, 'voxel-weapon-comparison-' + str(width), viewport=False)
    page.set_viewport_size({'width': 1280, 'height': 960})
    fixture.select_native(page, '#loadout-select', 'carbine')
    return {'all_nine_authoritative_catalog_stats': results, 'responsive_widths': [1280, 390, 320], 'form_key_guard_preserved': True}


def approach(shooter):
    for x, z in [(-20, -18), (-20, 18), (-8, 18)]:
        fixture.native_move(shooter, x, z)


def aim_at(shooter, target, height):
    body = actor(shooter)
    distance = native.horizontal_distance(body, target)
    yaw = math.atan2(target['x'] - body['x'], -(target['z'] - body['z']))
    eye = .98 if body['crouching'] else 1.62
    pitch = math.atan2(target['y'] + height - (body['y'] + eye), distance)
    return native.native_aim(shooter, yaw, pitch)


def damage_shot(shooter, victim, kind, expected_hp, height):
    target_id = snapshot(victim)['playerId']
    before = actor(victim)['hp']
    wait(shooter, 'id=>window.SemagVoxel.getState().state.players[id].shotCooldown===0', snapshot(shooter)['playerId'])
    event_id = snapshot(shooter)['state']['eventId']
    aim_at(shooter, actor(victim), height)
    shot = native.native_shot(shooter, duration=22)
    wait(victim, '([id,hp])=>window.SemagVoxel.getState().state.players[id].hp===hp', [target_id, expected_hp])
    events = [event for event in snapshot(shooter)['state']['events'] if event['id'] > event_id
              and event['type'] == 'damage' and event['targetId'] == target_id]
    assert len(events) == 1 and events[0]['hitKind'] == kind, (kind, shot, events)
    assert events[0]['damage'] == before - expected_hp and shot['hitKind'] == kind, (shot, events)
    return {'shot': shot, 'confirmed_damage': events[0], 'before_hp': before, 'after_hp': expected_hp}


def first_round(first, second):
    full = responsive_health(first, 200, 'full')
    native.enter_arena(first)
    native.cdp_key(first, 'f', 'KeyF')
    native.cdp_key(first, 'f', 'KeyF', 'keyUp')
    first.wait_for_timeout(90)
    assert actor(first)['potions'] == 1 and not actor(first)['healTicks'], 'Full health consumed potion'
    approach(second)
    aim_at(first, actor(second), 1.0)
    body = damage_shot(second, first, 'body', 172, 1.0)
    recent = meter(first, 172)
    assert recent['trail_hp'] > recent['hp'], ('Recent-damage trail did not hold previous HP', recent)
    screenshot(first, 'voxel-health-body-damage-trail')
    wait(second, 'document.querySelector("#combat-feedback").textContent==="HIT · 28 HP"', timeout=1200)
    body['feedback'] = second.locator('#combat-feedback').inner_text()
    leg = damage_shot(second, first, 'leg', 151, .27)
    wait(second, 'document.querySelector("#combat-feedback").textContent==="LEG HIT · 21 HP"', timeout=1200)
    leg['feedback'] = second.locator('#combat-feedback').inner_text()
    screenshot(second, 'voxel-health-confirmed-leg-hit')
    # Extra native contacts are required to reach the same genuine low-health
    # state now that full health is doubled. Every click confirms real damage.
    followups = [damage_shot(second, first, 'body', hp, 1.0) for hp in (123, 95, 67, 39)]
    low = followups[-1]
    warning = meter(first, 39)
    assert warning['low'] and warning['status'] == 'LOW HEALTH · FIND COVER', warning
    low_layouts = responsive_health(first, 39, 'low')
    first.wait_for_timeout(1050)
    settled = meter(first, 39)
    assert abs(settled['trail_hp'] - 39) < .01, ('Trail did not settle to actual HP', settled)
    native.enter_arena(first)
    event_id = snapshot(first)['state']['eventId']
    native.cdp_key(first, 'f', 'KeyF')
    first.wait_for_timeout(30)
    native.cdp_key(first, 'f', 'KeyF', 'keyUp')
    wait(first, 'window.SemagVoxel.getState().state.players[0].healTicks>0')
    assert actor(first)['potions'] == 0 and actor(first)['hp'] == 39
    wait(first, 'document.querySelector("#weapon-label").textContent==="HEALING POTION"', timeout=1200)
    screenshot(first, 'voxel-health-potion-channel')
    wait(first, 'window.SemagVoxel.getState().state.players[0].hp===99', timeout=5000)
    healed = next(event for event in snapshot(first)['state']['events'] if event['id'] > event_id and event['type'] == 'healComplete')
    assert healed['amount'] == 60 and healed['hp'] == 99
    healed_meter = meter(first, 99)
    assert healed_meter['trail_hp'] == 99 and not healed_meter['low'], healed_meter
    wait(first, '!document.querySelector("#health-gain").hidden')
    assert first.locator('#health-gain').inner_text() == '+60 HP'
    screenshot(first, 'voxel-health-healed-60')
    head = damage_shot(second, first, 'head', 15, 1.65)
    assert actor(first)['alive'], 'A single carbine headshot eliminated a 99 HP target'
    # Clamped confirmed damage remains honest on a lethal headshot.
    death = damage_shot(second, first, 'head', 0, 1.65)
    dead_meter = meter(first, 0, visible=False)
    assert dead_meter['status'] == 'ELIMINATED' and not actor(first)['alive']
    wait(second, 'document.querySelector("#combat-feedback").textContent.includes("HEADSHOT")', timeout=1200)
    death['feedback'] = second.locator('#combat-feedback').inner_text()
    assert 'HEADSHOT' in death['feedback']
    screenshot(second, 'voxel-health-headshot-elimination')
    wait(first, 'window.SemagVoxel.getState().state.phase==="buy"', timeout=18000)
    restore = meter(first, 200)
    assert restore['trail_hp'] == 200 and not restore['low'] and actor(first)['potions'] == 1
    sequence = [200, 172, 151, 123, 95, 67, 39, 99, 15, 0, 200]
    log('native_health_damage_heal_reset_passed', hp_sequence=sequence)
    return {'native_hp_sequence': sequence, 'body': body, 'leg': leg, 'low': low, 'native_low_health_followups': followups,
            'recent_damage_trail': recent, 'settled_damage_trail': settled, 'native_f_heal': healed,
            'healed_meter': healed_meter, 'survived_headshot': head, 'headshot_death': death, 'dead_meter': dead_meter,
            'round_reset': restore, 'full_responsive': full, 'low_responsive': low_layouts}


def cover_fire(first, second, weapon):
    native.enter_arena(first)
    native.native_aim(first, 0, 0)
    before = actor(first)
    event_id = snapshot(first)['state']['eventId']
    first.mouse.down(button='left')
    first.wait_for_timeout(50 if weapon == 'crossbow' else 24)
    first.mouse.up(button='left')
    kind = 'boltHit' if weapon == 'crossbow' else 'shot'
    wait(first, '([event,kind])=>window.SemagVoxel.getState().state.events.some(e=>e.id>event&&e.type===kind&&e.playerId===0)', [event_id, kind], timeout=3000)
    events = [event for event in snapshot(first)['state']['events'] if event['id'] > event_id
              and event['type'] == kind and event['playerId'] == 0]
    assert events and all(event['hitKind'] == 'wall' for event in events), (weapon, events)
    assert actor(first)['ammo'] == before['ammo'] - 1 and actor(second)['hp'] == 200
    profile = first.evaluate('async id=>(await import("/voxel-weapons.js")).WEAPONS[id].effects', weapon)
    if weapon == 'shotgun':
        assert len(events) == 8 and all(event['pelletCount'] == 8 for event in events)
        assert profile['muzzleTicks'] > 0 and profile['kickStrength'] > 1
    else:
        assert len(events) == 1 and events[0]['ageTicks'] > 0 and profile['muzzleTicks'] == 0 and profile['tracerTicks'] == 0
        assert not any(event['id'] > event_id and event['type'] == 'shot' for event in snapshot(first)['state']['events'])
    screenshot(first, 'voxel-weapon-health-' + weapon + '-cover')
    fixture.finite_state(first)
    return {'weapon': weapon, 'native_shot_events': events, 'render_effects_profile': profile,
            'drawn_cover_blocked': True, 'ammo_consumed_once': True, 'finite_renderer': True}


def health_and_weapons(browser):
    contexts, pages = room(browser)
    first, second = pages
    try:
        REPORT['cases'].append({'name': 'nine_loadout_stats', 'result': loadout_stats(first)})
        fixture.ready(pages)
        REPORT['cases'].append({'name': 'native_health_damage_and_healing', 'result': first_round(first, second)})
        fixture.select_native(first, '#loadout-select', 'shotgun')
        wait(first, 'window.SemagVoxel.getState().state.players[0].weapon==="shotgun"')
        wait(first, 'window.SemagVoxel.getState().state.phase==="fight"', timeout=14000)
        REPORT['cases'].append({'name': 'native_shotgun_cover', 'result': cover_fire(first, second, 'shotgun')})
        approach(second)
        damage_shot(second, first, 'head', 116, 1.65)
        damage_shot(second, first, 'head', 32, 1.65)
        damage_shot(second, first, 'body', 4, 1.0)
        damage_shot(second, first, 'body', 0, 1.0)
        wait(first, 'window.SemagVoxel.getState().state.phase==="buy"', timeout=18000)
        fixture.select_native(first, '#loadout-select', 'crossbow')
        wait(first, 'window.SemagVoxel.getState().state.players[0].weapon==="crossbow"')
        wait(first, 'window.SemagVoxel.getState().state.phase==="fight"', timeout=14000)
        REPORT['cases'].append({'name': 'native_crossbow_cover', 'result': cover_fire(first, second, 'crossbow')})
        REPORT['render_and_network_observation'] = fixture.performance(first, duration=600)
        log('native_weapon_profiles_passed', representative_weapons=['carbine', 'shotgun', 'crossbow'])
    except BaseException as error:
        for i, page in enumerate(pages):
            try:
                (OUT / f'failure-health-{i}.json').write_text(json.dumps({'error': str(error), 'observed': snapshot(page)}, indent=2))
                screenshot(page, 'failure-health-' + str(i), viewport=False)
            except BaseException:
                pass
        raise
    finally:
        for context in contexts:
            context.close()


def spectator_case(browser):
    contexts, pages = room(browser, size=2)
    first, teammate, shooter, _ = pages
    try:
        fixture.select_native(shooter, '#loadout-select', 'marksman')
        wait(shooter, 'window.SemagVoxel.getState().state.players[2].weapon==="marksman"')
        log('native_spectator_clients_connected', chosen_weapon='marksman')
        fixture.ready(pages)
        log('native_spectator_fight_started', tick=snapshot(first)['state']['tick'])
        # Real background tabs are natively frozen only while the shooter
        # navigates. The observed victim and ally are resumed before damage;
        # all four server connections must remain live through the probe.
        def lifecycle(page, status):
            session = page.context.new_cdp_session(page)
            session.send('Page.setWebLifecycleState', {'state': status})
            session.detach()
        for page in (first, teammate, pages[3]):
            lifecycle(page, 'frozen')
        # Behind the actual spawn row, then down the clear western corridor;
        # a stationary squadmate at (0,-18) is physically avoided.
        # Initial facing is south; a genuine backward key reaches the rear
        # lane without spending software-browser round trips on a 180° turn.
        native.enter_arena(shooter)
        shooter.keyboard.down('ArrowDown')
        try:
            wait(shooter, 'window.SemagVoxel.getState().state.players[2].z<=-19.8', timeout=4000)
        finally:
            shooter.keyboard.up('ArrowDown')
        for x, z in [(-6, -20), (-6, 16)]:
            fixture.native_move(shooter, x, z, timeout=45000)
        lane_tick = snapshot(shooter)['state']['tick']
        for page in (first, teammate):
            lifecycle(page, 'active')
            wait(page, 'tick=>window.SemagVoxel.getState().state.tick>=tick', lane_tick)
        log('native_spectator_shooter_in_lane', tick=lane_tick)
        opening = damage_shot(shooter, first, 'head', 84, 1.65)
        assert actor(first)['alive'], 'A single marksman headshot eliminated a full-health player'
        finishing = damage_shot(shooter, first, 'head', 0, 1.65)
        wait(first, 'document.querySelector("#health-readout").classList.contains("is-spectating")')
        viewed = meter(first, 200)
        assert viewed['spectating'] and viewed['status'] == 'TEAMMATE' and viewed['label'] != 'Your health', viewed
        assert actor(first)['hp'] == 0 and snapshot(first)['state']['phase'] == 'fight'
        squad_ids = first.locator('#squad-health [data-player-id]').evaluate_all('(nodes)=>nodes.map(node=>Number(node.dataset.playerId))')
        assert squad_ids == [1] and first.locator('#squad-health').is_visible(), squad_ids
        allied_hit = damage_shot(shooter, teammate, 'body', 142, 1.0)
        live = meter(first, 142)
        assert live['spectating'] and live['subject'] == viewed['subject'], live
        wait(first, 'document.querySelector("#squad-health [data-player-id=\\"1\\"] [role=meter]").getAttribute("aria-valuenow")==="142"')
        log('native_spectator_allied_health_changed', expected_hp=142, tick=snapshot(first)['state']['tick'])
        # After all trusted shots, the shooter can be a background tab while
        # the living teammate and dead local client's camera remain live.
        lifecycle(shooter, 'frozen')
        layouts = responsive_health(first, 142, 'allied-spectator')
        # Opposing roster does not expose health even to a dead spectator.
        enemy_text = first.locator('#team1-roster').inner_text()
        assert 'HP' not in enemy_text, enemy_text
        final = snapshot(first)
        assert len(final['players']) == 4 and all(person['connected'] for person in final['players']), final['players']
        assert final['state']['phase'] == 'fight' and final['state']['round'] == 1
        assert [person['id'] for person in final['state']['players'] if person['alive']] == [1, 2, 3]
        REPORT['cases'].append({'name': 'native_allied_spectator_health', 'result': {
            'dead_local_hp': 0, 'live_allied_hp': 142, 'meter_initial': viewed, 'meter_updated': live,
            'native_opening_headshot_survived': opening, 'native_finishing_headshot': finishing, 'native_allied_body_hit': allied_hit,
            'compact_squad_meter_current_hp': 142, 'compact_squad_contains_only_allies': squad_ids,
            'all_four_genuine_clients_still_connected': True, 'normal_round_timer_unchanged': True,
            'enemy_health_hidden': True, 'responsive': layouts}})
        log('native_allied_spectator_health_passed')
    except BaseException as error:
        try:
            (OUT / 'failure-health-spectator.json').write_text(json.dumps({'error': str(error), 'observed': snapshot(first)}, indent=2))
            screenshot(first, 'failure-health-spectator', viewport=False)
        except BaseException:
            pass
        raise
    finally:
        for context in contexts:
            context.close()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    selected = os.environ.get('SEMAG_HEALTH_CASES', 'all')
    if selected == 'teams' and (OUT / 'report.json').exists():
        previous = json.loads((OUT / 'report.json').read_text())
        REPORT.update(previous)
        REPORT['cases'] = [case for case in REPORT['cases'] if case['name'] != 'native_allied_spectator_health']
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                args=['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            try:
                if selected != 'teams':
                    health_and_weapons(browser)
                if selected == 'teams' or os.environ.get('SEMAG_HEALTH_SKIP_TEAMS') != '1':
                    spectator_case(browser)
            finally:
                browser.close()
    finally:
        REPORT['errors'] = list(dict.fromkeys([*REPORT.get('errors', []), *native.ERRORS]))
        REPORT['failed_resources'] = list(dict.fromkeys([*REPORT.get('failed_resources', []), *native.RESOURCES]))
        (OUT / 'report.json').write_text(json.dumps(REPORT, indent=2))
    assert not REPORT['errors'], REPORT['errors']
    assert not REPORT['failed_resources'], REPORT['failed_resources']
    print(json.dumps({'status': 'passed', 'cases': len(REPORT['cases']), 'report': str(OUT / 'report.json')}), flush=True)


if __name__ == '__main__':
    main()
