"""Native solo ready-screen regression QA.

python test/solo-start-browser-smoke.py [server URL]
Requires Python Playwright and Chromium. With no URL, starts an isolated host.
The suite observes game state, timers, storage and module requests; it never
injects gameplay state. SEMAG_SCREENSHOT_DIR selects screenshot output.
"""
import json
import os
from pathlib import Path
import subprocess
import sys

from playwright.sync_api import sync_playwright
from browser_controls import controls_panel

ROOT = Path(__file__).resolve().parents[1]
SHOTS = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', ROOT / 'test-results' / 'solo-start'))
GAMES = {
    'paris-pedal': ('paris', 'paris-view.js'),
    'ember-delve': ('ember', 'ember-view.js'),
    'night-drive': ('highway', 'highway-view.js'),
    'deckbound': ('deckbound', 'deckbound-view.js'),
    'rift-survivor': ('rift', 'rift-view.js'),
    'apex-circuit': ('circuit', 'circuit-view.js'),
    'prism-shift': ('prism', 'prism-view.js'),
    'snake': ('snake', 'snake-view.js'),
    '2048': ('tiles-2048', '2048-view.js'),
    'minesweeper': ('minesweeper', 'minesweeper-view.js'),
}
INSTRUMENT = r'''() => {
    const stats = window.__soloStartQA = {rafCalls:0, rafCallbacks:0, pendingRaf:[], rafStacks:[], recordWrites:[], idleKeys:[]};
    const pending = new Set(), request = window.requestAnimationFrame, cancel = window.cancelAnimationFrame;
    window.requestAnimationFrame = callback => {
        stats.rafCalls++;
        if (stats.rafStacks.length < 4) stats.rafStacks.push(new Error().stack);
        const id = request.call(window, time => {pending.delete(id);stats.pendingRaf=[...pending];stats.rafCallbacks++;callback(time)});
        pending.add(id); stats.pendingRaf=[...pending]; return id;
    };
    window.cancelAnimationFrame = id => {pending.delete(id);stats.pendingRaf=[...pending];return cancel.call(window,id)};
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key,value) {
        if (String(key).startsWith('fireside-solo-best:')) stats.recordWrites.push({key,value});
        return write.call(this,key,value);
    };
    window.addEventListener('keydown', event => {
        if (event.target.id === 'solo-game' && document.getElementById('solo-app')?.dataset.phase === 'ready') {
            queueMicrotask(() => stats.idleKeys.push({key:event.key, prevented:event.defaultPrevented}));
        }
    }, true);
}'''


def state(page):
    return page.evaluate('window.firesideSolo?.getState() ?? null')


def records(page):
    return page.evaluate('''() => Object.fromEntries(Object.keys(localStorage)
        .filter(key => key.startsWith('fireside-solo-best:')).sort().map(key => [key,localStorage.getItem(key)]))''')


def ready(page, game):
    page.wait_for_function('game => window.firesideSolo?.gameId === game && document.getElementById("solo-app").dataset.phase === "ready"', arg=game, polling=50)
    assert state(page) is None, (game, 'A controller exists before Start')
    assert page.locator('#solo-start').is_visible() and page.locator('#solo-start').is_enabled()
    assert page.locator('#solo-status-label').inner_text() == 'READY'
    assert not page.locator('.solo-session-actions').is_visible(), 'Session actions exposed before Start'
    assert page.locator('#solo-game canvas,#solo-game [role="grid"],#solo-game .minesweeper-tile').count() == 0
    page.wait_for_function('document.getElementById("solo-preview").complete && document.getElementById("solo-preview").naturalWidth > 0', polling=50)


def assert_idle(page, game, original_records, module_requests):
    assert state(page) is None, (game, 'Idle interaction created a game')
    assert page.locator('#solo-app').get_attribute('data-phase') == 'ready'
    assert page.locator('#solo-status-label').inner_text() == 'READY'
    stats = page.evaluate('window.__soloStartQA')
    assert stats['rafCalls'] == stats['rafCallbacks'] == len(stats['pendingRaf']) == 0, (game, 'Idle preview runs a game loop', stats)
    assert not stats['recordWrites'] and records(page) == original_records, (game, 'Idle preview wrote records')
    assert not module_requests, (game, 'Game modules loaded before Start', module_requests)


