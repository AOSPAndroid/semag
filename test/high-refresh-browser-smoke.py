"""Native browser smoke checks for monitor-paced presentation.

python test/high-refresh-browser-smoke.py http://127.0.0.1:3000
SEMAG_REFRESH_CASES selects breach,royale,afterimage,shadow,paris,skyline,circuit,snake.
SEMAG_SCREENSHOT_DIR selects the inspectable report directory.

Gameplay uses native browser/CDP keyboard and mouse events only. Copied debug
snapshots and canvas draw calls are observed. No gameplay state, simulation
time, animation timestamps or animation scheduling is injected. Headless
Chromium's actual cadence is reported; this is not a 144/240 Hz hardware test.
"""
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import sys
import time

from playwright.sync_api import sync_playwright
from browser_controls import click_control

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('SEMAG_SCREENSHOT_DIR', '/workspace/scratch/semag-high-refresh-browser'))
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3000').rstrip('/')
SPEC = importlib.util.spec_from_file_location('refresh_voxel_assets', ROOT / 'test' / 'voxel-assets-browser-smoke.py')
assets = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(assets)
for module in (assets, assets.fixture, assets.native, assets.royale):
    module.OUT, module.URL = OUT, URL

SOURCES = ('display-timing.js', 'voxel-client.js', 'voxel-royale-client.js',
           'voxel-renderer.js', 'voxel-presentation.js', 'client.js',
           'planar-presentation.js', 'brawl-renderer.js', 'hub/room.js',
           'solo/render-sampling.js', 'solo/shadow-view.js', 'solo/paris-view.js',
           'solo/skyline-view.js', 'solo/circuit-view.js', 'solo/snake-view.js', 'solo/solo.js')
REPORT = {'cases': [], 'errors': [], 'failed_resources': [], 'screenshots': [],
          'headless_display_only': True, 'sources': {}}

# Count the genuine background draw performed once per 2D frame. Native RAF is
# left intact. These wrappers forward exactly the original canvas arguments.
PAINT_OBSERVER = r'''() => {
  const paints = window.__refreshPaint = {};
  const draw = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function(...args) {
    const result = draw.apply(this, args);
    if (this.canvas.isConnected && args[0]?.tagName === 'CANVAS' && args[1] === 0 && args[2] === 0) {
      const name = this.canvas.className || this.canvas.id;
      const item = paints[name] ||= {count: 0, times: []};
      item.count++; item.times.push(performance.now());
      if (item.times.length > 360) item.times.shift();
      if (name === 'circuit-canvas' && window.firesideSolo?.getState()) {
        const state = window.firesideSolo.getState();
        const frames = item.frames ||= [];
        frames.push({elapsed: state.elapsed, car: {x:state.car.x,y:state.car.y},
                     timing: window.firesideSolo.getDisplayTiming()});
        if (frames.length > 180) frames.shift();
      }
      if (name === 'snake-canvas' && window.firesideSolo?.getState()) {
        const state = window.firesideSolo.getState();
        const frames = item.frames ||= [];
        frames.push({ticks:state.ticks, phase:state.phase, time:performance.now()});
        if (frames.length > 180) frames.shift();
      }
    }
    return result;
  };
}'''


def log(stage, **details):
    print(json.dumps({'stage': stage, **details}), flush=True)


def wait(page, expression, arg=None, timeout=12000):
    return page.wait_for_function(expression, arg=arg, polling=25, timeout=timeout)


def observe(page, name):
    page.on('pageerror', lambda error: REPORT['errors'].append(f'{name}: {error}'))
    page.on('console', lambda message: REPORT['errors'].append(f'{name}: {message.text}') if message.type == 'error' else None)
    page.on('response', lambda response: REPORT['failed_resources'].append(f'{name}: {response.status} {response.url}') if response.status >= 400 else None)


def screenshot(page, name, selector=None):
    path = OUT / (name + '.png')
    if selector:
        page.locator(selector).screenshot(path=str(path))
    else:
        page.screenshot(path=str(path), full_page=True)
    REPORT['screenshots'].append(str(path))
    return str(path)


def sample(page, expression, duration=.75):
    observations, deadline = [], time.monotonic() + duration
    while time.monotonic() < deadline:
        observations.append(page.evaluate(expression))
        page.wait_for_timeout(9)
    return observations


