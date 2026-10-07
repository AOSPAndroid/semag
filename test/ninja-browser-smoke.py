"""Native browser QA for Shadow Lantern and Shinobi Showdown.

python test/ninja-browser-smoke.py [server URL]
Requires Python Playwright and Chromium. With no URL, starts an isolated host.
Live games receive only native keyboard, pointer, or trusted Chromium touch
input. State is observed, never injected. Pure copied fixtures inspect render
and record policies independently. SEMAG_SCREENSHOT_DIR selects artifacts.
Headless renderer timings are gross regressions, not a hardware GPU benchmark.
"""
import base64
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('SEMAG_SCREENSHOT_DIR',ROOT/'test-results'/'ninjas'))
INSTRUMENT=r"""() => {
    const stats=window.__ninjaQA={rafCalls:0,frames:0,pending:[],cpu:[],gaps:[],paintCalls:[],operations:0,recordWrites:[]};
    for(const method of ['drawImage','fillRect','stroke','fill','clearRect']){
        const original=CanvasRenderingContext2D.prototype[method];
        CanvasRenderingContext2D.prototype[method]=function(...args){stats.operations++;return original.apply(this,args)};
    }
    const request=window.requestAnimationFrame,cancel=window.cancelAnimationFrame,pending=new Set();let previous=null;
    window.requestAnimationFrame=callback=>{
        stats.rafCalls++;
        const game=/\/(solo\/shadow-view|hub\/room)\.js/.test(new Error().stack);
        const id=request.call(window,time=>{
            pending.delete(id);stats.pending=[...pending];
            if(!game){callback(time);return}
            const start=performance.now(),operations=stats.operations;callback(time);const cpu=performance.now()-start;
            stats.frames++;
            if(stats.frames>5){stats.cpu.push(cpu);stats.paintCalls.push(stats.operations-operations);if(previous!==null)stats.gaps.push(time-previous)}
            previous=pending.size?time:null;
            if(stats.cpu.length>1800)stats.cpu.shift();if(stats.paintCalls.length>1800)stats.paintCalls.shift();if(stats.gaps.length>1800)stats.gaps.shift();
        });
        if(game){pending.add(id);stats.pending=[...pending]}return id;
    };
    window.cancelAnimationFrame=id=>{if(pending.has(id))previous=null;pending.delete(id);stats.pending=[...pending];return cancel.call(window,id)};
    const write=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
        if(String(key).startsWith('fireside-solo-best:'))stats.recordWrites.push({key,value});
        return write.call(this,key,value);
    };
}"""

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
        for key in sorted(desired-self.held,key=lambda key:(key!='Shift',key)): self.page.keyboard.down(key)
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
    assert page.evaluate('window.__ninjaQA.rafCalls')==0, (tag,'Ready page runs RAF')
    assert records(page)==original_records and not page.evaluate('window.__ninjaQA.recordWrites')
    assert page.locator('#solo-game canvas').count()==0
    no_overflow(page,tag+'/ready')
    screenshot(page,tag.replace('/','-')+'-ready')


def pause_check(page, game, keyboard):
    keyboard.release()
    page.locator('#solo-pause').click()
    wait(page,'window.firesideSolo.getState().phase==="paused"')
    paused=state(page)
    wait(page,'window.__ninjaQA.pending.length===0')
    paused_frames=page.evaluate('window.__ninjaQA.frames')
    page.wait_for_timeout(200)
    assert page.evaluate('window.__ninjaQA.frames')==paused_frames, (game,'Paused rendering loop keeps running')
    assert state(page)==paused, (game,'Paused state advanced')
    # All shortcuts stay native in editable controls. Pausing makes accidental
    # input/action leakage detectable without elapsed time obscuring comparison.
    page.evaluate('''()=>{const input=document.createElement('input');input.id='ninja-form-qa';
        input.setAttribute('aria-label','QA text input');document.querySelector('.solo-sidebar').append(input);input.focus()}''')
    page.keyboard.type('rpzqsdwasd123ejk')
    page.keyboard.press('Space')
    assert page.locator('#ninja-form-qa').input_value()=='rpzqsdwasd123ejk '
    assert state(page)==paused, (game,'Editable field triggered a shortcut')
    page.locator('#ninja-form-qa').evaluate('input=>input.remove()')
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
    assert result['better']==(35 if result['won']['direction']=='min' else 50)
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



def room_state(page):
    return page.evaluate('window.firesideRoom.getState()')


def room_phase(page, phase, timeout=15000):
    wait(page,'phase=>window.firesideRoom?.getState().phase===phase',arg=phase,timeout=timeout)


def watch(page, tag, errors, resources):
    page.on('pageerror',lambda error:errors.append(f'{tag}: {error}'))
    page.on('console',lambda message:errors.append(f'{tag}: {message.text}') if message.type=='error' else None)
    page.on('response',lambda response:resources.append(f'{tag}: {response.status} {response.url}') if response.status>=400 else None)


def performance_result(page, tag):
    stats=page.evaluate('window.__ninjaQA')
    cpu,gaps=distribution(stats['cpu']),distribution(stats['gaps'])
    assert cpu['count']>=30, (tag,'Insufficient rendering samples',cpu)
    assert cpu['p95']<35 and gaps['p95']<65, (tag,'Gross rendering slowdown',cpu,gaps)
    paints=distribution(stats['paintCalls'])
    assert paints['p95']<300 and paints['max']<15000, (tag,'Unbounded rendering work',paints)
    return {'cpu_ms':cpu,'frame_gap_ms':gaps,'canvas_operations':paints,'hitches_over_100ms':sum(x>100 for x in stats['gaps'])}


