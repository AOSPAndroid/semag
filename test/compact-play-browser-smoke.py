"""Independent native browser checks for Semag's compact play pages.

python test/compact-play-browser-smoke.py http://127.0.0.1:3000
SEMAG_SCREENSHOT_DIR changes the report/screenshot directory.
Only genuine browser keyboard/mouse/click input affects games. JavaScript is
used to read DOM geometry and the existing read-only game snapshots. No game
state, clock, animation scheduler, or network input is injected. SwiftShader
checks rendering/interaction, not a hardware performance benchmark.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import urllib.request
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', '/workspace/scratch/semag-compact-ui-browser'))
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3000').rstrip('/')
REPORT = {'cases': [], 'errors': [], 'failed_resources': [], 'screenshots': [], 'measurements': {},
          'native_gameplay_only': True, 'software_webgl_only': True, 'sources': {}}
SOURCE_NAMES = ('solo.html', 'solo/solo.js', 'solo/solo.css', 'solo/play.css', 'play.html',
                'hub/room.js', 'hub/room.css', 'hub/room-play.css', 'afterimage.html', 'style.css',
                'client.js', 'voxel.html', 'voxel.css', 'voxel-client.js', 'voxel-royale.html',
                'voxel-royale.css', 'voxel-royale-client.js', 'voxel-play.css', 'keyboard-layout.js',
                'checkers-view.js', 'solo/survival-view.js', 'solo/survival.css', 'solo/shadow-view.js', 'solo/shadow.css', 'solo/render-sampling.js')


def hashes():
    return {name: hashlib.sha256((ROOT / 'public' / name).read_bytes()).hexdigest()
            for name in SOURCE_NAMES if (ROOT / 'public' / name).exists()}


def log(stage, **details):
    print(json.dumps({'stage': stage, **details}), flush=True)


def case(name, **details):
    REPORT['cases'].append({'name': name, **details})
    log('compact-play-pass', name=name, **details)


def wait(page, expression, arg=None, timeout=18000):
    return page.wait_for_function(expression, arg=arg, polling=30, timeout=timeout)


def observe(page, name):
    page.on('pageerror', lambda error: REPORT['errors'].append(f'{name}: {error}'))
    page.on('console', lambda message: REPORT['errors'].append(f'{name}: {message.text}') if message.type == 'error' else None)
    page.on('response', lambda response: REPORT['failed_resources'].append(f'{name}: {response.status} {response.url}') if response.status >= 400 else None)


def screenshot(page, name):
    path = OUT / (name + '.png')
    page.screenshot(path=str(path), full_page=True)
    REPORT['screenshots'].append(str(path))


def no_overflow(page, name):
    box = page.evaluate('''()=>({width:innerWidth,body:document.body.scrollWidth,
      html:document.documentElement.scrollWidth,height:innerHeight,scrollHeight:document.body.scrollHeight})''')
    assert max(box['body'], box['html']) <= box['width'] + 1, (name, box)
    return box


def measure(page, name, selector, desktop_fit=False):
    page.mouse.wheel(0, -5000)
    page.wait_for_timeout(90)
    rect = page.locator(selector).bounding_box()
    browser = page.viewport_size
    visible_width = max(0, min(rect['x'] + rect['width'], browser['width']) - max(0, rect['x']))
    visible_height = max(0, min(rect['y'] + rect['height'], browser['height']) - max(0, rect['y']))
    box = no_overflow(page, name)
    measurement = {'viewport': rect, 'canvas_area': rect['width'] * rect['height'],
                   'visible_area': visible_width * visible_height, 'visible_fraction': visible_width * visible_height / (rect['width'] * rect['height']),
                   'page': box, 'browser': browser}
    REPORT['measurements'][name] = measurement
    if desktop_fit:
        assert rect['y'] >= -1 and rect['y'] + rect['height'] <= browser['height'] + 1, (name, measurement)
        assert measurement['visible_fraction'] > .99, (name, measurement)
    return measurement


def create_room(game, **settings):
    request = urllib.request.Request(URL + '/api/rooms', data=json.dumps({'gameId': game, 'name': 'Native compact UI QA', **settings}).encode(),
                                    headers={'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(request))['room']['id']


def get(page, expression):
    return page.evaluate(expression)


def fullscreen(page, button, name, inner_button=None, panel=None):
    page.locator(button).click()
    wait(page, 'Boolean(document.fullscreenElement)')
    exit_selector = inner_button or button
    assert page.locator(exit_selector).is_visible(), name
    if name == 'solo-fullscreen':
        page.mouse.move(100,100); page.mouse.wheel(0,1200); page.wait_for_timeout(100)
        button_rect = page.locator(exit_selector).bounding_box()
        assert 0 <= button_rect['y'] and button_rect['y'] + button_rect['height'] <= page.viewport_size['height'], button_rect
        page.mouse.wheel(0,-1500); page.wait_for_timeout(100)
    if panel:
        opener, dialog, closer = panel
        page.locator(opener).click()
        assert page.locator(dialog).is_visible(), (name, 'dialog unavailable in fullscreen')
        page.locator(closer).click()
    page.locator(exit_selector).click()
    wait(page, '!document.fullscreenElement')
    case(name, native_fullscreen_enter_exit=True)


def dialog(page, opener, panel, closer, name, read=None, paused=None, focus_target=None):
    page.locator(opener).click()
    assert page.locator(panel).is_visible()
    assert page.locator(opener).get_attribute('aria-expanded') == 'true'
    panel_rect = page.locator(panel).bounding_box(); viewport = page.viewport_size
    assert panel_rect['x'] >= -1 and panel_rect['x']+panel_rect['width'] <= viewport['width']+1, (name,panel_rect)
    assert panel_rect['y'] >= -1 and panel_rect['y']+panel_rect['height'] <= viewport['height']+1, (name,panel_rect)
    active = page.evaluate('selector=>document.querySelector(selector).contains(document.activeElement)', panel)
    assert active, (name, 'focus not moved to panel')
    page.keyboard.press('Shift+Tab')
    assert page.evaluate('selector=>document.querySelector(selector).contains(document.activeElement)', panel), (name, 'backward Tab escaped panel')
    for _ in range(18):
        page.keyboard.press('Tab')
        assert page.evaluate('selector=>document.querySelector(selector).contains(document.activeElement)', panel), (name, 'Tab escaped panel')
    if paused:
        assert get(page, paused), (name, 'game not paused by opening controls')
    if read:
        before = get(page, read)
        page.keyboard.down('w')
        page.wait_for_timeout(350)
        page.keyboard.up('w')
        after = get(page, read)
        assert before == after, (name, 'controls panel allowed movement', before, after)
    page.keyboard.press('Escape')
    wait(page, 'selector=>!document.querySelector(selector).open && (document.querySelector(selector).hidden || getComputedStyle(document.querySelector(selector)).display === "none")', panel)
    wait(page, 'selector=>document.querySelector(selector).getAttribute("aria-expanded") === "false"', opener)
    restored_focus = focus_target or opener
    wait(page, 'selector=>document.activeElement===document.querySelector(selector)', restored_focus)
    if paused:
        assert get(page, paused), (name, 'closing controls silently resumed solo game')
    page.locator(opener).click()
    page.locator(closer).click()
    assert not page.locator(panel).is_visible()
    case(name, tab_focus_confined=True, escape_focus_restored=True, focus_target=restored_focus, native_close=True)


def connected(page, family):
    api = {'room': 'firesideRoom', 'breach': 'SemagVoxel', 'royale': 'SemagRoyale', 'afterimage': 'afterimage'}[family]
    expr = f'window.{api}'
    if family in ('breach', 'royale'):
        wait(page, f'{expr}?.getState().connected && {expr}.getState().state')
    else:
        wait(page, f'{expr}?.connected && {expr}.getState()')
    return expr


def mobile_measure(page, family, viewport, canvas, ready=None):
    page.set_viewport_size(viewport)
    page.wait_for_timeout(160)
    name = family + '-' + str(viewport['width'])
    measure(page, name, canvas)
    if family in ('breach','royale'):
        header = '.voxel-topbar' if family == 'breach' else '.topbar'
        boxes = page.locator(header).evaluate('node=>{const parent=node.getBoundingClientRect();return [...node.querySelectorAll(".brand,.keyboard-layout-picker,#sound-button,#guide-button,#fullscreen-button")].filter(n=>n.getClientRects().length).map(n=>{const r=n.getBoundingClientRect();return {label:n.id||n.className,x:r.x,y:r.y,right:r.right,bottom:r.bottom,parent:{x:parent.x,y:parent.y,right:parent.right,bottom:parent.bottom}}})}')
        for box in boxes:
            assert box['x'] >= box['parent']['x']-1 and box['right'] <= box['parent']['right']+1 and box['y'] >= box['parent']['y']-1 and box['bottom'] <= box['parent']['bottom']+1, (name,'header controls outside toolbar',box)
    if ready:
        assert page.locator(ready).is_visible(), (name, 'primary readiness action hidden')
    screenshot(page, name)
    case(name, no_horizontal_overflow=True)


def native_cdp_key(page, key, code, kind):
    session = page.context.new_cdp_session(page)
    try:
        session.send('Input.dispatchKeyEvent', {'type': kind, 'key': key, 'code': code,
                     'windowsVirtualKeyCode': ord(key.upper()), **({'text': key, 'unmodifiedText': key} if kind == 'keyDown' else {})})
    finally:
        session.detach()


def solo_case(browser):
    context = browser.new_context(viewport={'width': 1365, 'height': 768})
    page = context.new_page(); observe(page, 'solo')
    page.goto(URL + '/solo.html?game=voxel-wilds')
    wait(page, 'window.firesideSolo?.gameId === "voxel-wilds"')
    assert get(page, 'window.firesideSolo.getState()') is None
    dialog(page, '#solo-info-button', '#solo-info', '#solo-info-close', 'solo-controls-before-start')
    assert get(page, 'window.firesideSolo.getState()') is None
    assert page.locator('#solo-start').is_visible()
    screenshot(page, 'wilds-ready-compact')
    page.locator('#solo-start').click()
    wait(page, 'window.firesideSolo.getState() !== null')
    if page.locator('.wilds-new-world').is_visible():
        page.locator('.wilds-new-world').click()
    wait(page, 'window.firesideSolo.getState().phase === "playing"')
    page.locator('.wilds-canvas').click()
    wait(page, 'Boolean(document.pointerLockElement)')
    before = get(page, 'window.firesideSolo.getState().player')
    assert get(page, 'window.firesideSolo.getState().phase') == 'playing'
    page.keyboard.down('d')
    try:
        wait(page, 'before=>{const p=window.firesideSolo.getState().player;return Math.hypot(p.x-before.x,p.z-before.z)>.3}', before, timeout=5000)
    finally: page.keyboard.up('d')
    after = get(page, 'window.firesideSolo.getState().player')
    distance = math.hypot(after['x'] - before['x'], after['z'] - before['z'])
    assert distance > .25, ('solo movement did not respond', before, after)
    box = page.locator('.wilds-canvas').bounding_box()
    yaw = get(page, 'window.firesideSolo.getState().controls.lookYaw')
    page.mouse.move(box['x'] + box['width']/2, box['y'] + box['height']/2)
    page.mouse.move(box['x'] + box['width']/2 + 35, box['y'] + box['height']/2 + 20)
    page.wait_for_timeout(100)
    assert abs(get(page, 'window.firesideSolo.getState().controls.lookYaw') - yaw) > .01
    screenshot(page, 'wilds-playing-compact')
    page.keyboard.press('Escape')
    wait(page, 'window.firesideSolo.getState().phase === "paused"')
    measure(page, 'wilds-1365', '.wilds-canvas', desktop_fit=True)
    screenshot(page, 'wilds-gameplay-compact')
    dialog(page, '#solo-info-button', '#solo-info', '#solo-info-close', 'solo-controls-during-game',
           read='JSON.stringify(window.firesideSolo.getState().player)', paused='window.firesideSolo.getState().phase === "paused"')
    assert page.locator('#solo-pause').is_visible()
    fullscreen(page, '#solo-fullscreen', 'solo-fullscreen', panel=('#solo-info-button', '#solo-info', '#solo-info-close'))
    page.locator('select[data-keyboard-layout]').click()
    page.keyboard.press('End'); page.keyboard.press('Enter')
    assert page.locator('select[data-keyboard-layout]').input_value() == 'zqsd'
    page.locator('#solo-pause').click()
    wait(page, 'window.firesideSolo.getState().phase === "playing"')
    page.locator('.wilds-canvas').click(); wait(page, 'Boolean(document.pointerLockElement)')
    before = get(page, 'window.firesideSolo.getState().player')
    native_cdp_key(page, 'z', 'KeyW', 'keyDown')
    try:
        wait(page, 'before=>{const p=window.firesideSolo.getState().player;return Math.hypot(p.x-before.x,p.z-before.z)>.2}', before, timeout=5000)
    finally: native_cdp_key(page, 'z', 'KeyW', 'keyUp')
    after = get(page, 'window.firesideSolo.getState().player')
    assert math.hypot(after['x'] - before['x'], after['z'] - before['z']) > .15
    page.keyboard.press('Escape'); wait(page, 'window.firesideSolo.getState().phase === "paused"')
    case('solo-native-movement-mouselook-zqsd', moved_distance=distance)
    page.set_viewport_size({'width':1440,'height':900}); page.wait_for_timeout(120)
    measure(page, 'wilds-1440', '.wilds-canvas', desktop_fit=True)
    mobile_measure(page, 'wilds', {'width':390,'height':844}, '.wilds-canvas')
    dialog(page, '#solo-info-button', '#solo-info', '#solo-info-close', 'solo-mobile-controls')
    mobile_measure(page, 'wilds', {'width':320,'height':740}, '.wilds-canvas')
    context.close()


def room_case(browser, game='relic-duel'):
    context = browser.new_context(viewport={'width':1365,'height':768})
    room = create_room(game)
    path = URL + f'/play.html?game={game}&room={room}'
    page = context.new_page(); peer = context.new_page()
    for node, tag in [(page,'room/main'),(peer,'room/peer')]:
        observe(node,tag); node.goto(path); connected(node,'room')
    page.bring_to_front()
    assert get(page, 'window.firesideRoom.getState().phase') == 'lobby'
    page.set_viewport_size({'width':320,'height':740}); page.wait_for_timeout(120)
    assert page.locator('#ready-button').is_visible(), 'mobile lobby hides Ready'
    no_overflow(page, game+'-mobile-lobby')
    page.set_viewport_size({'width':1365,'height':768}); page.wait_for_timeout(120)
    page.locator('#ready-button').click()
    wait(page, 'document.querySelector("#ready-button").textContent.includes("Cancel ready")')
    page.wait_for_timeout(150)
    assert get(page, 'window.firesideRoom.getState().phase') == 'lobby', 'one Ready started a two-player game'
    peer.locator('#ready-button').click(); page.bring_to_front()
    wait(page, 'window.firesideRoom.getState().phase === "fight"')
    if game == 'checkers':
        source = page.locator('.checker-square.is-available').first
        square = source.get_attribute('data-square')
        source.click()
        assert source.get_attribute('aria-selected') == 'true'
        destination = page.locator('.checker-square.is-destination').first
        target = destination.get_attribute('data-square')
        destination.click()
        wait(page, 'window.firesideRoom.getState().moves === 1')
        moved = get(page, 'window.firesideRoom.getState().lastMove')
        assert {key:moved[key] for key in ('from','to')} == {'from':int(square),'to':int(target)}, moved
        grid = page.locator('.checkers-grid').bounding_box()
        assert abs(grid['width'] - grid['height']) <= 2
        case('checkers-native-scaled-click', source=square,destination=target,board=grid)
        measure(page, 'checkers-1365', '.checkers-grid', desktop_fit=True)
        mobile_measure(page, 'checkers', {'width':390,'height':844}, '.checkers-grid')
        mobile_measure(page, 'checkers', {'width':320,'height':740}, '.checkers-grid')
    else:
        page.locator('#arena').click()
        before = get(page, 'window.firesideRoom.getState().fighters[window.firesideRoom.playerId]')
        page.keyboard.down('d')
        try:
            wait(page, 'before=>{const p=window.firesideRoom.getState().fighters[window.firesideRoom.playerId];return Math.hypot(p.x-before.x,p.y-before.y)>6}', before, timeout=5000)
        finally: page.keyboard.up('d')
        after = get(page, 'window.firesideRoom.getState().fighters[window.firesideRoom.playerId]')
        assert math.hypot(after['x']-before['x'],after['y']-before['y']) > 5
        measure(page, 'room-1365', '#arena', desktop_fit=True)
        screenshot(page, 'room-gameplay-compact')
        dialog(page,'#room-panel-button','#room-panel','#room-panel-close','room-controls-live',
               read='JSON.stringify(((f)=>({x:f.x,y:f.y}))(window.firesideRoom.getState().fighters[window.firesideRoom.playerId]))')
        fullscreen(page,'#fullscreen-button','room-fullscreen',panel=('#room-panel-button','#room-panel','#room-panel-close'))
        page.set_viewport_size({'width':1440,'height':900}); page.wait_for_timeout(120)
        measure(page,'room-1440','#arena',desktop_fit=True)
        mobile_measure(page,'room',{'width':390,'height':844},'#arena')
        dialog(page,'#room-panel-button','#room-panel','#room-panel-close','room-mobile-controls')
        mobile_measure(page,'room',{'width':320,'height':740},'#arena')
        case('room-two-player-readiness-native-movement')
    context.close()


def afterimage_case(browser):
    context=browser.new_context(viewport={'width':1365,'height':768})
    page=context.new_page(); observe(page,'afterimage')
    room=create_room('afterimage'); page.goto(URL+f'/afterimage.html?room={room}'); connected(page,'afterimage')
    dialog(page,'#room-controls-button','#room-controls','#room-controls-close','afterimage-controls-lobby')
    assert page.locator('#practice-button').is_visible() and page.locator('#ready-button').is_visible()
    page.locator('#practice-button').click()
    wait(page,'window.afterimage.practice && window.afterimage.getState().phase === "fight"')
    page.locator('#arena').click()
    before=get(page,'window.afterimage.getState().fighters[0].x')
    page.keyboard.down('d')
    try: wait(page,'before=>Math.abs(window.afterimage.getState().fighters[0].x-before)>6',before,timeout=5000)
    finally: page.keyboard.up('d')
    after=get(page,'window.afterimage.getState().fighters[0].x')
    assert abs(after-before) > 5
    dialog(page,'#room-controls-button','#room-controls','#room-controls-close','afterimage-controls-practice',
           read='JSON.stringify(window.afterimage.getState().fighters.map(f=>({x:f.x,y:f.y})))', focus_target='#arena')
    assert get(page,'Object.values(window.afterimage.getState().fighters[0].previousInput).every(value=>!value)')
    measure(page,'afterimage-1365','#arena',desktop_fit=True); screenshot(page,'afterimage-gameplay-compact')
    fullscreen(page,'#fullscreen-button','afterimage-fullscreen',panel=('#room-controls-button','#room-controls','#room-controls-close'))
    page.set_viewport_size({'width':1440,'height':900}); page.wait_for_timeout(120)
    measure(page,'afterimage-1440','#arena',desktop_fit=True)
    mobile_measure(page,'afterimage',{'width':390,'height':844},'#arena')
    dialog(page,'#room-controls-button','#room-controls','#room-controls-close','afterimage-mobile-controls',focus_target='#arena')
    mobile_measure(page,'afterimage',{'width':320,'height':740},'#arena')
    case('afterimage-native-practice-movement',delta=after-before)
    context.close()


def voxel_case(browser, family):
    context=browser.new_context(viewport={'width':1365,'height':768})
    game='voxel-breach' if family=='breach' else 'voxel-royale'
    room=create_room(game)
    path=URL+('/voxel.html' if family=='breach' else '/voxel-royale.html')+f'?room={room}'
    page=context.new_page(); peer=context.new_page()
    for node,tag in [(page,family+'/main'),(peer,family+'/peer')]:
        observe(node,tag); node.goto(path); connected(node,family)
    page.bring_to_front()
    api='SemagVoxel' if family=='breach' else 'SemagRoyale'
    expr='window.'+api+'.getState()'
    dialog(page,'#room-panel-button','#room-dialog','#close-room',family+'-room-controls-lobby')
    if family=='breach':
        assert get(page,expr+'.state.phase')=='lobby'
        page.locator('#overlay-ready').click(); page.wait_for_timeout(150)
        assert get(page,expr+'.state.phase')=='lobby', 'one player Ready started Breach'
        peer.locator('#overlay-ready').click(); page.bring_to_front()
    else:
        assert get(page,expr+'.state.phase')=='lobby'
        assert not page.locator('#overlay-start').is_disabled()
        page.locator('#overlay-start').click()
    wait(page,expr+'.state.phase === "fight"')
    page.locator('#enter-arena').click()
    wait(page,'Boolean(document.pointerLockElement)')
    before=get(page,expr+'.state.players['+expr+'.playerId]')
    page.keyboard.down('d'); page.wait_for_timeout(400); page.keyboard.up('d')
    after=get(page,expr+'.state.players['+expr+'.playerId]')
    distance=math.hypot(after['x']-before['x'],after['z']-before['z'])
    assert distance > .15,(family,'native movement did not respond',before,after)
    box=page.locator('#arena').bounding_box()
    yaw=get(page,expr+'.input.yaw')
    page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
    page.mouse.move(box['x']+box['width']/2+25,box['y']+box['height']/2+12)
    page.wait_for_timeout(80)
    assert abs(get(page,expr+'.input.yaw')-yaw) > .01
    screenshot(page,family+'-playing-compact')
    page.keyboard.press('Escape'); wait(page,expr+'.controls.paused')
    dialog(page,'#room-panel-button','#room-dialog','#close-room',family+'-room-controls-live',
           read='JSON.stringify('+expr+'.input)',paused=expr+'.controls.paused')
    fullscreen(page,'#arena-fullscreen-button',family+'-fullscreen',inner_button='#arena-fullscreen-button',
               panel=('#room-panel-button','#room-dialog','#close-room'))
    measure(page,family+'-1365','#arena',desktop_fit=True); screenshot(page,family+'-gameplay-compact')
    page.set_viewport_size({'width':1440,'height':900}); page.wait_for_timeout(120)
    measure(page,family+'-1440','#arena',desktop_fit=True)
    mobile_measure(page,family,{'width':390,'height':844},'#arena')
    dialog(page,'#room-panel-button','#room-dialog','#close-room',family+'-mobile-controls')
    mobile_measure(page,family,{'width':320,'height':740},'#arena')
    case(family+'-two-player-start-native-movement-mouselook',moved_distance=distance)
    context.close()


def coarse_voxel_case(browser):
    context = browser.new_context(viewport={'width':844,'height':390},is_mobile=True,has_touch=True)
    room = create_room('voxel-breach')
    path = URL + f'/voxel.html?room={room}'
    page = context.new_page(); peer = context.new_page()
    for node, tag in [(page,'touch/main'),(peer,'touch/peer')]:
        observe(node,tag); node.goto(path); connected(node,'breach')
    page.bring_to_front()
    page.locator('#overlay-ready').click(); peer.locator('#overlay-ready').click(); page.bring_to_front()
    expr = 'window.SemagVoxel.getState()'
    wait(page,expr+'.state.phase === "fight"')
    page.locator('#enter-arena').click()
    wait(page,expr+'.controls.touch && !'+expr+'.controls.paused')
    no_overflow(page,'breach-touch-landscape')
    canvas = page.locator('#arena').bounding_box()
    assert canvas['height'] >= 170 and canvas['y'] + canvas['height'] <= 390
    assert page.locator('#touch-controls').is_visible()
    button = page.locator('#room-panel-button').bounding_box()
    assert button['y'] + button['height'] <= 390, button
    before = get(page,expr+'.state.players['+expr+'.playerId]')
    pad = page.locator('[data-voxel-pad="move"]').bounding_box()
    session = context.new_cdp_session(page)
    start = {'x':pad['x']+pad['width']/2,'y':pad['y']+pad['height']/2,'id':0}
    try:
        session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[start]})
        session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{**start,'x':start['x']+24}]})
        wait(page,'before=>{const q=window.SemagVoxel.getState();const p=q.state.players[q.playerId];return Math.hypot(p.x-before.x,p.z-before.z)>.3}',before)
    finally:
        session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]}); session.detach()
    screenshot(page,'breach-touch-landscape-playing')
    dialog(page,'#room-panel-button','#room-dialog','#close-room','breach-touch-landscape-controls')
    measure(page,'breach-touch-landscape','#arena',desktop_fit=True)
    case('breach-coarse-pointer-native-touch',viewport=canvas)
    context.close()


def shadow_resize_case(browser):
    context = browser.new_context(viewport={'width':320,'height':740})
    page = context.new_page(); observe(page,'shadow-resize')
    page.goto(URL+'/solo.html?game=shadow-lantern')
    wait(page,'window.firesideSolo?.gameId === "shadow-lantern"')
    assert get(page,'window.firesideSolo.getState()') is None
    page.locator('#solo-start').click()
    wait(page,'window.firesideSolo.getState() !== null')
    sequence = [(320,740,480,440),(1365,768,960,640),(1365,500,480,440),(1365,768,960,640)]
    views = []
    for width,height,pixels_w,pixels_h in sequence:
        page.set_viewport_size({'width':width,'height':height})
        wait(page,'([w,h])=>{const c=document.querySelector("#solo-game canvas");return c && c.width===w && c.height===h}',[pixels_w,pixels_h])
        page.wait_for_timeout(140)
        measurement = measure(page,'shadow-'+str(width)+'x'+str(height),'#solo-game canvas',desktop_fit=width>950)
        views.append({'browser':[width,height],'canvas_pixels':[pixels_w,pixels_h],'display':measurement['viewport']})
    page.locator('#solo-pause').click()
    screenshot(page,'shadow-wide-after-resize')
    case('shadow-native-resize-recovery',sequence=views)
    context.close()


def main():
    OUT.mkdir(parents=True,exist_ok=True); REPORT['sources']=hashes()
    REPORT['fixture_sha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,
                args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
                      '--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding'])
            try:
                selected=os.environ.get('SEMAG_COMPACT_CASES','solo,shadow,room,checkers,afterimage,breach,royale,touch').split(',')
                for family in selected:
                    if family=='solo': solo_case(browser)
                    elif family=='shadow': shadow_resize_case(browser)
                    elif family=='room': room_case(browser)
                    elif family=='checkers': room_case(browser,'checkers')
                    elif family=='afterimage': afterimage_case(browser)
                    elif family=='touch': coarse_voxel_case(browser)
                    else: voxel_case(browser,family)
            except BaseException:
                for index, context in enumerate(browser.contexts):
                    for position, page in enumerate(context.pages):
                        try:
                            screenshot(page,f'failure-{index}-{position}')
                            snap = page.evaluate('()=>({url:location.href,active:document.activeElement?.outerHTML.slice(0,180),phase:window.firesideRoom?.getState().phase,solo:window.firesideSolo?.getState()?.phase,voxel:window.SemagVoxel?.getState(),royale:window.SemagRoyale?.getState(),button:document.querySelector("#ready-button")?.outerHTML})')
                            (OUT/f'failure-{index}-{position}.json').write_text(json.dumps(snap,indent=2))
                        except Exception: pass
                raise
            finally: browser.close()
        assert REPORT['sources']==hashes(),'UI source changed during final native QA'
        assert not REPORT['errors'],REPORT['errors']
        assert not REPORT['failed_resources'],REPORT['failed_resources']
        REPORT['passed']=True
    except BaseException as error:
        REPORT['passed']=False; REPORT['failure']=repr(error)
        raise
    finally:
        (OUT/'report.json').write_text(json.dumps(REPORT,indent=2));log('compact-play-report',path=str(OUT/'report.json'),passed=REPORT.get('passed'),cases=len(REPORT['cases']))

if __name__=='__main__':main()