def pose_finite(body, arena):
    assert all(math.isfinite(body[key]) for key in ('x', 'y', 'z')), body
    radius = body.get('radius', .32)
    height = 1.15 if body.get('crouching') else 1.8
    bounds = arena['bounds']
    assert bounds['minX'] + radius - .0002 <= body['x'] <= bounds['maxX'] - radius + .0002, body
    assert bounds['minZ'] + radius - .0002 <= body['z'] <= bounds['maxZ'] - radius + .0002, body
    assert body['y'] >= -.0002, body
    for box in arena['colliders']:
        gap = math.hypot(body['x'] - max(box['x'], min(box['x'] + box['w'], body['x'])),
                         body['z'] - max(box['z'], min(box['z'] + box['d'], body['z'])))
        vertical = body['y'] < box['y'] + box['h'] - .0002 and body['y'] + height > box['y'] + .0002
        assert not vertical or gap >= radius - .0002, ('Presentation penetrated solid cover', body, box, gap)


def voxel_case(browser, mode):
    contexts, pages, arena = assets.room(browser, mode, 'courtyard' if mode == 'breach' else 'forest')
    host, peer = pages
    frozen = None
    details = {'game': 'voxel-' + mode}
    try:
        details['start'] = assets.begin(pages, mode)
        frozen = assets.royale.freeze(peer)
        surface = assets.debug(host)
        before = assets.actor(host)
        assets.enter(host)
        forward = 'z' if host.locator('select[data-keyboard-layout]').input_value() == 'zqsd' else 'w'
        assets.native.cdp_key(host, forward, 'KeyW')
        try:
            wait(host, 'window.__voxelQA.lastInput?.buttons.up === true')
            look = assets.native.native_look_delta if mode == 'breach' else assets.royale.look
            aim_changes = []
            for dx in (16, -7, 9):
                start_aim, end_aim = look(host, dx, 3)
                aim_changes.append(abs(assets.native.angle_delta(end_aim['yaw'], start_aim['yaw'])))
                assert assets.snapshot(host)['input']['up'], 'Mouse movement released native forward input'
            assert max(aim_changes) > .001, aim_changes
            wait(host, f'id=>window.{surface}.getState().state.players[id].previousInput.up === true', 0)
            wait(host, 'yaw=>Math.abs(window.__voxelQA.lastInput.buttons.yaw-yaw)>.001 && window.__voxelQA.lastInput.buttons.up', before['yaw'])
            seen = sample(host, 'window.' + surface + '.getState()', .85)
        finally:
            assets.native.cdp_key(host, forward, 'KeyW', 'keyUp')
        wait(host, 'window.__voxelQA.lastInput?.buttons.up === false')
        wait(host, f'window.{surface}.getState().state.players[0].previousInput.up === false')
        after = assets.actor(host)
        assert math.hypot(after['x'] - before['x'], after['z'] - before['z']) > .05, ('Native movement did not move', before, after)
        remainders, differences = [], []
        for view in seen:
            assets.fixture.finite(host, arena)
            presented, predicted = view['presentationPlayer'], view['predictedPlayer']
            assert presented and predicted and presented['id'] == predicted['id'] == view['playerId']
            pose_finite(presented, arena)
            assert 0 <= view['predictionRemainder'] < 1 / 120 + 1e-9, view['predictionRemainder']
            remainders.append(view['predictionRemainder'])
            differences.append(math.hypot(presented['x'] - predicted['x'], presented['y'] - predicted['y'], presented['z'] - predicted['z']))
        assert max(remainders) > 1e-5 and max(differences) > 1e-5, ('Local presentation stayed at tick pose', remainders, differences)
        count = assets.snapshot(host)['renderCount']
        host.wait_for_timeout(180)
        assert assets.snapshot(host)['renderCount'] > count
        assets.tap(host, ' ', 'Space')
        wait(host, f'window.{surface}.getState().state.players[0].y>.03', timeout=2500)
        assets.fixture.finite(host, arena)
        wait(host, f'window.{surface}.getState().state.players[0].grounded', timeout=3500)
        assets.fixture.finite(host, arena)
        if mode == 'breach':
            details['ads'] = assets.ads(host, 'refresh-breach')
            details['reload'] = assets.discharge_and_reload(host, 'refresh-breach')
        else:
            details['knife'] = assets.knife_cut(host, 'refresh-forest')
            assert assets.actor(host)['meleeWeapon'] == 'knife' and not assets.actor(host)['hasGun']
        screenshot(host, 'refresh-' + mode, '#viewport')
        details['presentation'] = {'samples': len(seen), 'maximum_subtick_seconds': max(remainders),
                                   'maximum_observed_last_display_to_latest_physics_difference': max(differences), 'native_move_jump_land': True,
                                   'presentation_collision_checked': True,
                                   'native_rapid_aim_preserves_forward_and_release_edges': True}
        details['performance'] = assets.performance(host, arena)
        assets.royale.thaw(frozen)
        frozen = None
        wait(peer, f'window.{assets.debug(peer)}.getState().state.phase === "fight"')
        assert assets.snapshot(peer)['connected'] and assets.snapshot(peer)['graphicsError'] == ''
        REPORT['cases'].append(details)
        log('native-refresh-pass', game=details['game'], presentation=details['presentation'])
    except BaseException as error:
        assets.failure(pages, 'refresh-' + mode, details, error)
        raise
    finally:
        if frozen:
            assets.royale.thaw(frozen)
        for context in contexts:
            context.close()