def native_layout(page, value):
    picker = page.locator('select[data-keyboard-layout]')
    picker.click()
    page.keyboard.press('Home')
    if value == 'zqsd':
        page.keyboard.press('ArrowDown')
    page.keyboard.press('Enter')
    assert picker.input_value() == value


def start(page, game, activation, module_requests):
    # Hold the real module response to prove repeated pointer activation cannot
    # mount multiple games while Start is loading. The mounted source is intact.
    held = []
    pattern = '**/solo/' + GAMES[game][1]
    page.route(pattern, lambda route: held.append(route))
    button = page.locator('#solo-start')
    box = button.bounding_box()
    assert box
    page.locator('#solo-game').focus()
    page.keyboard.down('ArrowLeft')
    if activation == 'click':
        button.click()
    else:
        button.focus()
        page.keyboard.press(activation)
    page.wait_for_function('document.getElementById("solo-app").dataset.phase === "loading"')
    assert state(page) is None and button.is_disabled(), (game, 'Start loading gate failed')
    for _ in range(3):
        page.mouse.click(box['x'] + box['width']/2, box['y'] + box['height']/2)
    assert state(page) is None
    assert len(held) == 1, (game, 'Duplicate view imports', len(held))
    held.pop().continue_()
    page.unroute(pattern)
    page.wait_for_function('window.firesideSolo?.getState() !== null')
    page.keyboard.up('ArrowLeft')
    assert page.locator('#solo-launch').count() == 0
    assert page.locator('.solo-session-actions').is_visible()
    assert page.locator('#solo-restart').is_enabled() and page.locator('#solo-pause').is_enabled()
    view = '#solo-game > .' + GAMES[game][0] + ('-view' if game not in ('2048',) else '')
    # The highway view uses highway-view; all other roots follow their prefix.
    assert page.locator(view).count() == 1, (game, 'Expected exactly one mounted view', view)
    expected_module = '/solo/' + GAMES[game][1]
    assert len([url for url in module_requests if url.endswith(expected_module)]) == 1, (game, 'View imported repeatedly')
    assert page.locator('#solo-game [data-control][aria-pressed="true"],#solo-game [data-input][aria-pressed="true"]').count() == 0, (game, 'A pre-Start key stayed held')
    initial = state(page)
    assert initial['phase'] != 'paused', (game, 'Start did not begin play')
    if game == '2048':
        assert initial['moves'] == 0
    if game == 'snake':
        assert initial['queuedDirection'] is None and initial['direction'] == 'right'
    if game == 'minesweeper':
        assert not initial['generated'] and initial['opened'] == 0
    if game == 'prism-shift':
        assert initial['active']['x'] == 3


def native_play(page, game):
    initial = state(page)
    if game == '2048':
        page.locator('.tiles-2048-grid').focus()
        page.keyboard.press('ArrowLeft')
        assert state(page)['moves'] == 1 and state(page)['board'] != initial['board']
    elif game == 'minesweeper':
        page.locator('.minesweeper-tile[data-index="0"]').click()
        assert state(page)['generated'] and state(page)['opened'] > 0
        page.wait_for_function('window.firesideSolo.getState().elapsed > 0')
    elif game == 'deckbound':
        page.locator('.deckbound-path-combat').first.click()
        page.wait_for_function('window.firesideSolo.getState().phase === "battle"')
        turn = state(page)['turn']
        page.locator('#solo-game [data-action="end-turn"]').click()
        assert state(page)['turn'] == turn + 1
    elif game == 'snake':
        page.wait_for_function('ticks => window.firesideSolo.getState().ticks > ticks', arg=initial['ticks'])
        assert state(page)['snake'][0] != initial['snake'][0]
    elif game == 'apex-circuit':
        page.wait_for_function('window.firesideSolo.getState().startDelay <= 0')
        page.locator('.circuit-canvas').focus()
        page.keyboard.down('ArrowUp')
        page.wait_for_timeout(160)
        page.keyboard.up('ArrowUp')
        assert state(page)['car']['speed'] > 0
    else:
        page.wait_for_function('elapsed => window.firesideSolo.getState().elapsed > elapsed + 0.1', arg=initial['elapsed'])
    assert state(page)['phase'] not in ('paused', 'lost', 'won'), (game, 'Native play did not remain active')


