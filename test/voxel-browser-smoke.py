"""Native browser QA for Voxel Breach.

python test/voxel-browser-smoke.py [http://127.0.0.1:3100]
Creates real rooms through Semag and drives clients using trusted Chromium
keyboard, mouse, and touch input. Live state is only observed, never changed.
SEMAG_SCREENSHOT_DIR selects artifacts. Software WebGL timings are gross
regression samples, not a hardware frame-rate benchmark.
SEMAG_VOXEL_POLISH=1 retains the full changed 1v1 feedback sequence while
checking 2v2/3v3 team gates, a brief native movement/shot, and refreshed maps
with passive peers lifecycle-frozen after their synchronized Ready gate.
SEMAG_PHYSICS_QA=1 checks native crate jumping/landing and body pressure, plus
copied live-state collision invariants, and skips unchanged objective rounds.
SEMAG_ARSENAL_QA=1 adds six native weapon/ADS/reload probes and separate
finite utility rounds, preserving the original objective and lifecycle case.
"""
import json
import html
import math
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', '/workspace/scratch/semag-voxel-browser'))
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3100').rstrip('/')
ERRORS, RESOURCES, REPORT = [], [], {'cases': [], 'hub': {}, 'errors': [], 'failed_resources': [], 'screenshots': []}
ARSENAL = os.environ.get('SEMAG_ARSENAL_QA') == '1'
LOADOUTS = ['carbine', 'smg', 'marksman', 'pistol', 'shotgun', 'burst']
INSTRUMENT = r"""() => {
  const stats = window.__voxelQA = {frames:0,cpu:[],gaps:[],drawCalls:[],glCalls:0,lastInput:null,
    messages:[],sent:[],inputTimes:[],welcome:null,latestState:null,glContexts:0,glResources:{}};
  for(const cls of [window.WebGLRenderingContext, window.WebGL2RenderingContext].filter(Boolean)){
    for(const [kind,create,remove] of [['buffers','createBuffer','deleteBuffer'],['programs','createProgram','deleteProgram'],['shaders','createShader','deleteShader'],['textures','createTexture','deleteTexture']]){
      const live=new Set(),make=cls.prototype[create],drop=cls.prototype[remove];
      stats.glResources[kind] ||= {created:0,deleted:0,live:0,peak:0};const count=stats.glResources[kind];
      if(make)cls.prototype[create]=function(...args){const value=make.apply(this,args);if(value){live.add(value);count.created++;count.live++;count.peak=Math.max(count.peak,count.live)}return value};
      if(drop)cls.prototype[remove]=function(value){if(live.delete(value)){count.deleted++;count.live--}return drop.call(this,value)};
    }
    for(const method of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
      const original=cls.prototype[method];if(!original)continue;
      cls.prototype[method]=function(...args){stats.glCalls++;return original.apply(this,args)};
    }
  }
  const getContext=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){
    const result=getContext.call(this,type,...args);if(result && /^webgl/.test(type))stats.glContexts++;return result;
  };
  const NativeWS=window.WebSocket;
  window.WebSocket=class extends NativeWS{
    constructor(...args){super(...args);this.addEventListener('message',event=>{
      let message;try{message=JSON.parse(event.data)}catch{return}
      if(message.type==='welcome')stats.welcome=message;
      if(message.type==='state')stats.latestState=message;
      stats.messages.push(message);if(stats.messages.length>120)stats.messages.shift();
    })}
    send(data){let message;try{message=JSON.parse(data)}catch{};
      if(message?.type==='input'){stats.lastInput=message;stats.inputTimes.push(performance.now());if(stats.inputTimes.length>1600)stats.inputTimes.shift()}
      else if(message){stats.sent.push(message);if(stats.sent.length>120)stats.sent.shift()}
      return super.send(data);
    }
  };
  const request=window.requestAnimationFrame;let previous=null;
  window.requestAnimationFrame=callback=>{
    const game=/voxel-(?:client|view|renderer)\.js/.test(new Error().stack);
    return request.call(window,time=>{
      if(!game){callback(time);return}
      const start=performance.now(),draws=stats.glCalls;callback(time);stats.frames++;
      if(stats.frames>10){stats.cpu.push(performance.now()-start);stats.drawCalls.push(stats.glCalls-draws);if(previous!==null)stats.gaps.push(time-previous)}
      previous=time;
      for(const name of ['cpu','gaps','drawCalls'])if(stats[name].length>1200)stats[name].shift();
    });
  };
}"""


def wait(page, expression, **kwargs):
    kwargs.setdefault('polling', 50)
    kwargs.setdefault('timeout', 15000)
    return page.wait_for_function(expression, **kwargs)


def observe(page, tag):
    page.on('pageerror', lambda error: ERRORS.append(f'{tag}: {error}'))
    page.on('console', lambda msg: ERRORS.append(f'{tag}: {msg.text}') if msg.type == 'error' else None)
    page.on('response', lambda response: RESOURCES.append(f'{tag}: {response.status} {response.url}') if response.status >= 400 else None)


def state(page):
    return page.evaluate('window.__voxelQA.latestState?.state')


def envelope(page):
    return page.evaluate('window.__voxelQA.latestState')


def welcome(page):
    return page.evaluate('window.__voxelQA.welcome')


def connected(page):
    wait(page, 'window.__voxelQA.welcome && window.__voxelQA.latestState')
    return welcome(page)['playerId']


def phase(page, expected, **kwargs):
    wait(page, 'phase => window.__voxelQA.latestState?.state.phase === phase', arg=expected, **kwargs)


def actor(page, ident=None):
    current=state(page)
    if ident is None: ident=welcome(page)['playerId']
    return current['players'][ident]


def no_overflow(page, tag):
    sizes=page.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})')
    assert sizes['scroll'] <= sizes['width'], (tag, 'Horizontal overflow', sizes)


def screenshot(page, name, viewport=False):
    path=OUT/(name+'.png')
    if viewport:
        page.locator('#viewport' if viewport=='hud' else '#arena').screenshot(path=str(path))
    else:
        page.screenshot(path=str(path), full_page=True)
    REPORT['screenshots'].append(str(path))
    return str(path)