def afterimage_case(browser):
    contexts = [browser.new_context(viewport={'width': 1280, 'height': 960}) for _ in range(2)]
    pages = [context.new_page() for context in contexts]
    try:
        host, peer = pages
        for i, page in enumerate(pages):
            observe(page, f'afterimage/{i}')
        host.goto(URL)
        host.locator('[data-create-game="afterimage"]').click()
        host.wait_for_url('**/afterimage.html?room=*')
        wait(host, 'window.afterimage?.connected && window.afterimage.playerId === 0')
        peer.goto(host.url)
        wait(peer, 'window.afterimage?.connected && window.afterimage.playerId === 1')
        host.locator('#practice-button').click()
        wait(host, 'window.afterimage.practice && window.afterimage.getState().phase === "fight"')
        host.locator('#arena').focus()
        before = host.evaluate('window.afterimage.getState().fighters[0].x')
        host.keyboard.down('d')
        try:
            views = sample(host, '({state:window.afterimage.getState(),view:window.afterimage.getPresentation()})', .7)
        finally:
            host.keyboard.up('d')
        assert host.evaluate('window.afterimage.getState().fighters[0].x') > before + 30
        moving = [item for item in views if item['view']['previousPositions'] is not None]
        assert moving and all(0 <= item['view']['fraction'] <= 1 for item in moving)
        assert any(0 < item['view']['fraction'] < 1 and abs(item['view']['fighters'][0]['x'] - item['state']['fighters'][0]['x']) > .0001 for item in moving), moving
        count = moving[-1]['view']['renderCount']
        host.wait_for_timeout(120)
        assert host.evaluate('window.afterimage.getPresentation().renderCount') > count
        screenshot(host, 'refresh-afterimage-practice', '#arena')
        host.locator('#practice-button').click()
        wait(host, '!window.afterimage.practice && window.afterimage.getState().phase === "lobby"')
        click_control(host, '#ready-button')
        host.wait_for_timeout(100)
        assert host.evaluate('window.afterimage.getState().phase') == 'lobby'
        click_control(peer, '#ready-button')
        wait(host, 'window.afterimage.getState().phase === "fight"', timeout=12000)
        wait(peer, 'window.afterimage.getState().phase === "fight"')
        before = host.evaluate('window.afterimage.getState().fighters[0].x')
        host.locator('#arena').focus()
        host.keyboard.down('d')
        host.wait_for_timeout(220)
        host.keyboard.up('d')
        wait(host, 'x=>window.afterimage.getState().fighters[0].x>x+15', before)
        wait(peer, 'x=>window.afterimage.getState().fighters[0].x>x+15', before)
        REPORT['cases'].append({'game': 'afterimage', 'native_practice_and_two_ready': True,
                                'copied_presentation_samples': len(views), 'between_tick_fraction': True,
                                'native_multiplayer_input_sync': True})
        log('native-refresh-pass', game='afterimage')
    finally:
        for context in contexts:
            context.close()


def solo_state(page):
    return page.evaluate('window.firesideSolo.getState()')


def blur_resume(page, context):
    other = context.new_page()
    session = context.new_cdp_session(page)
    try:
        other.goto('about:blank')
        other.bring_to_front()
        # Native headless focus controls produce actual browser focus/blur
        # events; no DOM lifecycle event or gameplay state is fabricated.
        session.send('Emulation.setFocusEmulationEnabled', {'enabled': True})
        session.send('Emulation.setFocusEmulationEnabled', {'enabled': False})
        wait(page, 'window.firesideSolo.getState().phase === "paused"')
        paused = solo_state(page)
        page.wait_for_timeout(220)
        assert solo_state(page) == paused, 'Simulation advanced during native browser blur'
        page.bring_to_front()
        assert solo_state(page)['phase'] == 'paused', 'Focus return resumed without explicit input'
        page.locator('#solo-pause').click()
        wait(page, 'window.firesideSolo.getState().phase === "playing"')
    finally:
        session.detach()
        other.close()


