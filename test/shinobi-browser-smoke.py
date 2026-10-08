"""Genuine two-player QA for the faster Shinobi Showdown combat.

python test/shinobi-browser-smoke.py [http://127.0.0.1:3000]
SEMAG_SCREENSHOT_DIR selects the evidence directory. Requires Python Playwright
and Chromium. All gameplay uses browser keyboard, mouse or trusted CDP touch
input. firesideRoom only supplies copied observations; no state, socket, clock,
RAF or simulation injection is used. Headless software graphics are not a
physical PC frame-rate benchmark.
SEMAG_QA_CASES=desktop, touch or focus selects a bounded regression group.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import time
from urllib.parse import parse_qs, urlparse
from urllib.request import urlopen

from playwright.sync_api import sync_playwright
from browser_controls import click_control, controls_panel

ROOT = Path(__file__).resolve().parents[1]
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3000').rstrip('/')
OUT = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', ROOT / 'test-results' / 'shinobi'))
SOURCES = [
    'public/play.html', 'public/shinobi-engine.js', 'public/shinobi-input.js',
    'public/shinobi-renderer.js', 'public/shinobi.css', 'public/hub/room.js',
    'public/hub/room.css', 'public/hub/room-play.css', 'public/hub/theme.css',
    'public/keyboard-layout.js', 'public/keyboard-layout.css',
    'public/combat-controls.js',
    'public/network-timeline.js', 'public/planar-presentation.js', 'server.js',
]
ERRORS, RESOURCES, CHECKS = [], [], []


def hashes():
    result = {}
    for name in SOURCES:
        data = (ROOT / name).read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        if name.startswith('public/'):
            with urlopen(URL + '/' + name.removeprefix('public/')) as response:
                assert hashlib.sha256(response.read()).hexdigest() == digest, ('Stale served source', name)
        result[name] = digest
    return result


def wait(page, expression, arg=None, timeout=5000):
    return page.wait_for_function(expression, arg=arg, timeout=timeout, polling=5)


def state(page):
    return page.evaluate('window.firesideRoom.getState()')


def phase(page, value, timeout=12000):
    wait(page, 'phase=>window.firesideRoom?.getState().phase===phase', value, timeout)


def actor(page):
    return state(page)['fighters'][page.evaluate('window.firesideRoom.playerId')]


def focus(page):
    page.bring_to_front()
    page.locator('#arena').focus()


def idle(page):
    wait(page, '()=>["idle","run"].includes(window.firesideRoom.getState().fighters[window.firesideRoom.playerId].action)')


def stamina(page, minimum):
    wait(page, 'n=>window.firesideRoom.getState().fighters[window.firesideRoom.playerId].stamina>=n', minimum, 7000)


def aim(page, x, y):
    box = page.locator('#arena').bounding_box()
    assert box and box['width'] > 0 and box['height'] > 0
    page.mouse.move(box['x'] + x / 960 * box['width'], box['y'] + y / 640 * box['height'])


def event(page, after, kind, fields=None, timeout=3000):
    fields = fields or {}
    wait(page, '([id,kind,fields])=>window.firesideRoom.getState().events.some(e=>e.id>id&&e.type===kind&&Object.entries(fields).every(([k,v])=>e[k]===v))', [after, kind, fields], timeout)
    return next(e for e in state(page)['events'] if e['id'] > after and e['type'] == kind and all(e.get(k) == v for k, v in fields.items()))


def shot(page, name):
    path = OUT / (name + '.png')
    page.screenshot(path=str(path), full_page=True)
    return str(path)


def failure_evidence(pages, prefix):
    evidence = []
    for index, page in enumerate(pages):
        try:
            observed = state(page)
            (OUT / (prefix + '-' + str(index) + '.json')).write_text(json.dumps(observed, indent=2) + '\n')
            evidence.append({'state': observed, 'input': page.evaluate('window.firesideRoom.getInputState?.()'),
                             'nativeEvents': page.evaluate('window.__shinobiNativeEvents||[]'),
                             'screenshot': shot(page, prefix + '-' + str(index))})
        except Exception as error:
            evidence.append({'captureError': repr(error)})
    (OUT / (prefix + '-evidence.json')).write_text(json.dumps(evidence, indent=2) + '\n')
    return evidence


def check(name, evidence):
    CHECKS.append({'name': name, 'passed': True, 'evidence': evidence})
    print('PASS ' + name, flush=True)


def move(page, target, timeout=9000):
    """An observed native controller; cover still blocks an invalid route."""
    focus(page)
    seat = page.evaluate('window.firesideRoom.playerId')
    deadline = time.monotonic() + timeout / 1000
    held = None
    try:
        while time.monotonic() < deadline:
            current = state(page)
            assert current['phase'] == 'fight', ('Move interrupted', current['phase'])
            f = current['fighters'][seat]
            dx, dy = target[0] - f['x'], target[1] - f['y']
            if abs(dx) < 7 and abs(dy) < 7:
                if held:
                    page.keyboard.up(held)
                    held = None
                page.wait_for_timeout(70)
                f = actor(page)
                if abs(target[0] - f['x']) < 10 and abs(target[1] - f['y']) < 10:
                    return f
            near = max(abs(dx), abs(dy)) < 70
            wanted = ('ArrowRight' if dx > 0 else 'ArrowLeft') if abs(dx) >= 7 else ('ArrowDown' if dy > 0 else 'ArrowUp')
            if held != wanted:
                if held:
                    page.keyboard.up(held)
                page.keyboard.down(wanted)
                held = wanted
            page.wait_for_timeout(18 if near else 30)
            if near:
                page.keyboard.up(held)
                held = None
                page.wait_for_timeout(60)
    finally:
        if held:
            page.keyboard.up(held)
    raise AssertionError(('Native move failed', target, actor(page)))


def watch(page, label):
    page.on('pageerror', lambda error: ERRORS.append(label + ': ' + str(error)))
    page.on('console', lambda message: ERRORS.append(label + ': ' + message.text) if message.type == 'error' else None)
    page.on('response', lambda response: RESOURCES.append(label + ': ' + str(response.status) + ' ' + response.url) if response.status >= 400 else None)


def create_pair(browser, touch=False):
    contexts = [browser.new_context(viewport={'width': 390 if touch else 1365, 'height': 900}, has_touch=touch, device_scale_factor=2 if touch else 1) for _ in range(2)]
    pages = [context.new_page() for context in contexts]
    for i, page in enumerate(pages):
        watch(page, ('touch' if touch else 'desktop') + '-P' + str(i + 1))
        page.goto(URL + '/')
    first, second = pages
    first.locator('[data-create-game="shinobi-showdown"]').click()
    first.wait_for_url('**/*room=*')
    wait(first, 'window.firesideRoom?.connected&&window.firesideRoom.playerId===0')
    code = parse_qs(urlparse(first.url).query)['room'][0]
    second.locator('#room-code').fill(code.lower())
    second.locator('#join-button').click()
    second.wait_for_url('**/*room=*')
    wait(second, 'window.firesideRoom?.connected&&window.firesideRoom.playerId===1')
    return contexts, pages


def ready_pair(first, second, fence=False):
    click_control(first, '#ready-button')
    wait(first, 'document.querySelector("#ready-button span").textContent==="Cancel ready"')
    assert state(first)['phase'] == 'lobby', 'One ready player started the duel'
    click_control(second, '#ready-button')
    phase(first, 'countdown')
    if fence:
        focus(first)
        aim(first, 500, 320)
        first.keyboard.down('c')
        first.keyboard.down('Space')
    phase(first, 'fight')
    phase(second, 'fight')
    if fence:
        first.wait_for_timeout(180)
        current = state(first)
        assert not any(e['type'] in ('attack', 'dash') for e in current['events']), ('Held pre-bell action leaked', current)
        assert actor(first)['stamina'] == 100 and actor(first)['action'] in ('idle', 'run')
        first.keyboard.up('c')
        first.keyboard.up('Space')
        check('Both-ready gate and held countdown action fence', {'phase': current['phase'], 'stamina': actor(first)['stamina']})


def french_movement(page):
    with controls_panel(page, 'select[data-keyboard-layout]') as picker:
        picker.select_option('zqsd')
    focus(page)
    before = actor(page)
    # Trusted Chromium key/code pair of a French Q key at physical KeyA.
    session = page.context.new_cdp_session(page)
    try:
        session.send('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': 'q', 'code': 'KeyA', 'windowsVirtualKeyCode': 81, 'text': 'q'})
        wait(page, 'x=>window.firesideRoom.getState().fighters[0].x<x-20', before['x'])
        session.send('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': 'q', 'code': 'KeyA', 'windowsVirtualKeyCode': 81})
    finally:
        session.detach()
    wait(page, '!window.firesideRoom.getState().fighters[0].previousInput.left')
    released = actor(page)
    page.wait_for_timeout(120)
    settled = actor(page)
    assert abs(settled['x'] - released['x']) < .01 and abs(settled['y'] - released['y']) < .01, ('Released movement drift', released, settled)
    check('French physical Q movement and released movement', {'before': before['x'], 'after': settled['x']})


def rapid_commitments(page):
    page.evaluate('''()=>{
        window.__shinobiNativeEvents=[];
        for(const type of ['pointerdown','pointerup','pointermove','mousedown','mouseup','lostpointercapture','pointercancel','keydown','keyup'])
            window.addEventListener(type,event=>{
                if(event.target?.id!=='arena')return;
                const state=window.firesideRoom.getState(),fighter=state.fighters[window.firesideRoom.playerId];
                window.__shinobiNativeEvents.push({type,trusted:event.isTrusted,button:event.button,buttons:event.buttons,key:event.key,code:event.code,
                    sourceTouch:event.sourceCapabilities?.firesTouchEvents,
                    input:window.firesideRoom.getInputState?.(),
                    tick:state.tick,action:fighter.action,frame:fighter.actionFrame,stamina:fighter.stamina});
                if(window.__shinobiNativeEvents.length>128)window.__shinobiNativeEvents.shift();
            });
    }''')
    focus(page)
    idle(page)
    f = actor(page)
    aim(page, f['x'], f['y'] - 150)
    before = state(page)['eventId']
    page.mouse.down(button='left')
    page.mouse.up(button='left')
    aim(page, f['x'] + 150, f['y'])
    cut = event(page, before, 'attack', {'fighter': 0, 'action': 'light'})
    assert math.cos(cut['facing']) < .15 and math.sin(cut['facing']) < -.9, ('Short press lost its commitment aim', cut)
    idle(page)
    stamina(page, 40)
    f = actor(page)
    aim(page, f['x'] + 150, f['y'])
    before = state(page)['eventId']
    # A second physical mouse button while LMB is held can surface only as a
    # pointermove buttons transition. Tap it late enough to be a legal buffer.
    page.mouse.down(button='left')
    event(page, before, 'attack', {'action': 'light'})
    wait(page, 'window.firesideRoom.getState().fighters[0].action==="light"&&window.firesideRoom.getState().fighters[0].actionFrame>=23')
    page.mouse.down(button='right')
    page.mouse.up(button='right')
    aim(page, f['x'], f['y'] + 150)
    heavy = event(page, before, 'attack', {'action': 'heavy'})
    page.mouse.up(button='left')
    assert math.cos(heavy['facing']) > .9 and abs(math.sin(heavy['facing'])) < .15, ('Chorded RMB lost press-time aim', heavy)
    idle(page)
    wait(page, '!window.firesideRoom.getState().fighters[0].previousInput.attack&&!window.firesideRoom.getState().fighters[0].previousInput.heavy')
    check('Zero-delay mouse taps, chorded RMB and press-time aim', {'cut': cut, 'heavy': heavy})


def cover_and_body(first, second):
    stamina(first, 28)
    move(first, (220, 320))
    move(first, (220, 220))
    focus(first)
    aim(first, 500, 220)
    previous = state(first)['eventId']
    first.keyboard.press('Space')
    event(first, previous, 'dash', {'fighter': 0})
    idle(first)
    f = actor(first)
    assert abs(f['x'] - 255) < .05, ('Dash crossed rooftop chimney', f)
    shot(first, 'shinobi-dash-cover')
    move(first, (220, 220))
    move(first, (220, 320))
    move(second, (500, 320))
    move(first, (440, 320))
    stamina(first, 28)
    focus(first)
    target = actor(second)
    aim(first, target['x'], target['y'])
    previous = state(first)['eventId']
    first.keyboard.press('Space')
    event(first, previous, 'dash', {'fighter': 0})
    samples = []
    deadline = time.monotonic() + 3
    while time.monotonic() < deadline:
        observed = state(first)
        a, b = observed['fighters']
        presented = first.evaluate('window.firesideRoom.getPresentation()?.fighters')
        samples.append({'tick': observed['tick'], 'gap': math.hypot(a['x'] - b['x'], a['y'] - b['y']),
                        'action': a['action'], 'frame': a['actionFrame'],
                        'presentationGap': math.hypot(presented[0]['x'] - presented[1]['x'], presented[0]['y'] - presented[1]['y']) if presented else None})
        if a['action'] != 'dash':
            break
        first.wait_for_timeout(8)
    idle(first)
    bodies = state(first)['fighters']
    gap = math.hypot(bodies[0]['x'] - bodies[1]['x'], bodies[0]['y'] - bodies[1]['y'])
    assert gap >= 29.999 and min(sample['gap'] for sample in samples) >= 29.999, ('Dash penetrated another body', bodies, samples)
    assert all(sample['presentationGap'] is None or sample['presentationGap'] >= 29.999 for sample in samples), ('Displayed dash body overlap', samples)
    assert min(sample['gap'] for sample in samples) < 31, ('Dash did not actually touch another body', samples)
    move(first, (440, 320))
    check('Swept dash cover and fighter-body collision', {'chimneyStop': f['x'], 'bodyGap': gap, 'nativeDashSamples': samples})


def chains_and_feint(first, second):
    stamina(first, 90)
    move(first, (440, 320))
    move(second, (500, 320))
    focus(first)
    aim(first, 500, 320)
    before = state(first)
    hits, chains = [], []
    first.keyboard.press('c')
    for combo in (1, 2, 3):
        hit = event(first, before['eventId'], 'hit', {'fighter': 0, 'target': 1, 'attack': 'light', 'comboStep': combo})
        hits.append(hit)
        if combo < 3:
            first.keyboard.press('c')
            chains.append(event(first, hit['id'], 'chain', {'fighter': 0, 'comboStep': combo + 1}))
    idle(first)
    assert actor(second)['hp'] == before['fighters'][1]['hp'] - 54
    shot(first, 'shinobi-confirmed-three-cut-chain')
    stamina(first, 38)
    focus(first)
    aim(first, 500, 320)
    before = state(first)
    first.keyboard.press('g')
    event(first, before['eventId'], 'attack', {'action': 'heavy'})
    wait(first, 'window.firesideRoom.getState().fighters[0].action==="heavy"&&window.firesideRoom.getState().fighters[0].actionFrame>=5')
    first.keyboard.press('r')
    feint = event(first, before['eventId'], 'feint', {'fighter': 0})
    idle(first)
    after = state(first)
    assert after['fighters'][1]['hp'] == before['fighters'][1]['hp'], ('Feinted heavy still damaged opponent', before, after)
    assert after['fighters'][0]['stamina'] <= before['fighters'][0]['stamina'] - 37, ('Feint refunded commitment cost', before, after)
    check('Real hit-confirmed three-cut chain and costly heavy feint', {'hits': hits, 'chains': chains, 'feint': feint, 'rivalHP': actor(second)['hp'],
          'trustedFeintPresses': first.evaluate('(window.__shinobiNativeEvents||[]).filter(e=>e.code==="KeyR")')})


def parry_and_deflect(first, second):
    idle(first)
    idle(second)
    stamina(first, 26)
    stamina(second, 20)
    focus(second)
    aim(second, 440, 320)
    focus(first)
    aim(first, 500, 320)
    before = state(first)
    first.keyboard.press('g')
    wait(first, 'window.firesideRoom.getState().fighters[0].action==="heavy"&&window.firesideRoom.getState().fighters[0].actionFrame>=14')
    focus(second)
    second.keyboard.press('f')
    parry = event(first, before['eventId'], 'parry', {'fighter': 1, 'target': 0})
    assert actor(second)['hp'] == before['fighters'][1]['hp']
    assert state(first)['fighters'][0]['action'] == 'stun'
    idle(first)
    idle(second)
    # At 100 pixels, release startup plus travel is approximately 150 ms;
    # send the reactive directional parry just before actual tool contact.
    move(first, (400, 320))
    stamina(second, 20)
    focus(second)
    aim(second, 400, 320)
    focus(first)
    aim(first, 500, 320)
    before = state(first)
    first.keyboard.press('e')
    first.wait_for_timeout(90)
    focus(second)
    second.keyboard.press('f')
    deflect = event(first, before['eventId'], 'deflect', {'fighter': 1})
    assert actor(second)['hp'] == before['fighters'][1]['hp']
    reflected = event(first, deflect['id'], 'hit', {'fighter': 1, 'target': 0, 'attack': 'kunai'})
    shot(first, 'shinobi-native-parry-deflect')
    check('Directional reactive heavy parry and genuine kunai reflection', {'parry': parry, 'deflect': deflect, 'reflectedHit': reflected})


def layouts(page):
    for width in (1365, 390, 320):
        page.set_viewport_size({'width': width, 'height': 900})
        page.wait_for_timeout(90)
        sizes = page.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})')
        assert sizes['scroll'] <= sizes['width'], ('Horizontal overflow', width, sizes)
        for selector in ('#p1-health-track', '#p2-health-track', '#timer'):
            box = page.locator(selector).bounding_box()
            assert box and box['width'] > 8 and box['height'] > 2 and box['x'] >= -1 and box['x'] + box['width'] <= width + 1, ('HUD outside view', width, selector, box)
        assert 'health:' in page.locator('#p1-health-track').get_attribute('aria-label')
        shot(page, 'shinobi-hud-' + str(width))
    page.set_viewport_size({'width': 1365, 'height': 900})
    check('Desktop, 390 and 320 pixel HUD readability', {'widths': [1365, 390, 320]})


def actual_match(first, second):
    routes = {1: [(440, 320)], 2: [(806, 90), (190, 90), (190, 320)], 3: [(154, 75), (746, 75), (746, 220)]}
    visited, wins = [], []
    for number, shooter in ((1, 0), (2, 1), (3, 0)):
        phase(first, 'fight')
        current = state(first)
        assert current['round'] == number
        visited.append(current['stageId'])
        page, rival = (first, second) if shooter == 0 else (second, first)
        if number == 1:
            move(second, (500, 320))
        for point in routes[number]:
            move(page, point)
        deadline = time.monotonic() + 16
        while state(first)['phase'] == 'fight' and time.monotonic() < deadline:
            focus(page)
            idle(page)
            stamina(page, 26)
            target = actor(rival)
            aim(page, target['x'], target['y'])
            before = state(first)['eventId']
            page.keyboard.press('g')
            event(first, before, 'hit', {'fighter': shooter, 'target': 1 - shooter, 'attack': 'heavy'})
        phase(first, 'roundEnd')
        ended = state(first)
        assert ended['winner'] == shooter and ended['fighters'][1 - shooter]['hp'] == 0, ('Native knockout failed', ended)
        wins.append([f['wins'] for f in ended['fighters']])
        shot(first, 'shinobi-' + current['stageId'] + '-knockout')
        if number < 3:
            phase(first, 'countdown')
            reset = state(first)
            assert all(f['hp'] == 100 and f['stamina'] == 100 and f['comboStep'] == 0 and f['inputBuffer'] is None for f in reset['fighters']), ('Round failed to reset combat', reset)
    phase(first, 'matchEnd')
    phase(second, 'matchEnd')
    assert state(first)['winner'] == 0 and [f['wins'] for f in state(first)['fighters']] == [2, 1]
    # Authoritative phase changes immediately; the compact DOM HUD paints on
    # its existing cadence. Await the real visible action before activating it.
    wait(first, 'document.querySelector("#room-app").dataset.phase==="matchEnd"')
    first.locator('#ready-button').wait_for(state='visible')
    click_control(first, '#ready-button')
    first.wait_for_timeout(100)
    assert state(first)['phase'] == 'lobby', 'One player started rematch'
    click_control(second, '#ready-button')
    phase(first, 'fight')
    reset = state(first)
    assert reset['round'] == 1 and reset['stageId'] == 'rooftop' and all(f['wins'] == 0 and f['hp'] == 100 and f['stamina'] == 100 for f in reset['fighters'])
    check('Three genuine arena knockouts, round reset and both-ready rematch', {'arenas': visited, 'wins': wins, 'rematchRound': reset['round']})


def touch_event(page, selector, duration=0, offset=(0, 0), cancel=False, point=None):
    element = page.locator(selector)
    if point is None:
        box = element.bounding_box()
        viewport = page.viewport_size
        if not box or box['x'] < 0 or box['y'] < 0 or box['x'] + box['width'] > viewport['width'] + 1 or box['y'] + box['height'] > viewport['height'] + 1:
            element.scroll_into_view_if_needed()
            box = element.bounding_box()
        assert box and box['width'] >= 44 and box['height'] >= 44, ('Small touch control', selector, box)
        point = {'x': box['x'] + box['width'] * (.5 + offset[0]), 'y': box['y'] + box['height'] * (.5 + offset[1]), 'id': 7}
    session = page.context.new_cdp_session(page)
    try:
        session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [point]})
        if duration:
            page.wait_for_timeout(duration)
        session.send('Input.dispatchTouchEvent', {'type': 'touchCancel' if cancel else 'touchEnd', 'touchPoints': []})
    finally:
        session.detach()
    return element


def touch_controls(browser):
    contexts, pages = create_pair(browser, touch=True)
    first, second = pages
    try:
        ready_pair(first, second)
        first.evaluate('''()=>{
            window.__shinobiNativeEvents=[];
            for(const type of ['pointerdown','pointerup','pointercancel','lostpointercapture','touchstart','touchend'])
                window.addEventListener(type,event=>{
                    const button=event.target.closest?.('[data-shinobi-action]');
                    if(!button)return;
                    const state=window.firesideRoom.getState(),fighter=state.fighters[0];
                    window.__shinobiNativeEvents.push({type,trusted:event.isTrusted,action:button.dataset.shinobiAction,
                        phase:state.phase,frame:fighter.actionFrame,stance:fighter.action,stamina:fighter.stamina,
                        tick:state.tick,input:window.firesideRoom.getInputState?.()});
                });
        }''')
        first.bring_to_front()
        before = actor(first)
        touch_event(first, '[data-shinobi-pad="move"]', 140, (.3, 0), cancel=True)
        wait(first, '!window.firesideRoom.getState().fighters[0].previousInput.right')
        moved = actor(first)
        assert moved['x'] > before['x'] + 15
        touch_event(first, '[data-shinobi-pad="aim"]', 80, (.3, -.2))
        wait(first, 'window.firesideRoom.getState().fighters[0].aimY<-.2')
        events = []
        for action in ('attack', 'heavy', 'throw', 'parry', 'dash'):
            idle(first)
            stamina(first, 32)
            before = state(first)['eventId']
            touch_event(first, '[data-shinobi-action="' + action + '"]')
            kind = 'attack' if action in ('attack', 'heavy') else 'parryStart' if action == 'parry' else action
            events.append(event(first, before, kind, {'fighter': 0}))
            wait(first, 'action=>!window.firesideRoom.getState().fighters[0].previousInput[action]', action)
        idle(first)
        stamina(first, 38)
        feint_box = first.locator('[data-shinobi-action="feint"]').bounding_box()
        assert feint_box and feint_box['width'] >= 44 and feint_box['height'] >= 44
        feint_point = {'x': feint_box['x'] + feint_box['width'] / 2,
                       'y': feint_box['y'] + feint_box['height'] / 2, 'id': 7}
        before = state(first)['eventId']
        touch_event(first, '[data-shinobi-action="heavy"]')
        event(first, before, 'attack', {'action': 'heavy'})
        # The game intentionally buffers an early feint until frame 6. Keep
        # this genuine reaction free of extra DOM/stability waits mid-windup.
        touch_event(first, '[data-shinobi-action="feint"]', point=feint_point)
        events.append(event(first, before, 'feint', {'fighter': 0}))
        assert first.locator('[data-shinobi-action]').count() == 6
        shot(first, 'shinobi-touch-six-actions-390')
        first.set_viewport_size({'width': 320, 'height': 900})
        first.wait_for_timeout(90)
        assert first.evaluate('document.documentElement.scrollWidth<=innerWidth')
        for button in first.locator('[data-shinobi-action]').all():
            box = button.bounding_box()
            assert box['width'] >= 44 and box['height'] >= 44
        shot(first, 'shinobi-touch-six-actions-320')
        first.set_viewport_size({'width': 900, 'height': 600})
        first.locator('#fullscreen-button').click()
        wait(first, '!!document.fullscreenElement')
        idle(first)
        stamina(first, 20)
        before = state(first)['eventId']
        touch_event(first, '[data-shinobi-action="parry"]')
        event(first, before, 'parryStart', {'fighter': 0})
        shot(first, 'shinobi-touch-fullscreen')
        first.locator('#fullscreen-button').click()
        wait(first, '!document.fullscreenElement')
        check('Trusted touch move, aim, six combat actions and fullscreen', {'actions': events, 'cancelReleasesMovement': True,
              'trustedTouchEvents': first.evaluate('window.__shinobiNativeEvents')})
    except Exception:
        failure_evidence(pages, 'failure-touch')
        raise
    finally:
        for context in contexts:
            context.close()


def focus_mouse_fence(first, second):
    """Keep real mouse buttons physically held across actual browser/UI reset."""
    first.evaluate('''()=>{
        window.__shinobiFocusEvents=[];
        for(const type of ['blur','focus','visibilitychange'])
            (type==='visibilitychange'?document:window).addEventListener(type,event=>{
                window.__shinobiFocusEvents.push({type,trusted:event.isTrusted,visible:document.visibilityState,
                    input:window.firesideRoom.getInputState(),tick:window.firesideRoom.getState().tick});
            });
    }''')
    focus(first)
    idle(first)
    stamina(first, 70)
    f = actor(first)
    aim(first, f['x'], f['y'] - 120)
    before = state(first)['eventId']
    first.mouse.down(button='left')
    event(first, before, 'attack', {'fighter': 0, 'action': 'light'})
    idle(first)
    before = state(first)['eventId']
    # Playwright forces each headless context to retain focus. Remove that
    # environment override and foreground a real tab in the same context;
    # Chromium, rather than a fabricated DOM event, supplies trusted blur.
    session = first.context.new_cdp_session(first)
    foreground = None
    try:
        session.send('Emulation.setFocusEmulationEnabled', {'enabled': False})
        foreground = first.context.new_page()
        foreground.goto('about:blank')
        foreground.bring_to_front()
        wait(first, '!document.hasFocus()')
        wait(first, '!window.firesideRoom.getInputState().buttons.attack')
    finally:
        if foreground:
            foreground.close()
        first.bring_to_front()
        session.send('Emulation.setFocusEmulationEnabled', {'enabled': True})
        session.detach()
    focus(first)
    f = actor(first)
    aim(first, f['x'] + 150, f['y'])
    first.wait_for_timeout(160)
    current = state(first)
    assert not first.evaluate('window.firesideRoom.getInputState().buttons.attack'), ('Held LMB rearmed after native blur', current)
    assert not any(e['id'] > before and e['type'] == 'attack' for e in current['events']), ('Pointer movement invented an attack after blur', current)
    # A genuinely fresh secondary button remains usable while the old primary
    # button is still physically down. It must not rearm that primary button.
    first.mouse.down(button='right')
    first.mouse.up(button='right')
    aim(first, f['x'], f['y'] + 120)
    heavy = event(first, before, 'attack', {'fighter': 0, 'action': 'heavy'})
    assert math.cos(heavy['facing']) > .9, ('Fresh secondary commitment lost its original aim', heavy)
    idle(first)
    current = state(first)
    attacks = [e for e in current['events'] if e['id'] > before and e['type'] == 'attack']
    assert len(attacks) == 1 and attacks[0]['action'] == 'heavy', ('Fresh RMB rearmed old held LMB', attacks)
    assert not first.evaluate('window.firesideRoom.getInputState().buttons.attack')
    first.mouse.up(button='left')
    before = state(first)['eventId']
    aim(first, f['x'], f['y'] - 120)
    first.mouse.down(button='left')
    first.mouse.up(button='left')
    fresh = event(first, before, 'attack', {'fighter': 0, 'action': 'light'})
    assert math.sin(fresh['facing']) < -.9
    idle(first)

    # Open real controls using native keyboard activation, keeping the mouse
    # physically held. Browser modal Escape performs the genuine reset path.
    stamina(first, 14)
    before = state(first)['eventId']
    first.mouse.down(button='left')
    event(first, before, 'attack', {'fighter': 0, 'action': 'light'})
    idle(first)
    before = state(first)['eventId']
    first.locator('#room-panel-button').focus()
    first.keyboard.press('Space')
    wait(first, 'document.getElementById("room-panel").open')
    wait(first, '!window.firesideRoom.getInputState().buttons.attack')
    first.keyboard.press('Escape')
    wait(first, '!document.getElementById("room-panel").open')
    focus(first)
    aim(first, f['x'] + 150, f['y'])
    first.wait_for_timeout(160)
    current = state(first)
    assert not first.evaluate('window.firesideRoom.getInputState().buttons.attack'), ('Held mouse rearmed after help closed', current)
    assert not any(e['id'] > before and e['type'] == 'attack' for e in current['events']), ('Help return invented a mouse attack', current)
    first.mouse.up(button='left')
    before = state(first)['eventId']
    first.mouse.down(button='left')
    first.mouse.up(button='left')
    restarted = event(first, before, 'attack', {'fighter': 0, 'action': 'light'})
    shot(first, 'shinobi-native-focus-fence')
    transitions = first.evaluate('window.__shinobiFocusEvents')
    assert any(e['type'] == 'blur' and e['trusted'] for e in transitions), ('Probe never caused real native blur', transitions)
    check('Real blur/help held-mouse fences and fresh secondary/primary presses', {
        'freshSecondary': heavy, 'freshPrimary': fresh, 'afterHelp': restarted, 'nativeFocusEvents': transitions,
        'trustedMouseEvents': first.evaluate('window.__shinobiNativeEvents||[]')})


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    cases = os.environ.get('SEMAG_QA_CASES', 'full')
    assert cases in ('full', 'desktop', 'touch', 'focus'), ('Unknown case selection', cases)
    initial = hashes()
    report = {'checks': CHECKS, 'errors': ERRORS, 'resourceErrors': RESOURCES, 'runtimeHashesBefore': initial, 'status': 'running', 'nativeInputOnly': True, 'cases': cases}
    active_pages = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'])
            if cases in ('full', 'desktop', 'focus'):
                contexts, pages = create_pair(browser)
                active_pages = pages
                first, second = pages
                try:
                    shot(first, 'shinobi-ready')
                    ready_pair(first, second, fence=True)
                    if cases != 'focus':
                        french_movement(first)
                    rapid_commitments(first)
                    if cases == 'focus':
                        focus_mouse_fence(first, second)
                    else:
                        cover_and_body(first, second)
                        chains_and_feint(first, second)
                        parry_and_deflect(first, second)
                        layouts(first)
                        actual_match(first, second)
                except Exception:
                    report['failureEvidence'] = failure_evidence(pages, 'failure-desktop')
                    raise
                finally:
                    for context in contexts:
                        context.close()
                active_pages = []
            if cases in ('full', 'touch'):
                touch_controls(browser)
            browser.close()
        assert not ERRORS and not RESOURCES, ('Browser or resource errors', ERRORS, RESOURCES)
        report['runtimeHashesAfter'] = hashes()
        assert report['runtimeHashesAfter'] == initial, 'Runtime changed while native proof was running'
        report['status'] = 'passed'
        print('PASS all Shinobi native checks', flush=True)
    except Exception as error:
        report['status'] = 'failed'
        report['failure'] = repr(error)
        for index, page in enumerate(active_pages):
            try:
                report.setdefault('failureStates', []).append(state(page))
                shot(page, 'failure-' + str(index))
            except Exception:
                pass
        raise
    finally:
        (OUT / 'report.json').write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    main()