def distribution(values):
    values=sorted(values)
    return {'count':len(values),'p50':values[len(values)//2] if values else None,
        'p95':values[min(len(values)-1,int(len(values)*.95))] if values else None,
        'max':max(values) if values else None}


def native_layout(page, value):
    if page.evaluate('Boolean(window.SemagVoxel?.getState().controls.pointerLocked)'):
        page.keyboard.press('Escape')
        wait(page,'!window.SemagVoxel.getState().controls.pointerLocked')
    picker=page.locator('select[data-keyboard-layout]')
    assert picker.count()==1
    picker.click();page.keyboard.press('Home')
    if value=='zqsd':page.keyboard.press('ArrowDown')
    page.keyboard.press('Enter')
    assert picker.input_value()==value


def cdp_key(page, key, code, kind='keyDown', repeat=False, session=None):
    own_session=session is None
    if own_session:session=page.context.new_cdp_session(page)
    try:
        payload={'type':kind,'key':key,'code':code,'windowsVirtualKeyCode':ord(key.upper()) if len(key)==1 else 0}
        if kind=='keyDown':
            payload['autoRepeat']=repeat
            if len(key)==1:payload.update(text=key,unmodifiedText=key)
        session.send('Input.dispatchKeyEvent',payload)
    finally:
        if own_session:session.detach()


class Keyboard:
    def __init__(self,page):self.page,self.held=page,set()
    def set(self,desired):
        desired=set(desired)
        for key in sorted(self.held-desired):self.page.keyboard.up(key)
        for key in sorted(desired-self.held):self.page.keyboard.down(key)
        self.held=desired
    def release(self):self.set(set())


def trusted_touch(page, context, selector, duration=180, offset=(0,0), cancel=False):
    """Trusted browser touch dispatcher, including native cancellation."""
    target=page.locator(selector);target.scroll_into_view_if_needed();box=target.bounding_box();assert box
    point={'x':box['x']+box['width']/2,'y':box['y']+box['height']/2,'id':7}
    session=context.new_cdp_session(page);active=False
    try:
        session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point]});active=True
        if offset!=(0,0):
            point={**point,'x':point['x']+offset[0]*box['width'],'y':point['y']+offset[1]*box['height']}
            session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[point]})
        page.wait_for_timeout(duration);held=actor(page)
        session.send('Input.dispatchTouchEvent',{'type':'touchCancel' if cancel else 'touchEnd','touchPoints':[]});active=False
        page.wait_for_timeout(180)
        return held,actor(page)
    finally:
        if active:session.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]})
        session.detach()


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    host=None
    if len(sys.argv)<=1:
        env={**os.environ,'PORT':'3100'}
        host=subprocess.Popen(['npm','start'],cwd=ROOT,env=env,stdout=(OUT/'server.log').open('w'),stderr=subprocess.STDOUT)
        import urllib.request
        for _ in range(100):
            try:
                with urllib.request.urlopen(URL+'/health',timeout=.2) as response:
                    if response.status==200:break
            except Exception:time.sleep(.1)
        else:raise RuntimeError('Isolated host did not start')
    try:
        with sync_playwright() as playwright:
            browser=playwright.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=[
                '--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
            try:
                run(browser)
            finally:browser.close()
    finally:
        REPORT['errors']=ERRORS;REPORT['failed_resources']=RESOURCES
        (OUT/'report.json').write_text(json.dumps(REPORT,indent=2))
        if host:
            host.terminate()
            try:host.wait(timeout=5)
            except subprocess.TimeoutExpired:host.kill()
    assert not ERRORS, ('Browser errors',ERRORS)
    assert not RESOURCES, ('Failed resources',RESOURCES)
    print(json.dumps({'status':'passed','cases':len(REPORT['cases']),'report':str(OUT/'report.json')},indent=2))


def new_context(browser, width=1280, mobile=False):
    context=browser.new_context(viewport={'width':width,'height':1000 if mobile else 960},
        device_scale_factor=2 if mobile else 1,has_touch=mobile)
    context.add_init_script('('+INSTRUMENT+')();')
    return context


def hub_checks(browser):
    context=new_context(browser)
    page=context.new_page();observe(page,'hub');posts=[]
    page.on('request',lambda request:posts.append(request.url) if '/api/rooms' in request.url and request.method=='POST' else None)
    try:
        page.goto(URL)
        wait(page,"document.querySelector('#host-status').textContent==='Host is online'")
        assert page.locator('[data-game-card]').count()==25
        assert page.locator('#nav-game-count').inner_text()=='25'
        for key,count in [('all',25),('solo',14),('friends',11),('action',12),('roguelike',4),('driving',3),('ninja',2),('voxel',1)]:
            target=page.locator(f'[data-filter="{key}"]')
            if not target.count() and key=='friends':target=page.locator('[data-filter="multiplayer"]')
            assert target.count()==1,(key,'Missing shelf filter')
            assert int(target.locator('span').inner_text())==count
        page.locator('[data-create-game="voxel-breach"]').click()
        assert page.locator('#voxel-setup').is_visible()
        page.locator('[data-cancel-voxel]').click();assert not posts
        page.locator('[data-create-game="voxel-breach"]').click();page.keyboard.press('Escape');assert not posts
        page.locator('[data-filter="voxel"]').click()
        assert page.locator('[data-game-card]:visible').count()==1
        wait(page,"Array.from(document.querySelectorAll('[data-game-card=voxel-breach] img')).every(image=>image.complete&&image.naturalWidth>0)")
        screenshot(page,'voxel-hub-desktop')
        for width in (390,320):
            page.set_viewport_size({'width':width,'height':900});no_overflow(page,f'hub/{width}')
            page.locator('[data-create-game="voxel-breach"]').click();no_overflow(page,f'hub/setup/{width}')
            screenshot(page,f'voxel-setup-{width}');page.keyboard.press('Escape')
        assert not posts
        page.set_viewport_size({'width':1280,'height':960})
        page.locator('#game-search').fill('voxel');assert page.locator('[data-game-card]:visible').count()==1
        return {'catalog':25,'solo':14,'friends':11,'action':12,'ninja':2,'voxel':1,
            'cancel_and_escape_create_no_room':True,'filter_and_search':True,'responsive_widths':[1280,390,320]}
    finally:context.close()


def create_room(page,size,map_id):
    page.goto(URL)
    wait(page,"document.querySelector('#host-status').textContent==='Host is online'")
    page.locator('[data-create-game="voxel-breach"]').click()
    page.locator(f'#voxel-setup [name=teamSize][value="{size}"]').check()
    picker=page.locator('#voxel-map');picker.click();page.keyboard.press('Home')
    for _ in range(('courtyard','depot','canal').index(map_id)):page.keyboard.press('ArrowDown')
    page.keyboard.press('Enter');assert picker.input_value()==map_id
    page.locator('#voxel-create').click();page.wait_for_url('**/voxel.html?room=*')
    assert connected(page)==0
    code=parse_qs(urlparse(page.url).query)['room'][0]
    hello=welcome(page)
    assert hello['capacity']==2*size and hello['teamSize']==size and hello['mapId']==map_id
    assert state(page)['phase']=='lobby'
    return code


def hub_capacity(observer,code,count,capacity):
    observer.goto(URL)
    row=observer.locator(f'[data-room-id="{code}"]')
    row.wait_for();text=row.locator('small')
    wait(observer,'([code,text])=>document.querySelector(`[data-room-id="${code}"] small`)?.textContent.includes(text)',arg=[code,f'{count}/{capacity} players'])
    assert f'{capacity//2}v{capacity//2}' in text.inner_text()
    button=row.locator('button')
    assert button.is_disabled()==(count==capacity)
    return {'text':text.inner_text(),'join_disabled':button.is_disabled()}


def ready_clients(pages, setup_probe=True):
    for page in pages[:-1]:page.locator('#ready-button').click()
    pages[0].wait_for_timeout(350)
    assert all(state(page)['phase']=='lobby' for page in pages),'Game started with missing Ready'
    assert sum(player['ready'] for player in envelope(pages[0])['players'])==len(pages)-1
    pages[-1].locator('#ready-button').click();phase(pages[0],'countdown')
    # Cancelling the first countdown resets the entire readiness agreement.
    pages[0].locator('#ready-button').click();phase(pages[0],'lobby')
    wait(pages[0],'window.__voxelQA.latestState.players.every(player=>!player.ready)')
    for page in pages:page.locator('#ready-button').click()
    phase(pages[0],'buy');phase(pages[-1],'buy')
    assert all(player['alive'] for player in state(pages[0])['players'])
    screenshot(pages[0],f'voxel-{len(pages)//2}v{len(pages)//2}-buy')
    if len(pages)==2 and setup_probe:
        # Setup controls are exercised inside the real eight-second phase;
        # movement/fire still cannot begin before the authoritative bell.
        first=pages[0];before=actor(first);touch_setup=first.viewport_size['width']<600
        if touch_setup:
            for width in ((390,320) if setup_probe=='layout' else (320,)):
                boxes=mobile_buy_layout(first,width)
                REPORT.setdefault('mobile_buy_layouts',[]).append({'width':width,**boxes})
            first.set_viewport_size({'width':390,'height':1000})
            if setup_probe=='layout':
                phase(pages[0],'fight',timeout=18000);phase(pages[-1],'fight')
                return
        setup_weapon=first.locator('[data-arena-loadout="carbine"]')
        if touch_setup:setup_weapon.tap()
        else:setup_weapon.click()
        wait(first,'window.__voxelQA.latestState.state.players[0].weapon==="carbine"')
        if touch_setup:
            first.locator('#enter-arena').tap()
            wait(first,'window.SemagVoxel.getState().controls.touch && !window.SemagVoxel.getState().controls.paused')
            first.locator('#arena').focus()
        else:enter_arena(first)
        digits=[('é','Digit2','smg'),('"','Digit3','marksman')]
        if ARSENAL:digits += [("'",'Digit4','pistol'),('(','Digit5','shotgun'),('-','Digit6','burst'),('&','Digit1','carbine'),('"','Digit3','marksman')]
        key_session=first.context.new_cdp_session(first)
        try:
            for key,code,weapon in digits:
                cdp_key(first,key,code,session=key_session);cdp_key(first,key,code,'keyUp',session=key_session)
                wait(first,'weapon=>window.__voxelQA.latestState.state.players[0].weapon===weapon',arg=weapon)
        finally:key_session.detach()
        first.keyboard.down('w');first.wait_for_timeout(80);first.keyboard.up('w')
        assert horizontal_distance(before,actor(first))<.001,'Setup phase movement unlocked early'
        assert first.locator('#loadout-select').input_value()=='marksman'
        print(json.dumps({'stage':'native_setup_loadouts_passed','button':'carbine','trusted_azerty_shortcuts':LOADOUTS[1:] if ARSENAL else ['smg','marksman']}),flush=True)
    phase(pages[0],'fight',timeout=18000);phase(pages[-1],'fight')


def mobile_buy_layout(page,width):
    page.set_viewport_size({'width':width,'height':1000});no_overflow(page,f'1v1/mobile/setup{width}')
    boxes=page.evaluate('''()=>{
        const rect=node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom}};
        const text=selector=>{const node=document.querySelector(selector);return{selector,width:node.clientWidth,scroll:node.scrollWidth}};
        return{phase:window.__voxelQA.latestState.state.phase,screenWidth:innerWidth,clip:rect(document.querySelector('#game-shell')),
            viewport:rect(document.querySelector('#viewport')),overlay:rect(document.querySelector('#game-overlay')),card:rect(document.querySelector('.overlay-card')),
            buttons:Array.from(document.querySelectorAll('[data-arena-loadout],#enter-arena')).map(rect),
            text:['.overlay-card','#overlay-title','#overlay-subtitle','#arena-loadouts'].map(text)};
    }''')
    assert boxes['phase']=='buy','Layout snapshot missed the real buy phase'
    outer=boxes['viewport']
    assert outer['x']>=boxes['clip']['x']-1 and outer['right']<=min(boxes['clip']['right'],boxes['screenWidth'])+1,('Viewport clipped by its game shell or screen',boxes)
    for item in [boxes['overlay'],boxes['card'],*boxes['buttons']]:
        assert item['x']>=outer['x']-1 and item['right']<=outer['right']+1 and item['y']>=outer['y']-1 and item['bottom']<=outer['bottom']+1,('Mobile setup control clipped',boxes)
    assert len(boxes['buttons'])==(7 if ARSENAL else 4)
    for item in boxes['text']:
        assert item['scroll']<=item['width']+1,('Mobile setup text overflow',boxes)
    screenshot(page,f'voxel-1v1-buy-{width}')
    return boxes


def team_consistency(pages,size,map_id):
    first=envelope(pages[0]);last=envelope(pages[-1])
    assert first['capacity']==2*size and first['teamSize']==size and first['mapId']==map_id
    assert len(first['players'])==2*size and len(first['state']['players'])==2*size
    expected=[0]*size+[1]*size
    assert [player['team'] for player in first['players']]==expected
    assert [player['team'] for player in first['state']['players']]==expected
    assert [player['team'] for player in last['players']]==expected
    assert first['state']['phase']==last['state']['phase']=='fight'
    privacy=[]
    for page in pages:
        ident=welcome(page)['playerId'];team=state(page)['players'][ident]['team']
        own_ids=[player['id'] for player in state(page)['players'] if player['team']==team and player['alive']]
        wait(page,'ids=>Array.from(document.querySelectorAll("#map-plan .map-player"))'
            '.filter(node=>node.getAttribute("display")!=="none").map(node=>Number(node.dataset.playerId))'
            '.sort((a,b)=>a-b).join(",")===ids.join(",")',arg=own_ids)
        assert page.locator('#map-plan .map-player').count()==6,'Map marker nodes grew with updates'
        assert page.locator(f'#map-plan .map-player.self[data-player-id="{ident}"]').count()==1
        assert page.locator('#map-plan .map-site-label').all_text_contents()==['A','B']
        privacy.append({'observer':ident,'visible_player_ids':own_ids,'opponents_hidden':True})
    return {'capacity':2*size,'metadata_teams':expected,'all_clients_joined':True,'synchronized_fight':True,
        'tactical_map_privacy':privacy,'bounded_reused_map_marker_nodes':6}


def enter_arena(page):
    target=page.locator('#enter-arena')
    if target.is_visible():target.click()
    wait(page,'window.SemagVoxel && !window.SemagVoxel.getState().controls.paused')
    page.locator('#arena').focus()
    return page.evaluate('window.SemagVoxel.getState().controls')


def gameplay_input(page,action,desired):
    wait(page,'([action,value])=>window.SemagVoxel.getState().input[action]===value',arg=[action,desired],timeout=4000)


def horizontal_distance(a,b):return math.hypot(a['x']-b['x'],a['z']-b['z'])


def start_physics_monitor(page):
    if os.environ.get('SEMAG_PHYSICS_QA')!='1':return
    page.evaluate('''async()=>{
        const {MAPS,playerHeight}=await import('/voxel-engine.js');
        const stats=window.__voxelQA.physics={samples:0,boundaryChecks:0,coverChecks:0,bodyChecks:0,supportChecks:0,violations:[]};
        const check=(condition,kind,detail)=>{if(!condition&&stats.violations.length<12)stats.violations.push({kind,...detail})};
        stats.timer=setInterval(()=>{
            const state=window.__voxelQA.latestState?.state;if(!state||state.phase!=='fight')return;
            stats.samples++;const arena=MAPS[state.mapId],bodies=state.players.filter(body=>body.alive);
            for(const body of bodies){
                const height=playerHeight(body),r=body.radius;stats.boundaryChecks++;
                check(['x','y','z','vx','vy','vz'].every(key=>Number.isFinite(body[key]))&&body.x>=arena.bounds.minX+r-.0001&&body.x<=arena.bounds.maxX-r+.0001&&body.z>=arena.bounds.minZ+r-.0001&&body.z<=arena.bounds.maxZ-r+.0001&&body.y>=-.0001,
                    'boundary',{tick:state.tick,id:body.id,x:body.x,y:body.y,z:body.z});
                let supported=body.y<=.0001;
                for(const box of arena.colliders){
                    const gap=Math.hypot(body.x-Math.max(box.x,Math.min(box.x+box.w,body.x)),body.z-Math.max(box.z,Math.min(box.z+box.d,body.z)));
                    const overlaps=body.y<box.y+box.h-.0001&&body.y+height>box.y+.0001;
                    stats.coverChecks++;check(!overlaps||gap>=r-.0001,'cover',{tick:state.tick,id:body.id,y:body.y,gap,radius:r,box:box.id});
                    if(Math.abs(body.y-box.y-box.h)<.0001&&gap<=r+.0001)supported=true;
                }
                stats.supportChecks++;check(!body.grounded||supported,'support',{tick:state.tick,id:body.id,x:body.x,y:body.y,z:body.z});
            }
            for(let a=0;a<bodies.length;a++)for(let b=a+1;b<bodies.length;b++){
                const first=bodies[a],second=bodies[b],overlaps=first.y<second.y+playerHeight(second)-.0001&&second.y<first.y+playerHeight(first)-.0001;
                const gap=Math.hypot(first.x-second.x,first.z-second.z);stats.bodyChecks++;
                check(!overlaps||gap>=first.radius+second.radius-.0001,'body',{tick:state.tick,ids:[first.id,second.id],gap});
            }
        },50);
    }''')


def physics_result(page):
    if os.environ.get('SEMAG_PHYSICS_QA')!='1':return None
    result=page.evaluate('''()=>{const stats=window.__voxelQA.physics;clearInterval(stats.timer);const {timer,...result}=stats;return result}''')
    assert result['samples']>=20 and not result['violations'], ('Observed native physics violation',result)
    return result


def native_controls(page, profile):
    evidence={'entered':enter_arena(page),'layouts':[]}
    for chosen,left,forward in [('wasd','a','w'),('zqsd','q','z')]:
        native_layout(page,chosen);page.locator('#arena').focus();enter_arena(page)
        before=actor(page);page.keyboard.down(left);gameplay_input(page,'left',True);page.wait_for_timeout(220)
        page.keyboard.up(left);gameplay_input(page,'left',False);page.wait_for_timeout(160)
        moved=actor(page);assert horizontal_distance(before,moved)>.4,(profile,chosen,'Left movement missing',before,moved)
        page.keyboard.down('d');page.wait_for_timeout(220);page.keyboard.up('d');page.wait_for_timeout(160)
        before=actor(page);page.keyboard.down(forward);gameplay_input(page,'up',True);page.wait_for_timeout(180)
        page.keyboard.up(forward);gameplay_input(page,'up',False);page.wait_for_timeout(160)
        assert horizontal_distance(before,actor(page))>.3,(profile,chosen,'Forward movement missing')
        page.keyboard.down('s');page.wait_for_timeout(180);page.keyboard.up('s');page.wait_for_timeout(160)
        evidence['layouts'].append(chosen)
    native_layout(page,'zqsd');enter_arena(page)
    cdp_key(page,'q','KeyA');gameplay_input(page,'left',True);page.wait_for_timeout(100)
    cdp_key(page,'q','KeyA','keyUp');gameplay_input(page,'left',False)
    cdp_key(page,'z','KeyW');gameplay_input(page,'up',True);page.wait_for_timeout(100)
    cdp_key(page,'z','KeyW','keyUp');gameplay_input(page,'up',False)
    evidence['trusted_french_key_code']=True
    for key,action in [('Control','crouch'),('Shift','walk'),('Space','jump')]:
        enter_arena(page);page.keyboard.down(key);gameplay_input(page,action,True);page.wait_for_timeout(100)
        held=actor(page);page.keyboard.up(key);gameplay_input(page,action,False)
        if action=='crouch':assert held['crouching'],('Crouch did not reach server',held)
        if action=='jump':assert held['y']>0,('Native jump did not leave floor',held)
        evidence[action]=True
    page.wait_for_timeout(600)
    enter_arena(page);page.keyboard.down('d');gameplay_input(page,'right',True)
    native_layout(page,'wasd');gameplay_input(page,'right',False);page.keyboard.up('d')
    evidence['layout_change_releases']=True
    return evidence


def native_team_polish_controls(page):
    """A short real input probe; the complete keyboard suite remains 1v1."""
    entered=enter_arena(page)
    before=actor(page);page.keyboard.down('d');gameplay_input(page,'right',True)
    page.wait_for_timeout(180);page.keyboard.up('d');gameplay_input(page,'right',False)
    page.wait_for_timeout(120)
    assert horizontal_distance(before,actor(page))>.25,'Team mode native movement failed'
    shot=native_shot(page)
    assert shot['playerId']==welcome(page)['playerId']
    return {'entered':entered,'native_movement':True,'native_weapon_firing':True,
        'full_keyboard_and_neutral_control_suite':'Fresh 1v1 desktop/mobile cases'}


def neutral_forms_and_help(page):
    enter_arena(page);page.keyboard.down('d');gameplay_input(page,'right',True)
    page.keyboard.press('Escape');gameplay_input(page,'right',False);page.keyboard.up('d')
    wait(page,'!window.SemagVoxel.getState().controls.pointerLocked')
    page.wait_for_timeout(220);before=actor(page)
    page.evaluate("""()=>{const input=document.createElement('input');input.id='voxel-form-qa';
      input.setAttribute('aria-label','QA text input');document.body.append(input);input.focus()}""")
    field=page.locator('#voxel-form-qa');field.press('w');field.press('q');field.press('r');field.press('e');field.press('Space');field.press('2')
    if ARSENAL:
        for key in ['v','g','h']:field.press(key)
    assert field.input_value()==('wqre 2vgh' if ARSENAL else 'wqre 2')
    current=actor(page)
    assert current['ammo']==before['ammo'] and current['weapon']==before['weapon'] and horizontal_distance(before,current)<.01,'Editable input caused movement/action'
    if ARSENAL:assert all(current[key]==before[key] for key in ['slot','grenades','potions','healTicks']),'Editable input consumed a supply or changed slot'
    field.evaluate('input=>input.remove()')
    page.locator('#guide-button').click();assert page.locator('#guide-dialog').is_visible()
    assert page.evaluate('window.SemagVoxel.getState().controls.paused')
    assert not any(page.evaluate('window.SemagVoxel.getState().input').get(key,False) for key in ['up','down','left','right','fire','reload','interact','jump','walk','crouch']+(['aim','swap','grenade','heal'] if ARSENAL else []))
    page.keyboard.press('w');page.keyboard.press('r')
    assert actor(page)['ammo']==current['ammo'] and horizontal_distance(current,actor(page))<.01
    page.keyboard.press('Space');assert not page.locator('#guide-dialog').is_visible()
    assert actor(page)['y']==0 and horizontal_distance(current,actor(page))<.01,'Help button activation leaked a jump'
    page.locator('#guide-button').click();page.locator('#close-guide').click();assert not page.locator('#guide-dialog').is_visible()
    enter_arena(page)
    return {'escape_releases_pointer_and_held_inputs':True,'forms_neutral':True,'guide_neutral':True}


LOOK_CALIBRATION={}


def angle_delta(target,current):return (target-current+math.pi)%(2*math.pi)-math.pi


def look_input(page):return page.evaluate('window.SemagVoxel.getState().input')


def native_look_delta(page,dx,dy):
    box=page.locator('#arena').bounding_box();assert box
    controls=page.evaluate('window.SemagVoxel.getState().controls')
    x,y=box['x']+box['width']/2,box['y']+box['height']/2
    # Moving back to the centre is native too; read the actual input after it
    # when calibrating. Locked mouse motion remains relative outside bounds.
    page.mouse.move(x,y)
    baseline=look_input(page)
    if not controls['pointerLocked']:page.mouse.down(button='right')
    page.mouse.move(x+dx,y+dy,steps=2)
    if not controls['pointerLocked']:page.mouse.up(button='right')
    return baseline,look_input(page)


def native_aim(page,yaw,pitch=0):
    enter_arena(page)
    # A native calibration pulse measures the product's chosen sensitivity.
    # No mouse handler, input state, or engine value is replaced or injected.
    key=id(page)
    if key not in LOOK_CALIBRATION:
        before,after=native_look_delta(page,40,30)
        sx=angle_delta(after['yaw'],before['yaw'])/40
        sy=(after['pitch']-before['pitch'])/30
        assert abs(sx)>.0001 and abs(sy)>.0001,('Native mouse look did not respond',before,after)
        LOOK_CALIBRATION[key]=(sx,sy)
    sx,sy=LOOK_CALIBRATION[key]
    box=page.locator('#arena').bounding_box();x,y=box['x']+box['width']/2,box['y']+box['height']/2
    page.mouse.move(x,y)
    for _ in range(14):
        current=look_input(page)
        dyaw=angle_delta(yaw,current['yaw']);dpitch=pitch-current['pitch']
        if abs(dyaw)<.001 and abs(dpitch)<.001:break
        dx=max(-box['width']*.35,min(box['width']*.35,dyaw/sx))
        dy=max(-box['height']*.35,min(box['height']*.35,dpitch/sy))
        locked=page.evaluate('window.SemagVoxel.getState().controls.pointerLocked')
        if not locked:
            x,y=box['x']+box['width']/2,box['y']+box['height']/2
            page.mouse.move(x,y);page.mouse.down(button='right')
        page.mouse.move(x+dx,y+dy,steps=3);x+=dx;y+=dy
        if not locked:page.mouse.up(button='right')
        current=look_input(page)
        if abs(angle_delta(yaw,current['yaw']))<.001 and abs(pitch-current['pitch'])<.001:break
    current=look_input(page)
    assert abs(angle_delta(yaw,current['yaw']))<.006 and abs(pitch-current['pitch'])<.006,('Native aim missed target',yaw,pitch,current)
    page.wait_for_timeout(100)
    return {'yaw':current['yaw'],'pitch':current['pitch'],'mouse_sensitivity':[sx,sy]}


def native_move(page,x,z,timeout=30000):
    enter_arena(page);key='z' if page.locator('select[data-keyboard-layout]').input_value()=='zqsd' else 'w'
    deadline=time.monotonic()+timeout/1000
    for attempt in range(4):
        current=actor(page);dx=x-current['x'];dz=z-current['z'];distance=math.hypot(dx,dz)
        if distance<.5:return current
        assert state(page)['phase']=='fight' and current['alive'],('Route interrupted',state(page)['phase'],current)
        native_aim(page,math.atan2(dx,-dz),0)
        # A straight held input lets the authoritative simulation progress
        # normally. Browser-side polling observes the waypoint without paying
        # a Python/CDP/mouse round trip for every few centimetres.
        ux,uz=dx/distance,dz/distance
        page.keyboard.down(key)
        try:
            wait(page,"""([id,x,z,ux,uz])=>{
                const state=window.__voxelQA.latestState.state,actor=state.players[id];
                return state.phase!=='fight'||!actor.alive||(x-actor.x)*ux+(z-actor.z)*uz<.25;
            }""",arg=[welcome(page)['playerId'],x,z,ux,uz],polling=20,
                timeout=max(1500,min(int((deadline-time.monotonic())*1000),int((distance/4.85+5)*1000))))
        finally:page.keyboard.up(key)
        page.wait_for_timeout(150)
        if time.monotonic()>deadline:break
    current=actor(page)
    assert math.hypot(x-current['x'],z-current['z'])<.65,('Native route missed waypoint',x,z,current)
    return current


def native_shot(page,duration=45):
    enter_arena(page);before=actor(page);event_id=state(page)['eventId']
    page.mouse.down(button='left');page.wait_for_timeout(duration);page.mouse.up(button='left')
    wait(page,'([id,event])=>window.__voxelQA.latestState.state.events.some(item=>item.id>event&&item.type==="shot"&&item.playerId===id)',arg=[welcome(page)['playerId'],event_id])
    page.wait_for_timeout(120);after=actor(page)
    assert after['ammo']<before['ammo'],'Native LMB did not consume a shot'
    return next(event for event in reversed(state(page)['events']) if event['id']>event_id and event['type']=='shot' and event['playerId']==welcome(page)['playerId'])


def native_wall_and_reload(page):
    native_move(page,-4,18);native_aim(page,0,0)
    enemy_hp=actor(page,1)['hp'];shot=native_shot(page)
    assert shot['hitKind']=='wall' and shot['colliderId'].startswith('central-'),('Expected drawn central cover',shot)
    assert actor(page,1)['hp']==enemy_hp,'Shot crossed solid cover'
    before=actor(page);page.keyboard.press('r',delay=40)
    wait(page,'window.__voxelQA.latestState.state.players[0].reloadTicks>0')
    page.locator('#reload-track').wait_for(state='visible')
    assert 'RELOADING' in page.locator('#weapon-status').inner_text()
    progress=int(page.locator('#reload-track').get_attribute('aria-valuenow'))
    assert 0<=progress<100
    screenshot(page,'voxel-native-reload-feedback-canvas',viewport=True)
    wait(page,'window.__voxelQA.latestState.state.players[0].reloadTicks===0',timeout=6000)
    after=actor(page)
    assert after['ammo']>before['ammo'] and after['reserve']<before['reserve'],'Native reload did not transfer finite reserve'
    native_move(page,-4,6.5);native_aim(page,0)
    key='z' if page.locator('select[data-keyboard-layout]').input_value()=='zqsd' else 'w'
    page.keyboard.down(key);page.wait_for_timeout(550);page.keyboard.up(key);page.wait_for_timeout(180)
    body=actor(page);assert abs(body['z']-6.32)<.035,('Body did not stop at central wall plus radius',body)
    screenshot(page,'voxel-native-cover-contact-canvas',viewport=True)
    contact_shot=native_shot(page)
    assert contact_shot['hitKind']=='wall','Point-blank cover shot crossed the wall'
    page.keyboard.press('r',delay=35)
    wait(page,'window.__voxelQA.latestState.state.players[0].reloadTicks>0')
    screenshot(page,'voxel-native-cover-reload-canvas',viewport=True)
    wait(page,'window.__voxelQA.latestState.state.players[0].reloadTicks===0',timeout=6000)
    assert page.evaluate('window.SemagVoxel.getState().graphicsError')=='','Reload at cover broke graphics'
    native_move(page,-4,18)
    return {'blocked_shot':shot,'reload_finite_reserve':True,'native_reload_progress':True,
        'native_cover_reload_art':True,'wall_body_z':body['z'],'wall_front_z':6,'body_radius':.32}


def native_crate_physics(page):
    for x,z in [(-20,18),(-20,-9.2),(-16.95,-9.2)]:native_move(page,x,z)
    native_aim(page,math.pi/2,0);enter_arena(page)
    key='z' if page.locator('select[data-keyboard-layout]').input_value()=='zqsd' else 'w'
    page.keyboard.down(key);page.keyboard.down('Space')
    try:
        wait(page,'window.__voxelQA.latestState.state.players[0].y>.8',timeout=3000)
        wait(page,'(()=>{const p=window.__voxelQA.latestState.state.players[0];return p.y===1&&p.grounded})()',timeout=3000)
    finally:page.keyboard.up('Space');page.keyboard.up(key)
    page.wait_for_timeout(130);landed=actor(page)
    assert landed['y']==1 and landed['grounded'], ('Native jump failed to land on low cover',landed)
    screenshot(page,'voxel-native-crate-landing-canvas',viewport=True)
    native_aim(page,-math.pi/2,0);page.keyboard.down(key)
    try:
        wait(page,'(()=>{const p=window.__voxelQA.latestState.state.players[0];return p.y<.9&&!p.grounded})()',timeout=3000,polling=20)
        falling=actor(page)
        wait(page,'window.__voxelQA.latestState.state.players[0].y===0',timeout=3000)
    finally:page.keyboard.up(key)
    page.wait_for_timeout(150);floor=actor(page)
    assert floor['grounded'] and floor['y']==0
    print(json.dumps({'stage':'native_crate_jump_landing_walkoff_passed','landed_y':landed['y'],'falling_grounded':falling['grounded']}),flush=True)
    return {'native_landed':landed,'native_falling':falling,'native_floor':floor}


def native_body_pressure(first,second):
    # Clear east lane, reached using actual input through both teams' routes.
    for x,z in [(-20,-9.2),(-20,8),(20,8)]:native_move(first,x,z)
    native_move(first,20,12)
    for x,z in [(20,-18),(20,8)]:native_move(second,x,z)
    native_aim(first,0,0);enter_arena(first)
    key='z' if first.locator('select[data-keyboard-layout]').input_value()=='zqsd' else 'w'
    stationary=actor(second);first.keyboard.down(key)
    try:
        wait(first,'(()=>{const [a,b]=window.__voxelQA.latestState.state.players;return Math.hypot(a.x-b.x,a.z-b.z)<.65})()',timeout=5000)
        first.wait_for_timeout(450);pressed=actor(first);blocked=actor(second)
        predicted=first.evaluate('window.SemagVoxel.getState().predictedPlayer')
    finally:first.keyboard.up(key)
    assert horizontal_distance(stationary,blocked)<.001, ('Movement pushed an idle opponent',stationary,blocked)
    assert horizontal_distance(pressed,blocked)>=.6399, ('Native player bodies overlapped',pressed,blocked)
    assert horizontal_distance(predicted,blocked)>=.639, ('Local prediction crossed an observed live body',predicted,blocked)
    native_aim(first,-math.pi/2,0);first.keyboard.down(key);first.wait_for_timeout(300);first.keyboard.up(key)
    first.wait_for_timeout(100);escaped=actor(first)
    assert escaped['x']<pressed['x']-.7, ('Body pressure prevented tangent escape',pressed,escaped)
    screenshot(first,'voxel-native-body-pressure-canvas',viewport=True)
    print(json.dumps({'stage':'native_idle_body_block_and_escape_passed','idle_drift':horizontal_distance(stationary,blocked)}),flush=True)
    return {'stationary_before':stationary,'stationary_after':blocked,'native_contact':pressed,'predicted_contact':predicted,'native_escape':escaped}


def native_team_body_pressure(page):
    """A real active client approaches its connected, idle spawn teammate."""
    stationary=actor(page,1);current=actor(page)
    native_aim(page,math.atan2(stationary['x']-current['x'],-(stationary['z']-current['z'])),0);enter_arena(page)
    key='z' if page.locator('select[data-keyboard-layout]').input_value()=='zqsd' else 'w'
    page.keyboard.down(key)
    try:
        wait(page,'(()=>{const [a,b]=window.__voxelQA.latestState.state.players;return Math.hypot(a.x-b.x,a.z-b.z)<.65})()',timeout=4000)
        page.wait_for_timeout(350);contact=actor(page);blocked=actor(page,1)
        predicted=page.evaluate('window.SemagVoxel.getState().predictedPlayer')
    finally:page.keyboard.up(key)
    assert horizontal_distance(stationary,blocked)<.001 and horizontal_distance(contact,blocked)>=.6399, ('Team body pressure moved or overlapped idle teammate',stationary,contact,blocked)
    assert horizontal_distance(predicted,blocked)>=.639, ('Team client predicted through its teammate',predicted,blocked)
    native_aim(page,0,0);page.keyboard.down(key);page.wait_for_timeout(300);page.keyboard.up(key)
    page.wait_for_timeout(100);escaped=actor(page)
    assert escaped['z']<contact['z']-.7, ('Team body contact prevented tangent escape',contact,escaped)
    return {'idle_teammate_before':stationary,'idle_teammate_after':blocked,'authoritative_contact':contact,'predicted_contact':predicted,'native_tangent_escape':escaped}


def native_objective_round(first,second):
    route=[]
    for x,z in [(-20,18),(-20,-12),(-13,-12)]:
        current=native_move(first,x,z);route.append({'x':current['x'],'z':current['z']})
    first.keyboard.down('e');gameplay_input(first,'interact',True)
    first.locator('#interaction-track').wait_for(state='visible',timeout=3000)
    assert first.locator('#interaction-track').get_attribute('aria-label')=='Planting device'
    assert 'PLANTING' in first.locator('#objective-label').inner_text()
    wait(first,'window.__voxelQA.latestState.state.bomb.status==="planted"',timeout=7000)
    first.keyboard.up('e');gameplay_input(first,'interact',False)
    print(json.dumps({'stage':'native_plant_passed'}),flush=True)
    planted=state(first)['bomb'];assert planted['siteId']=='A' and planted['timerTicks']>0
    wait(first,'document.querySelector("#round-label").textContent.includes("DEVICE PLANTED")')
    clock=int(first.locator('#timer').inner_text())
    assert 0<clock<=35 and abs(clock-math.ceil(state(first)['bomb']['timerTicks']/120))<=1,('Planted HUD clock is stale',clock,state(first)['bomb'])
    assert clock!=math.ceil(state(first)['roundTicks']/120),'Planted HUD still displays the preplant round clock'
    screenshot(first,'voxel-native-planted-site-canvas',viewport=True)
    for x,z in [(-13,-18),(-13,-12)]:native_move(second,x,z)
    second.keyboard.down('e');gameplay_input(second,'interact',True)
    second.locator('#interaction-track').wait_for(state='visible',timeout=3000)
    assert second.locator('#interaction-track').get_attribute('aria-label')=='Defusing device'
    wait(first,'window.__voxelQA.latestState.state.roundReason==="defuse"',timeout=9000)
    second.keyboard.up('e');gameplay_input(second,'interact',False)
    result=state(first);assert result['scores']==[0,1] and result['bomb']['status']=='defused'
    assert any(event['type']=='plant' for event in result['events']) and any(event['type']=='defuse' for event in result['events'])
    wait(first,'document.querySelector("#phase-title").textContent==="Round lost."')
    wait(second,'document.querySelector("#phase-title").textContent==="Round secured."')
    assert 'Device defused.' in first.locator('#phase-detail').inner_text()
    assert first.locator('#phase-announcement').get_attribute('data-outcome')=='lost'
    assert second.locator('#phase-announcement').get_attribute('data-outcome')=='won'
    screenshot(first,'voxel-native-defused-round')
    print(json.dumps({'stage':'native_defuse_passed'}),flush=True)
    return {'actual_plant_and_defuse':True,'attacker_route':route,'planted':planted,'score':result['scores'],
        'native_channel_progress':True,'planted_clock_uses_charge_seconds':clock,'perspective_aware_defuse_result':True}


def native_elimination_round(first,second):
    phase(first,'fight',timeout=20000)
    opponent=actor(first,1)
    current=actor(first);native_move(first,-20,current['z']);native_move(first,-20,opponent['z']);native_move(first,-5,opponent['z'])
    opponent=actor(first,1);current=actor(first)
    native_aim(first,math.atan2(opponent['x']-current['x'],-(opponent['z']-current['z'])),0)
    first.wait_for_timeout(500)
    screenshot(first,f'voxel-native-firing-angle-round-{state(first)["round"]}-canvas',viewport=True)
    assert first.locator('#crosshair').is_visible()
    opening=native_shot(first)
    wait(first,'window.__voxelQA.latestState.state.players[1].hp===84',timeout=3000)
    assert opening['targetId']==1 and opening['hitKind']=='head' and opening['damage']==116,('Precise stationary marksman opening shot did not hit',opening)
    assert actor(first,1)['alive'], 'A single marksman headshot eliminated a full-health player'
    wait(first,'window.__voxelQA.latestState.state.players[0].shotCooldown===0',timeout=3000)
    opponent=actor(first,1);current=actor(first)
    native_aim(first,math.atan2(opponent['x']-current['x'],-(opponent['z']-current['z'])),0)
    shot=native_shot(first)
    wait(first,'!window.__voxelQA.latestState.state.players[1].alive',timeout=3000)
    wait(second,'!window.__voxelQA.latestState.state.players[1].alive')
    result=state(first)
    assert shot['targetId']==1 and shot['hitKind']=='head' and shot['damage']==116,('Precise stationary marksman follow-up did not hit',shot)
    assert result['players'][0]['kills']>0 and result['players'][1]['deaths']>0
    wait(first,'document.querySelector("#kill-feed").textContent.includes("[HS]")',timeout=2000)
    assert 'HEADSHOT' in first.locator('#combat-feedback').inner_text()
    assert first.locator('#hit-marker').get_attribute('data-kind')=='elimination'
    wait(first,'document.querySelector("#phase-title").textContent==="Round secured."')
    wait(second,'document.querySelector("#phase-title").textContent==="Round lost."')
    assert 'Opposing squad eliminated.' in first.locator('#phase-detail').inner_text()
    if result['phase']!='matchEnd':second.locator('#spectator-hud').wait_for(state='visible',timeout=2500)
    screenshot(second,f'voxel-native-eliminated-round-{result["round"]}')
    print(json.dumps({'stage':'native_elimination_passed','round':result['round'],'scores':result['scores']}),flush=True)
    return {'round':result['round'],'opening_headshot_survived':opening,'shot':shot,'scores':result['scores'],'dead_peer_spectates':True,
        'native_headshot_feedback_and_kill_feed':True,'perspective_aware_elimination_result':True}


def native_objective_and_elimination(pages):
    first,second=pages
    objective=native_objective_round(first,second)
    elimination=native_elimination_round(first,second)
    assert state(first)['scores']==[1,1] and state(second)['scores']==[1,1]
    return {'native_objective':objective,'native_elimination':elimination,
        'two_native_rounds_score':[1,1]}


def native_disconnect_rejoin(pages,contexts):
    first,second=pages
    second.close();phase(first,'lobby')
    reset=state(first);assert reset['scores']==[0,0] and all(player['hp']==200 for player in reset['players'])
    wait(first,'window.__voxelQA.latestState.players.every(player=>!player||!player.ready)')
    replacement=contexts[1].new_page();observe(replacement,'1v1/rejoin');replacement.goto(first.url)
    assert connected(replacement)==1 and state(replacement)['phase']=='lobby'
    pages[1]=replacement
    first.locator('#ready-button').click();first.wait_for_timeout(200);assert state(first)['phase']=='lobby'
    replacement.locator('#ready-button').click();phase(first,'countdown')
    return {'disconnect_resets_match':True,'open_seat_rejoined':True,'all_ready_required_again':True}


def context_recovery(page):
    # Deliberate graphics fault injection, separate from normal native play.
    # The live room state, health, positions, and inputs are never replaced.
    before=envelope(page);ident=welcome(page)['playerId']
    available=page.locator('#arena').evaluate("canvas=>Boolean(canvas.getContext('webgl').getExtension('WEBGL_lose_context'))")
    if not available:return {'status':'skipped','reason':'WEBGL_lose_context unavailable'}
    page.locator('#arena').evaluate("canvas=>{canvas.__voxelRecoveryExtension=canvas.getContext('webgl').getExtension('WEBGL_lose_context');canvas.__voxelRecoveryExtension.loseContext()}")
    wait(page,'Boolean(window.SemagVoxel.getState().graphicsError)')
    assert page.evaluate('window.SemagVoxel.getState().controls.paused')
    assert page.evaluate('window.SemagVoxel.getState().connected')
    assert not any(look_input(page).get(key,False) for key in ['up','down','left','right','fire','reload','interact']+(['aim','swap','grenade','heal'] if ARSENAL else []))
    page.wait_for_timeout(150)
    page.locator('#arena').evaluate("canvas=>canvas.__voxelRecoveryExtension.restoreContext()")
    wait(page,'!window.SemagVoxel.getState().graphicsError')
    assert page.evaluate('window.SemagVoxel.getState().controls.paused')
    assert welcome(page)['playerId']==ident and state(page)['scores']==before['state']['scores']
    screenshot(page,'voxel-restored-graphics-canvas',viewport=True)
    return {'status':'passed','lost_context_releases_controls':True,'restored_without_disconnect_or_room_reset':True,'controls_remain_released':True}


def native_touch(page,context):
    phase(page,'fight',timeout=22000)
    if page.locator('#enter-arena').is_visible():page.locator('#enter-arena').tap()
    enter_arena(page)
    page.locator('#touch-controls').wait_for(state='visible',timeout=6000)
    assert page.evaluate('window.SemagVoxel.getState().controls.touch'),'Native touch entry not detected'
    for target in page.locator('[data-voxel-pad],[data-voxel-action]').all():
        box=target.bounding_box();assert box and box['width']>=44 and box['height']>=44,('Small touch target',box)
    before=actor(page);held,released=trusted_touch(page,context,'[data-voxel-pad="move"]',180,offset=(.27,-.2),cancel=True)
    assert horizontal_distance(before,held)>.3,'Native touch movement failed'
    assert not any(look_input(page)[key] for key in ['up','down','left','right']),'Touch cancellation stuck movement'
    before=look_input(page);trusted_touch(page,context,'[data-voxel-pad="look"]',150,offset=(.25,-.1))
    after=look_input(page);assert abs(angle_delta(after['yaw'],before['yaw']))>.05,'Native touch look failed'
    actions=['crouch','walk','jump','fire','reload','interact']+(['aim','swap','grenade','heal'] if ARSENAL else [])
    for action in actions:
        if ARSENAL and action=='aim':
            wait(page,'window.__voxelQA.latestState.state.players[0].reloadTicks===0',timeout=6000)
        held,released=trusted_touch(page,context,f'[data-voxel-action="{action}"]',150,cancel=action in ['fire','crouch'])
        assert held['previousInput'][action],('Touch action did not reach the server',action,held)
        assert not look_input(page)[action],('Cancelled touch action stayed held',action)
        if ARSENAL and action=='aim':assert held['aiming'] and held['aimTicks']>0,'Touch AIM did not reach authoritative ADS'
        if ARSENAL and action=='swap':
            assert held['slot']=='sword','Touch sword swap failed'
            trusted_touch(page,context,'[data-voxel-action="swap"]',100)
            wait(page,'window.__voxelQA.latestState.state.players[0].slot==="primary"')
        if ARSENAL and action=='grenade':assert released['grenades']==0,'Touch FRAG failed to consume its single charge'
    return {'native_move_and_look':True,'all_six_actions':True,'native_actions':actions,'native_cancellation_releases':True,'minimum_target_pixels':44,'high_frequency_pacing':native_touch_pacing(page,context)}


def native_touch_pacing(page,context):
    page.locator('[data-voxel-pad="move"]').scroll_into_view_if_needed()
    boxes=[page.locator(f'[data-voxel-pad="{name}"]').bounding_box() for name in ['move','look']]
    assert all(boxes)
    points=[{'x':box['x']+box['width']/2,'y':box['y']+box['height']/2,'id':7+index} for index,box in enumerate(boxes)]
    session=context.new_cdp_session(page);active=False
    start=page.evaluate('performance.now()')
    try:
        session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[points[0]]});active=True
        session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':points})
        for index in range(140):
            moved=[{**point,'x':point['x']+boxes[which]['width']*(.24+.015*(index%4)),
                'y':point['y']-boxes[which]['height']*.16} for which,point in enumerate(points)]
            session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':moved})
        session.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]});active=False
        page.wait_for_timeout(180)
    finally:
        if active:session.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]})
        session.detach()
    times=page.evaluate('start=>window.__voxelQA.inputTimes.filter(time=>time>=start)',start)
    peak=max((sum(other>=stamp and other<stamp+1000 for other in times) for stamp in times),default=0)
    assert peak<=220,('Touch input packets exceeded the nominal safe rate',peak)
    assert page.evaluate('window.SemagVoxel.getState().connected'),'Native touch burst disconnected the room'
    assert not any(look_input(page)[key] for key in ['up','down','left','right']),'Two-pad cancellation stuck movement'
    assert not any(message['type']=='error' and 'Too many' in message.get('message','') for message in page.evaluate('window.__voxelQA.messages'))
    return {'trusted_two_pad_move_events':140,'peak_packets_in_observed_one_second_window':peak,
        'server_rate_limit_per_second':300,'connected_after_burst':True,'native_cancel_released_both_pads':True}