def solo_case(browser, game, canvas_name, direction):
    context = browser.new_context(viewport={'width': 1280, 'height': 1100})
    context.add_init_script('(' + PAINT_OBSERVER + ')();')
    page = context.new_page()
    observe(page, game)
    try:
        page.goto(URL + '/solo.html?game=' + game)
        wait(page, 'window.firesideSolo && document.getElementById("solo-app").dataset.phase === "ready"')
        assert solo_state(page) is None
        page.wait_for_timeout(180)
        assert solo_state(page) is None and not page.evaluate('Object.keys(window.__refreshPaint).length')
        page.locator('#solo-start').click()
        wait(page, 'window.firesideSolo.getState()?.phase === "playing"')
        canvas = page.locator('.' + canvas_name)
        canvas.focus()
        before = solo_state(page)
        page.keyboard.down(direction)
        try:
            samples = sample(page, '({state:window.firesideSolo.getState(),timing:window.firesideSolo.getDisplayTiming?.() ?? null})', .65)
        finally:
            page.keyboard.up(direction)
        after = solo_state(page)
        assert after['phase'] == 'playing', (game, after)
        assert after['elapsed'] > before['elapsed'], (game, before, after)
        timing = [item['timing'] for item in samples if item['timing']]
        assert timing, (game, 'Continuous view did not expose copied display diagnostics')
        assert all(0 <= item['lastFraction'] <= 1 for item in timing), timing
        assert any(0 < item['lastFraction'] < 1 for item in timing), (game, timing)
        assert timing[-1]['renderSamples'] > timing[0]['renderSamples'], timing
        assert timing[-1]['physicsSamples'] > timing[0]['physicsSamples'], timing
        assert timing[-1]['interpolatedSamples'] > 0, (game, timing)
        # Pause, native input while paused, and explicit resume must preserve
        # collision/clock state and clear held input/history before the next run.
        page.locator('#solo-pause').click()
        wait(page, 'window.firesideSolo.getState().phase === "paused"')
        paused = solo_state(page)
        assert page.evaluate('window.firesideSolo.getDisplayTiming().lastFraction') == 1, (game, 'Pause retained a fractional display sample')
        canvas.focus()
        page.keyboard.press(direction)
        page.wait_for_timeout(250)
        assert solo_state(page) == paused, (game, 'Paused simulation changed')
        page.locator('#solo-pause').click()
        wait(page, 'window.firesideSolo.getState().phase === "playing"')
        if game == 'paris-pedal':
            blur_resume(page, context)
        page.locator('#solo-restart').click()
        wait(page, 'window.firesideSolo.getState().phase === "playing"')
        reset = solo_state(page)
        assert reset['elapsed'] < .2 and reset.get('level', 0) == 0, (game, reset)
        screenshot(page, 'refresh-' + game)
        REPORT['cases'].append({'game': game, 'native_start_move_pause_resume_restart': True,
                                'native_blur_explicit_resume': game == 'paris-pedal',
                                'timing': timing[-1],
                                'paint_observation': page.evaluate('window.__refreshPaint')})
        log('native-refresh-pass', game=game, timing=timing[-1])
    finally:
        context.close()