def hub_check(browser,url,errors,resources):
    context=browser.new_context(viewport={'width':1440,'height':1100})
    page=context.new_page();watch(page,'hub',errors,resources)
    try:
        page.goto(url+'/')
        expected={'all':25,'solo':14,'friends':11,'action':12,'roguelike':4,'driving':3,'ninja':2,'voxel':1}
        assert page.locator('[data-game-card]').count()==25
        for category,count in expected.items():
            page.locator(f'[data-filter="{category}"]').click()
            assert page.locator('[data-game-card]:visible').count()==count, (category,count,page.locator('[data-game-card]:visible').count())
        page.locator('[data-filter="all"]').click()
        page.locator('#game-search').fill('ninja')
        assert page.locator('[data-game-card]:visible').count()==2
        for game,title in (('shadow-lantern','Shadow Lantern'),('shinobi-showdown','Shinobi Showdown')):
            page.locator('#game-search').fill(title)
            assert page.locator('[data-game-card]:visible').count()==1
            assert page.locator(f'[data-game-card="{game}"]').is_visible()
        page.locator('#game-search').fill('')
        cover_count=page.locator('.game-art img').count()
        for image in page.locator('.game-art img').all():
            image.scroll_into_view_if_needed();image.evaluate('image=>image.decode()')
            assert image.evaluate('image=>image.complete&&image.naturalWidth>0')
        page.evaluate('scrollTo(0,0)');no_overflow(page,'hub/desktop')
        page.screenshot(path=str(OUT/'ninja-hub-desktop.png'),full_page=False)
        for width in (390,320):
            page.set_viewport_size({'width':width,'height':900});page.evaluate('scrollTo(0,0)')
            no_overflow(page,'hub/'+str(width));screenshot(page,'ninja-hub-'+str(width))
        page.locator('[data-play-solo="shadow-lantern"]').click()
        wait(page,'window.firesideSolo?.gameId==="shadow-lantern"')
        assert state(page) is None and page.locator('#solo-start').is_visible()
        return {'counts':expected,'search_ninja':2,'covers_loaded':cover_count,'shelf_ready_gate':True}
    finally:
        context.close()


def native_room_aim(page,x,y):
    box=page.locator('#arena').bounding_box();assert box
    page.mouse.move(box['x']+x/960*box['width'],box['y']+y/640*box['height'])


def room_move(page,target,seat,timeout=12):
    keyboard=Keyboard(page);page.locator('#arena').focus();deadline=time.monotonic()+timeout
    try:
        while time.monotonic()<deadline:
            current=room_state(page);assert current['phase']=='fight', ('Move interrupted',current['phase'])
            actor=current['fighters'][seat];dx,dy=target[0]-actor['x'],target[1]-actor['y']
            if abs(dx)<6 and abs(dy)<6:
                keyboard.release();page.wait_for_timeout(70);return room_state(page)['fighters'][seat]
            # Far routes use held native keys. Near the target, release and use
            # short pulses so authoritative snapshot latency cannot turn this
            # controller into a perpetual diagonal oscillation.
            near=max(abs(dx),abs(dy))<65
            if near:
                keyboard.release();page.wait_for_timeout(70)
                actor=room_state(page)['fighters'][seat];dx,dy=target[0]-actor['x'],target[1]-actor['y']
                if abs(dx)<6 and abs(dy)<6:return actor
            if abs(dx)>=6: key='ArrowRight' if dx>0 else 'ArrowLeft'
            else: key='ArrowDown' if dy>0 else 'ArrowUp'
            keyboard.set({key});page.wait_for_timeout(20 if near else 30)
            if near:keyboard.release();page.wait_for_timeout(65)
    finally:
        keyboard.release()
    raise AssertionError(('Native room move failed',target,room_state(page)['fighters'][seat]))


def room_event(page,event_id,kind,timeout=4000,filters=None):
    filters=filters or {}
    wait(page,'([id,kind,fields])=>window.firesideRoom.getState().events.some(e=>e.id>id&&e.type===kind&&Object.entries(fields).every(([key,value])=>e[key]===value))',arg=[event_id,kind,filters],timeout=timeout)
    return next(event for event in room_state(page)['events'] if event['id']>event_id and event['type']==kind and all(event.get(key)==value for key,value in filters.items()))


def room_layouts(page):
    screenshot(page,'shinobi-showdown-desktop-active')
    for width in (390,320):
        page.set_viewport_size({'width':width,'height':900});no_overflow(page,'shinobi/'+str(width))
        screenshot(page,'shinobi-showdown-'+str(width)+'-active')
    page.set_viewport_size({'width':1440,'height':1000})


