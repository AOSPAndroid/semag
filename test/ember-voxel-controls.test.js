import test from 'node:test';
import assert from 'node:assert/strict';
import { mount, emberCameraInput, emberLook, emberControl } from '../public/solo/ember-view.js';
import { createState, step, togglePause } from '../public/solo/ember-engine.js';
import { createBestStore, recordDetails } from '../public/solo/solo.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('Ember movement follows every camera quadrant without a faster diagonal or reversed strafe', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 1.17]) {
    const forward = emberCameraInput({ up: true }, null, yaw);
    near(forward.moveX, Math.sin(yaw)); near(forward.moveY, -Math.cos(yaw));
    const right = emberCameraInput({ right: true }, null, yaw);
    near(right.moveX, Math.cos(yaw)); near(right.moveY, Math.sin(yaw));
    near(forward.moveX * right.moveX + forward.moveY * right.moveY, 0);
    const diagonal = emberCameraInput({ up: true, right: true }, null, yaw);
    near(Math.hypot(diagonal.moveX, diagonal.moveY), 1);
    const neutral = emberCameraInput({ up: true, down: true, left: true, right: true }, null, yaw);
    near(Math.hypot(neutral.moveX, neutral.moveY), 0);
  }
});

test('touch movement has a dead zone and shares the camera orientation and action buttons', () => {
  const yaw = Math.PI / 2;
  const centered = emberCameraInput({ right: true }, { x: .08, y: -.08 }, yaw);
  near(centered.moveX, 0); near(centered.moveY, 1);
  const stick = emberCameraInput({ left: true, melee: true, spell: true, dash: true, interact: true, sprint: true, crouch: true, walk: true }, { x: 0, y: -1 }, yaw);
  near(stick.moveX, 1); near(stick.moveY, 0);
  assert.equal(stick.melee, true); assert.equal(stick.spell, true); assert.equal(stick.dash, true); assert.equal(stick.interact, true);
  assert.equal(stick.sprint, true); assert.equal(stick.crouch, true); assert.equal(stick.walk, true);
  const tooFar = emberCameraInput({}, { x: 1, y: -1 }, yaw);
  near(Math.hypot(tooFar.moveX, tooFar.moveY), 1);
});

test('native printed AZERTY keys, arrows and keyboard-only turn retain nearby combat controls', () => {
  for (const [key, code, action] of [['z', 'KeyW', 'up'], ['q', 'KeyA', 'left'], ['s', 'KeyS', 'down'], ['d', 'KeyD', 'right'], ['Z', 'KeyW', 'up']])
    assert.equal(emberControl({ key, code }, 'zqsd'), action);
  for (const [key, action] of [['w', 'up'], ['a', 'left'], ['ArrowRight', 'right'], ['Shift', 'sprint'], ['Control', 'crouch'], [' ', 'dash'], ['c', 'walk'], ['j', 'melee'], ['e', 'spell'], ['f', 'interact'], [',', 'turnLeft'], ['.', 'turnRight']])
    assert.equal(emberControl({ key }, 'wasd'), action);
  assert.equal(emberControl({ key: 'w', repeat: true }, 'wasd'), 'up', 'a held movement key is not dropped when the browser repeats it');
  for (const event of [{ key: 'p' }, { key: 'r' }, { key: 'Escape' }, { key: 'w', ctrlKey: true }, { key: 'e', metaKey: true }, { key: 'f', isComposing: true }, { key: 'w', defaultPrevented: true }, { key: 'f', target: { closest: () => ({}) } }])
    assert.equal(emberControl(event, 'wasd'), null, 'session keys, text entry and browser shortcuts never become attacks');
});

test('captured Ctrl stance permits movement and combat chords while outside browser shortcuts remain protected', () => {
  const captured = { captured: true, crouchHeld: true };
  assert.equal(emberControl({ key: 'Control', ctrlKey: true }), 'crouch');
  for (const [key, action] of [['w', 'up'], ['c', 'walk'], ['j', 'melee'], ['e', 'spell'], [' ', 'dash']]) {
    const event = { key, ctrlKey: true };
    assert.equal(emberControl(event, 'wasd', captured), action);
    assert.equal(emberControl(event, 'wasd'), null);
    assert.equal(emberControl(event, 'wasd', { captured: true, crouchHeld: false }), null);
    assert.equal(emberControl(event, 'wasd', { captured: false, crouchHeld: true }), null);
  }
  assert.equal(emberControl({ key: 'z', code: 'KeyW', ctrlKey: true }, 'zqsd', captured), 'up');
  for (const extra of [{ altKey: true }, { metaKey: true }, { isComposing: true }, { defaultPrevented: true }, { target: { closest: () => ({}) } }])
    assert.equal(emberControl({ key: 'w', ctrlKey: true, ...extra }, 'wasd', captured), null);
});