def snake_case(browser):
    context = browser.new_context(viewport={'width': 1280, 'height': 1100})
    context.add_init_script('(' + PAINT_OBSERVER + ')();')
    page = context.new_page()
    observe(page, 'snake')
    try:
        page.goto(URL + '/solo.html?game=snake')
        wait(page, 'window.firesideSolo && document.getElementById("solo-app").dataset.phase === "ready"')
        assert solo_state(page) is None
        page.locator('#solo-start').click()
        wait(page, 'window.firesideSolo.getState()?.phase === "playing"')
        page.locator('[data-mode="classic"]').click()
        wait(page, 'window.firesideSolo.getState().mode === "classic"')
        page.locator('.snake-canvas').focus()
        page.keyboard.press('ArrowDown')
        start = page.evaluate('({state:window.firesideSolo.getState(),paint:window.__refreshPaint["snake-canvas"],now:performance.now()})')
        page.wait_for_timeout(630)
        end = page.evaluate('({state:window.firesideSolo.getState(),paint:window.__refreshPaint["snake-canvas"],now:performance.now()})')
        assert end['state']['phase'] == 'playing' and end['state']['ticks'] > start['state']['ticks'], (start, end)
        paints = end['paint']['count'] - start['paint']['count']
        elapsed = (end['now'] - start['now']) / 1000
        paint_rate = paints / elapsed
        grid_steps = end['state']['ticks'] - start['state']['ticks']
        assert paints > grid_steps, ('Canvas did not paint between simulation grid steps', paints, grid_steps)
        frames = [frame for frame in end['paint']['frames'] if start['now'] <= frame['time'] <= end['now'] and frame['phase'] == 'playing']
        assert any(first['ticks'] == second['ticks'] and second['time'] > first['time']
                   for first, second in zip(frames, frames[1:])), ('No naturally painted intermediate grid frame', frames)
        page.locator('.snake-canvas').focus()
        page.keyboard.press('ArrowLeft')
        wait(page, 'window.firesideSolo.getState().direction === "left"')
        page.locator('#solo-pause').click()
        wait(page, 'window.firesideSolo.getState().phase === "paused"')
        before = solo_state(page)
        page.wait_for_timeout(230)
        assert solo_state(page) == before
        page.locator('#solo-pause').click()
        wait(page, 'window.firesideSolo.getState().phase === "playing"')
        page.locator('#solo-restart').click()
        wait(page, 'window.firesideSolo.getState().ticks <= 1')
        screenshot(page, 'refresh-snake')
        REPORT['cases'].append({'game': 'snake', 'native_start_steer_pause_resume_restart': True,
                                'observed_headless_paints_per_second': paint_rate,
                                'observed_paints': paints, 'observation_seconds': elapsed,
                                'simulation_grid_steps': grid_steps,
                                'native_paints_between_unchanged_grid_steps': True,
                                'hardware_refresh_rate_not_verified': True})
        log('native-refresh-pass', game='snake', observed_headless_paints_per_second=paint_rate)
    finally:
        context.close()