def native_select_loadout(page,weapon):
    """A real select and keyboard choice; no synthetic change or socket call."""
    picker=page.locator('#loadout-select');picker.click();page.keyboard.press('Home')
    for _ in range(LOADOUTS.index(weapon)):page.keyboard.press('ArrowDown')
    page.keyboard.press('Enter')
    wait(page,'weapon=>window.__voxelQA.latestState.state.players[0].weapon===weapon',arg=weapon)
    assert picker.input_value()==weapon


def native_ads(page,name=None):
    entered=enter_arena(page);before=look_input(page)
    if not entered['pointerLocked']:
        box=page.locator('#arena').bounding_box();page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
    page.mouse.down(button='right')
    try:
        gameplay_input(page,'aim',True)
        wait(page,'(()=>{const p=window.__voxelQA.latestState.state.players[0];return p.aiming&&p.aimTicks===18})()')
        aimed=actor(page)
        if aimed['weapon']=='marksman':page.locator('#scope-reticle').wait_for(state='visible')
        if name:screenshot(page,name+'-ads-canvas',viewport='hud')
    finally:page.mouse.up(button='right')
    gameplay_input(page,'aim',False)
    wait(page,'(()=>{const p=window.__voxelQA.latestState.state.players[0];return !p.aiming&&p.aimTicks===0})()')
    assert not look_input(page)['fire'],'ADS release triggered an unintended shot'
    return {'native_rmb_hold':True,'native_rmb_release':True,'authoritative_aim_ticks':aimed['aimTicks'],
        'pointer_locked':entered['pointerLocked'],'fallback':entered['fallback'],'scope_visible':aimed['weapon']=='marksman'}