def create_room(browser,url,errors,resources,profile):
    width=390 if profile=='mobile' else 1440
    contexts=[browser.new_context(viewport={'width':width,'height':1000},device_scale_factor=2 if profile=='mobile' else 1,has_touch=profile=='mobile') for _ in range(2)]
    pages=[context.new_page() for context in contexts]
    for page,context,index in zip(pages,contexts,range(2)):
        context.add_init_script("localStorage.setItem('semag-keyboard-layout','zqsd');("+INSTRUMENT+")();")
        watch(page,'shinobi-'+profile+'-P'+str(index+1),errors,resources)
        page.goto(url+'/')
    first,second=pages
    first.locator('[data-create-game="shinobi-showdown"]').click();first.wait_for_url('**/*room=*')
    wait(first,'window.firesideRoom?.connected&&window.firesideRoom.playerId===0')
    code=parse_qs(urlparse(first.url).query)['room'][0]
    second.locator('#room-code').fill(code.lower());second.locator('#join-button').click();second.wait_for_url('**/*room=*')
    wait(second,'window.firesideRoom?.connected&&window.firesideRoom.playerId===1')
    for page in pages:
        assert page.locator('select[data-keyboard-layout]').input_value()=='zqsd'
        page.locator('#player-name').fill('');page.locator('#player-name').press('r');page.locator('#player-name').press('q')
        assert page.locator('#player-name').input_value()=='rq'
        assert room_state(page)['phase']=='lobby'
        assert page.locator('#ready-button span').inner_text()=='Ready up'
    first.locator('#ready-button').click()
    wait(first,'document.querySelector("#ready-button span").textContent==="Cancel ready"')
    assert room_state(first)['phase']=='lobby'
    second.locator('#ready-button').click();room_phase(first,'fight');room_phase(second,'fight')
    first.locator('#arena').focus();before=room_state(first)['fighters'][0]['x']
    first.keyboard.down('q');first.wait_for_timeout(100);first.keyboard.up('q')
    assert room_state(first)['fighters'][0]['x']<before-3, 'French native move did not work'
    return contexts,pages,code

def trusted_touch(page,context,selector,duration=180,offset=(0,0),room=False,cancel=False):
    element=page.locator(selector);element.scroll_into_view_if_needed();box=element.bounding_box();assert box
    assert box['width']>=44 and box['height']>=44, (selector,'Small touch target',box)
    point={'x':box['x']+box['width']*(.5+offset[0]),'y':box['y']+box['height']*(.5+offset[1]),'id':9}
    session=context.new_cdp_session(page);read=room_state if room else state;active=False
    try:
        before=read(page)
        session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point]});active=True
        page.wait_for_timeout(duration);held=read(page)
        session.send('Input.dispatchTouchEvent',{'type':'touchCancel' if cancel else 'touchEnd','touchPoints':[]});active=False
        page.wait_for_timeout(80);released=read(page)
        assert 'is-held' not in (element.get_attribute('class') or '')
        return before,held,released
    finally:
        if active: session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        session.detach()


def wait_idle(page,seat=0):
    wait(page,'seat=>["idle","run"].includes(window.firesideRoom.getState().fighters[seat].action)',arg=seat,timeout=3000,polling=10)



def copied_weapon_cover_fixture(page):
    result=page.evaluate(r"""async()=>{
        const {ShinobiRenderer}=await import('/shinobi-renderer.js');
        const {MOVES,STAGES}=await import('/shinobi-engine.js');
        const observed=structuredClone(window.firesideRoom.getState());
        const fighter={...structuredClone(observed.fighters[0]),x:420,y:320,facing:0,actionFacing:0,hp:100,action:'light',actionFrame:MOVES.light.startup,attackHits:[]};
        function paint(body,covers){
            const canvas=document.createElement('canvas'),renderer=new ShinobiRenderer(canvas);
            canvas.width=960;canvas.height=640;const ctx=canvas.getContext('2d');
            ctx.fillStyle='#e8e9df';ctx.fillRect(0,0,960,640);
            renderer.paintFighter(ctx,body,observed.tick,false,covers);
            const pixels=ctx.getImageData(0,0,960,640).data;
            renderer.destroy();return{pixels,data:canvas.toDataURL('image/png')};
        }
        function blocks(rect,x,y){
            let enter=0,exit=1;const dx=x-fighter.x,dy=y-fighter.y;
            for(const[o,d,lo,hi]of[[fighter.x,dx,rect.x+1,rect.x+rect.w-1],[fighter.y,dy,rect.y+1,rect.y+rect.h-1]]){
                if(Math.abs(d)<1e-9){if(o<lo||o>hi)return false;continue}
                let a=(lo-o)/d,b=(hi-o)/d;if(a>b)[a,b]=[b,a];enter=Math.max(enter,a);exit=Math.min(exit,b);if(enter>exit)return false;
            }
            return enter<1&&exit>0;
        }
        const idle={...fighter,action:'idle',actionFrame:0};
        const cover=STAGES.garden.covers[0],thin={...cover,w:12};
        const free=paint(fighter,[]),base=paint(idle,[]),blocked=paint(fighter,[cover]),blockedIdle=paint(idle,[cover]);
        const thinBlocked=paint(fighter,[thin]),thinIdle=paint(idle,[thin]);
        let freeForward=0,blockedForward=0,thinBeyond=0,thinFreeBeyond=0,bodyPixels=0;
        function changed(a,b,i){return a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]}
        for(let y=240;y<400;y++)for(let x=350;x<530;x++){
            const i=(y*960+x)*4,d=Math.hypot(x-fighter.x,y-fighter.y);
            if(d<14&&(blocked.pixels[i]!==232||blocked.pixels[i+1]!==233||blocked.pixels[i+2]!==223))bodyPixels++;
            if(x>438&&d<100&&blocks(cover,x+.5,y+.5)){
                if(changed(free.pixels,base.pixels,i))freeForward++;
                if(changed(blocked.pixels,blockedIdle.pixels,i))blockedForward++;
            }
            if(x>thin.x+thin.w+1&&d<100&&blocks(thin,x+.5,y+.5)){
                if(changed(thinBlocked.pixels,thinIdle.pixels,i))thinBeyond++;
                if(changed(free.pixels,base.pixels,i))thinFreeBeyond++;
            }
        }
        const away=paint({...fighter,facing:Math.PI,actionFacing:Math.PI},[cover]);
        const awayIdle=paint({...idle,facing:Math.PI,actionFacing:Math.PI},[cover]);let awayVisible=0;
        for(let y=240;y<400;y++)for(let x=330;x<402;x++){const i=(y*960+x)*4;if(changed(away.pixels,awayIdle.pixels,i))awayVisible++}
        return{freeForward,blockedForward,thinBeyond,thinFreeBeyond,bodyPixels,awayVisible,blockedImage:blocked.data,freeImage:free.data};
    }""")
    for field in ('blockedImage','freeImage'):
        (OUT/('shinobi-copied-weapon-'+('blocked' if field=='blockedImage' else 'free')+'-fixture.png')).write_bytes(base64.b64decode(result.pop(field).split(',',1)[1]))
    (OUT/'shinobi-copied-weapon-cover-fixture.json').write_text(json.dumps(result,indent=2)+'\n')
    assert result['freeForward']>10 and result['thinFreeBeyond']>10 and result['awayVisible']>10
    assert result['blockedForward']==0 and result['thinBeyond']==0, ('A visible weapon crosses solid cover',result)
    assert result['bodyPixels']>100, ('Cover clipping erased the ninja body',result)
    return result