def circuit_case(browser):
    context = browser.new_context(viewport={'width': 1280, 'height': 1100})
    context.add_init_script('(' + PAINT_OBSERVER + ')();')
    page = context.new_page()
    observe(page, 'apex-circuit')
    try:
        page.goto(URL + '/solo.html?game=apex-circuit')
        wait(page, 'window.firesideSolo && document.getElementById("solo-app").dataset.phase === "ready"')
        assert solo_state(page) is None
        page.locator('#solo-start').click()
        wait(page, 'window.firesideSolo.getState()?.startDelay === 0')
        initial = solo_state(page)
        page.locator('.circuit-canvas').focus()
        page.keyboard.down('ArrowUp')
        try:
            views = sample(page, '({state:window.firesideSolo.getState(),timing:window.firesideSolo.getDisplayTiming()})', .75)
        finally:
            page.keyboard.up('ArrowUp')
        before = solo_state(page)
        assert before['car']['speed'] > 0 and math.hypot(before['car']['x'] - initial['car']['x'], before['car']['y'] - initial['car']['y']) > 5
        assert views[-1]['timing']['interpolatedSamples'] > 0 and any(0 < item['timing']['lastFraction'] < 1 for item in views)
        page.keyboard.press('q')
        after = solo_state(page)
        assert after['penalty'] == before['penalty'] + 3
        assert 3 <= after['elapsed'] - before['elapsed'] <= 3.2
        assert math.hypot(after['car']['x'] - initial['car']['x'], after['car']['y'] - initial['car']['y']) < .01
        assert after['car']['speed'] == 0
        frames = page.evaluate('window.__refreshPaint["circuit-canvas"].frames')
        reset_frames = [frame for frame in frames if before['elapsed'] + 3 - 1e-7 <= frame['elapsed'] <= after['elapsed'] + 1e-7
                        and frame['timing']['lastFraction'] == 1]
        assert reset_frames, ('Manual reset did not draw the exact reset pose immediately', frames)
        assert all(math.hypot(frame['car']['x'] - initial['car']['x'], frame['car']['y'] - initial['car']['y']) < .01 for frame in reset_frames)
        page.locator('#solo-pause').click()
        wait(page, 'window.firesideSolo.getState().phase === "paused"')
        paused = solo_state(page)
        assert page.evaluate('window.firesideSolo.getDisplayTiming().lastFraction') == 1
        challenge = paused.get('challenge')
        if challenge and challenge['resets'] >= challenge['resetLimit']:
            assert page.locator('[data-action="reset-car"]').is_disabled(), 'Finite Veteran reset allowance was bypassed'
            reset_paused = paused
        else:
            page.locator('[data-action="reset-car"]').click()
            reset_paused = solo_state(page)
            assert reset_paused['phase'] == 'paused' and reset_paused['elapsed'] == paused['elapsed'] + 3
            assert page.evaluate('window.firesideSolo.getDisplayTiming().lastFraction') == 1
        page.wait_for_timeout(160)
        assert solo_state(page) == reset_paused
        page.locator('#solo-pause').click()
        wait(page, 'window.firesideSolo.getState().phase === "playing"')
        screenshot(page, 'refresh-apex-circuit')
        REPORT['cases'].append({'game': 'apex-circuit', 'native_acceleration_interpolation': True,
                                'native_q_reset': True, 'reset_button_respects_finite_allowance': True,
                                'each_reset_penalty_seconds': 3,
                                'manual_reset_immediate_exact_pose_and_fraction_one': True,
                                'timing': views[-1]['timing']})
        log('native-refresh-pass', game='apex-circuit', exact_reset_frame=reset_frames[-1])
    finally:
        context.close()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    REPORT['sources'] = {name: hashlib.sha256((ROOT / 'public' / name).read_bytes()).hexdigest()
                         for name in SOURCES if (ROOT / 'public' / name).exists()}
    selected = set(filter(None, os.environ.get('SEMAG_REFRESH_CASES', '').split(',')))
    if selected and os.environ.get('SEMAG_REFRESH_APPEND') == '1' and (OUT / 'report.json').exists():
        previous = json.loads((OUT / 'report.json').read_text())
        assert previous['sources'] == REPORT['sources'], 'Cannot merge native proof from different presentation sources'
        names = {'breach': 'voxel-breach', 'royale': 'voxel-royale', 'shadow': 'shadow-lantern',
                 'paris': 'paris-pedal', 'skyline': 'skyline-hook', 'circuit': 'apex-circuit'}
        replaced = {names.get(name, name) for name in selected}
        REPORT['cases'] = [case for case in previous['cases'] if case['game'] not in replaced]
        for case in REPORT['cases']:
            presentation = case.get('presentation', {})
            if 'maximum_subtick_displacement' in presentation:
                presentation['maximum_observed_last_display_to_latest_physics_difference'] = presentation.pop('maximum_subtick_displacement')
        REPORT['screenshots'] = previous['screenshots']
        REPORT['errors'] = previous['errors']
        REPORT['failed_resources'] = previous['failed_resources']
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                args=['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader',
                      '--enable-unsafe-swiftshader', '--disable-background-timer-throttling',
                      '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
            try:
                for mode in ('breach', 'royale'):
                    if not selected or mode in selected:
                        voxel_case(browser, mode)
                if not selected or 'afterimage' in selected:
                    afterimage_case(browser)
                for case, game, canvas, key in (('shadow', 'shadow-lantern', 'shadow-canvas', 'ArrowLeft'),
                                                ('paris', 'paris-pedal', 'paris-canvas', 'ArrowLeft'),
                                                ('skyline', 'skyline-hook', 'skyline-canvas', 'ArrowRight')):
                    if not selected or case in selected:
                        solo_case(browser, game, canvas, key)
                if not selected or 'circuit' in selected:
                    circuit_case(browser)
                if not selected or 'snake' in selected:
                    snake_case(browser)
            finally:
                browser.close()
    finally:
        REPORT['errors'] += assets.REPORT['errors']
        REPORT['failed_resources'] += assets.REPORT['failed_resources']
        (OUT / 'report.json').write_text(json.dumps(REPORT, indent=2))
    assert not REPORT['errors'], ('Browser errors', REPORT['errors'])
    assert not REPORT['failed_resources'], ('Failed resources', REPORT['failed_resources'])
    assert all(hashlib.sha256((ROOT / 'public' / name).read_bytes()).hexdigest() == digest
               for name, digest in REPORT['sources'].items()), 'Presentation sources changed during the native proof'
    log('passed', native_cases=len(REPORT['cases']), report=str(OUT / 'report.json'))


if __name__ == '__main__':
    main()