def wait_event(page,kind,after=0,player_id=0,timeout=6000):
    wait(page,'([kind,after,id])=>window.__voxelQA.latestState.state.events.some(e=>e.type===kind&&e.id>after&&e.playerId===id)',
        arg=[kind,after,player_id],timeout=timeout)
    return next(event for event in reversed(state(page)['events']) if event['type']==kind and event['id']>after and event.get('playerId')==player_id)


def native_frag(page,name=None):
    enter_arena(page);before=actor(page);event_id=state(page)['eventId']
    page.keyboard.press('g',delay=40)
    thrown=wait_event(page,'grenadeThrow',event_id)
    assert actor(page)['grenades']==before['grenades']-1,'Native grenade did not consume one charge'
    wait(page,'window.__voxelQA.latestState.state.grenades.length>0')
    flying=state(page)['grenades'][0]
    assert all(math.isfinite(flying[key]) for key in ['x','y','z','vx','vy','vz','fuseTicks'])
    if name:screenshot(page,name+'-throw-canvas',viewport='hud')
    bounced=wait_event(page,'grenadeBounce',event_id)
    exploded=wait_event(page,'grenadeExplosion',event_id)
    wait(page,'window.__voxelQA.latestState.state.grenades.length===0')
    assert exploded['tick']-thrown['tick']==288,('Native frag fuse drifted',thrown,exploded)
    after=actor(page)
    page.keyboard.press('g',delay=40);page.wait_for_timeout(180)
    assert not state(page)['grenades'] and actor(page)['grenades']==0,'Empty grenade inventory allowed another throw'
    return {'throw':thrown,'bounce':bounced,'explosion':exploded,'before_hp':before['hp'],'after_hp':after['hp'],
        'native_input':'G','single_charge':True,'exact_288_tick_fuse':True,'bounded_finite_trajectory':True}


