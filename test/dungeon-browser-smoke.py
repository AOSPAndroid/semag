"""Real keyboard Dungeon expedition: python test/dungeon-browser-smoke.py [URL].

Runs an isolated host by default. The navigator reads authoritative geometry and
sends only physical keyboard input; it never changes game state, enemies,
resources, damage or outcomes. FIRESIDE_DUNGEON_ROOMS defaults to 4 (first guardian and
biome transition); set 9 for the full expedition. Screenshots are captured at
320/390px around the real shrine choices and next room.
Requires Python Playwright and Chromium.
"""
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
from browser_controls import controls_panel

ROOT = Path(__file__).resolve().parents[1]
SCREENSHOTS = Path(os.environ.get('FIRESIDE_SCREENSHOT_DIR', ROOT / 'test-results' / 'dungeon'))
TARGET_ROOM = int(os.environ.get('FIRESIDE_DUNGEON_ROOMS', os.environ.get('DUNGEON_ROOMS', '4')))
assert 2 <= TARGET_ROOM <= 9
KEYS = {'up':'w','left':'a','down':'s','right':'d','attack':'j','shoot':'k','block':'i','roll':'Space'}
errors=[]

def gap(a,b): return math.hypot(a['x']-b['x'], a['y']-b['y'])

def blocked(state,a,b,padding=14.9):
    for r in state['obstacles']:
        low,high,intersects=0,1,True
        for origin,delta,minv,maxv in [(a['x'],b['x']-a['x'],r['x']-padding,r['x']+r['w']+padding),(a['y'],b['y']-a['y'],r['y']-padding,r['y']+r['h']+padding)]:
            if abs(delta)<1e-8:
                if origin<minv or origin>maxv: intersects=False;break
            else:
                first,last=(minv-origin)/delta,(maxv-origin)/delta
                if first>last:first,last=last,first
                low,high=max(low,first),min(high,last)
                if low>high:intersects=False;break
        if intersects:return True
    return False

def waypoint(state,start,goal):
    if not blocked(state,start,goal):return goal
    points=[start,goal]
    for r in state['obstacles']:
        for x in [r['x']-22,r['x']+r['w']+22]:
            for y in [r['y']-22,r['y']+r['h']+22]:points.append({'x':x,'y':y})
    costs=[math.inf]*len(points);previous=[-1]*len(points);done=set();costs[0]=0
    for _ in points:
        current=min((i for i in range(len(points)) if i not in done),key=lambda i:costs[i],default=-1)
        if current<0 or not math.isfinite(costs[current]) or current==1:break
        done.add(current)
        for nxt in range(1,len(points)):
            if nxt in done or blocked(state,points[current],points[nxt]):continue
            cost=costs[current]+gap(points[current],points[nxt])
            if cost<costs[nxt]:costs[nxt],previous[nxt]=cost,current
    if previous[1]<0:return goal
    node=1
    while previous[node]>0:node=previous[node]
    return points[node]

def steer(buttons,dx,dy):
    if math.hypot(dx,dy)<3:return
    angle=math.floor(math.atan2(dy,dx)/(math.pi/4)+.5)*(math.pi/4)
    if math.cos(angle)>.3:buttons.add('right')
    if math.cos(angle)<-.3:buttons.add('left')
    if math.sin(angle)>.3:buttons.add('down')
    if math.sin(angle)<-.3:buttons.add('up')

