import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer, WORLD } from '../public/voxel-engine.js';
import { createEyeHeightPresenter, VoxelRenderer } from '../public/voxel-renderer.js';

const emptyMap = { id: 'camera-fixture', colliders: [], bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }, sites: [] };
const player = patch => ({ ...createCombatPlayer(0), ...patch });
const near = (actual, expected, message = '') => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} versus ${expected}`);

test('stance height settles smoothly without delaying feet, jumping or changing input state', () => {
  const present = createEyeHeightPresenter(), standing = Object.freeze(player({ x: 2, y: 3, z: 4 }));
  assert.deepEqual(present(standing, emptyMap, 0), [2, 3 + WORLD.eyeHeight, 4]);
  const crouching = Object.freeze({ ...standing, crouching: true, x: 2.2, y: 3.3, z: 4.1 });
  const eye = present(crouching, emptyMap, 1000 / 60);
  assert.equal(eye[0], crouching.x);
  assert.equal(eye[2], crouching.z);
  assert.ok(eye[1] > crouching.y + WORLD.crouchEyeHeight && eye[1] < crouching.y + WORLD.eyeHeight);
  near(eye[1] - crouching.y, WORLD.crouchEyeHeight + (WORLD.eyeHeight - WORLD.crouchEyeHeight) * Math.exp(-(1000 / 60) / 45));
  const jumped = Object.freeze({ ...crouching, y: 3.7 });
  const jumpEye = present(jumped, emptyMap, 1000 / 30);
  near(jumpEye[1] - jumped.y, WORLD.crouchEyeHeight + (WORLD.eyeHeight - WORLD.crouchEyeHeight) * Math.exp(-(1000 / 30) / 45));
  assert.equal(crouching.y, 3.3, 'render stance never writes the physics body');
  assert.equal(crouching.previousInput.crouch, false, 'render stance never rewrites input history');
});

test('60, 120 and 240 Hz crouch and stand transitions agree at equal elapsed time', () => {
  for (const crouching of [true, false]) {
    const heights = [];
    for (const hz of [60, 120, 240]) {
      const present = createEyeHeightPresenter(), start = player({ crouching: !crouching }), end = player({ crouching });
      present(start, emptyMap, 0);
      let eye;
      for (let frame = 1; frame <= hz / 10; frame++) eye = present(end, emptyMap, frame * 1000 / hz);
      heights.push(eye[1]);
      assert.ok(eye[1] > WORLD.crouchEyeHeight && eye[1] < WORLD.eyeHeight);
    }
    near(heights[0], heights[1], '60/120 Hz');
    near(heights[0], heights[2], '60/240 Hz');
  }
});

test('eye transition is monotonic, bounded and stable through same-time redraws', () => {
  const present = createEyeHeightPresenter(), standing = player(), crouching = player({ crouching: true });
  let previous = present(standing, emptyMap, 0)[1];
  for (let time = 4; time <= 400; time += 4) {
    const eye = present(crouching, emptyMap, time);
    assert.ok(eye[1] <= previous && eye[1] >= WORLD.crouchEyeHeight);
    assert.deepEqual(present(crouching, emptyMap, time), eye, 'a UI redraw does not restart or snap the animation');
    previous = eye[1];
  }
  assert.ok(previous - WORLD.crouchEyeHeight < .0001);
});

test('a low roof and its padded edge stop descending stance eye before solid cover', () => {
  const ceiling = { x: -.5, y: 1.3, z: -.5, w: 1, h: .1, d: 1 };
  const map = { ...emptyMap, colliders: [ceiling] };
  for (const x of [0, -.535, .535]) {
    const present = createEyeHeightPresenter();
    present(player({ x }), emptyMap, 0);
    // Map changes reset, so establish this map while standing before crouching.
    present(player({ x }), map, 1);
    const eye = present(player({ x, crouching: true }), map, 2);
    assert.ok(eye[1] <= ceiling.y - .04 - .005 + 1e-9, `conservative roof edge at x=${x}`);
    assert.ok(eye[1] >= WORLD.crouchEyeHeight);
  }
});

test('upward stance smoothing cannot cross the underside of a platform into an older low eye', () => {
  const deck = { x: -.5, y: 1.15, z: -.5, w: 1, h: .1, d: 1 };
  const map = { ...emptyMap, colliders: [deck] }, present = createEyeHeightPresenter();
  present(player({ crouching: true }), map, 0);
  const eye = present(player(), map, 1);
  assert.ok(eye[1] >= deck.y + deck.h + .04 + .005 - 1e-9);
  assert.ok(eye[1] <= WORLD.eyeHeight);
});

test('eye resumes from the real pose for spectators, death, life/round context, gaps and teleports', () => {
  const scenarios = [
    ['spectator switch', player({ id: 1, crouching: true }), emptyMap, 18, undefined],
    ['death', player({ crouching: true, alive: false }), emptyMap, 18, undefined],
    ['map', player({ crouching: true }), { ...emptyMap }, 18, undefined],
    ['round', player({ crouching: true }), emptyMap, 18, 'round-2'],
    ['teleport', player({ crouching: true, x: 3 }), emptyMap, 18, undefined],
    ['frame reversal', player({ crouching: true }), emptyMap, 7, undefined],
    ['suspended tab', player({ crouching: true }), emptyMap, 200, undefined],
  ];
  for (const [label, changed, map, time, context] of scenarios) {
    const present = createEyeHeightPresenter();
    present(player(), emptyMap, 0);
    assert.ok(present(player({ crouching: true }), emptyMap, 16)[1] > WORLD.crouchEyeHeight);
    assert.deepEqual(present(changed, map, time, context), [changed.x, changed.y + WORLD.crouchEyeHeight, changed.z], label);
  }
  const present = createEyeHeightPresenter();
  present(player({ alive: false, crouching: true }), emptyMap, 0);
  assert.equal(present(player(), emptyMap, 16)[1], WORLD.eyeHeight, 'new life resets immediately');
  present(player({ crouching: true }), emptyMap, 32);
  present.reset();
  assert.equal(present(player({ crouching: true }), emptyMap, 48)[1], WORLD.crouchEyeHeight, 'renderer round/context reset clears stance lag');
});

test('invalid coordinates or frame timestamps fall back to finite raw eye without stale stance', () => {
  const present = createEyeHeightPresenter();
  present(player(), emptyMap, 0);
  for (const patch of [{ x: NaN }, { y: Infinity }, { z: undefined }]) {
    const eye = present(player({ crouching: true, ...patch }), emptyMap, 16);
    assert.ok(eye.every(Number.isFinite));
    near(eye[1], WORLD.crouchEyeHeight);
  }
  assert.deepEqual(present(player({ crouching: true }), emptyMap, NaN), [0, WORLD.crouchEyeHeight, 0]);
});

function renderHarness(initialRect = { width: 960, height: 540 }) {
  const worldEyes = [], events = new Map(), bounds = { ...initialRect }, viewports = [];
  let layoutReads = 0;
  const gl = new Proxy({}, { get(_, name) {
    if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
    if (name === 'getAttribLocation') return () => 0;
    if (name === 'getUniformLocation') return (_program, uniform) => uniform;
    if (name === 'uniform3fv') return (uniform, value) => { if (uniform === 'uEye' && value[1] > 0) worldEyes.push([...value]); };
    if (name === 'viewport') return (...values) => viewports.push(values);
    if (typeof name === 'string' && name.startsWith('create')) return () => ({});
    return () => {};
  } });
  const canvas = { width: 960, height: 540, getContext: () => gl,
    addEventListener(type, callback) { events.set(type, callback); }, removeEventListener(type) { events.delete(type); },
    dispatchEvent() {},
    getBoundingClientRect() { layoutReads++; return { ...bounds }; } };
  const renderer = new VoxelRenderer(canvas), modelEyes = [];
  renderer._viewModel = (...args) => { modelEyes.push(args[6]); return new Float32Array(); };
  return { renderer, canvas, worldEyes, modelEyes, events, bounds, viewports, get layoutReads() { return layoutReads; } };
}

test('the actual camera and first-person cover ray share the same smoothed eye, including round resets', () => {
  const { renderer, worldEyes, modelEyes } = renderHarness();
  const state = { gameId: 'voxel-breach', map: emptyMap, phase: 'fight', round: 1, tick: 0, players: [player()], events: [] };
  renderer.render(state, { localId: 0, time: 1000 });
  state.players[0].crouching = true;
  renderer.render(state, { localId: 0, time: 1016 });
  assert.ok(worldEyes.at(-1)[1] > WORLD.crouchEyeHeight);
  assert.deepEqual(modelEyes.at(-1), worldEyes.at(-1), 'cover clipping uses the exact rendered camera eye');
  state.round++;
  renderer.render(state, { localId: 0, time: 1032 });
  assert.equal(worldEyes.at(-1)[1], WORLD.crouchEyeHeight);
  assert.deepEqual(modelEyes.at(-1), worldEyes.at(-1));
  renderer.destroy();
});

test('restoring a lost graphics context starts from the actual eye rather than stale stance animation', () => {
  const { renderer, worldEyes, events } = renderHarness();
  const state = { gameId: 'voxel-breach', map: emptyMap, phase: 'fight', round: 1, tick: 0, players: [player()], events: [] };
  renderer.render(state, { localId: 0, time: 1000 });
  state.players[0].crouching = true;
  renderer.render(state, { localId: 0, time: 1016 });
  assert.ok(worldEyes.at(-1)[1] > WORLD.crouchEyeHeight);
  events.get('webglcontextlost')({ preventDefault() {} });
  assert.equal(renderer.render(state, { localId: 0, time: 1024 }), false);
  events.get('webglcontextrestored')();
  assert.equal(renderer.render(state, { localId: 0, time: 1032 }), true);
  assert.equal(worldEyes.at(-1)[1], WORLD.crouchEyeHeight);
  renderer.destroy();
  assert.equal(events.size, 0, 'renderer teardown removes both graphics lifecycle handlers');
});

test('first-person clipping observes explicit low camera height rather than recomputing the standing eye', () => {
  const actor = player(), cover = { ...emptyMap, colliders: [{ x: -.7, y: 0, z: -.85, w: 1.4, h: 1.05, d: .5 }] };
  const model = eye => VoxelRenderer.prototype._viewModel.call({ lastAim: null, swayX: 0, swayY: 0, localShot: null }, actor, 0, 0, 1000, false, cover, eye);
  const standing = model([0, WORLD.eyeHeight, 0]), low = model([0, 1.1, 0]);
  assert.ok(standing.length > low.length, 'held geometry is clipped against the cover seen by the transitioning eye');
  assert.ok(low.every(Number.isFinite));
});

test('steady renderer frames avoid layout reads while explicit resize updates aspect and drawing buffer', () => {
  const fixture = renderHarness({ width: 1000, height: 400 });
  const { renderer, canvas, bounds, viewports } = fixture;
  const state = { gameId: 'voxel-breach', map: emptyMap, phase: 'fight', round: 1, tick: 0, players: [player()], events: [] };
  assert.equal(fixture.layoutReads, 1, 'initial drawing buffer is measured once');
  assert.equal(renderer.aspect, 2.5);
  assert.equal(canvas.width, 1000);
  assert.equal(canvas.height, 400);
  for (let frame = 0; frame < 12; frame++) renderer.render(state, { localId: 0, time: 1000 + frame * 1000 / 240 });
  assert.equal(fixture.layoutReads, 1, 'HUD updates cannot force a canvas measurement on every display frame');
  Object.assign(bounds, { width: 1200, height: 800 });
  renderer.resize();
  assert.equal(fixture.layoutReads, 2);
  assert.equal(renderer.aspect, 1.5);
  assert.equal(canvas.width, 1200);
  assert.equal(canvas.height, 800);
  assert.deepEqual(viewports.at(-1), [0, 0, 1200, 800]);
  renderer.destroy();
});

test('observer size updates avoid forced layout and its callback stops after teardown, including context loss', () => {
  const originalObserver = globalThis.ResizeObserver, observers = [];
  globalThis.ResizeObserver = class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
  };
  try {
    const fixture = renderHarness(), { renderer, canvas, bounds, events } = fixture, observer = observers.at(-1);
    assert.equal(observer.target, canvas);
    Object.assign(bounds, { width: 900, height: 600 });
    observer.callback([{ target: {}, contentRect: { width: 1, height: 1 } }, { target: canvas, contentRect: { ...bounds } }]);
    assert.equal(fixture.layoutReads, 1, 'observer provides dimensions without getBoundingClientRect');
    assert.equal(renderer.aspect, 1.5);
    assert.equal(canvas.width, 900);
    assert.equal(canvas.height, 600);
    events.get('webglcontextlost')({ preventDefault() {} });
    Object.assign(bounds, { width: 700, height: 500 });
    observer.callback([{ target: canvas, contentRect: { ...bounds } }]);
    assert.equal(canvas.width, 900, 'an interrupted context defers size changes until restoration');
    events.get('webglcontextrestored')();
    assert.equal(renderer.available, true);
    assert.equal(renderer.aspect, 1.4);
    assert.equal(canvas.width, 700);
    assert.equal(canvas.height, 500);
    assert.equal(fixture.layoutReads, 2, 'restoration measures the current size once');
    events.get('webglcontextlost')({ preventDefault() {} });
    renderer.destroy();
    assert.equal(observer.disconnected, true, 'destroy during context loss still disconnects observation');
    observer.callback([{ target: canvas, contentRect: { width: 300, height: 300 } }]);
    assert.equal(canvas.width, 700, 'queued callbacks cannot mutate a destroyed renderer');
    assert.equal(fixture.layoutReads, 2);
    assert.equal(events.size, 0);
  } finally {
    if (originalObserver === undefined) delete globalThis.ResizeObserver;
    else globalThis.ResizeObserver = originalObserver;
  }
});

test('window and fullscreen listeners update sizing and are removed on renderer teardown', () => {
  const originalWindow = globalThis.window, originalDocument = globalThis.document;
  const windowEvents = new Map(), documentEvents = new Map();
  const target = events => ({ addEventListener(type, callback) { events.set(type, callback); }, removeEventListener(type) { events.delete(type); } });
  globalThis.window = target(windowEvents);
  globalThis.document = target(documentEvents);
  try {
    const fixture = renderHarness(), { renderer, canvas, bounds } = fixture;
    Object.assign(bounds, { width: 1600, height: 900 });
    windowEvents.get('resize')();
    assert.equal(canvas.width, 1600);
    assert.equal(canvas.height, 900);
    Object.assign(bounds, { width: 1000, height: 700 });
    documentEvents.get('fullscreenchange')();
    assert.equal(canvas.width, 1000);
    assert.equal(canvas.height, 700);
    near(renderer.aspect, 10 / 7);
    assert.equal(fixture.layoutReads, 3);
    renderer.destroy();
    assert.equal(windowEvents.size, 0);
    assert.equal(documentEvents.size, 0);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test('retina and large fullscreen sizes keep their CSS aspect within a bounded drawing buffer', () => {
  const originalRatio = globalThis.devicePixelRatio;
  globalThis.devicePixelRatio = 3;
  try {
    const fixture = renderHarness({ width: 3840, height: 2160 }), { renderer, canvas } = fixture;
    near(renderer.aspect, 16 / 9);
    assert.ok(canvas.width < 3840 && canvas.height < 2160, 'a high resolution screen retains the existing fixed pixel budget');
    assert.ok(canvas.width * canvas.height <= 2205000, 'rounding cannot materially exceed the 2.2M pixel budget');
    assert.ok(canvas.width > 1000 && canvas.height > 600, 'fullscreen retains useful resolution');
    renderer.destroy();
  } finally {
    if (originalRatio === undefined) delete globalThis.devicePixelRatio;
    else globalThis.devicePixelRatio = originalRatio;
  }
});
