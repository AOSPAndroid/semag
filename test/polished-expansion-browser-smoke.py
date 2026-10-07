"""Native browser QA for the three carefully built solo expansions.

python test/polished-expansion-browser-smoke.py [server URL]
Requires Python Playwright and Chromium. With no URL, starts an isolated host.
Live gameplay uses trusted keyboard, mouse, or touch events only; observed state
is never modified. SEMAG_SCREENSHOT_DIR selects the artifact directory. Renderer
timings are gross headless checks, rather than a hardware GPU benchmark.
"""
import base64
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', ROOT / 'test-results' / 'polished-expansion'))
GAMES = {
    'skyline-hook': ('skyline', 'skyline-view.js', 'veteran-campaign-v1'),
    'starfall-squadron': ('starfall', 'starfall-view.js', 'veteran-campaign-v1'),
    'ironwood-tactics': ('ironwood', 'ironwood-view.js', 'ironwood-v1-veteran'),
}
INSTRUMENT = r'''() => {
    const stats=window.__expansionQA={rafCalls:0,frames:0,pending:[],cpu:[],gaps:[],recordWrites:[]};
    const request=window.requestAnimationFrame,cancel=window.cancelAnimationFrame,pending=new Set();let previous=null;
    window.requestAnimationFrame=callback=>{
        stats.rafCalls++;
        const game=/\/solo\/(skyline|starfall|ironwood)-view\.js/.test(new Error().stack);
        const id=request.call(window,time=>{
            pending.delete(id);stats.pending=[...pending];
            if(!game){callback(time);return}
            const start=performance.now();callback(time);const cpu=performance.now()-start;
            stats.frames++;
            if(stats.frames>5){stats.cpu.push(cpu);if(previous!==null)stats.gaps.push(time-previous)}
            // A stopped loop is a player pause/decision, not a rendering stall.
            previous=pending.size?time:null;if(stats.cpu.length>1800)stats.cpu.shift();if(stats.gaps.length>1800)stats.gaps.shift();
        });
        if(game){pending.add(id);stats.pending=[...pending]}return id;
    };
    window.cancelAnimationFrame=id=>{if(pending.has(id))previous=null;pending.delete(id);stats.pending=[...pending];return cancel.call(window,id)};
    const write=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
        if(String(key).startsWith('fireside-solo-best:'))stats.recordWrites.push({key,value});
        return write.call(this,key,value);
    };
}'''


def wait(page, expression, **kwargs):
    kwargs.setdefault('polling', 50)
    return page.wait_for_function(expression, **kwargs)


def state(page):
    return page.evaluate('window.firesideSolo.getState()')


def records(page):
    return page.evaluate('''() => Object.fromEntries(Object.keys(localStorage)
        .filter(key=>key.startsWith('fireside-solo-best:')).sort().map(key=>[key,localStorage.getItem(key)]))''')


class Keyboard:
    def __init__(self, page):
        self.page, self.held = page, set()

    def set(self, desired):
        desired = set(desired)
        for key in sorted(self.held-desired): self.page.keyboard.up(key)
        for key in sorted(desired-self.held): self.page.keyboard.down(key)
        self.held=desired

    def release(self):
        self.set(set())


def canvas_export(page, selector, name):
    data=page.locator(selector).evaluate("canvas=>canvas.toDataURL('image/png')")
    path=OUT/(name+'.png')
    path.write_bytes(base64.b64decode(data.split(',',1)[1]))
    return str(path)


def screenshot(page, name):
    path=OUT/(name+'.png')
    page.screenshot(path=str(path),full_page=True)
    return str(path)


def no_overflow(page, tag):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (tag,'Horizontal overflow')


def painted(page, selector):
    sample=page.locator(selector).evaluate('''canvas=>{
        const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
        const colors=new Set();let opaque=0;
        for(let y=0;y<96;y++)for(let x=0;x<96;x++){
            const i=(Math.floor((y+.5)*canvas.height/96)*canvas.width+Math.floor((x+.5)*canvas.width/96))*4;
            colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);if(pixels[i+3]>0)opaque++;
        }
        return {width:canvas.width,height:canvas.height,colors:colors.size,opaque:opaque/9216};
    }''')
    assert sample['colors']>10 and sample['opaque']>.9, ('Blank or missing game art',sample)
    return sample