def shinobi_desktop(first,second):
    evidence={'copied_weapon_cover_fixture':copied_weapon_cover_fixture(first)};room_move(first,(220,320),0);room_move(first,(220,220),0)
    native_room_aim(first,500,220);first.locator('#arena').focus()
    event_id=room_state(first)['eventId'];first.keyboard.press('l',delay=30)
    contact=room_event(first,event_id,'cover');rect=room_state(first)['obstacles'][0]
    clearance=math.hypot(contact['x']-max(rect['x'],min(rect['x']+rect['w'],contact['x'])),contact['y']-max(rect['y'],min(rect['y']+rect['h'],contact['y'])))
    assert abs(clearance-3)<.05, ('Kunai cover contact misses its drawn radius',contact,clearance)
    evidence['kunai_cover']={'event':contact,'clearance':clearance}
    wait_idle(first);native_room_aim(first,500,220);first.keyboard.press('Space',delay=25)
    wait(first,'window.firesideRoom.getState().fighters[0].action==="dash"',polling=10)
    wait_idle(first);actor=room_state(first)['fighters'][0]
    assert abs(actor['x']-(rect['x']-actor['radius']))<.05, ('Dash crossed visible cover',actor)
    evidence['dash_cover']={'x':actor['x'],'radius':actor['radius']}
    canvas_export(first,'#arena','shinobi-rooftop-cover-contact-canvas')
    room_move(first,(220,220),0);room_move(first,(220,320),0)
    room_move(second,(706,320),1);native_room_aim(first,706,320);first.locator('#arena').focus()
    previous=room_state(first);event_id=previous['eventId'];first.keyboard.press('l',delay=25)
    hit=room_event(first,event_id,'hit');assert hit['attack']=='kunai' and hit['target']==1 and hit['damage']==14
    wait(second,'hp=>window.firesideRoom.getState().fighters[1].hp===hp',arg=previous['fighters'][1]['hp']-14)
    evidence['native_kunai_hit']=hit
    wait_idle(first);room_move(first,(646,320),0)
    native_room_aim(first,706,320);native_room_aim(second,646,320)
    first.locator('#arena').focus();event_id=room_state(first)['eventId'];hp=room_state(first)['fighters'][1]['hp']
    first.keyboard.press('k',delay=20)
    wait(first,'window.firesideRoom.getState().fighters[0].action==="heavy"&&window.firesideRoom.getState().fighters[0].actionFrame>=15',polling=5)
    second.locator('#arena').focus();second.keyboard.press('i',delay=30)
    parry=room_event(first,event_id,'parry',filters={'target':0});assert parry['fighter']==1 and parry['target']==0
    assert room_state(first)['fighters'][1]['hp']==hp
    evidence['native_heavy_parry']=parry
    canvas_export(first,'#arena','shinobi-rooftop-native-parry-canvas')
    wait_idle(first);wait_idle(second)
    first.locator('#arena').focus();native_room_aim(first,706,320);event_id=room_state(first)['eventId']
    first.mouse.down(button='left');first.wait_for_timeout(35);first.mouse.up(button='left')
    light=room_event(first,event_id,'hit');assert light['attack']=='light' and light['damage']==18
    evidence['native_pointer_katana']=light
    canvas_export(first,'#arena','shinobi-rooftop-native-katana-canvas')
    wait_idle(first);wait_idle(second)
    native_room_aim(first,706,320);native_room_aim(second,646,320)
    first.locator('#arena').focus();event_id=room_state(first)['eventId'];first.keyboard.press('l',delay=15)
    wait(first,'window.firesideRoom.getState().fighters[0].action==="throw"&&window.firesideRoom.getState().fighters[0].actionFrame>=5',polling=5)
    second.locator('#arena').focus();second.keyboard.press('i',delay=25)
    deflect=room_event(first,event_id,'deflect');assert deflect['fighter']==1
    evidence['native_kunai_deflect']=deflect
    canvas_export(first,'#arena','shinobi-rooftop-native-deflect-canvas')
    room_layouts(first)
    return evidence


