"""Focused native arena contact and art QA.

python test/arena-polish-browser-smoke.py [http://127.0.0.1:3000]
Creates real rooms through the shelf and uses native two-player inputs. Live
state is read-only. Isolated sprite/pose inspections use copies of observed
fighters and never alter the running games. Requires Playwright and Chromium.
"""
import base64
import json
import math
import os
from pathlib import Path
import sys
import time
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright
from browser_controls import controls_panel

URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3000').rstrip('/')
ARTIFACTS = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', Path(__file__).resolve().parents[1] / 'test-results' / 'arena-polish'))
SURFACE = '(window.firesideRoom || window.afterimage)'
ERRORS, RESOURCES, REPORTS = [], [], []


def state(page):
    return page.evaluate(f'{SURFACE}.getState()')


def phase(page, value):
    page.wait_for_function(f'phase => {SURFACE}?.getState().phase === phase', arg=value, timeout=12000)


def connected(page, seat):
    page.wait_for_function(f'seat => {SURFACE}?.connected && {SURFACE}.playerId === seat', arg=seat)


def watch(page, name):
    page.on('pageerror', lambda error: ERRORS.append(f'{name}: {error}'))
    page.on('console', lambda msg: ERRORS.append(f'{name}: {msg.text}') if msg.type == 'error' else None)
    page.on('response', lambda response: RESOURCES.append(f'{name}: {response.status} {response.url}') if response.status >= 400 else None)


class Keyboard:
    def __init__(self, page):
        self.page, self.held = page, set()

    def set(self, desired):
        desired = set(desired)
        for key in sorted(self.held - desired):
            self.page.keyboard.up(key)
        for key in sorted(desired - self.held):
            self.page.keyboard.down(key)
        self.held = desired

    def release(self):
        self.set(set())


def move_to(page, target, seat=0, timeout=6):
    keyboard = Keyboard(page)
    page.locator('#arena').focus()
    deadline = time.monotonic() + timeout
    try:
        while time.monotonic() < deadline:
            current = state(page)
            assert current['phase'] == 'fight', current['phase']
            actor = current['fighters'][seat]
            dx, dy = target[0] - actor['x'], target[1] - actor['y']
            if abs(dx) <= 8 and abs(dy) <= 8:
                return actor
            desired = []
            if abs(dx) > 8:
                desired.append('ArrowRight' if dx > 0 else 'ArrowLeft')
            if abs(dy) > 8:
                desired.append('ArrowDown' if dy > 0 else 'ArrowUp')
            keyboard.set(desired)
            page.wait_for_timeout(30)
    finally:
        keyboard.release()
    raise AssertionError(f'Native route did not reach {target}: {state(page)["fighters"][seat]}')


def event_after(page, event_id, kind, move=None, timeout=3000):
    page.wait_for_function(f'''([id,kind,move]) => {SURFACE}.getState().events.some(e=>e.id>id && e.type===kind && (!move || e.move===move))''', arg=[event_id, kind, move], timeout=timeout)
    return next(e for e in state(page)['events'] if e['id'] > event_id and e['type'] == kind and (not move or e.get('move') == move))


def contact_clearance(event, obstacles, radius):
    distances = [math.hypot(event['x'] - max(rect['x'], min(event['x'], rect['x'] + rect['w'])), event['y'] - max(rect['y'], min(event['y'], rect['y'] + rect['h']))) for rect in obstacles]
    nearest = min(distances)
    assert abs(nearest - radius) < .05, (event, nearest, radius)
    return nearest


def aim_at(page, x, y):
    box = page.locator('#arena').bounding_box()
    page.mouse.move(box['x'] + x / 960 * box['width'], box['y'] + y / 640 * box['height'])


def screenshot(page, name):
    page.screenshot(path=str(ARTIFACTS / name), full_page=True)


def capture_layouts(page, game):
    page.wait_for_timeout(80)
    screenshot(page, f'{game}-desktop.png')
    for width in (390, 320):
        page.set_viewport_size({'width': width, 'height': 844})
        page.wait_for_timeout(80)
        sizes = page.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})')
        assert sizes['scroll'] <= sizes['width'], (game, sizes)
        with controls_panel(page, 'select[data-keyboard-layout]'):
            box = page.locator('select[data-keyboard-layout]').bounding_box()
            assert box and 0 <= box['x'] and box['x'] + box['width'] <= width + 1
        screenshot(page, f'{game}-{width}.png')
    page.set_viewport_size({'width': 1440, 'height': 1000})