class Navigator:
    def __init__(self):self.routes={};self.last_attacks=[-100,-100]
    def controls(self,state,f):
        buttons=set()
        if f.get('downed') or state['phase']!='fight':return buttons
        alive=[e for e in state['enemies'] if e['hp']>0]
        if state['roomBreak']:
            if state['boonSelections'][f['id']]:return buttons
            desired='ward' if state['wave']%2 else 'leech'
            choice=next((c for c in state['shrineChoices'] if c['id']==desired),state['shrineChoices'][0]);target=waypoint(state,f,choice)
            if gap(f,choice)<45:buttons.add('block')
            else:steer(buttons,target['x']-f['x'],target['y']-f['y'])
            return buttons
        if not alive:return buttons
        ally=state['fighters'][1-f['id']]
        if ally.get('downed') and gap(f,ally)<58 and all(gap(f,e)>120 for e in alive):return {'block'}
        enemy=min(alive,key=lambda e:gap(f,e));distance=gap(f,enemy)
        ranged=next((e for e in alive if e['action']=='windup' and e.get('attackKind') in ['burst','fan','crown'] and gap(f,e)<340 and e['actionFrame']>e['windupTicks']-35),None)
        if ranged:
            dx,dy=f['x']-ranged['x'],f['y']-ranged['y']
            steer(buttons,-dy,dx)
            if f['stamina']>32 and not f['previousInput']['roll'] and ranged['actionFrame']>=ranged['windupTicks']-16:buttons.add('roll')
            return buttons
        threat=next((e for e in alive if e['action'] in ['windup','attack'] and e.get('attackKind') not in ['burst','fan','crown'] and gap(f,e)<e['reach']+65),None)
        if threat and (threat['action']=='attack' or threat['actionFrame']>threat['windupTicks']-28):
            if threat.get('attackKind') not in ['slam','charge'] and (threat['action']=='attack' or threat['actionFrame']>=threat['windupTicks']-8) and f['action']!='attack':
                steer(buttons,threat['x']-f['x'],threat['y']-f['y']);buttons.add('block');return buttons
            steer(buttons,f['x']-threat['x'],f['y']-threat['y'])
            if f['stamina']>32 and not f['previousInput']['roll'] and (threat['action']=='attack' or threat['actionFrame']>=threat['windupTicks']-16):buttons.add('roll')
            return buttons
        danger=next((h for h in state['hazards'] if h['kind']=='fire' and (h.get('active') or h.get('warning')) and gap(f,h)<h['radius']+40),None)
        if danger:steer(buttons,f['x']-danger['x'],f['y']-danger['y']);return buttons
        projectile=next((p for p in state['projectiles'] if p['team']=='enemies' and gap(f,p)<65),None)
        if projectile and f['stamina']>36 and not f['previousInput']['roll'] and f['action']!='attack':
            steer(buttons,-projectile['vy'],projectile['vx']);buttons.add('roll');return buttons
        if f['stamina']<12 and f['action']!='attack':steer(buttons,f['x']-enemy['x'],f['y']-enemy['y']);return buttons
        route=self.routes.get(f['id'])
        if not route or route['wave']!=state['wave'] or route['enemy']!=enemy['id'] or state['tick']-route['tick']>12 or gap(f,route['target'])<12:
            route={'wave':state['wave'],'enemy':enemy['id'],'tick':state['tick'],'target':waypoint(state,f,enemy)};self.routes[f['id']]=route
        if distance>57 or blocked(state,f,enemy,2):steer(buttons,route['target']['x']-f['x'],route['target']['y']-f['y'])
        else:steer(buttons,enemy['x']-f['x'],enemy['y']-f['y'])
        if distance<87 and not blocked(state,f,enemy,2) and state['tick']-self.last_attacks[f['id']]>=66 and f['stamina']>=10 and f['action'] not in ['attack','roll'] and f['stun']==0:
            buttons.add('attack');self.last_attacks[f['id']]=state['tick']
        elif 160<distance<320 and not blocked(state,f,enemy,5) and state['tick']-self.last_attacks[f['id']]>=90 and f['stamina']>40 and f['action'] not in ['attack','roll'] and f['stun']==0:
            buttons.add('shoot');self.last_attacks[f['id']]=state['tick']
        return buttons