def session_controls(page, game):
    page.locator('#solo-pause').click()
    page.wait_for_function('window.firesideSolo.getState().phase === "paused"')
    before = state(page)
    page.wait_for_timeout(150)
    assert state(page) == before, (game, 'Paused game advanced')
    page.locator('#solo-pause').click()
    page.wait_for_function('window.firesideSolo.getState().phase !== "paused"')
    page.locator('#solo-restart').click()
    fresh = state(page)
    assert fresh['phase'] not in ('paused', 'lost', 'won')
    assert page.locator('#solo-start').count() == 0, (game, 'Restart reopened the initial gate')
    if game == '2048': assert fresh['moves'] == 0
    if game == 'minesweeper': assert not fresh['generated'] and fresh['opened'] == 0
    if game == 'deckbound': assert fresh['phase'] == 'route' and fresh['floor'] == 1
    if game == 'apex-circuit': assert fresh['startDelay'] > 0 and fresh['penalty'] == 0


def run(url):
    SHOTS.mkdir(parents=True, exist_ok=True)
    errors, resources, mutations, sockets, results = [], [], [], [], []
    with sync_playwright() as playwright:
        options = {'headless': True, 'args': ['--no-sandbox']}
        if Path('/usr/bin/chromium').exists(): options['executable_path'] = '/usr/bin/chromium'
        browser = playwright.chromium.launch(**options)
        try:
            for index, game in enumerate(GAMES):
                for entry in ('shelf', 'direct'):
                    context = browser.new_context(viewport={'width':1440,'height':1000})
                    context.add_init_script('localStorage.setItem("fireside-solo-best:' + game + ':default", "321"); (' + INSTRUMENT + ')();')
                    page = context.new_page()
                    requests = []
                    tag = f'{game}/{entry}'
                    page.on('pageerror', lambda error, tag=tag: errors.append(f'{tag}: {error}'))
                    page.on('console', lambda msg, tag=tag: errors.append(f'{tag}: {msg.text}') if msg.type == 'error' else None)
                    page.on('response', lambda response, tag=tag: resources.append(f'{tag}: {response.status} {response.url}') if response.status >= 400 else None)
                    page.on('request', lambda request: requests.append(request.url) if '/solo/' in request.url and request.url.endswith(('-view.js','-engine.js')) else None)
                    page.on('request', lambda request, tag=tag: mutations.append(f'{tag}: {request.method} {request.url}') if '/api/rooms' in request.url and request.method != 'GET' else None)
                    page.on('websocket', lambda socket, tag=tag: sockets.append(f'{tag}: {socket.url}'))
                    try:
                        if entry == 'shelf':
                            page.goto(url + '/')
                            page.locator('[data-filter="solo"]').click()
                            page.locator(f'[data-play-solo="{game}"]').click()
                        else:
                            page.goto(url + '/solo.html?game=' + game)
                        ready(page, game)
                        original_records = records(page)
                        page.wait_for_timeout(350)
                        assert_idle(page, game, original_records, requests)
                        page.locator('#solo-game').focus()
                        assert page.evaluate('document.activeElement.id') == 'solo-game'
                        for key in ('r','p','ArrowLeft','ArrowUp','ArrowDown','ArrowRight','Space','Enter'):
                            page.keyboard.press(key)
                        assert_idle(page, game, original_records, requests)
                        idle_keys = page.evaluate('window.__soloStartQA.idleKeys')
                        assert len(idle_keys) >= 8 and all(not event['prevented'] for event in idle_keys), (game, 'Idle shortcuts consumed gameplay input', idle_keys)
                        with controls_panel(page, '#solo-how-to', resume=False):
                            page.locator('#solo-how-to summary').focus()
                            page.keyboard.press('Enter')
                            assert page.locator('#solo-how-to').evaluate('node => node.open')
                        native_layout(page, 'zqsd')
                        assert_idle(page, game, original_records, requests)
                        page.evaluate('''() => {const input=document.createElement('input');input.id='start-qa-input';document.querySelector('#solo-game').append(input);input.focus()}''')
                        page.keyboard.type('rpzqsdwasd')
                        assert page.locator('#start-qa-input').input_value() == 'rpzqsdwasd'
                        assert_idle(page, game, original_records, requests)
                        page.locator('#start-qa-input').evaluate('input => input.remove()')
                        if entry == 'direct':
                            for width in (320,390):
                                page.set_viewport_size({'width':width,'height':900})
                                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (game, width, 'Ready screen overflow')
                                assert page.locator('#solo-start').is_visible() and page.locator('select[data-keyboard-layout]').is_visible()
                                if game == 'paris-pedal': page.screenshot(path=str(SHOTS/f'paris-ready-{width}.png'), full_page=True)
                            page.set_viewport_size({'width':1440,'height':1000})
                            if game == 'paris-pedal': page.screenshot(path=str(SHOTS/'paris-ready-desktop.png'), full_page=True)
                        activation = ('click','Enter','Space')[index % 3] if entry == 'shelf' else ('Space','click','Enter')[index % 3]
                        start(page, game, activation, requests)
                        native_play(page, game)
                        session_controls(page, game)
                        results.append({'game':game,'entry':entry,'start_activation':activation,'idle':True,'single_mount':True,'native_play_pause_restart':True})
                        print(f'PASS {tag}: ready idle, native {activation} Start, single mount, play/pause/restart', flush=True)
                    finally:
                        context.close()
            # Leaving while a view import is delayed cannot activate hidden play.
            context = browser.new_context(viewport={'width':1440,'height':1000})
            page = context.new_page()
            page.goto(url + '/solo.html?game=paris-pedal')
            ready(page, 'paris-pedal')
            held = []
            pattern = '**/solo/paris-view.js'
            page.route(pattern, lambda route: held.append(route))
            page.locator('#solo-start').click()
            page.wait_for_function('document.getElementById("solo-app").dataset.phase === "loading"')
            page.locator('.solo-back').click()
            page.wait_for_url(url + '/')
            for route in held:
                try: route.continue_()
                except Exception: pass  # Navigation can cancel the old document's fetch.
            page.unroute(pattern)
            assert page.evaluate('window.firesideSolo === undefined'), 'A delayed solo controller mounted on the shelf'
            page.go_back(wait_until='commit')
            page.wait_for_function('window.firesideSolo !== undefined')
            restored = state(page)
            assert restored is None or restored['phase'] == 'paused', ('Delayed-import history restoration autoplayed', restored)
            context.close()
            print('PASS delayed Start import → shelf → Back: no autoplay', flush=True)
            assert not errors, errors
            assert not resources, resources
            assert not mutations, mutations
            assert not sockets, sockets
            print(json.dumps({'games':results,'errors':errors,'failed_resources':resources,'room_mutations':mutations,'sockets':sockets,'screenshots':str(SHOTS)},indent=2),flush=True)
        finally:
            browser.close()


def main():
    if len(sys.argv) > 1:
        run(sys.argv[1].rstrip('/'))
        return
    source = "import {createServer} from './server.js'; const server=createServer(); const address=await server.listen(0,'127.0.0.1'); console.log(JSON.stringify({port:address.port})); process.on('SIGTERM',async()=>{await server.close();process.exit(0)});"
    host = subprocess.Popen(['node','--input-type=module','--eval',source],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    try:
        line = host.stdout.readline()
        if not line: raise RuntimeError(host.stderr.read())
        run(f'http://127.0.0.1:{json.loads(line)["port"]}')
    finally:
        host.terminate()
        try: host.wait(timeout=5)
        except subprocess.TimeoutExpired:
            host.kill(); host.wait(timeout=5)


if __name__ == '__main__': main()