def native_friendly_grenade(page):
    teammate=actor(page,1);current=actor(page)
    native_aim(page,math.atan2(teammate['x']-current['x'],-(teammate['z']-current['z'])),-1.2)
    evidence=native_frag(page,f'voxel-{state(page)["teamSize"]}v{state(page)["teamSize"]}-frag')
    teammate_after=actor(page,1);blast=evidence['explosion']
    distance=math.hypot(teammate_after['x']-blast['x'],teammate_after['z']-blast['z'])
    assert distance<5.5 and teammate_after['hp']==teammate['hp']==200,('Friendly frag fixture was not nearby and immune',distance,teammate,teammate_after,blast)
    assert evidence['after_hp']<evidence['before_hp'] and actor(page)['alive'],'Thrower self-risk was not observed safely'
    evidence.update(teammate_within_blast_radius=distance,teammate_hp_unchanged=True,thrower_self_damage=True)
    return evidence


def arsenal_room(browser,weapon='marksman',peer_weapon='pistol'):
    contexts=[new_context(browser,960),new_context(browser,640)]
    pages=[context.new_page() for context in contexts]
    for index,page in enumerate(pages):observe(page,f'arsenal/{weapon}/P{index+1}')
    create_room(pages[0],1,'courtyard');native_select_loadout(pages[0],weapon)
    pages[1].goto(pages[0].url);connected(pages[1])
    # Select helper observes local slot zero, so the peer uses its real picker directly.
    picker=pages[1].locator('#loadout-select');picker.click();pages[1].keyboard.press('Home')
    for _ in range(LOADOUTS.index(peer_weapon)):pages[1].keyboard.press('ArrowDown')
    pages[1].keyboard.press('Enter')
    wait(pages[1],'weapon=>window.__voxelQA.latestState.state.players[1].weapon===weapon',arg=peer_weapon)
    ready_clients(pages,setup_probe=False)
    return contexts,pages