test('mouse look updates the camera immediately and keeps it above the ground without mutating physics', () => {
  const state = createState({ seed: 1729, difficulty: 'veteran' }), before = structuredClone(state);
  const camera = { yaw: Math.PI / 2, pitch: .32 }, original = { ...camera };
  const moved = emberLook(camera, 100, 60);
  near(moved.yaw, camera.yaw + .25); near(moved.pitch, camera.pitch + .15);
  assert.deepEqual(camera, original); assert.deepEqual(state, before);
  assert.equal(emberLook(camera, 0, -9000).pitch, .12);
  assert.equal(emberLook(camera, 0, 9000).pitch, 1.05);
  assert.deepEqual(emberLook(camera, NaN, Infinity), camera);
});

test('camera-space movement and nearby actions reach the actual fixed-step engine; paused steps stay frozen', () => {
  const state = createState({ seed: 1729, difficulty: 'veteran' });
  const x = state.player.x, y = state.player.y;
  for (let tick = 0; tick < 12; tick++) step(state, emberCameraInput({ up: true }, null, Math.PI / 2));
  assert.ok(state.player.x > x); near(state.player.y, y);
  step(state, emberCameraInput({ melee: true }, null, Math.PI / 2));
  assert.ok(state.player.attackTime > 0); assert.ok(state.events.some(event => event.type === 'swing'));
  step(state, emberCameraInput({ spell: true }, null, Math.PI / 2));
  assert.ok(state.projectiles.some(projectile => projectile.owner === 'player' && projectile.vx > 0));
  step(state, emberCameraInput({ dash: true, up: true }, null, Math.PI / 2));
  assert.ok(state.player.dashTime > 0); assert.ok(state.player.dashX > .99);
  togglePause(state); const paused = structuredClone(state);
  for (let tick = 0; tick < 12; tick++) step(state, emberCameraInput({ up: true, melee: true, spell: true }, null, 0));
  assert.deepEqual(state, paused);
});

test('third-person records preserve earlier top-down scores and separate all three difficulties', () => {
  const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  let store = createBestStore(storage);
  store.update('ember-delve', 1200); store.update('ember-delve', 900, { scope: 'veteran-v3' });
  for (const [index, difficulty] of ['standard', 'veteran', 'nightmare'].entries()) {
    const recordKey = `${difficulty}-thirdperson-v2`;
    const policy = recordDetails('ember-delve', { phase: 'lost', recordKey, record: 200 + index });
    assert.equal(policy.scope, recordKey); assert.equal(policy.candidate, 200 + index);
    store.update('ember-delve', policy.candidate, policy);
  }
  store = createBestStore(storage);
  assert.equal(store.read('ember-delve'), 1200); assert.equal(store.read('ember-delve', 'veteran-v3'), 900);
  for (const [index, difficulty] of ['standard', 'veteran', 'nightmare'].entries()) assert.equal(store.read('ember-delve', `${difficulty}-thirdperson-v2`), 200 + index);
  const unknown = recordDetails('ember-delve', { phase: 'won', recordKey: 'veteran-thirdperson-v3', record: 99999 });
  assert.equal(unknown.candidate, null);
  assert.equal(recordDetails('deckbound', { phase: 'won', recordKey: 'veteran-thirdperson-v1', record: 99999 }).candidate, null);
});

