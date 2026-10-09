"""Native collision/graphics smoke QA for the four polished solo games.

python test/collision-polish-browser-smoke.py [server URL]
Requires Python Playwright and Chromium. Starts an isolated host without a URL.
Controls are trusted keyboard/pointer events; firesideSolo state is read-only.
Canvas exports preserve actual rendered frames. SEMAG_SCREENSHOT_DIR controls
artifact output. Callback timings are gross headless-browser checks, rather
than a hardware GPU benchmark or a replacement for comparative profiling.
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
OUT = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', ROOT / 'test-results' / 'collision-polish'))
CASES = {
    'night-drive': ('highway', 'highway-canvas'),
    'paris-pedal': ('paris', 'paris-canvas'),
    'ember-delve': ('ember', 'ember-canvas'),
    'rift-survivor': ('rift', 'rift-canvas'),
}
INSTRUMENT = r'''() => {
    const stats=window.__collisionQA={cpu:[],gaps:[],frames:0,pending:[],impactText:[]};
    const request=window.requestAnimationFrame,cancel=window.cancelAnimationFrame,pending=new Set();let previous=null;
    window.requestAnimationFrame=callback=>{
        const game=/\/solo\/[a-z0-9-]+-view\.js/.test(new Error().stack);
        const id=request.call(window,time=>{
            pending.delete(id);stats.pending=[...pending];
            if(!game){callback(time);return}
            const start=performance.now();callback(time);const cpu=performance.now()-start;
            stats.frames++;
            if(stats.frames>5){stats.cpu.push(cpu);if(previous!==null)stats.gaps.push(time-previous)}
            previous=time;if(stats.cpu.length>1500)stats.cpu.shift();if(stats.gaps.length>1500)stats.gaps.shift();
        });
        if(game){pending.add(id);stats.pending=[...pending]}return id;
    };
    window.cancelAnimationFrame=id=>{pending.delete(id);stats.pending=[...pending];return cancel.call(window,id)};
    const fillText=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(text,...args){
        if(/IMPACT|NEAR MISS|TIGHT, CLEAN PASS/.test(String(text))){stats.impactText.push(String(text));if(stats.impactText.length>100)stats.impactText.shift()}
        return fillText.call(this,text,...args);
    };
}'''


def wait(page, expression, **kwargs):
    kwargs.setdefault('polling', 50)
    return page.wait_for_function(expression, **kwargs)


def state(page):
    return page.evaluate('window.firesideSolo.getState()')


class Keyboard:
    def __init__(self, page):
        self.page, self.held = page, set()

    def set(self, desired):
        desired = set(desired)
        for key in sorted(self.held - desired): self.page.keyboard.up(key)
        for key in sorted(desired - self.held): self.page.keyboard.down(key)
        self.held = desired

    def release(self):
        self.set(set())


def canvas_export(page, selector, filename):
    encoded = page.locator(selector).evaluate("canvas => canvas.toDataURL('image/png')")
    path = OUT / filename
    path.write_bytes(base64.b64decode(encoded.split(',', 1)[1]))
    return str(path)


def painted(page, selector):
    result = page.locator(selector).evaluate('''canvas => {
        const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
        const colors=new Set();let opaque=0;
        for(let row=0;row<18;row++)for(let col=0;col<18;col++){
            const x=Math.floor((col+.5)*canvas.width/18),y=Math.floor((row+.5)*canvas.height/18),offset=(y*canvas.width+x)*4;
            colors.add(`${pixels[offset]},${pixels[offset+1]},${pixels[offset+2]}`);if(pixels[offset+3]>0)opaque++;
        }
        return {width:canvas.width,height:canvas.height,colors:colors.size,opaque:opaque/324};
    }''')
    assert result['colors'] > 8 and result['opaque'] > .9, ('Blank or missing scene assets', result)
    return result


def steer(current, target, paris=False):
    velocity = current['vx'] if paris else current['steeringVelocity']
    error = current['x'] + velocity * (.10 if paris else .075) - target
    tolerance = .045 if paris else .014
    keys = {'z'}
    if error > tolerance: keys.add('q')
    elif error < -tolerance: keys.add('d')
    return keys


def upcoming(current, paris=False):
    player_length = 1.8 if paris else current['car']['length']
    return sorted((actor for actor in current['traffic'] if not actor['passed'] and not actor['crashed'] and
                   (actor['z'] - current['distance'] if paris else actor['z']) > -(actor['length'] + player_length)/2),
                  key=lambda actor: actor['z'])


def safe_near_target(current, actors, paris):
    nearest = actors[0]
    row = [actor for actor in actors if actor['row'] == nearest['row']]
    width, limit, clearance = (.62, 4.02, .18) if paris else (current['car']['width'], .86, .065)
    candidates = []
    for actor in row:
        future = actor.get('targetX', actor['x']) if paris else (-.62,0,.62)[actor.get('targetLane',actor['lane'])]
        actor_width = max(actor['width'], actor.get('targetWidth', actor['width']))
        for side in (-1, 1):
            target = (min(actor['x'], future) if side < 0 else max(actor['x'], future)) + side*((width+actor_width)/2+clearance)
            if abs(target) > limit: continue
            clear = True
            for other in row:
                other_future = other.get('targetX', other['x']) if paris else (-.62,0,.62)[other.get('targetLane',other['lane'])]
                other_width = max(other['width'], other.get('targetWidth', other['width']))
                lo = min(other['x'], other_future) - (width+other_width)/2
                hi = max(other['x'], other_future) + (width+other_width)/2
                if lo-.018 < target < hi+.018: clear=False;break
            if clear: candidates.append(target)
    return min(candidates, key=lambda target: abs(target-current['x'])) if candidates else current['x']


def driving_contacts(page, game, selector, keyboard, profile):
    paris = game == 'paris-pedal'
    near_type = 'near-pass' if paris else 'near-miss'
    started = time.monotonic()
    close_frame, near, impact = None, None, None
    while time.monotonic() - started < 26:
        current = state(page)
        assert current['phase'] == 'playing', (game, 'Run ended before its controlled contact', current['result'])
        events = current.get('events', [])
        near = near or next((event for event in events if event['type'] == near_type), None)
        impact = next((event for event in events if event['type'] == 'crash'), None)
        if impact:
            assert near, (game, 'Pilot crashed before a clean near pass')
            assert current['health'] == 2 and current['totalCrashes'] == 1, (game, 'One traffic contact must cost one health')
            keyboard.release()
            wait(page, "window.__collisionQA.impactText.some(text => text.includes('IMPACT'))", timeout=2000)
            page.locator('#solo-pause').click()
            wait(page, 'window.firesideSolo.getState().phase === "paused"')
            contact = state(page)
            canvas_export(page, selector, f'{game}-{profile}-impact-canvas.png')
            page.screenshot(path=str(OUT/f'{game}-{profile}-impact-page.png'),full_page=True)
            texts = page.evaluate('window.__collisionQA.impactText')
            assert any('IMPACT' in text and '2' in text for text in texts), (game, 'Impact feedback was not drawn', texts)
            return {'near_pass':near,'impact':impact,'contact_state':contact,'close_geometry':close_frame,'feedback':texts[-4:]}
        actors = upcoming(current, paris)
        if actors:
            target = actors[0]['x'] if near else safe_near_target(current, actors, paris)
            keyboard.set(steer(current,target,paris))
            if close_frame is None:
                for actor in actors:
                    z = actor['z'] - current['distance'] if paris else actor['z']
                    clearance = abs(current['x']-actor['x']) - ((.62 if paris else current['car']['width'])+actor['width'])/2
                    half_length = ((1.8 if paris else current['car']['length'])+actor['length'])/2
                    if abs(z) < half_length and .02 < clearance < (.48 if paris else .14):
                        path = canvas_export(page,selector,f'{game}-{profile}-close-pass-canvas.png')
                        close_frame = {'path':path,'actorId':actor['id'],'clearance':clearance,'longitudinal':z,'halfLength':half_length}
                        break
        else:
            keyboard.set({'z'})
        page.wait_for_timeout(35)
    raise AssertionError((game,'Native pilot did not observe near pass and impact',state(page)))


def aim(page, selector, x, y):
    box = page.locator(selector).bounding_box()
    assert box
    page.mouse.move(box['x']+x/960*box['width'],box['y']+y/640*box['height'])


def clear_segment(start, target, obstacles, radius=6):
    dx,dy=target['x']-start['x'],target['y']-start['y']
    for rect in obstacles:
        enter,leave=0.,1.
        for origin,delta,lo,hi in ((start['x'],dx,rect['x']-radius,rect['x']+rect['width']+radius),
                                   (start['y'],dy,rect['y']-radius,rect['y']+rect['height']+radius)):
            if abs(delta)<1e-8:
                if origin<lo or origin>hi: enter,leave=2.,-1.;break
            else:
                a,b=(lo-origin)/delta,(hi-origin)/delta
                enter=max(enter,min(a,b));leave=min(leave,max(a,b))
        if enter<=leave: return False
    return True


def action_contacts(page, game, selector, keyboard, profile):
    ember = game == 'ember-delve'
    # Aim a real projectile at a solid wall or cover from the ordinary spawn.
    aim(page,selector,12,320) if ember else aim(page,selector,325,235)
    keyboard.set({'k'} if ember else {'j'})
    began=time.monotonic()
    cover=None
    while time.monotonic()-began<3:
        current=state(page)
        cover=next((event for event in current.get('events',[]) if event['type']=='impact'),None)
        if cover: break
        page.wait_for_timeout(25)
    keyboard.release()
    assert cover, (game,'Native projectile did not create a cover/wall impact',state(page).get('events'))
    canvas_export(page,selector,f'{game}-{profile}-cover-impact-canvas.png')
    before=state(page)['player']['x']
    keyboard.set({'d'});page.wait_for_timeout(140);keyboard.release()
    assert state(page)['player']['x']>before+8,(game,'ZQSD movement failed')
    last_id=state(page)['eventId']
    obstacles=state(page)['room']['obstacles'] if ember else [
        {'x':280,'y':200,'width':90,'height':70},{'x':630,'y':200,'width':90,'height':70},
        {'x':280,'y':410,'width':90,'height':70},{'x':630,'y':410,'width':90,'height':70}]
    hit=None;began=time.monotonic()
    while time.monotonic()-began<5:
        current=state(page)
        assert current['phase']=='playing',(game,'Action run ended before contact')
        hit=next((event for event in current.get('events',[]) if event['id']>last_id and event['type']=='hit'),None)
        if hit: break
        enemies=sorted((enemy for enemy in current['enemies'] if enemy['hp']>0 and clear_segment(current['player'],enemy,obstacles)),
                       key=lambda enemy:math.hypot(enemy['x']-current['player']['x'],enemy['y']-current['player']['y']))
        if enemies:
            aim(page,selector,enemies[0]['x'],enemies[0]['y']);keyboard.set({'k'} if ember else {'j'})
        else:
            keyboard.release()
        page.wait_for_timeout(35)
    keyboard.release()
    assert hit,(game,'Native projectile never hit a visible enemy',state(page).get('events'))
    canvas_export(page,selector,f'{game}-{profile}-enemy-hit-canvas.png')
    page.locator('#solo-pause').click();wait(page,'window.firesideSolo.getState().phase === "paused"')
    page.screenshot(path=str(OUT/f'{game}-{profile}-contact-page.png'),full_page=True)
    return {'cover_impact':cover,'enemy_hit':hit,'contact_state':state(page)}


def distribution(values):
    ordered=sorted(values)
    return {'count':len(ordered),'p50':ordered[len(ordered)//2] if ordered else None,
            'p95':ordered[min(len(ordered)-1,int(len(ordered)*.95))] if ordered else None,
            'max':max(ordered) if ordered else None}


def run(url):
    OUT.mkdir(parents=True,exist_ok=True)
    errors,resources,mutations,sockets,results=[],[],[],[],[]
    with sync_playwright() as playwright:
        options={'headless':True,'args':['--no-sandbox']}
        if Path('/usr/bin/chromium').exists(): options['executable_path']='/usr/bin/chromium'
        browser=playwright.chromium.launch(**options)
        try:
            for profile,width,dpr in (('desktop',1440,1),('mobile',390,2)):
                for game,(prefix,canvas_class) in CASES.items():
                    context=browser.new_context(viewport={'width':width,'height':1000 if width>600 else 900},device_scale_factor=dpr)
                    context.add_init_script("localStorage.setItem('semag-keyboard-layout','zqsd');("+INSTRUMENT+")();")
                    page=context.new_page();tag=f'{game}/{profile}'
                    page.on('pageerror',lambda error,tag=tag:errors.append(f'{tag}: {error}'))
                    page.on('console',lambda msg,tag=tag:errors.append(f'{tag}: {msg.text}') if msg.type=='error' else None)
                    page.on('response',lambda response,tag=tag:resources.append(f'{tag}: {response.status} {response.url}') if response.status>=400 else None)
                    page.on('request',lambda request,tag=tag:mutations.append(f'{tag}: {request.method} {request.url}') if '/api/rooms' in request.url and request.method!='GET' else None)
                    page.on('websocket',lambda socket,tag=tag:sockets.append(f'{tag}: {socket.url}'))
                    keyboard=Keyboard(page);selector='.'+canvas_class
                    try:
                        page.goto(url+'/solo.html?game='+game)
                        wait(page,'game => window.firesideSolo?.gameId === game',arg=game)
                        assert state(page) is None and page.locator('#solo-start').is_visible(),(tag,'Ready screen regressed')
                        assert page.locator('select[data-keyboard-layout]').input_value()=='zqsd'
                        page.wait_for_timeout(150);assert state(page) is None
                        page.locator('#solo-start').click();wait(page,'window.firesideSolo.getState() !== null')
                        page.locator(selector).focus()
                        assert page.locator('#solo-game > section').get_attribute('data-keyboard-layout')=='zqsd'
                        if game in ('night-drive','paris-pedal'):
                            before=state(page)['x'];keyboard.set({'d'});page.wait_for_timeout(120);keyboard.release()
                            assert state(page)['x']>before+.015,(tag,'French steering failed')
                            evidence=driving_contacts(page,game,selector,keyboard,profile)
                        else:
                            evidence=action_contacts(page,game,selector,keyboard,profile)
                        paint=painted(page,selector)
                        paused=state(page);page.wait_for_timeout(200)
                        assert state(page)==paused,(tag,'Paused contacts or recovery moved')
                        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),(tag,'Game overflow')
                        stats=page.evaluate('window.__collisionQA')
                        cpu,gaps=distribution(stats['cpu']),distribution(stats['gaps'])
                        assert cpu['count']>=20,(tag,'Insufficient actual draw samples',stats['frames'])
                        assert cpu['p95']<55 and gaps['p95']<100,(tag,'Gross rendering slowdown',cpu,gaps)
                        page.locator('#solo-pause').click();wait(page,'window.firesideSolo.getState().phase === "playing"')
                        page.locator('#solo-restart').click()
                        fresh=state(page)
                        assert fresh['phase']=='playing' and page.locator('#solo-start').count()==0
                        if game in ('night-drive','paris-pedal'): assert fresh['health']==3 and fresh['totalCrashes']==0
                        elif game in ('ember-delve','rift-survivor'): assert fresh['player']['hp']==fresh['player']['maxHp']
                        results.append({'game':game,'profile':profile,'dpr':dpr,'paint':paint,'cpu_ms':cpu,'frame_gap_ms':gaps,'evidence':evidence})
                        print(f'PASS {tag}: native contacts, ZQSD, ready/pause/restart, visible assets; draw p95 {cpu["p95"]:.1f}ms',flush=True)
                    finally:
                        keyboard.release();context.close()
            assert not errors,errors
            assert not resources,resources
            assert not mutations,mutations
            assert not sockets,sockets
            report={'games':results,'errors':errors,'failed_resources':resources,'room_mutations':mutations,'websockets':sockets,'screenshots':str(OUT)}
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
        if not line:raise RuntimeError(host.stderr.read())
        run(f'http://127.0.0.1:{json.loads(line)["port"]}')
    finally:
        host.terminate()
        try:host.wait(timeout=5)
        except subprocess.TimeoutExpired:host.kill();host.wait(timeout=5)


if __name__=='__main__':main()