def distribution(values):
    values=sorted(values)
    return {'count':len(values),'p50':values[len(values)//2] if values else None,
            'p95':values[min(len(values)-1,int(len(values)*.95))] if values else None,
            'max':max(values) if values else None}


def native_layout(page, value):
    select=page.locator('select[data-keyboard-layout]')
    select.click();page.keyboard.press('Home')
    if value=='zqsd': page.keyboard.press('ArrowDown')
    page.keyboard.press('Enter')
    assert select.input_value()==value


def ready_gate(page, game, modules, original_records, tag):
    wait(page,'game=>window.firesideSolo?.gameId===game && document.getElementById("solo-app").dataset.phase==="ready"',arg=game)
    assert state(page) is None
    assert page.locator('#solo-start').is_visible() and page.locator('#solo-start').is_enabled()
    assert not page.locator('.solo-session-actions').is_visible()
    wait(page,'document.getElementById("solo-preview").complete && document.getElementById("solo-preview").naturalWidth>0')
    page.wait_for_timeout(200)
    page.locator('#solo-game').focus()
    for key in ('r','p','q','z','Space','Enter','1','e'): page.keyboard.press(key)
    assert state(page) is None and not modules, (tag,'View or engine started before Start',modules)
    assert page.evaluate('window.__expansionQA.rafCalls')==0, (tag,'Ready page runs RAF')
    assert records(page)==original_records and not page.evaluate('window.__expansionQA.recordWrites')
    assert page.locator('#solo-game canvas').count()==0
    no_overflow(page,tag+'/ready')
    screenshot(page,tag.replace('/','-')+'-ready')


def pause_check(page, game, keyboard):
    keyboard.release()
    page.locator('#solo-pause').click()
    wait(page,'window.firesideSolo.getState().phase==="paused"')
    paused=state(page)
    page.wait_for_timeout(200)
    assert state(page)==paused, (game,'Paused state advanced')
    # All shortcuts stay native in editable controls. Pausing makes accidental
    # input/action leakage detectable without elapsed time obscuring comparison.
    page.evaluate('''()=>{const input=document.createElement('input');input.id='expansion-form-qa';
        input.setAttribute('aria-label','QA text input');document.querySelector('.solo-sidebar').append(input);input.focus()}''')
    page.keyboard.type('rpzqsdwasd123ejk')
    page.keyboard.press('Space')
    assert page.locator('#expansion-form-qa').input_value()=='rpzqsdwasd123ejk '
    assert state(page)==paused, (game,'Editable field triggered a shortcut')
    page.locator('#expansion-form-qa').evaluate('input=>input.remove()')
    native_layout(page,'wasd')
    assert state(page)==paused, (game,'Layout change mutated paused state')
    native_layout(page,'zqsd')
    assert state(page)==paused
    page.locator('#solo-how-to summary').focus();page.keyboard.press('Space')
    assert page.locator('#solo-how-to').evaluate('details=>details.open')
    assert state(page)==paused, (game,'Help shortcut leaked')
    page.keyboard.press('Enter')
    assert not page.locator('#solo-how-to').evaluate('details=>details.open')
    page.locator('#solo-pause').click()
    wait(page,'window.firesideSolo.getState().phase!=="paused"')
    return paused


def isolated_record_policy(page, game, scope):
    # This fixture copies an observed state/update and uses an independent Map
    # store. It exercises qualification and record direction without completing
    # a live run synthetically or writing the player's browser storage.
    result=page.evaluate('''async ([game,scope])=>{
        const {recordDetails,createBestStore}=await import('/solo/solo.js');
        const observed=structuredClone(window.firesideSolo.getState());
        const update={...observed,recordKey:scope,record:42,score:42};
        const partial=recordDetails(game,{...update,phase:'playing'});
        const lost=recordDetails(game,{...update,phase:'lost'});
        const won=recordDetails(game,{...update,phase:'won',result:'campaign'});
        const foreign=recordDetails(game,{...update,phase:'won',result:'campaign',recordKey:'foreign-mode'});
        const storage=new Map(),store=createBestStore({getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)});
        store.update(game,42,{scope,direction:won.direction});
        const worse=store.update(game,won.direction==='min'?50:35,{scope,direction:won.direction});
        const better=store.update(game,won.direction==='min'?35:50,{scope,direction:won.direction});
        return {partial,lost,won,foreign,worse,better,unrelated:store.read(game,'other-difficulty')};
    }''',[game,scope])
    assert result['partial']['candidate'] is None and result['lost']['candidate'] is None
    assert result['won']['candidate']==42 and result['foreign']['candidate'] is None
    assert result['worse']==42 and result['unrelated'] is None
    assert result['better']==(35 if game=='skyline-hook' else 50)
    return result


def touch_hold(page, context, selector, duration=180):
    """Use Chromium's native touch dispatcher; no synthetic DOM events."""
    element=page.locator(selector)
    element.scroll_into_view_if_needed()
    box=element.bounding_box();assert box
    point={'x':box['x']+box['width']/2,'y':box['y']+box['height']/2,'id':7}
    session=context.new_cdp_session(page)
    observed=None
    try:
        session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point]})
        page.wait_for_timeout(duration)
        observed=state(page)
    finally:
        session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        session.detach()
    return observed


def touch_drag(page, context, selector, dx, dy, duration=250):
    element=page.locator(selector);element.scroll_into_view_if_needed()
    box=element.bounding_box();assert box
    point={'x':box['x']+box['width']*.5,'y':box['y']+box['height']*.7,'id':9}
    session=context.new_cdp_session(page)
    try:
        session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point]})
        point={**point,'x':point['x']+dx,'y':point['y']+dy}
        session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[point]})
        page.wait_for_timeout(duration)
    finally:
        session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        session.detach()