class Keyboard:
    def __init__(self,page):self.page,self.held=page,set()
    def set(self,actions,observed=None):
        desired={KEYS[a] for a in actions}
        for key in sorted(self.held-desired):self.page.keyboard.up(key)
        # Face the intended direction before pressing an attack or guard key.
        # Native key events arrive separately, unlike a unit-test input object.
        # Repress movement after real focus releases, confirmed by input state.
        ordered=[a for a in ['up','left','down','right','block','roll','attack','shoot'] if a in actions]
        for action in ordered:
            key=KEYS[action]
            if key not in self.held:self.page.keyboard.down(key)
            elif observed is not None and not observed.get(action):
                self.page.keyboard.up(key);self.page.keyboard.down(key)
        self.held=desired
    def release(self):self.set(set())

def read(page):return page.evaluate('window.firesideRoom.getState()')
def watch(page,name):
    page.on('pageerror',lambda e:errors.append(name+': '+str(e)))
    page.on('console',lambda e:errors.append(name+': '+e.text) if e.type=='error' else None)
    page.on('response',lambda e:errors.append(name+': '+str(e.status)+' '+e.url) if e.status>=400 else None)
def capture(page,name):
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(SCREENSHOTS/name),full_page=True,animations='disabled')

def main(url):
    SCREENSHOTS.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-background-timer-throttling','--disable-renderer-backgrounding'])
        ca=browser.new_context(viewport={'width':1440,'height':1000},has_touch=False);cb=browser.new_context(viewport={'width':1440,'height':1000},has_touch=False)
        a,b=ca.new_page(),cb.new_page();watch(a,'P1');watch(b,'P2')
        a.goto(url);a.locator('[data-create-game="dungeon-run"]').click();a.wait_for_function('window.firesideRoom?.connected');b.goto(a.url);b.wait_for_function('window.firesideRoom?.playerId===1')
        for page, name in ((a, 'Mina'), (b, 'Rook')):
            with controls_panel(page, '#player-name'):
                page.locator('#player-name').fill(name)
                page.locator('#player-name').press('Enter')
        a.locator('#ready-button').focus();a.keyboard.press('Space');a.wait_for_function('document.querySelector("#ready-button").classList.contains("is-ready")');assert read(a)['phase']=='lobby'
        b.locator('#ready-button').click();a.wait_for_function('window.firesideRoom.getState().phase==="fight"');a.locator('#arena').focus();b.locator('#arena').focus()
        keyboard=[Keyboard(a),Keyboard(b)];navigator=Navigator();seen=set();rooms=set();bosses=set();boons=[];actions=set();first_shrines=False;first_choices=False;next_room=False;last_status=0
        started=time.monotonic();deadline=started+float(os.environ.get('DUNGEON_TIMEOUT','360' if TARGET_ROOM==9 else '180'))
        while time.monotonic()<deadline:
            state=read(a);rooms.add(state['wave'])
            for e in state['events']:
                if e['id'] in seen:continue
                seen.add(e['id']);actions.add(e['type'])
                if e['type']=='boon':boons.append(e)
                if e['type']=='enemyDeath' and e.get('enemyType')=='boss':bosses.add(state['wave'])
            if time.monotonic()-last_status>float(os.environ.get('DUNGEON_STATUS_INTERVAL','10')):
                print(json.dumps({'room':state['wave'],'break':state['roomBreak'],'phase':state['phase'],'heroes':[[round(f['hp']),round(f['stamina']),round(f['x']),round(f['y']),f['action'],[k for k,v in f['previousInput'].items() if v]] for f in state['fighters']],'foes':[[e['type'],round(e['hp'])] for e in state['enemies'] if e['hp']>0]}),flush=True);last_status=time.monotonic()
            if state['phase']=='matchEnd':break
            if state['wave']==1 and state['roomBreak'] and not first_shrines:
                for k in keyboard:k.release()
                for width in [320,390]:
                    a.set_viewport_size({'width':width,'height':900});a.wait_for_timeout(120)
                    assert a.locator('#dungeon-build-details').get_attribute('open') is not None
                    assert a.locator('#dungeon-shrines li').count()==3
                    for effect in ['+3 sword damage','+12 maximum health','pierce one extra foe']:assert effect in a.locator('#dungeon-shrines').inner_text()
                    capture(a,f'fireside-dungeon-shrines-{width}.png')
                first_shrines=True;a.set_viewport_size({'width':1440,'height':1000});a.locator('#arena').focus()
            if state['wave']==1 and all(state['boonSelections']) and not first_choices:
                for k in keyboard:k.release()
                a.wait_for_function('document.querySelector("#dungeon-boons").textContent.includes("Living Ward")');b.wait_for_function('document.querySelector("#dungeon-boons").textContent.includes("Living Ward")')
                assert state['fighters'][0]['boons']['ward']==1 and state['fighters'][1]['boons']['ward']==1
                assert state['fighters'][0]['maxHp']==112 and state['fighters'][1]['maxHp']==112
                assert len([e for e in boons if e['boon']=='ward'])==2
                a.set_viewport_size({'width':320,'height':900});capture(a,'fireside-dungeon-both-boons-320.png');a.set_viewport_size({'width':390,'height':900});capture(a,'fireside-dungeon-both-boons-390.png');a.set_viewport_size({'width':1440,'height':1000});a.locator('#arena').focus();first_choices=True
            if state['wave']==2 and not next_room:
                for k in keyboard:k.release()
                assert not state['roomBreak'];assert state['roomName']=='Broken Colonnade';assert state['fighters'][0]['boons']['ward']==1
                a.set_viewport_size({'width':320,'height':900});capture(a,'fireside-dungeon-room2-build-320.png');a.set_viewport_size({'width':390,'height':900});capture(a,'fireside-dungeon-room2-build-390.png');a.set_viewport_size({'width':1440,'height':1000});a.locator('#arena').focus();next_room=True
            if TARGET_ROOM<9 and state['wave']>=TARGET_ROOM:break
            for i,k in enumerate(keyboard):k.set(navigator.controls(state,state['fighters'][i]),state['fighters'][i]['previousInput'])
            a.wait_for_timeout(12)
        for k in keyboard:k.release()
        final=read(a)
        print(json.dumps({'finalPhase':final['phase'],'result':final.get('result'),'room':final['wave'],'heroes':[[round(f['hp']),round(f['stamina']),f['downed']] for f in final['fighters']]}),flush=True)
        capture(a,'fireside-dungeon-final.png')
        assert first_shrines and first_choices and next_room,{'phase':final['phase'],'wave':final['wave'],'heroes':[(f['hp'],f['downed']) for f in final['fighters']]}
        if TARGET_ROOM==9:assert final.get('result')=='victory',final.get('result')
        else:assert final['wave']>=TARGET_ROOM and final['phase']=='fight',(final['wave'],final['phase'])
        if TARGET_ROOM>=4:assert 3 in bosses;assert final['biome']['id']=='crypt' if TARGET_ROOM<7 else final['biome']['id']=='ember'
        a.wait_for_timeout(120);capture(a,'fireside-dungeon-progression.png')
        assert not errors,errors
        result={'result':'pass','rooms':sorted(rooms),'guardians':sorted(bosses),'physicalBoonChoices':len(boons),'actions':sorted(actions),'elapsedSeconds':round(time.monotonic()-started,1),'finalBiomes':final['biome'],'browserErrors':errors}
        print(json.dumps(result),flush=True);browser.close();return result

if __name__=='__main__':
    host=None
    try:
        if len(sys.argv)>1:url=sys.argv[1].rstrip('/')
        else:
            port=os.environ.get('DUNGEON_PORT','4187');url='http://127.0.0.1:'+port
            host=subprocess.Popen(['node','server.js'],cwd=ROOT,env={**os.environ,'PORT':port},stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
            for _ in range(100):
                if host.poll() is not None:raise RuntimeError(host.stderr.read().decode())
                try:
                    with urlopen(url+'/api/host-info',timeout=.2) as response:
                        if response.status==200:break
                except Exception:time.sleep(.05)
            else:raise RuntimeError('Dungeon test host did not start')
        main(url)
    finally:
        if host:host.terminate();host.wait(timeout=5)