def frame_probe(page):
    values = page.evaluate('''() => new Promise(resolve => {
        const frames=[]; let previous=0, begin=0;
        function measure(now) {
            if(!begin) begin=now;
            if(previous) frames.push(now-previous); previous=now;
            if(now-begin<850) requestAnimationFrame(measure);
            else resolve(frames);
        }
        requestAnimationFrame(measure);
    })''')
    values = sorted(values)
    result = {'samples': len(values), 'median_ms': values[len(values)//2], 'p95_ms': values[int((len(values)-1)*.95)], 'max_ms': values[-1], 'over_100ms': sum(value > 100 for value in values)}
    assert result['median_ms'] < 35 and result['p95_ms'] < 85, result
    return result


def fresh_room(browser, game):
    contexts = [browser.new_context(viewport={'width': 1440, 'height': 1000}) for _ in range(2)]
    first, second = [context.new_page() for context in contexts]
    for page, name in ((first, 'P1'), (second, 'P2')):
        watch(page, f'{game}/{name}')
        page.goto(URL)
        page.wait_for_selector('select[data-keyboard-layout]')
        page.locator('select[data-keyboard-layout]').select_option('zqsd')
    first.locator(f'[data-create-game="{game}"]').click()
    first.wait_for_url('**/*room=*')
    connected(first, 0)
    code = parse_qs(urlparse(first.url).query)['room'][0]
    second.locator('#room-code').fill(code.lower())
    second.locator('#join-button').click()
    second.wait_for_url('**/*room=*')
    connected(second, 1)
    assert first.locator('select[data-keyboard-layout]').input_value() == 'zqsd'
    with controls_panel(first, '#player-name', resume=False):
        first.locator('#player-name').fill('')
        first.locator('#player-name').press('r')
        first.locator('#player-name').press('q')
        assert first.locator('#player-name').input_value() == 'rq'
    assert first.locator('#ready-button span').inner_text() == 'Ready up'
    if game == 'oddstock-rumble':
        first.locator('[data-brawl-character="sprout"]').click()
        second.locator('[data-brawl-character="wrench"]').click()
        first.locator('[data-brawl-stage="rooftop"]').click()
        first.wait_for_function('window.firesideRoom.getState().fighters.every(f=>f.selected) && window.firesideRoom.getState().stageSelected')
    first.locator('#ready-button').click()
    first.wait_for_function("document.querySelector('#ready-button span').textContent === 'Cancel ready'")
    assert state(first)['phase'] == 'lobby'
    second.locator('#ready-button').click()
    phase(first, 'fight')
    phase(second, 'fight')
    first.locator('#arena').focus()
    x = state(first)['fighters'][0]['x']
    first.keyboard.down('q')
    first.wait_for_timeout(110)
    first.keyboard.up('q')
    assert state(first)['fighters'][0]['x'] < x - 5, (game, 'ZQSD native left failed')
    return contexts, first, second


def topdown(first, second, game):
    initial = state(first)
    if game == 'relic-duel':
        obstacle = initial['obstacles'][0]
        target_y = obstacle['y'] + obstacle['h']/2
        move_to(second, (370, 320), 1)
        move_to(second, (370, target_y), 1)
        move_to(first, (230, target_y))
        direction, wall_x = 'd', obstacle['x'] - initial['fighters'][0]['radius']
    else:
        obstacle = next(rect for rect in initial['obstacles'] if rect['x'] < 400 and rect['y'] > 350)
        target_y = obstacle['y'] + obstacle['h']/2
        move_to(first, (420, target_y))
        direction, wall_x = 'q', obstacle['x'] + obstacle['w'] + initial['fighters'][0]['radius']
    first.locator('#arena').focus()
    first.keyboard.down(direction)
    first.wait_for_timeout(430)
    first.keyboard.up(direction)
    actor = state(first)['fighters'][0]
    assert abs(actor['x'] - wall_x) < .05, (game, actor, wall_x)
    event_id = state(first)['eventId']
    first.keyboard.press('k', delay=40)
    stop = event_after(first, event_id, 'arrowStop', 'arrow')
    assert stop['reason'] == 'cover', stop
    clearance = contact_clearance(stop, state(first)['obstacles'], 5)
    screenshot(first, f'{game}-cover-contact.png')
    if game == 'relic-duel':
        assert state(first)['fighters'][1]['hp'] == 100, 'Arrow passed through solid pillar'
        move_to(second, (370, 320), 1)
        move_to(first, (260, 320))
        first.keyboard.down('d'); first.wait_for_timeout(25); first.keyboard.up('d')
        hp = state(first)['fighters'][1]['hp']
        first.keyboard.press('k', delay=40)
        first.wait_for_function(f'hp=>{SURFACE}.getState().fighters[1].hp<hp', arg=hp, timeout=3000)
        second.wait_for_function(f'hp=>{SURFACE}.getState().fighters[1].hp<hp', arg=hp, timeout=3000)
        hit = True
    else:
        before = {enemy['id']:enemy['hp'] for enemy in state(first)['enemies']}
        keyboard=Keyboard(first)
        first.locator('#arena').focus()
        deadline=time.monotonic()+7
        hit=False
        try:
            while time.monotonic()<deadline:
                current=state(first)
                if any(enemy['hp']<before.get(enemy['id'],enemy['hp']) for enemy in current['enemies']):
                    hit=True;break
                hero=current['fighters'][0]
                nearest=min((enemy for enemy in current['enemies'] if enemy['hp']>0),key=lambda enemy:math.hypot(enemy['x']-hero['x'],enemy['y']-hero['y']))
                dx,dy=nearest['x']-hero['x'],nearest['y']-hero['y']
                desired=[]
                if abs(dx)>25:desired.append('d' if dx>0 else 'q')
                if abs(dy)>25:desired.append('s' if dy>0 else 'z')
                keyboard.set(desired)
                first.wait_for_timeout(100)
                first.keyboard.press('j',delay=25)
                first.wait_for_timeout(100)
        finally:
            keyboard.release()
        assert hit, 'Native co-op combat did not damage an enemy'
    return {'wall_body_contact':True,'arrow_stop':stop,'cover_clearance':clearance,'native_hit':hit}


def vector(first, second):
    obstacle=state(first)['obstacles'][0]
    target_y=obstacle['y']+obstacle['h']/2
    move_to(second,(380,320),1);move_to(second,(380,target_y),1)
    move_to(first,(154,target_y))
    first.locator('#arena').focus()
    first.keyboard.down('d');first.wait_for_timeout(430);first.keyboard.up('d')
    assert abs(state(first)['fighters'][0]['x']-(obstacle['x']-16))<.05
    aim_at(first,obstacle['x']+obstacle['w']/2,target_y)
    event_id=state(first)['eventId']
    first.keyboard.down('i');first.keyboard.press('j',delay=40);first.keyboard.up('i')
    cover=event_after(first,event_id,'cover')
    clearance=contact_clearance(cover,state(first)['obstacles'],3)
    assert state(first)['fighters'][1]['hp']==100
    screenshot(first,'vector-arena-cover-contact.png')
    move_to(second,(380,320),1);move_to(first,(232,320))
    rival=state(first)['fighters'][1]
    aim_at(first,rival['x'],rival['y'])
    first.keyboard.down('i');first.keyboard.press('j',delay=40);first.keyboard.up('i')
    first.wait_for_function(f'{SURFACE}.getState().fighters[1].hp<100',timeout=3000)
    second.wait_for_function(f'{SURFACE}.getState().fighters[1].hp<100',timeout=3000)
    return {'wall_body_contact':True,'cover_impact':cover,'cover_clearance':clearance,'open_lane_hit':True}


def brawl(first, second):
    first.wait_for_function(f'{SURFACE}.getState().fighters[0].grounded')
    before=state(first)['fighters'][0]
    first.keyboard.press('Space',delay=40)
    first.wait_for_function(f'!{SURFACE}.getState().fighters[0].grounded && {SURFACE}.getState().fighters[0].y<450')
    first.wait_for_function(f'{SURFACE}.getState().fighters[0].grounded && {SURFACE}.getState().fighters[0].onPlatform === "left"',timeout=3000)
    landed=state(first)['fighters'][0]
    platform=next(p for p in state(first)['platforms'] if p['id']=='left')
    assert abs(landed['y']+landed['height']/2-platform['y'])<.05
    first.keyboard.press('j',delay=25)
    active=first.wait_for_function(f'''()=>{{const f={SURFACE}.getState().fighters[0];return f.action==='attack' && f.actionFrame>=f.move.startup && f.actionFrame<f.move.startup+f.move.active ? f : false;}}''',timeout=3000)
    actor=active.json_value()
    active.dispose()
    screenshot(first,'oddstock-rumble-sprout-strike.png')
    paint=first.evaluate('''async actor => {
        const {BrawlRenderer}=await import('/brawl-renderer.js');
        const sprite=BrawlRenderer.prototype.sprite.call({lastSprites:[null,null],sprites:new Map()},actor,0,true);
        const pixels=sprite.getContext('2d').getImageData(0,0,sprite.width,sprite.height).data;
        let left=sprite.width,right=-1,top=sprite.height,bottom=-1;
        for(let y=0;y<sprite.height;y++)for(let x=0;x<sprite.width;x++)if(pixels[(y*sprite.width+x)*4+3]){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
        return {width:sprite.width,height:sprite.height,left,right,top,bottom,png:sprite.toDataURL()};
    }''',actor)
    (ARTIFACTS/'sprout-live-pose-sprite.png').write_bytes(base64.b64decode(paint.pop('png').split(',')[1]))
    assert paint['width']==160 and paint['right']>144 and paint['right']<159, paint
    return {'starting_platform':before['onPlatform'],'native_jump_landing':landed['onPlatform'],'foot_plane':landed['y']+landed['height']/2,'sprite_bounds':paint}


def afterimage(first, second):
    first.locator('#arena').focus()
    first.keyboard.down('d')
    try:
        first.wait_for_function(f'Math.abs({SURFACE}.getState().fighters[1].x-{SURFACE}.getState().fighters[0].x)<94',timeout=4000)
    finally:
        first.keyboard.up('d')
    poses=[]
    for key,action in [('j','light'),('k','heavy')]:
        first.wait_for_function(f'{SURFACE}.getState().fighters[0].action === "idle" || {SURFACE}.getState().fighters[0].action === "run"',timeout=3000)
        hp=state(first)['fighters'][1]['hp']
        first.keyboard.press(key,delay=25)
        active=first.wait_for_function(f'''action=>{{const f={SURFACE}.getState().fighters[0];const startup=action==='light'?12:28;return f.action===action && f.actionFrame>=startup && f.actionFrame<startup+(action==='light'?8:11) ? f : false;}}''',arg=action,timeout=3000)
        fighter=active.json_value()
        active.dispose()
        screenshot(first,f'afterimage-{action}-active.png')
        pose=first.evaluate('''async ([fighter,action])=>{
            const {ArenaRenderer}=await import('/renderer.js');const {MOVES}=await import('/engine.js');
            const renderer={reducedMotion:{matches:true}};
            const live=ArenaRenderer.prototype.pose.call(renderer,fighter,0);
            const start=ArenaRenderer.prototype.pose.call(renderer,{...fighter,actionFrame:MOVES[action].startup},0);
            return {observedFrame:fighter.actionFrame,forwardTip:live.frontHand[0]+Math.cos(live.sword)*live.swordLength,firstActiveTip:start.frontHand[0]+Math.cos(start.sword)*start.swordLength,firstActiveTrail:!!start.trail,reach:MOVES[action].reach};
        }''',[fighter,action])
        assert pose['firstActiveTrail'] and pose['firstActiveTip']>=pose['reach']-12,pose
        first.wait_for_function(f'hp=>{SURFACE}.getState().fighters[1].hp<hp',arg=hp,timeout=2000)
        second.wait_for_function(f'hp=>{SURFACE}.getState().fighters[1].hp<hp',arg=hp,timeout=2000)
        poses.append({'action':action,**pose})
    return {'native_light_heavy_hits':True,'poses':poses}


ARTIFACTS.mkdir(parents=True,exist_ok=True)
with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding'])
    try:
        for game in ['relic-duel','dungeon-run','vector-arena','oddstock-rumble','afterimage']:
            contexts=[]
            try:
                contexts,first,second=fresh_room(browser,game)
                if game in ['relic-duel','dungeon-run']:result=topdown(first,second,game)
                elif game=='vector-arena':result=vector(first,second)
                elif game=='oddstock-rumble':result=brawl(first,second)
                else:result=afterimage(first,second)
                result.update({'game':game,'both_ready':True,'native_zqsd':True,'form_typing':True,'frames':frame_probe(first)})
                capture_layouts(first,game)
                REPORTS.append(result)
                print(f'PASS {game}: {json.dumps(result)}',flush=True)
            finally:
                for context in contexts:context.close()
    finally:
        browser.close()
assert not ERRORS,ERRORS
assert not RESOURCES,RESOURCES
report={'games':REPORTS,'browser_errors':ERRORS,'failed_resources':RESOURCES,'screenshots':str(ARTIFACTS)}
(ARTIFACTS/'report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report),flush=True)