def native_arsenal_weapon_case(browser,weapon):
    contexts=[];passive=None
    try:
        contexts,pages=arsenal_room(browser,weapon);first,second=pages
        passive=second.context.new_cdp_session(second);passive.send('Page.setWebLifecycleState',{'state':'frozen'})
        native_aim(first,-.06,0);first.wait_for_timeout(160)
        screenshot(first,f'voxel-weapon-{weapon}-hip-canvas',viewport='hud')
        ads=native_ads(first,f'voxel-weapon-{weapon}')
        # Reacquire the lower cover face after sights release. Sustained recoil
        # may rise, but a legitimate high shot must never be called tunnelling.
        native_aim(first,-.06,-.12)
        first.wait_for_timeout(160);before=actor(first)
        shot=native_shot(first,600)
        first.wait_for_timeout(260);after=actor(first);used=before['ammo']-after['ammo']
        if weapon in ['pistol','shotgun']:assert used==1,('Single-trigger weapon fired repeatedly while held',weapon,used)
        if weapon=='burst':assert used==3,('Burst did not fire exactly three rounds for one held press',used)
        if weapon=='shotgun':
            pellets=[e for e in state(first)['events'] if e['type']=='shot' and e['playerId']==0 and e['tick']==shot['tick']]
            assert shot['pelletCount']==8 and len(pellets)==8 and sorted(e['pellet'] for e in pellets)==list(range(8)),('Shotgun did not report eight real pellet rays',shot,pellets)
        assert shot['hitKind']=='wall' and actor(first,1)['hp']==200,('Native gun shot crossed cover',weapon,shot)
        assert first.locator('#weapon-label').inner_text()==weapon.upper()
        first.keyboard.press('r',delay=40)
        wait(first,'window.__voxelQA.latestState.state.players[0].reloadTicks>0')
        screenshot(first,f'voxel-weapon-{weapon}-reload-canvas',viewport='hud')
        wait(first,'window.__voxelQA.latestState.state.players[0].reloadTicks===0',timeout=6000)
        reloaded=actor(first)
        assert reloaded['ammo']>after['ammo'] and reloaded['reserve']<after['reserve']
        evidence={'weapon':weapon,'status':'passed','native_ads':ads,'native_held_trigger_rounds':used,
            'native_cover_shot':shot,'finite_reload':True,'performance':performance_snapshot(first,1)}
        print(json.dumps({'stage':'native_arsenal_weapon_passed','weapon':weapon,'held_trigger_rounds':used}),flush=True)
        return evidence
    except Exception:
        if contexts:
            try:
                (OUT/f'failure-arsenal-{weapon}.json').write_text(json.dumps(first.evaluate('window.SemagVoxel.getState()'),indent=2))
                screenshot(first,f'failure-arsenal-{weapon}')
            except Exception:pass
        raise
    finally:
        if passive:
            try:passive.send('Page.setWebLifecycleState',{'state':'active'});passive.detach()
            except Exception:pass
        for context in contexts:context.close()


def sword_swing(page,name=None):
    enter_arena(page);event_id=state(page)['eventId']
    page.mouse.down(button='left')
    try:
        started=wait_event(page,'meleeStart',event_id)
        wait(page,'(()=>{const s=window.__voxelQA.latestState.state;return s.players[0].meleePhase==="active"||s.phase!=="fight"})()',timeout=3000,polling=10)
        if name:screenshot(page,name+'-active-canvas',viewport='hud')
        page.wait_for_timeout(650)
    finally:page.mouse.up(button='left')
    assert len([e for e in state(page)['events'] if e['type']=='meleeStart' and e['id']>event_id and e['playerId']==0])==1,'Holding attack restarted the sword'
    wait(page,'window.__voxelQA.latestState.state.players[0].meleeTicks===0')
    return started


def press_into_column(page,yaw):
    native_aim(page,yaw,0);enter_arena(page)
    key='z' if page.locator('select[data-keyboard-layout]').input_value()=='zqsd' else 'w'
    page.keyboard.down(key);page.wait_for_timeout(750);page.keyboard.up(key);page.wait_for_timeout(120)
    return actor(page)