def shinobi_match(first,second):
    visited=set();captured=set();routes={1:[(646,320)],2:[(806,90),(190,90),(190,320)],3:[(154,75),(746,75),(746,220)]}
    deadline=time.monotonic()+100
    while time.monotonic()<deadline:
        current=room_state(first)
        if current['phase']=='matchEnd':break
        if current['phase']!='fight':first.wait_for_timeout(30);continue
        number=current['round'];assert number<=3, ('Native match did not resolve in three wins',current)
        shooter=1 if number==2 else 0;page=(first,second)[shooter]
        visited.add(current['stageId'])
        for point in routes[number]:room_move(page,point,shooter)
        current=room_state(first);target=current['fighters'][1-shooter]
        native_room_aim(page,target['x'],target['y']);page.locator('#arena').focus()
        canvas_export(first,'#arena','shinobi-'+current['stageId']+'-native-duel-canvas');captured.add(current['stageId'])
        last_attack=0
        while time.monotonic()<deadline:
            current=room_state(first)
            if current['phase']!='fight' or current['round']!=number:break
            actor=current['fighters'][shooter];target=current['fighters'][1-shooter]
            native_room_aim(page,target['x'],target['y'])
            if actor['action'] in ('idle','run') and actor['stamina']>=26 and time.monotonic()-last_attack>.65:
                page.keyboard.press('k',delay=25);last_attack=time.monotonic()
            first.wait_for_timeout(20)
    room_phase(first,'matchEnd',timeout=2000);room_phase(second,'matchEnd')
    result=room_state(first)
    assert result['winner']==0 and [f['wins'] for f in result['fighters']]==[2,1]
    assert visited=={'rooftop','garden','shrine'} and captured==visited, (visited,captured)
    wait(second,'window.firesideRoom.getState().fighters[0].wins===2&&window.firesideRoom.getState().fighters[1].wins===1')
    screenshot(first,'shinobi-showdown-native-match-end')
    first.locator('#ready-button').click();first.wait_for_timeout(200)
    assert room_state(first)['phase']=='lobby', 'One player started a rematch without peer agreement'
    second.locator('#ready-button').click();room_phase(first,'fight');room_phase(second,'fight')
    return {'stages':sorted(visited),'winner':0,'round_wins':[2,1],'both_agree_rematch':True}


def solo_move(page,keyboard,x,y,timeout=14):
    page.locator('.shadow-canvas').focus();deadline=time.monotonic()+timeout
    while time.monotonic()<deadline:
        current=state(page);assert current['phase']=='playing', ('Native stealth route ended early',current)
        actor=current['player'];dx,dy=x-actor['x'],y-actor['y']
        if abs(dx)<3 and abs(dy)<3:
            keyboard.release();page.wait_for_timeout(40);return state(page)
        # One-axis moves keep the authored route clear of exact rounded cover.
        if abs(dx)>=3: keys={'Shift','ArrowRight' if dx>0 else 'ArrowLeft'}
        else: keys={'Shift','ArrowDown' if dy>0 else 'ArrowUp'}
        keyboard.set(keys);page.wait_for_timeout(20)
    keyboard.release();raise AssertionError(('Native stealth waypoint unreachable',(x,y),state(page)))


def native_solo_aim(page,x,y):
    canvas=page.locator('.shadow-canvas');box=canvas.bounding_box()
    dimensions=canvas.evaluate('canvas=>({width:canvas.width,height:canvas.height})');actor=state(page)['player']
    cx=max(0,min(960-dimensions['width'],actor['x']-dimensions['width']/2))
    cy=max(0,min(640-dimensions['height'],actor['y']-dimensions['height']*.55))
    page.mouse.move(box['x']+(x-cx)/dimensions['width']*box['width'],box['y']+(y-cy)/dimensions['height']*box['height'])


def active_help(page):
    before=state(page);page.locator('#solo-how-to summary').focus();page.keyboard.press('Space')
    assert page.locator('#solo-how-to').evaluate('details=>details.open'), 'Active Help did not open with Space'
    assert state(page)['smoke']==before['smoke'] and state(page)['kunai']==before['kunai'], 'Help activation spent a ninja tool'
    page.keyboard.press('Enter');assert not page.locator('#solo-how-to').evaluate('details=>details.open')