// Isolated unit DOM/GL fixtures run the mounted view's real engine and event
// handlers. They do not install any browser hooks or modify gameplay state.
function mountedFixture() {
  const saved = new Map(), frames = new Map(), buffers = new Set(); let frameId = 0, bufferId = 0;
  const gl = new Proxy({
    createShader: () => ({}), createProgram: () => ({}), getShaderParameter: () => true, getProgramParameter: () => true,
    getAttribLocation: () => 0, getUniformLocation: () => ({}),
    createBuffer: () => { const buffer = { id: ++bufferId }; buffers.add(buffer); return buffer; }, deleteBuffer: buffer => buffers.delete(buffer),
  }, { get: (target, key) => target[key] ?? (() => {}) });
  class Node {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.className = ''; this.children = []; this.listeners = new Map(); this.dataset = {}; this.style = {}; this.attrs = {}; this.width = 960; this.height = 540; this.hidden = false; }
    append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
    insertBefore(child, reference) { child.parent = this; this.children.splice(this.children.indexOf(reference), 0, child); }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    closest(selector) { return selector.split(',').some(value => value.trim() === this.tagName.toLowerCase()) ? this : this.parent?.closest(selector) || null; }
    querySelector(selector) { for (const child of this.children) { if (child.tagName.toLowerCase() === selector || selector.startsWith('.') && child.className.split(' ').includes(selector.slice(1))) return child; const found = child.querySelector(selector); if (found) return found; } return null; }
    addEventListener(type, handler) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(handler); }
    removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
    emit(type, values = {}) { const event = { target: this, preventDefault() { this.defaultPrevented = true; }, ...values }; for (const handler of this.listeners.get(type) || []) handler(event); }
    focus() { document.activeElement = this; }
    getBoundingClientRect() { return { left: 0, top: 0, width: this.className.includes('stick') ? 74 : 960, height: this.className.includes('stick') ? 74 : 540 }; }
    getContext() { return gl; }
    setPointerCapture() {}
    requestPointerLock() { document.pointerLockElement = this; document.emit('pointerlockchange'); }
  }
  const documentNode = new Node('document'), windowNode = new Node('window'), motion = new Node('media');
  motion.matches = false; windowNode.matchMedia = () => motion;
  documentNode.createElement = tag => new Node(tag); documentNode.createTextNode = value => { const node = new Node('text'); node.textContent = value; return node; };
  documentNode.exitPointerLock = () => { documentNode.pointerLockElement = null; documentNode.emit('pointerlockchange'); };
  const values = {
    document: documentNode, window: windowNode, Element: Node,
    ResizeObserver: class { constructor(callback) { this.callback = callback; } observe() { this.callback(); } disconnect() {} },
    requestAnimationFrame: callback => { const id = ++frameId; frames.set(id, callback); return id; }, cancelAnimationFrame: id => frames.delete(id),
  };
  for (const [key, value] of Object.entries(values)) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); }
  return {
    container: new Node('main'), document: documentNode, window: windowNode, buffers, frames,
    key(key, repeat = false, down = true, extra = {}) { windowNode.emit(down ? 'keydown' : 'keyup', { key, code: key.length === 1 ? `Key${key.toUpperCase()}` : `${key}Left`, repeat, target: this.container, ...extra }); },
    frame(time) { const due = [...frames.values()]; frames.clear(); for (const callback of due) callback(time); },
    cleanup() { for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } },
  };
}

test('mounted pause clears held inputs, ignores stale repeats and releases capture before resume', () => {
  const env = mountedFixture(); let game;
  try {
    game = mount(env.container); const canvas = env.container.querySelector('canvas'), initialX = game.getState().player.x;
    env.frame(0); env.key('w'); env.frame(50); const moved = game.getState(); assert.ok(moved.player.x > initialX);
    canvas.requestPointerLock(); assert.equal(game.getPresentationDiagnostics().mouseLocked, true);
    game.togglePause(); const paused = game.getState(); assert.equal(paused.phase, 'paused'); assert.equal(env.document.pointerLockElement, null);
    env.frame(2000); assert.deepEqual(game.getState(), paused); assert.equal(env.frames.size, 0);
    game.togglePause(); env.frame(2010); env.key('w', true); env.frame(2060);
    assert.equal(game.getState().player.x, paused.player.x, 'the physical key must be released and pressed again after a pause');
    env.key('w', false, false); env.key('w'); env.frame(2110); assert.ok(game.getState().player.x > paused.player.x);
    game.destroy(); game = null; assert.equal(env.frames.size, 0); assert.equal(env.buffers.size, 0);
    assert.equal([...env.window.listeners.values()].reduce((n, listeners) => n + listeners.size, 0), 0);
    assert.equal([...env.document.listeners.values()].reduce((n, listeners) => n + listeners.size, 0), 0);
  } finally { game?.destroy(); env.cleanup(); }
});