def native_arsenal_utilities_case(browser):
    contexts=[]
    try:
        contexts,pages=arsenal_room(browser);first,second=pages
        enter_arena(first);first.keyboard.press('h',delay=40);first.wait_for_timeout(180)
        assert actor(first)['hp']==200 and actor(first)['potions']==1 and not actor(first)['healTicks'],'Full-health potion was consumed'
        native_aim(first,0,-1.2);frag=native_frag(first,'voxel-native-frag')
        assert 0<frag['after_hp']<200,('Floor frag did not provide a safe native wound',frag)
        before=actor(first);event_id=state(first)['eventId'];first.keyboard.press('h',delay=40)
        wait_event(first,'healStart',event_id);wait(first,'window.__voxelQA.latestState.state.players[0].healTicks>0')
        wait(first,'document.querySelector("#weapon-label").textContent==="HEALING POTION"',timeout=1800)
        screenshot(first,'voxel-native-potion-channel-canvas',viewport='hud')
        healed=wait_event(first,'healComplete',event_id)
        assert healed['amount']==min(60,200-before['hp']) and actor(first)['potions']==0
        assert actor(first)['hp']==min(200,before['hp']+60),'Native potion restored an incorrect amount'
        print(json.dumps({'stage':'native_frag_and_potion_passed','hp_before':before['hp'],'hp_after':actor(first)['hp']}),flush=True)
        first.keyboard.press('h',delay=40);first.wait_for_timeout(180)
        assert not actor(first)['healTicks'] and actor(first)['potions']==0,'Empty potion inventory started another channel'
        first.keyboard.press('v',delay=40);wait(first,'window.__voxelQA.latestState.state.players[0].slot==="sword"')
        wait(first,'document.querySelector("#weapon-label").textContent==="SWORD"')
        # Opponents approach opposite faces of an actual 1.6m-wide column.
        for x,z in [(-20,18),(-20,-13.4),(-10.5,-13.4)]:native_move(first,x,z)
        for x,z in [(-6.3,-18),(-6.3,-13.4)]:native_move(second,x,z)
        left=press_into_column(first,math.pi/2);right=press_into_column(second,-math.pi/2)
        assert 2.2<horizontal_distance(left,right)<2.4,('Blocked-sword peers were outside the blade range',left,right)
        hp=actor(first,1)['hp'];blocked_start=sword_swing(first,'voxel-native-sword-cover')
        assert actor(first,1)['hp']==hp and not any(e['type']=='meleeHit' and e['id']>blocked_start['id'] for e in state(first)['events']),'Sword hit through the drawn column'
        print(json.dumps({'stage':'native_column_blocks_sword_passed'}),flush=True)
        for x,z in [(-7.28,-16.5)]:native_move(second,x,z)
        for x,z in [(-10.5,-16.5),(-8.9,-16.5)]:native_move(first,x,z)
        target=actor(first,1);own=actor(first)
        native_aim(first,math.atan2(target['x']-own['x'],-(target['z']-own['z'])),0)
        started=sword_swing(first,'voxel-native-sword-hit')
        hit=wait_event(first,'meleeHit',started['id'])
        assert hit['damage']==55 and hit['targetId']==1 and actor(first,1)['hp']==145,'Sword did not cause its one precise enemy hit'
        print(json.dumps({'stage':'native_sword_enemy_hit_passed','damage':hit['damage']}),flush=True)
        # The wounded defender consumes its own potion, then interrupts it by firing.
        own=actor(first);peer=actor(second);distance=horizontal_distance(own,peer)
        native_aim(second,math.atan2(own['x']-peer['x'],-(own['z']-peer['z'])),math.atan2(.9-1.62,distance))
        action_event=state(second)['eventId'];second.keyboard.press('h',delay=40)
        wait_event(second,'healStart',action_event,player_id=1)
        native_shot(second)
        action_cancel=wait_event(second,'healCancel',action_event,player_id=1)
        assert action_cancel['reason']=='action' and actor(second)['potions']==0 and actor(second)['hp']==145 and not actor(second)['healTicks'],'Firing did not interrupt the defender potion'
        first.wait_for_timeout(2100)
        assert actor(first,1)['hp']==145,'Action-interrupted potion completed later'
        print(json.dumps({'stage':'native_fire_interrupts_potion_passed'}),flush=True)
        finishing_hits=[]
        for expected_hp in (90,35,0):
            before_hp=actor(first,1)['hp']
            swing=sword_swing(first)
            confirmed=wait_event(first,'meleeHit',swing['id'])
            assert confirmed['targetId']==1 and confirmed['damage']==55, confirmed
            damage=wait_event(first,'damage',swing['id'])
            assert damage['targetId']==1 and damage['damage']==before_hp-expected_hp, ('Sword damage feedback failed to clamp overkill',damage,before_hp,expected_hp)
            assert actor(first,1)['hp']==expected_hp, ('Fresh sword hit restored or omitted damage',expected_hp,confirmed,actor(first,1))
            finishing_hits.append({'contact':confirmed,'confirmed_damage':damage})
        wait(first,'window.__voxelQA.latestState.state.roundReason==="elimination"')
        assert actor(first,1)['hp']==0 and not actor(first,1)['alive']
        phase(first,'buy',timeout=18000)
        reset=state(first)
        assert not reset['grenades'] and all(p['grenades']==1 and p['potions']==1 and p['slot']=='primary' and not p['healTicks'] and not p['meleeTicks'] and not p['aiming'] for p in reset['players']),'New round leaked arsenal state or omitted charges'
        print(json.dumps({'stage':'native_sword_elimination_and_round_reset_passed'}),flush=True)
        # The next fresh round supplies a real wounded player for damage cancellation.
        phase(first,'fight',timeout=18000)
        for x,z in [(-20,-18),(-20,18),(-8,18)]:native_move(second,x,z)
        own=actor(first);peer=actor(second);distance=horizontal_distance(own,peer)
        native_aim(second,math.atan2(own['x']-peer['x'],-(own['z']-peer['z'])),math.atan2(.9-1.62,distance))
        native_shot(second);wait(first,'window.__voxelQA.latestState.state.players[0].hp===166')
        event_id=state(first)['eventId'];enter_arena(first);first.keyboard.press('h',delay=40)
        wait_event(first,'healStart',event_id);screenshot(first,'voxel-native-potion-interrupted-canvas',viewport='hud')
        second.wait_for_timeout(240);native_shot(second)
        cancelled=wait_event(first,'healCancel',event_id)
        assert cancelled['reason']=='damage' and actor(first)['hp']==132 and actor(first)['potions']==0 and not actor(first)['healTicks'],'Damage did not interrupt finite healing'
        first.wait_for_timeout(2300)
        assert actor(first)['hp']==132 and not any(e['type']=='healComplete' and e['id']>event_id for e in state(first)['events']),'Interrupted potion completed later'
        evidence={'status':'passed','full_health_does_not_consume':True,'native_frag':frag,'native_heal':healed,
            'finite_inventory':True,'blocked_sword_start':blocked_start,'native_sword_hit':hit,
            'held_attack_does_not_repeat':True,'sword_elimination':True,'native_sword_finishing_hits':finishing_hits,'round_inventory_and_channels_reset':True,
            'native_fire_heal_cancellation':action_cancel,
            'native_damage_heal_cancellation':cancelled,'interrupted_channel_never_completes':True}
        print(json.dumps({'stage':'native_arsenal_utilities_passed'}),flush=True)
        return evidence
    except Exception:
        if contexts:
            try:
                (OUT/'failure-arsenal-utilities.json').write_text(json.dumps(pages[0].evaluate('window.SemagVoxel.getState()'),indent=2))
                screenshot(pages[0],'failure-arsenal-utilities')
            except Exception:pass
        raise
    finally:
        for context in contexts:context.close()


class NativeFrame:
    """A sandboxed real client with its owner's trusted keyboard and mouse."""
    def __init__(self,frame,page):self.frame,self.page=frame,page
    @property
    def keyboard(self):return self.page.keyboard
    @property
    def mouse(self):return self.page.mouse
    @property
    def viewport_size(self):return self.page.viewport_size
    def __getattr__(self,name):return getattr(self.frame,name)


def native_mobile_setup_case(browser):
    contexts=[new_context(browser,390,True),new_context(browser,640)]
    pages=[context.new_page() for context in contexts]
    for index,page in enumerate(pages):observe(page,f'arsenal/mobile-setup/P{index+1}')
    try:
        create_room(pages[0],1,'courtyard');pages[1].goto(pages[0].url);connected(pages[1])
        ready_clients(pages,setup_probe='layout')
        pages[0].locator('#enter-arena').tap()
        wait(pages[0],'window.SemagVoxel.getState().controls.touch && !window.SemagVoxel.getState().controls.paused')
        assert pages[0].evaluate('window.SemagVoxel.getState().controls.touch'),'Native touch setup entry failed'
        for width in (390,320):
            pages[0].set_viewport_size({'width':width,'height':1000});no_overflow(pages[0],f'arsenal/mobile-hud/{width}')
            for target in pages[0].locator('[data-voxel-pad],[data-voxel-action]').all():
                box=target.bounding_box();assert box and box['width']>=44 and box['height']>=44,('Small final touch target',width,box)
            assert pages[0].locator('[data-voxel-action]').count()==10
            screenshot(pages[0],f'voxel-native-arsenal-mobile-{width}')
            screenshot(pages[0],f'voxel-native-arsenal-mobile-{width}-hud',viewport='hud')
        result={'status':'passed','fresh_css_layout':True,'native_ready_and_touch_entry':True,
            'buy_layouts':REPORT['mobile_buy_layouts'],'hud_widths':[390,320],'all_ten_touch_targets_at_least_44px':True}
        print(json.dumps({'stage':'native_mobile_buy_and_hud_passed','widths':[390,320]}),flush=True)
        return result
    finally:
        for context in contexts:context.close()


def native_arsenal_fallback_case(browser):
    """Browser-enforced pointer-lock denial; no product API is replaced."""
    contexts=[new_context(browser,960),new_context(browser,960)];expected=[]
    first=contexts[0].new_page();outer=contexts[1].new_page();observe(first,'arsenal/fallback/host')
    outer.on('pageerror',lambda error:ERRORS.append(f'arsenal/fallback: {error}'))
    def console(message):
        if message.type!='error':return
        if 'pointer lock' in message.text.lower() and 'sandbox' in message.text.lower():expected.append(message.text)
        else:ERRORS.append(f'arsenal/fallback: {message.text}')
    outer.on('console',console)
    outer.on('response',lambda response:RESOURCES.append(f'arsenal/fallback: {response.status} {response.url}') if response.status>=400 else None)
    try:
        create_room(first,1,'courtyard')
        outer.set_content(f'<iframe name="arsenal-fallback" sandbox="allow-scripts allow-same-origin" src="{html.escape(first.url,quote=True)}" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>')
        frame=outer.frame(name='arsenal-fallback');assert frame
        client=NativeFrame(frame,outer);assert connected(client)==1
        ready_clients([first,client],setup_probe=False)
        enter_arena(client)
        wait(client,'(()=>{const c=window.SemagVoxel.getState().controls;return c.fallback&&!c.paused&&!c.pointerLocked})()')
        controls=client.evaluate('window.SemagVoxel.getState().controls')
        assert controls['fallback'] and not controls['pointerLocked'],'Browser permission fixture did not enter real fallback'
        box=client.locator('#arena').bounding_box();x,y=box['x']+box['width']/2,box['y']+box['height']/2
        client.mouse.move(x,y);before=look_input(client);client.mouse.down(button='right')
        try:
            gameplay_input(client,'aim',True)
            wait(client,'(()=>{const p=window.__voxelQA.latestState.state.players[1];return p.aiming&&p.aimTicks===18})()')
            client.mouse.move(x+80,y+40,steps=8);after=look_input(client)
            assert abs(angle_delta(after['yaw'],before['yaw']))>.02 and abs(after['pitch']-before['pitch'])>.02,'Fallback RMB did not drag and aim together'
            screenshot(client,'voxel-native-rmb-fallback-ads-canvas',viewport='hud')
        finally:client.mouse.up(button='right')
        gameplay_input(client,'aim',False);stable=look_input(client)
        client.mouse.move(x+100,y+50,steps=3)
        assert look_input(client)['yaw']==stable['yaw'] and look_input(client)['pitch']==stable['pitch'],'Fallback look continued after RMB release'
        client.mouse.down(button='right');gameplay_input(client,'aim',True)
        client.keyboard.press('Escape');gameplay_input(client,'aim',False);client.mouse.up(button='right')
        assert client.evaluate('window.SemagVoxel.getState().controls.paused'),'Escape did not release fallback ADS'
        evidence={'status':'passed','fixture':'Native sandbox permission excludes allow-pointer-lock',
            'real_browser_permission_denial':expected,'native_rmb_drag_and_ads':True,'rmb_release_stops_aim_and_drag':True,
            'escape_releases_held_ads':True,'input_state_never_injected':True,'performance':performance_snapshot(client)}
        print(json.dumps({'stage':'native_arsenal_fallback_passed'}),flush=True)
        return evidence
    finally:
        for context in contexts:context.close()