def skyline_play(page, context, keyboard, profile):
    canvas=page.locator('.skyline-canvas')
    page.mouse.move(1,1);canvas.focus()
    initial=state(page)['player']['x']
    keyboard.set({'d'});page.wait_for_timeout(130);keyboard.release()
    assert state(page)['player']['x']>initial+10, 'Native right did not accelerate the courier'
    before=state(page)['player']['x']
    keyboard.set({'q'});page.wait_for_timeout(220);keyboard.release()
    assert state(page)['player']['vx']<0 and state(page)['player']['x']<before+15, 'French left did not reverse the courier'
    page.locator('#solo-restart').click();canvas.focus()
    policy={'jumpUntil':0,'releaseMode':None};observed={};swing_frame=None;attempts=0
    started=time.monotonic()
    while time.monotonic()-started<35:
        current=state(page)
        for event in current['events']: observed.setdefault(event['type'],event)
        if current['phase']=='stage-clear': break
        if current['phase']=='dead':
            keyboard.release();attempts+=1
            assert attempts<4, ('Native courier repeatedly missed a fair first-stage route',current)
            page.locator('.skyline-continue').click();canvas.focus();policy={'jumpUntil':0,'releaseMode':None};continue
        assert current['phase']=='playing', ('Courier run ended unexpectedly',current)
        decision=page.evaluate('''async memory=>{
            const G=await import('/solo/skyline-engine.js'),s=window.firesideSolo.getState(),p=s.player,l=G.LEVELS[s.level];
            const missing=s.relays.findIndex(v=>!v),target=missing>=0?l.relays[missing][0]:l.goal[0],dir=Math.sign(target-p.x);
            const roof=l.platforms.find(r=>p.x>=r.x-8&&p.x<=r.x+r.width+8&&Math.abs(p.y+14-r.y)<3);
            let input={right:dir>0,left:dir<0,jump:s.elapsed<memory.jumpUntil,hook:false};
            if(p.grounded&&Math.abs(p.vx)>295){input.right=p.vx<0;input.left=p.vx>0;}
            if(Math.abs(target-p.x)<20){input.right=p.vx<-15;input.left=p.vx>15;}
            if(roof&&p.grounded){
                const end=dir>0?roof.x+roof.width:roof.x;
                const spikes=l.spikes.filter(spike=>dir>0?spike.x>p.x&&spike.x-p.x<90:spike.x+spike.width<p.x&&p.x-spike.x-spike.width<90);
                const gap=dir>0?end-p.x<55&&target>end:p.x-end<55&&target<end;
                const obstacle=l.platforms.some(r=>r.x>p.x&&r.x-p.x<80&&r.y<roof.y&&r.x<end);
                if((gap||spikes.length||obstacle)&&s.elapsed>memory.jumpUntil){memory.jumpUntil=s.elapsed+.5;input.jump=true;}
            }
            if(!p.grounded){
                const a=l.anchors.find(a=>a.x>p.x-150&&a.x<p.x+400);
                const destination=l.platforms.find(r=>r.x>p.x-160&&r.x>160);
                if(a&&(!destination||p.x<destination.x-10)&&p.x>180)input.hook=true;
            }
            if(!p.grounded&&p.x>880&&p.vx>300){input.left=true;input.right=false;}
            if(s.hook){
                let release=null;
                for(const direction of [1,0,-1]){
                    const copy=structuredClone(s);copy.events=[];
                    for(let i=0;i<180;i++){
                        G.step(copy,{right:direction===1,left:direction===-1,jump:false,hook:false});
                        if(copy.phase!=='playing')break;
                        if(copy.player.grounded){
                            const landing=l.platforms.find(r=>r.x>s.hook.x);
                            if(landing&&copy.player.x>landing.x+12&&copy.player.x<landing.x+landing.width-12)release=direction;
                            break;
                        }
                    }
                    if(release!==null)break;
                }
                if(release===null){input.hook=true;input.up=true;}
                else{input.hook=false;input.left=release===-1;input.right=release===1;memory.releaseMode=release;}
            }else if(memory.releaseMode!==null&&!p.grounded){input.hook=false;input.left=memory.releaseMode===-1;input.right=memory.releaseMode===1;}
            else if(p.grounded)memory.releaseMode=null;
            return {input,memory};
        }''',policy)
        policy=decision['memory'];inputs=decision['input'];keys=set()
        for control,key in (('left','q'),('right','d'),('jump','Space'),('hook','e'),('up','z'),('down','s')):
            if inputs.get(control): keys.add(key)
        keyboard.set(keys)
        if swing_frame is None and current['hook'] and not current['player']['grounded']:
            swing_frame=canvas_export(page,'.skyline-canvas',f'skyline-hook-{profile}-swing-canvas')
            screenshot(page,f'skyline-hook-{profile}-swing-page')
        page.wait_for_timeout(25)
    keyboard.release();cleared=state(page)
    assert cleared['phase']=='stage-clear' and cleared['cleared']==1 and all(cleared['relays']), ('Native first rooftop did not clear',cleared)
    assert all(kind in observed for kind in ('jump','attach','release','relay')), ('Missing real traversal mechanics',observed)
    screenshot(page,f'skyline-hook-{profile}-stage-clear-page')
    frozen=state(page);page.wait_for_timeout(180);assert state(page)==frozen, 'Stage transition skipped player choice'
    page.locator('.skyline-continue').click();canvas.focus()
    assert state(page)['level']==1 and state(page)['cleared']==1 and state(page)['lives']==cleared['lives']
    touch_evidence=None
    if profile=='mobile':
        before=state(page)['player']['x']
        touch_hold(page,context,'[data-control="right"]',150)
        after=state(page)['player']['x'];assert after>before+10
        held=touch_hold(page,context,'[data-control="hook"]',160)
        assert held['hook'] is not None and held['hook']['x']==328, 'Native touch did not catch the next-stage visible anchor'
        wait(page,'window.firesideSolo.getState().hook===null',timeout=1000)
        assert page.locator('[data-control="hook"]').get_attribute('aria-pressed')=='false'
        touch_evidence={'right_before':before,'right_after':after,'hook_touch':True}
    else:
        canvas.scroll_into_view_if_needed();box=canvas.bounding_box();assert box
        page.mouse.move(box['x']+328/960*box['width'],box['y']+160/580*box['height'])
        page.mouse.down();page.wait_for_timeout(120)
        assert state(page)['hook'] is not None, 'Native aimed mouse grapple did not catch a visible anchor'
        page.mouse.up();wait(page,'window.firesideSolo.getState().hook===null',timeout=1000)
    return {'first_rooftop_cleared':True,'clear_elapsed':cleared['levelElapsed'],'lives':cleared['lives'],'attempts':attempts,
            'observed_events':observed,'swing_frame':swing_frame,'touch':touch_evidence,'state':state(page)}