def shadow_play(page,context,keyboard,profile):
    canvas=page.locator('.shadow-canvas');canvas.focus();initial=state(page)
    keyboard.set({'q'});page.wait_for_timeout(90);keyboard.release();assert state(page)['player']['x']<initial['player']['x']-4
    keyboard.set({'z'});page.wait_for_timeout(90);keyboard.release();assert state(page)['player']['y']<initial['player']['y']-4
    assert state(page)['kunai']==initial['kunai'], 'French movement fired a distraction'
    active_help(page);canvas.focus();tools_before=state(page)
    if profile=='mobile':
        before,held,released=trusted_touch(page,context,'[data-control="right"]',130,cancel=True)
        assert held['player']['x']>before['player']['x']+8 and not released['player']['moving'], 'Native touch steering stayed held'
        page.locator('[data-control="sneak"]').tap()
        assert page.locator('[data-control="sneak"]').get_attribute('aria-pressed')=='true'
        trusted_touch(page,context,'[data-control="smoke"]',120)
        trusted_touch(page,context,'[data-control="kunai"]',120)
    else:
        native_solo_aim(page,100,100);canvas.focus();page.keyboard.press('Space',delay=25);page.keyboard.press('a',delay=25)
    tools=state(page);assert tools['smoke']==tools_before['smoke']-1 and tools['kunai']==tools_before['kunai']-1
    assert tools['clouds'] and any(event['type']=='throw' for event in tools['events'])
    canvas_export(page,'.shadow-canvas',f'shadow-lantern-{profile}-native-smoke-canvas')
    # Tool effects are exercised in a real warm-up. A fresh heist then follows
    # a repeatable quiet patrol route without changing the live state.
    page.locator('#solo-restart').click()
    wait(page,'window.firesideSolo.getState().level===0&&window.firesideSolo.getState().player.hp===3')
    if profile=='mobile': page.locator('[data-control="sneak"]').tap()
    solo_move(page,keyboard,325,535);solo_move(page,keyboard,325,452);canvas.focus()
    keyboard.set({'Shift','e'})
    wait(page,'window.firesideSolo.getState().guards[0].mode==="down"',timeout=15000,polling=20)
    keyboard.release();taken=state(page)
    assert any(event['type']=='takedown' for event in taken['events']) and taken['player']['hp']>0
    canvas_export(page,'.shadow-canvas',f'shadow-lantern-{profile}-native-takedown-canvas')
    waypoint_evidence=[]

    def go(x,y):
        current=solo_move(page,keyboard,x,y)
        waypoint_evidence.append({'x':current['player']['x'],'y':current['player']['y'],'alarm':current['alarm'],'hp':current['player']['hp'],'elapsed':current['elapsed']})

    def interact(kind,index=0):
        keyboard.release()
        if profile=='mobile': trusted_touch(page,context,'[data-control="interact"]',1350)
        else:
            canvas.focus();keyboard.set({'Shift','e'});page.wait_for_timeout(1350);keyboard.release()
        current=state(page)
        if kind=='seal': assert current['scrolls'][index], ('Native scroll channel failed',current)
        elif kind=='cache': assert current['caches'][index], ('Native tool cache failed',current)
        elif kind=='exit': assert current['phase']=='mission-clear' and current['cleared']==1

    go(100,452);go(100,155);go(430,155);interact('seal',0)
    canvas_export(page,'.shadow-canvas',f'shadow-lantern-{profile}-native-seal-canvas')
    go(430,325);go(740,325);go(795,375);interact('seal',1)
    canvas_export(page,'.shadow-canvas',f'shadow-lantern-{profile}-patrol-cones-canvas')
    go(795,535);go(585,535);go(585,505);interact('cache')
    go(585,535);go(100,535);interact('exit')
    fixed=state(page);frames=page.evaluate('window.__ninjaQA.frames');page.wait_for_timeout(250)
    assert state(page)==fixed and page.evaluate('window.__ninjaQA.frames')==frames
    assert not page.evaluate('window.__ninjaQA.pending'), 'Cleared mission runs RAF before Continue'
    assert page.locator('.shadow-continue').is_visible()
    screenshot(page,f'shadow-lantern-{profile}-mission-clear-page')
    carried={key:fixed[key] for key in ('smoke','kunai','alarm','score')};carried['hp']=fixed['player']['hp']
    if profile=='mobile': page.locator('.shadow-continue').tap()
    else: page.locator('.shadow-continue').click()
    wait(page,'window.firesideSolo.getState().phase==="playing"&&window.firesideSolo.getState().level===1')
    next_state=state(page)
    assert next_state['cleared']==1 and next_state['smoke']==carried['smoke'] and next_state['kunai']==carried['kunai']
    assert next_state['alarm']==carried['alarm'] and next_state['player']['hp']==carried['hp']
    canvas_export(page,'.shadow-canvas',f'shadow-lantern-{profile}-second-fortress-canvas')
    return {'first_mission_cleared':True,'native_rear_takedown':True,'native_tools':True,'native_touch':profile=='mobile','carried':carried,'route':waypoint_evidence,'first_clear':fixed,'next_state':next_state}

def shinobi_touch(page,context):
    for target in page.locator('[data-shinobi-action],[data-shinobi-pad]').all():
        box=target.bounding_box();assert box and box['width']>=44 and box['height']>=44
    before,held,released=trusted_touch(page,context,'[data-shinobi-pad="move"]',130,offset=(.3,0),room=True,cancel=True)
    assert held['fighters'][0]['x']>before['fighters'][0]['x']+15
    assert not released['fighters'][0]['previousInput']['right'], 'Touch cancellation left movement held'
    before,held,released=trusted_touch(page,context,'[data-shinobi-pad="aim"]',100,offset=(.3,-.2),room=True)
    actor=held['fighters'][0];assert actor['aimY']<-.2 and math.isclose(math.hypot(actor['aimX'],actor['aimY']),1,abs_tol=.001)
    evidence={'native_move':held['fighters'][0]['x'],'native_aim':[actor['aimX'],actor['aimY']]}
    for action in ('attack','heavy','throw','parry','dash'):
        wait_idle(page)
        previous=room_state(page);event_id=previous['eventId']
        before,held,released=trusted_touch(page,context,f'[data-shinobi-action="{action}"]',100,room=True,cancel=action=='dash')
        expected='attack' if action in ('attack','heavy') else 'parryStart' if action=='parry' else action
        assert any(event['id']>event_id and event['type']==expected for event in released['events']), ('Touch action did not reach server',action,released)
        assert not released['fighters'][0]['previousInput'][action], ('Touch action stayed held',action)
        evidence[action]={'action':held['fighters'][0]['action'],'stamina':held['fighters'][0]['stamina']}
    screenshot(page,'shinobi-showdown-mobile-native-controls')
    page.set_viewport_size({'width':320,'height':900});no_overflow(page,'shinobi/mobile320')
    screenshot(page,'shinobi-showdown-320-native-controls');page.set_viewport_size({'width':390,'height':1000})
    return evidence