test('mounted stance controls reach simulation and HUD, release on pause and require a fresh press', () => {
  const env = mountedFixture(); let game;
  try {
    game = mount(env.container); const canvas = env.container.querySelector('canvas'), stance = env.container.querySelector('.ember-stance');
    env.frame(0); env.key('w'); env.key('Shift'); env.frame(50);
    let snapshot = game.getState(); assert.equal(snapshot.player.sprinting, true); assert.ok(snapshot.player.stamina < snapshot.player.maxStamina);
    assert.match(stance.textContent, /SPRINTING/); assert.equal(snapshot.player.dashTime, 0, 'Shift does not dodge');
    canvas.requestPointerLock(); env.key('Control', false, true, { ctrlKey: true }); env.key('w', false, true, { ctrlKey: true }); env.frame(100);
    snapshot = game.getState(); assert.equal(snapshot.player.crouching, true); assert.equal(snapshot.player.sprinting, false);
    assert.match(stance.textContent, /CROUCHED/); assert.ok(game.getPresentationDiagnostics().camera.crouchAmount > 0);
    env.key('Control', false, false); env.key('w', false, false); env.key('c'); env.key('w'); env.frame(150);
    snapshot = game.getState(); assert.equal(snapshot.player.walking, true); assert.equal(snapshot.player.crouching, false); assert.equal(snapshot.player.attackTime, 0);
    assert.match(stance.textContent, /QUIET WALK/);
    game.togglePause(); const paused = game.getState(); assert.equal(paused.phase, 'paused'); assert.equal(env.document.pointerLockElement, null);
    game.togglePause(); env.frame(200); env.key('c', true); env.key('w', true); env.key('Shift', true); env.frame(250);
    snapshot = game.getState(); assert.equal(snapshot.player.walking, false); assert.equal(snapshot.player.sprinting, false); assert.equal(snapshot.player.crouching, false);
    assert.equal(snapshot.player.x, paused.player.x); assert.equal(snapshot.player.y, paused.player.y);
    env.key('c', false, false); env.key('j'); env.frame(300); assert.ok(game.getState().events.some(event => event.type === 'swing'));
  } finally { game?.destroy(); env.cleanup(); }
});

test('a real mounted graphics loss stops combat immediately and cannot be resumed behind a blank canvas', () => {
  const env = mountedFixture(); let game;
  try {
    game = mount(env.container); env.frame(0); env.key('w'); env.frame(50);
    const before = game.getState(); env.container.querySelector('canvas').emit('webglcontextlost');
    const paused = game.getState(); assert.equal(paused.phase, 'paused'); assert.equal(paused.elapsed, before.elapsed); assert.equal(env.frames.size, 0);
    assert.equal(game.getPresentationDiagnostics().graphicsFailed, true);
    const overlay = env.container.querySelector('.ember-overlay'); assert.equal(overlay.hidden, false);
    assert.match(overlay.querySelector('p').textContent, /Return to the hub/);
    assert.equal(overlay.querySelector('.ember-return').hidden, false);
    game.togglePause(); game.restart(); env.key('e'); env.frame(6000); assert.deepEqual(game.getState(), paused);
    game.destroy(); game = null; assert.equal(env.buffers.size, 0); assert.equal(env.frames.size, 0);
  } finally { game?.destroy(); env.cleanup(); }
});

test('captured P pauses even while crouching, swallows only its repeat, and releases movement/capture', () => {
  const env = mountedFixture(); let game;
  try {
    game = mount(env.container); const canvas = env.container.querySelector('canvas');
    env.frame(0); canvas.requestPointerLock(); env.key('Control', false, true, { ctrlKey: true }); env.key('w', false, true, { ctrlKey: true }); env.frame(50);
    assert.equal(game.getState().player.crouching, true);
    env.key('p', false, true, { ctrlKey: true }); const paused = game.getState();
    assert.equal(paused.phase, 'paused'); assert.equal(paused.player.crouching, false); assert.equal(env.document.pointerLockElement, null);
    env.key('p', true, true, { ctrlKey: true }); env.frame(300); assert.deepEqual(game.getState(), paused);
    env.key('p', false, false, { ctrlKey: true }); env.key('Control', false, false); game.togglePause(); env.frame(350); env.frame(400);
    assert.equal(game.getState().player.x, paused.player.x); assert.equal(game.getState().player.crouching, false);
    env.key('p', false, true, { ctrlKey: true }); assert.equal(game.getState().phase, 'playing', 'outside capture Ctrl+P remains a browser shortcut');
  } finally { game?.destroy(); env.cleanup(); }
});