def starfall_play(page, context, keyboard, profile):
    canvas=page.locator('.starfall-canvas');canvas.focus()
    assert page.locator('[data-starfall-auto]').is_checked(), 'Auto-fire should start enabled'
    assert state(page)['player']['radius']==3
    left_before=state(page)['player']['x']
    keyboard.set({'q','Shift'});page.wait_for_timeout(160)
    focused=state(page);keyboard.release()
    assert focused['player']['focus'] and focused['player']['x']<left_before-10, 'French focus/left failed'
    free_before=state(page)['player']['x']
    keyboard.set({'d'});page.wait_for_timeout(160);keyboard.release()
    free_distance=state(page)['player']['x']-free_before
    assert free_distance>24 and free_distance>1.7*(left_before-focused['player']['x']), 'Focus is not precise movement'
    touch_evidence=None
    if profile=='mobile':
        before=state(page)['player']['x']
        touch_drag(page,context,'.starfall-canvas',28,0)
        after=state(page)['player']['x']
        assert after>before+20, ('Actual touch drag did not move the ship',before,after)
        held=touch_hold(page,context,'[data-starfall-control="focus"]',100)
        assert held['player']['focus'], 'Actual touch Focus did not concentrate the ship'
        touch_evidence={'drag_before':before,'drag_after':after,'focus_touch':True}
    canvas.focus()
    started=time.monotonic();bombed=False;observed={};shots_frame=None;guardian_frame=None;dense_guardian_frame=None
    while time.monotonic()-started<95:
        current=state(page)
        assert current['phase']!='lost', ('Native Starfall pilot was destroyed',current)
        for event in current.get('events',[]):
            observed.setdefault(event['type'],event)
        if current['phase']=='upgrade': break
        if not bombed and current['hostileShots'] and current['kills']>0:
            keyboard.release();bombs=current['player']['bombs']
            if profile=='mobile': touch_hold(page,context,'[data-starfall-control="bomb"]',170)
            else:
                keyboard.set({'Space'});page.wait_for_timeout(170);keyboard.release()
            after=state(page)
            assert after['player']['bombs']==bombs-1, ('Holding one bomb consumed more than one charge',bombs,after['player']['bombs'])
            assert any(event['type']=='bomb' for event in after['events'])
            bombed=True;observed['bomb']=next(event for event in after['events'] if event['type']=='bomb')
            canvas.focus()
            current=state(page)
        decision=page.evaluate('''()=>{
            const s=window.firesideSolo.getState(),p=s.player,b=s.enemies.find(e=>e.boss);
            const enemy=b||s.enemies.filter(e=>e.y<p.y-30).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0];
            let best=null;
            for(const[mx,my]of [[0,0],[-1,0],[1,0],[0,-1],[0,1],[-Math.SQRT1_2,-Math.SQRT1_2],[-Math.SQRT1_2,Math.SQRT1_2],[Math.SQRT1_2,-Math.SQRT1_2],[Math.SQRT1_2,Math.SQRT1_2]]){
                let risk=0;
                for(const bullet of s.hostileShots){
                    const rx=bullet.x-p.x,ry=bullet.y-p.y,vx=bullet.vx-mx*105,vy=bullet.vy-my*105,vv=vx*vx+vy*vy;
                    const t=vv?Math.max(0,Math.min(.8,-(rx*vx+ry*vy)/vv)):0,d=Math.hypot(rx+vx*t,ry+vy*t);
                    risk+=200*Math.exp(-((d/(3+bullet.radius+9))**2))/(1+t*8);
                }
                const nx=p.x+mx*105*.4,ny=p.y+my*105*.4;
                if(nx<22||nx>458||ny<140||ny>560)risk+=500;
                const flight=enemy?Math.max(0,(p.y-enemy.y)/650):0;
                const target=b?240+Math.sin((b.age+flight-2)*(s.stage===6?.53:.63))*(s.stage===6?135:145):enemy?.x??240;
                const score=risk+Math.abs(nx-target)*.03+Math.abs(ny-430)*.002;
                if(!best||score<best.score)best={mx,my,score,risk};
            }
            return best;
        }''')
        keys={'Shift'}
        if decision['mx']<-.1: keys.add('q')
        elif decision['mx']>.1: keys.add('d')
        if decision['my']<-.1: keys.add('z')
        elif decision['my']>.1: keys.add('s')
        if bombed and current['player']['bombs']>0 and current['player']['invulnerable']<=0 and decision['risk']>80: keys.add('Space')
        keyboard.set(keys)
        if shots_frame is None and len(current['hostileShots'])>=16:
            shots_frame=canvas_export(page,'.starfall-canvas',f'starfall-squadron-{profile}-pattern-canvas')
            screenshot(page,f'starfall-squadron-{profile}-pattern-page')
        boss=next((enemy for enemy in current['enemies'] if enemy.get('boss')),None)
        if guardian_frame is None and boss and boss['y']>=100 and boss['hp']<boss['maxHp']*.85 and len(current['hostileShots'])>=6:
            guardian_frame=canvas_export(page,'.starfall-canvas',f'starfall-squadron-{profile}-guardian-canvas')
            screenshot(page,f'starfall-squadron-{profile}-guardian-page')
        if dense_guardian_frame is None and boss and boss['y']>=100 and boss['hp']<boss['maxHp']*.65 and len(current['hostileShots'])>=24:
            dense_guardian_frame=canvas_export(page,'.starfall-canvas',f'starfall-squadron-{profile}-dense-guardian-canvas')
            screenshot(page,f'starfall-squadron-{profile}-dense-guardian-page')
        page.wait_for_timeout(35)
    keyboard.release()
    current=state(page)
    assert current['phase']=='upgrade' and current['stagesCleared']==1, ('Native first guardian did not clear',current)
    assert bombed and current['kills']>=2 and current['grazes']>0, ('Insufficient genuine mechanics proof',current)
    assert shots_frame and guardian_frame, 'No representative active pattern/guardian frame was observed'
    screenshot(page,f'starfall-squadron-{profile}-upgrade-page')
    fixed=current;page.wait_for_timeout(200);assert state(page)==fixed, 'Upgrade choice advances combat'
    page.locator('#solo-pause').click();wait(page,'window.firesideSolo.getState().phase==="paused"')
    assert all(button.is_disabled() for button in page.locator('[data-starfall-upgrade]').all())
    paused=state(page);page.wait_for_timeout(150);assert state(page)==paused
    page.locator('#solo-pause').click();wait(page,'window.firesideSolo.getState().phase==="upgrade"')
    choice='lance' if 'lance' in current['upgradeChoices'] else current['upgradeChoices'][0]
    button=page.locator(f'[data-starfall-upgrade="{choice}"]')
    if profile=='mobile': button.tap()
    else: button.click()
    assert state(page)['phase']=='playing' and state(page)['stage']==2 and state(page)['build'][choice]==1
    return {'first_guardian_cleared':True,'kills':current['kills'],'grazes':current['grazes'],'hull':current['player']['hull'],
            'bombs':current['player']['bombs'],'observed_events':observed,'upgrade':choice,'touch':touch_evidence,
            'pattern_frame':shots_frame,'guardian_frame':guardian_frame,'dense_guardian_frame':dense_guardian_frame,'state':state(page)}