def room_form_check(page):
    page.locator('#arena').focus();wait_idle(page);page.wait_for_timeout(180)
    before=room_state(page)['fighters'][0]
    # Player names are deliberately locked during a match. A temporary neutral
    # editable field tests the document keyboard guard without changing game
    # state or disabling the product's name lock.
    page.evaluate('''()=>{const input=document.createElement('input');input.id='ninja-room-form-qa';
        input.setAttribute('aria-label','QA text input');document.querySelector('.party-panel').append(input)}''')
    field=page.locator('#ninja-room-form-qa');field.fill('');field.press('j');field.press('k');field.press('l');field.press('i');field.press('Space');field.press('q')
    assert field.input_value()=='jkli q'
    current=room_state(page)['fighters'][0]
    assert current['kunai']==before['kunai'] and current['action'] in ('idle','run'), 'Name input triggered a combat action'
    assert abs(current['x']-before['x'])<.05 and abs(current['y']-before['y'])<.05
    field.evaluate('input=>input.remove()')
    details=page.locator('#controls-panel details');details.locator('summary').focus();page.keyboard.press('Space')
    assert details.evaluate('details=>details.open')
    assert room_state(page)['fighters'][0]['action'] in ('idle','run'), 'Help activation caused a dash'
    page.keyboard.press('Enter');assert not details.evaluate('details=>details.open')


def shinobi_disconnect(browser,url,first,second,context,errors,resources,code):
    second.close();room_phase(first,'lobby')
    reset=room_state(first)
    assert all(actor['hp']==100 and actor['wins']==0 for actor in reset['fighters'])
    replacement=context.new_page();watch(replacement,'shinobi-rejoin',errors,resources)
    replacement.goto(url+'/play.html?game=shinobi-showdown&room='+code)
    wait(replacement,'window.firesideRoom?.connected&&window.firesideRoom.playerId===1')
    assert room_state(replacement)['phase']=='lobby'
    first.locator('#ready-button').click();first.wait_for_timeout(120)
    assert room_state(first)['phase']=='lobby'
    replacement.locator('#ready-button').click();room_phase(first,'fight');room_phase(replacement,'fight')
    return {'disconnect_resets_match':True,'rejoin_retains_open_seat':True,'both_ready_required_again':True}


def solo_case(browser,url,profile,errors,resources):
    width,dpr=(1440,1) if profile=='desktop' else (390,2)
    context=browser.new_context(viewport={'width':width,'height':1100 if profile=='desktop' else 1000},device_scale_factor=dpr,has_touch=profile=='mobile')
    seeds={f'fireside-solo-best:shadow-lantern:shadow-v1-{tier}':1200+100*index for index,tier in enumerate(('standard','veteran','nightmare'))}
    seeds['fireside-solo-best:ember-delve:default']=9876
    context.add_init_script("localStorage.setItem('semag-keyboard-layout','zqsd');for(const[key,value]of Object.entries("+json.dumps(seeds)+"))localStorage.setItem(key,JSON.stringify(value));("+INSTRUMENT+")();")
    page=context.new_page();modules=[];keyboard=Keyboard(page);tag='shadow-lantern/'+profile
    watch(page,tag,errors,resources)
    page.on('request',lambda request:modules.append(request.url) if '/solo/' in request.url and request.url.endswith(('-view.js','-engine.js')) else None)
    mutations=[];sockets=[]
    page.on('request',lambda request:mutations.append(request.url) if '/api/rooms' in request.url and request.method!='GET' else None)
    page.on('websocket',lambda socket:sockets.append(socket.url))
    try:
        page.goto(url+'/solo.html?game=shadow-lantern');original_records=records(page)
        ready_gate(page,'shadow-lantern',modules,original_records,tag)
        page.locator('#solo-start').click();wait(page,'window.firesideSolo.getState()!==null')
        assert state(page)['difficulty']=='veteran' and state(page)['recordKey']=='shadow-v1-veteran'
        assert page.locator('select[data-keyboard-layout]').input_value()=='zqsd'
        assert page.locator('#solo-record').inner_text().replace(',','')=='1300'
        evidence=shadow_play(page,context,keyboard,profile)
        paused=pause_check(page,'shadow-lantern',keyboard)
        page.locator('#solo-pause').click();wait(page,'window.firesideSolo.getState().phase==="paused"')
        no_overflow(page,tag);paint=painted(page,'.shadow-canvas')
        screenshot(page,'shadow-lantern-'+profile+'-active-page')
        if profile=='mobile':
            for button in page.locator('[data-control]').all():
                box=button.bounding_box();assert box['width']>=44 and box['height']>=44
            page.set_viewport_size({'width':320,'height':1000});no_overflow(page,tag+'/320');screenshot(page,'shadow-lantern-320-active-page')
            page.set_viewport_size({'width':390,'height':1000})
        perf=performance_result(page,tag);policy=isolated_record_policy(page,'shadow-lantern','shadow-v1-veteran')
        assert records(page)==original_records and not page.evaluate('window.__ninjaQA.recordWrites')
        page.locator('#solo-restart').click();fresh=state(page)
        assert fresh['difficulty']=='veteran' and fresh['phase']=='playing' and fresh['level']==0 and fresh['cleared']==0
        assert fresh['player']['hp']==3 and fresh['smoke']==2 and fresh['kunai']==4
        for index,tier in ((2,'nightmare'),(0,'standard'),(1,'veteran')):
            picker=page.locator('.shadow-tier-select');picker.click();page.keyboard.press('Home')
            for _ in range(index): page.keyboard.press('ArrowDown')
            page.keyboard.press('Enter');assert state(page)['difficulty']==tier
            assert page.locator('#solo-record').inner_text().replace(',','')==str(1200+index*100)
        page.reload();wait(page,'window.firesideSolo?.getState()===null')
        assert page.locator('#solo-start').is_visible() and records(page)==original_records
        assert page.locator('select[data-keyboard-layout]').input_value()=='zqsd'
        assert not mutations and not sockets
        return {'game':'shadow-lantern','profile':profile,'dpr':dpr,'evidence':evidence,'paused':paused,'paint':paint,'performance':perf,'record_policy':policy,'records_preserved':True,'solo_room_mutations':mutations,'solo_sockets':sockets}
    except Exception:
        screenshot(page,'failure-shadow-'+profile);(OUT/('failure-shadow-'+profile+'.json')).write_text(json.dumps(state(page),indent=2)+'\n');raise
    finally:
        keyboard.release();context.close()