def performance(page, peers=()):
    sessions=[]
    try:
        for peer in peers:
            session=peer.context.new_cdp_session(peer);session.send('Page.setWebLifecycleState',{'state':'frozen'});sessions.append(session)
        page.evaluate('window.__voxelQA.cpu=[];window.__voxelQA.gaps=[];window.__voxelQA.drawCalls=[]')
        page.wait_for_timeout(3200)
        return performance_snapshot(page,len(peers))
    finally:
        for session in sessions:
            session.send('Page.setWebLifecycleState',{'state':'active'});session.detach()


def performance_snapshot(page, frozen_peers=0):
    stats=page.evaluate('window.__voxelQA')
    result={name:distribution(stats[key]) for name,key in [('cpu_ms','cpu'),('frame_gap_ms','gaps'),('draw_calls','drawCalls')]}
    result['sample_is_software_webgl']=True;result['webgl_contexts']=stats['glContexts']
    result['active_game_view']=1;result['browser_lifecycle_frozen_peers']=frozen_peers;result['gl_resources']=stats['glResources']
    assert stats['glResources']['buffers']['live']<=8 and stats['glResources']['programs']['live']<=2,'Unbounded graphics resources'
    result['input_history_length']=page.evaluate('window.SemagVoxel.getState().queueLength')
    assert result['input_history_length']<=240,'Input prediction history grew without a bound'
    assert page.evaluate('window.SemagVoxel.getState().graphicsError')==''
    assert stats['glContexts']>0,'No actual WebGL context'
    assert stats['drawCalls'] and max(stats['drawCalls'])<3000,('Unbounded draw calls',result)
    return result


def room_case(browser,size,map_id,profile='desktop'):
    contexts=[];pages=[];observer_context=None;passive_sessions=[]
    physics=os.environ.get('SEMAG_PHYSICS_QA')=='1'
    short_team=(os.environ.get('SEMAG_VOXEL_POLISH')=='1' or physics or ARSENAL) and size>1
    try:
        count=size*2
        for index in range(count):
            mobile=profile=='mobile' and index==0
            context=new_context(browser,390 if mobile else (1280 if index==0 else 640),mobile)
            page=context.new_page();observe(page,f'{size}v{size}/{profile}/P{index+1}')
            contexts.append(context);pages.append(page)
        code=create_room(pages[0],size,map_id);invite=pages[0].url
        if size==1 and profile=='desktop':
            pages[0].locator('#loadout-select').click();pages[0].keyboard.press('Home');pages[0].keyboard.press('ArrowDown');pages[0].keyboard.press('ArrowDown');pages[0].keyboard.press('Enter')
            wait(pages[0],'window.__voxelQA.latestState.state.players[0].weapon==="marksman"')
        observer_context=new_context(browser);observer=observer_context.new_page();observe(observer,f'{size}v{size}/hub')
        partial=hub_capacity(observer,code,1,count)
        for index,page in enumerate(pages[1:],1):
            page.goto(invite);assert connected(page)==index
            assert state(page)['phase']=='lobby'
        full=hub_capacity(observer,code,count,count)
        overflow=None
        before=actor(pages[0]);pages[0].locator('#arena').focus();pages[0].keyboard.press('w',delay=100);pages[0].keyboard.press('Space')
        pages[0].wait_for_timeout(180);assert horizontal_distance(before,actor(pages[0]))<.001
        ready_clients(pages)
        print(json.dumps({'stage':'all_ready_gates_passed','mode':f'{size}v{size}','profile':profile}),flush=True)
        teams=team_consistency(pages,size,map_id)
        start_physics_monitor(pages[0])
        if short_team:
            # Every peer first joins and reaches the authoritative fight. Only
            # then freeze passive renderer pages to keep software-GL QA useful;
            # sockets stay genuinely connected and the server state is intact.
            for peer in pages[1:]:
                session=peer.context.new_cdp_session(peer)
                session.send('Page.setWebLifecycleState',{'state':'frozen'})
                passive_sessions.append(session)
        touch=native_touch(pages[0],contexts[0]) if profile=='mobile' else None
        controls=native_team_polish_controls(pages[0]) if short_team else native_controls(pages[0],profile)
        if not short_team:controls.update(neutral_forms_and_help(pages[0]))
        print(json.dumps({'stage':'native_controls_passed','mode':f'{size}v{size}','profile':profile}),flush=True)
        if touch is not None:controls['touch']=touch
        for width in ([1280] if profile=='desktop' else [390,320]):
            pages[0].set_viewport_size({'width':width,'height':1000 if profile=='mobile' else 960})
            no_overflow(pages[0],f'{size}v{size}/{width}')
            if profile=='mobile':
                rects=pages[0].evaluate('''()=>{
                    const rect=node=>{const r=node.getBoundingClientRect();return{x:r.x,right:r.right,y:r.y,bottom:r.bottom}};
                    return{map:rect(document.querySelector('#tactical-map')),objective:rect(document.querySelector('#objective-hud'))};
                }''')
                assert rects['map']['right']<=rects['objective']['x'],('Mobile map overlaps objective',rects)
            screenshot(pages[0],f'voxel-{size}v{size}-{map_id}-{width}')
            screenshot(pages[0],f'voxel-{size}v{size}-{map_id}-{width}-canvas',viewport=True)
        lifecycle={}
        if short_team:lifecycle['passive_peer_renderers_frozen_after_synchronized_fight']=len(passive_sessions)
        if short_team and (physics or ARSENAL):lifecycle['native_team_body_pressure']=native_team_body_pressure(pages[0])
        if short_team and ARSENAL:lifecycle['native_friendly_grenade']=native_friendly_grenade(pages[0])
        if size==1 and profile=='desktop':
            pages[0].set_viewport_size({'width':960,'height':800})
            lifecycle['software_test_gameplay_viewport']=[960,800]
            if physics:
                lifecycle['crate_jump_landing_walkoff']=native_crate_physics(pages[0])
                lifecycle['native_body_pressure']=native_body_pressure(pages[0],pages[1])
                lifecycle['physics_scope']='Native movement/contact checks; objective, round and graphics lifecycle covered by the published 3.10.1 smoke suite.'
            else:
                if ARSENAL:lifecycle['native_rmb_ads']=native_ads(pages[0],'voxel-native-marksman')
                lifecycle['collision_and_firing']=native_wall_and_reload(pages[0])
                lifecycle.update(native_objective_and_elimination(pages))
                lifecycle.update(native_disconnect_rejoin(pages,contexts))
                lifecycle['context_recovery']=context_recovery(pages[1])
        if short_team:
            pages[0].evaluate('window.__voxelQA.cpu=[];window.__voxelQA.gaps=[];window.__voxelQA.drawCalls=[]')
            pages[0].wait_for_timeout(3200)
            perf=performance_snapshot(pages[0],len(passive_sessions))
        else:perf=performance(pages[0],pages[1:])
        evidence={'game':'voxel-breach','mode':f'{size}v{size}','map':map_id,'profile':profile,
            'status':'passed','partial_room':partial,'full_room':full,'capacity_overflow':overflow,'all_ready_required':True,
            'countdown_cancel_resets_all_ready':True,'no_prestart_movement':True,'teams':teams,'native_controls':controls,
            'physics':physics_result(pages[0]),'performance':perf,'lifecycle':lifecycle}
        REPORT['cases'].append(evidence)
        print(json.dumps({'status':'passed','mode':f'{size}v{size}','profile':profile}),flush=True)
    except Exception:
        try:
            observed=pages[0].evaluate('window.SemagVoxel?.getState()')
            (OUT/f'failure-{size}v{size}-{profile}.json').write_text(json.dumps(observed,indent=2))
            screenshot(pages[0],f'failure-{size}v{size}-{profile}')
        except Exception:pass
        raise
    finally:
        for session in passive_sessions:
            try:session.send('Page.setWebLifecycleState',{'state':'active'});session.detach()
            except Exception:pass
        if observer_context:observer_context.close()
        for context in contexts:context.close()


def run(browser):
    selected=os.environ.get('SEMAG_VOXEL_CASES','all').split(',')
    if 'all' in selected or 'hub' in selected:REPORT['hub']=hub_checks(browser)
    for size,map_id in [(1,'courtyard'),(2,'depot'),(3,'canal')]:
        if 'all' in selected or f'{size}v{size}-desktop' in selected:room_case(browser,size,map_id)
    if 'all' in selected or '1v1-mobile' in selected:room_case(browser,1,'courtyard','mobile')
    if ARSENAL:
        REPORT['arsenal']={'weapons':[]}
        for weapon in LOADOUTS:
            if any(key in selected for key in ['all','arsenal','arsenal-weapons',f'weapon-{weapon}']):
                REPORT['arsenal']['weapons'].append(native_arsenal_weapon_case(browser,weapon))
        if any(key in selected for key in ['all','arsenal','arsenal-utilities']):REPORT['arsenal']['utilities']=native_arsenal_utilities_case(browser)
        if any(key in selected for key in ['all','arsenal','arsenal-fallback']):REPORT['arsenal']['fallback']=native_arsenal_fallback_case(browser)
        if 'setup-mobile' in selected:REPORT['arsenal']['mobile_setup']=native_mobile_setup_case(browser)


if __name__=='__main__':main()