def ironwood_play(page, context, keyboard, profile):
    view=page.locator('.ironwood-view')
    page.mouse.move(1,1)
    view.focus()
    assert page.locator('.ironwood-tile').count()==56
    before=state(page)
    # Start can mount the battlefield under the existing mouse position; hero
    # selection puts the native cursor at a known cell before French movement.
    page.locator('[data-action="tile"][data-x="1"][data-y="2"]').hover()
    view.focus();page.keyboard.press('1')
    selected_cursor=page.locator('.ironwood-tile.is-cursor')
    assert selected_cursor.get_attribute('data-x')=='2' and selected_cursor.get_attribute('data-y')=='5', 'Stationary pointer overrode keyboard hero selection'
    page.keyboard.press('q');page.keyboard.press('z')
    cursor=page.locator('.ironwood-tile.is-cursor')
    assert cursor.get_attribute('data-x')=='1' and cursor.get_attribute('data-y')=='4', ('French cursor did not move',cursor.get_attribute('aria-label'))
    assert state(page)==before, 'Grid cursor movement changed engine state'
    actions=[]

    def activate(selector):
        locator=page.locator(selector)
        if profile=='mobile': locator.tap()
        else: locator.click()

    def hero(hero_id):
        number={'warden':'1','ranger':'2','weaver':'3'}[hero_id]
        if profile=='mobile': activate(f'[data-action="hero"][data-hero="{hero_id}"]')
        else:
            view.focus();page.keyboard.press(number)
        assert page.locator(f'[data-action="hero"][data-hero="{hero_id}"]').get_attribute('aria-pressed')=='true'

    def move(hero_id,x,y):
        hero(hero_id)
        activate('[data-action="mode"][data-mode="move"]')
        prior=state(page)
        expected=page.evaluate('''async ([hero,x,y])=>{
            const {movementOptions}=await import('/solo/ironwood-engine.js');
            return movementOptions(structuredClone(window.firesideSolo.getState()),hero).find(p=>p.x===x&&p.y===y);
        }''',[hero_id,x,y])
        assert expected, ('Native pilot selected an unreachable destination',hero_id,x,y,prior)
        activate(f'[data-action="tile"][data-x="{x}"][data-y="{y}"]')
        after=state(page)
        own=next(h for h in after['heroes'] if h['id']==hero_id)
        old=next(h for h in prior['heroes'] if h['id']==hero_id)
        assert (own['x'],own['y'])==(x,y) and own['move']==old['move']-expected['cost']
        actions.append({'action':'move','hero':hero_id,'x':x,'y':y,'cost':expected['cost']})

    def attack(hero_id,x,y):
        hero(hero_id)
        activate('[data-action="mode"][data-mode="attack"]')
        expected=page.evaluate('''async ([hero,x,y])=>{
            const {previewAction}=await import('/solo/ironwood-engine.js');
            return previewAction(structuredClone(window.firesideSolo.getState()),hero,'attack',x,y);
        }''',[hero_id,x,y])
        assert expected['ok'], ('Native pilot attack invalid',hero_id,x,y,expected)
        target=next(enemy for enemy in state(page)['enemies'] if enemy['id']==expected['target'])
        if target['hp']>expected['damage']+(expected.get('push') or {}).get('damage',0):
            assert 'defeat' not in expected['text'], ('Nonlethal action falsely promises a defeat',target,expected)
        tile=page.locator(f'[data-action="tile"][data-x="{x}"][data-y="{y}"]')
        tile.hover()
        assert page.locator('.ironwood-preview').inner_text()==expected['text'], ('Visible action forecast disagrees',expected)
        activate(f'[data-action="tile"][data-x="{x}"][data-y="{y}"]')
        assert any(event['kind']=='attack' and event['unit']==expected['target'] and event['damage']==expected['damage'] for event in state(page)['events'])
        if expected.get('push') and expected['push']['kind']=='push':
            target=next(e for e in state(page)['enemies'] if e['id']==expected['target'])
            assert target['staggered'] and (target['x'],target['y'])==(expected['push']['x'],expected['push']['y'])
            assert 'CANCELED' in page.locator('.ironwood-intents').inner_text()
        actions.append({'action':'attack','hero':hero_id,'forecast':expected,'events':state(page)['events']})

    def end_turn():
        expected=page.evaluate('''async()=>{
            const {forecast}=await import('/solo/ironwood-engine.js');
            return forecast(structuredClone(window.firesideSolo.getState()));
        }''')
        before=state(page)
        if profile=='mobile': activate('[data-action="end-turn"]')
        else:
            view.focus();page.keyboard.press('e')
        after=state(page)
        assert after['events']==expected, ('Locked resolution disagrees with forecast',expected,after['events'])
        assert after['totalTurns']==before['totalTurns']+1
        actions.append({'action':'end-turn','forecast':expected,'turn':after['turn']})

    move('ranger',3,2);attack('ranger',2,2)
    move('weaver',4,3);attack('weaver',5,3)
    move('warden',3,3);hero('warden');activate('[data-action="mode"][data-mode="brace"]')
    assert all(h['shield']==5 for h in state(page)['heroes'])
    screenshot(page,f'ironwood-tactics-{profile}-battle-page')
    end_turn()
    first_brute=next(e for e in state(page)['enemies'] if e['id']=='enemy-0')
    assert (first_brute['x'],first_brute['y'])==(1,3), ('Initial brute advance route changed',first_brute)
    move('ranger',1,2);attack('ranger',1,3);attack('weaver',5,3)
    # The archer's displayed advance path is locked at the start of its turn.
    archer=next(e for e in state(page)['enemies'] if e['kind']=='archer' and e['hp']>0)
    assert (archer['x'],archer['y'])==(4,1), ('Initial enemy advance route changed',archer)
    move('warden',4,2);attack('warden',4,1)
    screenshot(page,f'ironwood-tactics-{profile}-canceled-intent-page')
    end_turn();move('ranger',1,0);attack('ranger',4,0)
    remaining=next((e for e in state(page)['enemies'] if e['hp']>0),None)
    if remaining:
        assert (remaining['x'],remaining['y'])==(2,4), ('Remaining enemy route changed',remaining)
        move('warden',3,4);attack('warden',2,4)
    assert state(page)['phase']=='reward' and state(page)['completed']==1, state(page)
    assert page.locator('[data-action="reward"]').count()==3
    screenshot(page,f'ironwood-tactics-{profile}-reward-page')
    fixed=state(page);page.wait_for_timeout(200)
    assert state(page)==fixed, 'Reward choice advances without player action'
    page.locator('#solo-pause').click();wait(page,'window.firesideSolo.getState().phase==="paused"')
    assert all(button.is_disabled() for button in page.locator('[data-action="reward"]').all())
    paused=state(page);page.wait_for_timeout(150);assert state(page)==paused
    page.locator('#solo-pause').click();wait(page,'window.firesideSolo.getState().phase==="reward"')
    choice=state(page)['rewards'][0]
    activate(f'[data-action="reward"][data-id="{choice}"]')
    assert state(page)['mission']==1 and state(page)['phase']=='battle' and state(page)['completed']==1
    return {'actions':actions,'first_mission_cleared':True,'reward':choice,'native_touch':profile=='mobile','state':state(page)}