def multiplayer_case(browser,url,profile,errors,resources):
    contexts,pages,code=create_room(browser,url,errors,resources,profile);first,second=pages
    try:
        room_form_check(first)
        if profile=='desktop':
            evidence=shinobi_desktop(first,second);match=shinobi_match(first,second)
        else:
            evidence=shinobi_touch(first,contexts[0]);match={'desktop_full_match_tested_separately':True}
            no_overflow(first,'shinobi/mobile')
            canvas_export(first,'#arena','shinobi-showdown-mobile-native-canvas')
        perf=performance_result(first,'shinobi-showdown/'+profile)
        disconnect=shinobi_disconnect(browser,url,first,second,contexts[1],errors,resources,code)
        return {'game':'shinobi-showdown','profile':profile,'dpr':2 if profile=='mobile' else 1,'evidence':evidence,'match':match,'performance':perf,'disconnect':disconnect,'paint':painted(first,'#arena')}
    except Exception:
        screenshot(first,'failure-shinobi-'+profile);(OUT/('failure-shinobi-'+profile+'.json')).write_text(json.dumps(room_state(first),indent=2)+'\n');raise
    finally:
        for context in contexts: context.close()


def run(url):
    OUT.mkdir(parents=True,exist_ok=True);errors=[];resources=[];results=[]
    selected=set(os.environ.get('SEMAG_QA_GAMES','shadow-lantern,shinobi-showdown').split(','))
    profiles=os.environ.get('SEMAG_QA_PROFILES','desktop,mobile').split(',')
    with sync_playwright() as playwright:
        options={'headless':True,'args':['--no-sandbox','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding']}
        if Path('/usr/bin/chromium').exists():options['executable_path']='/usr/bin/chromium'
        browser=playwright.chromium.launch(**options)
        try:
            for profile in profiles:
                for game,check in (('shadow-lantern',solo_case),('shinobi-showdown',multiplayer_case)):
                    if game not in selected:continue
                    result=check(browser,url,profile,errors,resources);results.append(result)
                    (OUT/'report-partial.json').write_text(json.dumps({'games':results,'errors':errors,'failed_resources':resources},indent=2)+'\n')
                    print('PASS '+game+'/'+profile+': native play, assets, controls, collision and session flow; draw p95 '+str(result['performance']['cpu_ms']['p95']),flush=True)
            hub=None if os.environ.get('SEMAG_QA_SKIP_HUB')=='1' else hub_check(browser,url,errors,resources)
            assert not errors and not resources, (errors,resources)
            report={'games':results,'hub':hub,'errors':errors,'failed_resources':resources,'screenshots':str(OUT)}
            (OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n')
            print(json.dumps(report),flush=True)
        finally:
            browser.close()


def main():
    if len(sys.argv)>1:run(sys.argv[1].rstrip('/'));return
    source="import{createServer}from'./server.js';const server=createServer();const address=await server.listen(0,'127.0.0.1');console.log(JSON.stringify({port:address.port}));process.on('SIGTERM',async()=>{await server.close();process.exit(0)});"
    host=subprocess.Popen(['node','--input-type=module','--eval',source],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    try:
        line=host.stdout.readline()
        if not line:raise RuntimeError(host.stderr.read())
        run('http://127.0.0.1:'+str(json.loads(line)['port']))
    finally:
        host.terminate()
        try:host.wait(timeout=5)
        except subprocess.TimeoutExpired:host.kill();host.wait(timeout=5)


if __name__=='__main__':main()