def hub_check(browser, url, errors, resources, mutations, sockets):
    context=browser.new_context(viewport={'width':1440,'height':1300})
    page=context.new_page();tag='hub'
    page.on('pageerror',lambda error:errors.append(f'{tag}: {error}'))
    page.on('console',lambda msg:errors.append(f'{tag}: {msg.text}') if msg.type=='error' else None)
    page.on('response',lambda response:resources.append(f'{tag}: {response.status} {response.url}') if response.status>=400 else None)
    page.on('request',lambda request:mutations.append(f'{tag}: {request.method} {request.url}') if '/api/rooms' in request.url and request.method!='GET' else None)
    page.on('websocket',lambda socket:sockets.append(f'{tag}: {socket.url}'))
    try:
        page.goto(url+'/')
        assert page.locator('[data-game-card]').count()==24
        assert page.locator('[data-play-solo]').count()==14
        assert page.locator('[data-create-game]').count()==10
        expected={'all':24,'solo':14,'friends':10,'action':11,'roguelike':4,'driving':3,'ninja':2}
        for category,count in expected.items():
            page.locator(f'[data-filter="{category}"]').click()
            assert page.locator('[data-game-card]:visible').count()==count, (category,'Catalog count mismatch')
        page.locator('[data-filter="all"]').click()
        for game,title in [('skyline-hook','Skyline Hook'),('starfall-squadron','Starfall Squadron'),('ironwood-tactics','Ironwood Tactics')]:
            page.locator('#game-search').fill(title)
            assert page.locator('[data-game-card]:visible').count()==1
            assert page.locator(f'[data-game-card="{game}"]').is_visible()
            page.locator('#game-search').fill('')
        for image in page.locator('.game-art img').all():
            image.scroll_into_view_if_needed()
            image.evaluate('image=>image.decode()')
            assert image.evaluate('image=>image.complete&&image.naturalWidth>0'), 'Missing shelf cover art'
        page.evaluate('window.scrollTo(0,0)');no_overflow(page,'hub/desktop')
        path=OUT/'polished-new-hub-desktop.png'
        page.screenshot(path=str(path),full_page=False)
        mobile=[]
        for width in (390,320):
            page.set_viewport_size({'width':width,'height':900});page.evaluate('window.scrollTo(0,0)')
            no_overflow(page,f'hub/{width}')
            path=OUT/f'polished-new-hub-{width}.png';page.screenshot(path=str(path),full_page=False);mobile.append(str(path))
        page.locator('[data-play-solo="skyline-hook"]').click()
        wait(page,'window.firesideSolo?.gameId==="skyline-hook"')
        assert state(page) is None and page.locator('#solo-start').is_visible(), 'Shelf navigation skipped the solo ready gate'
        print('PASS hub: 24 games / 14 solo, correct filters/search/covers, desktop/390/320 layouts, explicit solo gate',flush=True)
        return {'counts':expected,'desktop':str(OUT/'polished-new-hub-desktop.png'),'mobile':mobile,'ready_gate_from_shelf':True}
    finally:
        context.close()


def run(url):
    OUT.mkdir(parents=True,exist_ok=True)
    errors,resources,mutations,sockets,results=[],[],[],[],[]
    seeds={}
    for game in GAMES:
        for index,difficulty in enumerate(('standard','veteran','nightmare')):
            scope=f'ironwood-v1-{difficulty}' if game=='ironwood-tactics' else f'{difficulty}-campaign-v1'
            seeds[f'fireside-solo-best:{game}:{scope}']=123.45+index if game=='skyline-hook' else 2468+index
    with sync_playwright() as playwright:
        options={'headless':True,'args':['--no-sandbox']}
        if Path('/usr/bin/chromium').exists(): options['executable_path']='/usr/bin/chromium'
        browser=playwright.chromium.launch(**options)
        try:
            for profile,width,dpr in (('desktop',1440,1),('mobile',390,2)):
                selected_games=os.environ.get('SEMAG_QA_GAMES','').split(',')
                for game,(prefix,module,scope) in GAMES.items():
                    if selected_games!=[''] and game not in selected_games: continue
                    context=browser.new_context(viewport={'width':width,'height':1000 if width>600 else 900},device_scale_factor=dpr,has_touch=profile=='mobile')
                    context.add_init_script('''localStorage.setItem('semag-keyboard-layout','zqsd');
                        for(const[key,value]of Object.entries('''+json.dumps(seeds)+'''))if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(value));
                        ('''+INSTRUMENT+''')();''')
                    page=context.new_page();tag=f'{game}/{profile}';modules=[]
                    page.on('pageerror',lambda error,tag=tag:errors.append(f'{tag}: {error}'))
                    page.on('console',lambda msg,tag=tag:errors.append(f'{tag}: {msg.text}') if msg.type=='error' else None)
                    page.on('response',lambda response,tag=tag:resources.append(f'{tag}: {response.status} {response.url}') if response.status>=400 else None)
                    page.on('request',lambda request,modules=modules:modules.append(request.url) if '/solo/' in request.url and request.url.endswith(('-view.js','-engine.js')) else None)
                    page.on('request',lambda request,tag=tag:mutations.append(f'{tag}: {request.method} {request.url}') if '/api/rooms' in request.url and request.method!='GET' else None)
                    page.on('websocket',lambda socket,tag=tag:sockets.append(f'{tag}: {socket.url}'))
                    keyboard=Keyboard(page)
                    try:
                        page.goto(url+'/solo.html?game='+game)
                        original_records=records(page)
                        ready_gate(page,game,modules,original_records,tag)
                        assert page.locator('select[data-keyboard-layout]').input_value()=='zqsd'
                        page.locator('#solo-start').click()
                        wait(page,'window.firesideSolo.getState()!==null')
                        assert state(page)['difficulty']=='veteran', (tag,'Default difficulty is not Veteran')
                        assert len([request for request in modules if request.endswith('/'+module)])==1
                        expected_best='124.45s' if game=='skyline-hook' else '2469'
                        assert page.locator('#solo-record').inner_text()==expected_best, (tag,'Wrong stored difficulty record shown')
                        if profile=='mobile':
                            selector='[data-starfall-control]' if game=='starfall-squadron' else '[data-control]' if game=='skyline-hook' else '.ironwood-actions button'
                            for button in page.locator(selector).all():
                                assert button.bounding_box()['height']>=44, (tag,'Small action touch target')
                        if game=='skyline-hook': evidence=skyline_play(page,context,keyboard,profile)
                        elif game=='starfall-squadron': evidence=starfall_play(page,context,keyboard,profile)
                        else: evidence=ironwood_play(page,context,keyboard,profile)
                        assert state(page)['phase'] not in ('lost','won'), (tag,'Native pilot prematurely ended')
                        paused=pause_check(page,game,keyboard)
                        page.locator('#solo-pause').click();wait(page,'window.firesideSolo.getState().phase==="paused"')
                        if game=='skyline-hook':
                            assert page.locator('#solo-score-label').inner_text()=='CAMPAIGN TIME'
                            assert page.locator('#solo-score').inner_text()==f'{state(page)["elapsed"]:.2f}s', 'Primary campaign clock disagrees with the actual elapsed time'
                            assert page.locator('#solo-record-label').inner_text()=='FASTEST CLEAR'
                        no_overflow(page,tag)
                        screenshot(page,tag.replace('/','-')+'-active-page')
                        if game!='ironwood-tactics': paint=painted(page,'.'+prefix+'-canvas')
                        else: paint={'tiles':page.locator('.ironwood-tile').count()}
                        if profile=='mobile':
                            page.set_viewport_size({'width':320,'height':900})
                            no_overflow(page,tag+'/320')
                            screenshot(page,game+'-320-active-page')
                            page.set_viewport_size({'width':390,'height':900})
                        stats=page.evaluate('window.__expansionQA')
                        cpu,gaps=distribution(stats['cpu']),distribution(stats['gaps'])
                        if game=='ironwood-tactics':
                            assert stats['rafCalls']==0, (tag,'Turn-based game runs an animation loop')
                        else:
                            assert cpu['count']>=30, (tag,'Insufficient real render samples',stats)
                            assert cpu['p95']<35 and gaps['p95']<65, (tag,'Gross rendering slowdown',cpu,gaps)
                        policy=isolated_record_policy(page,game,scope)
                        assert records(page)==original_records and not stats['recordWrites'], (tag,'Partial gameplay overwrote a campaign record')
                        page.locator('#solo-restart').click()
                        fresh=state(page)
                        assert fresh['difficulty']=='veteran' and fresh['phase'] in ('playing','battle')
                        assert page.locator('#solo-start').count()==0
                        assert records(page)==original_records
                        if game=='skyline-hook': assert fresh['level']==0 and fresh['cleared']==0 and fresh['deaths']==0
                        elif game=='starfall-squadron': assert fresh['stage']==1 and fresh['score']==0 and fresh['player']['hull']==3
                        else: assert fresh['mission']==0 and fresh['turn']==1 and fresh['completed']==0
                        page.reload();wait(page,'window.firesideSolo?.getState()===null')
                        assert page.locator('#solo-start').is_visible() and records(page)==original_records
                        assert page.locator('select[data-keyboard-layout]').input_value()=='zqsd'
                        results.append({'game':game,'profile':profile,'dpr':dpr,'paint':paint,'cpu_ms':cpu,'frame_gap_ms':gaps,'evidence':evidence,'paused_state':paused,'record_policy':policy,'records_preserved':True})
                        print(f'PASS {tag}: meaningful native play, ready/pause/restart, ZQSD/forms, records, visible art; draw p95 {cpu["p95"]}',flush=True)
                    finally:
                        keyboard.release();context.close()
            assert not errors,errors
            assert not resources,resources
            assert not mutations,mutations
            assert not sockets,sockets
            hub=hub_check(browser,url,errors,resources,mutations,sockets)
            assert not errors and not resources and not mutations and not sockets, (errors,resources,mutations,sockets)
            report={'games':results,'hub':hub,'errors':errors,'failed_resources':resources,'room_mutations':mutations,'websockets':sockets,'screenshots':str(OUT)}
            (OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n')
            print(json.dumps(report),flush=True)
        finally:
            browser.close()


def main():
    if len(sys.argv)>1:
        run(sys.argv[1].rstrip('/'));return
    source="import{createServer}from'./server.js';const server=createServer();const address=await server.listen(0,'127.0.0.1');console.log(JSON.stringify({port:address.port}));process.on('SIGTERM',async()=>{await server.close();process.exit(0)});"
    host=subprocess.Popen(['node','--input-type=module','--eval',source],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    try:
        line=host.stdout.readline()
        if not line: raise RuntimeError(host.stderr.read())
        run(f'http://127.0.0.1:{json.loads(line)["port"]}')
    finally:
        host.terminate()
        try: host.wait(timeout=5)
        except subprocess.TimeoutExpired: host.kill();host.wait(timeout=5)


if __name__=='__main__': main()
