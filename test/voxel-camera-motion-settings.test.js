import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CAMERA_MOTION_STORAGE_KEY, CAMERA_MOTION_CHOICES, normalizeCameraMotion, cameraMotionStatus, createCameraMotionStore } from '../public/voxel-camera-motion-settings.js';

test('camera preference defaults to the device and admits only the four explicit choices', () => {
  assert.deepEqual(CAMERA_MOTION_CHOICES, ['system', 'normal', 'strong', 'off']); assert.ok(Object.isFrozen(CAMERA_MOTION_CHOICES));
  for (const choice of CAMERA_MOTION_CHOICES) assert.equal(normalizeCameraMotion(choice), choice);
  for (const invalid of [undefined, null, '', 'NORMAL', 'true', '__proto__', 'constructor', ['normal'], new String('normal'), 1]) assert.equal(normalizeCameraMotion(invalid), 'system');
  assert.equal(createCameraMotionStore({ storage: undefined }).get(), 'system');
});

test('saved choice survives a new store without writing or replacing the device default on first read', () => {
  const saved = new Map(), writes = [];
  const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => { writes.push([key, value]); saved.set(key, value); } };
  const first = createCameraMotionStore({ storage }); assert.equal(first.get(), 'system'); assert.deepEqual(writes, []);
  assert.equal(first.set('strong'), 'strong'); assert.deepEqual(writes, [[CAMERA_MOTION_STORAGE_KEY, 'strong']]);
  const reopened = createCameraMotionStore({ storage }); assert.equal(reopened.get(), 'strong'); assert.equal(writes.length, 1);
  first.set('strong'); assert.equal(writes.length, 1, 'selecting the current option neither writes again nor resets a session');
});

test('blocked, absent and corrupt browser storage retain usable safe in-memory choices', () => {
  for (const storage of [null, undefined, { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } }, { getItem() { return '{broken}'; } }]) {
    const store = createCameraMotionStore({ storage }); assert.equal(store.get(), 'system');
    assert.equal(store.set('normal'), 'normal'); assert.equal(store.get(), 'normal');
    assert.equal(store.set('off'), 'off'); assert.equal(store.get(), 'off');
    assert.equal(store.set('corrupt'), 'system'); assert.equal(store.get(), 'system');
  }
});

test('a denied localStorage property getter cannot break the default browser store', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  try {
    const store = createCameraMotionStore();
    assert.equal(store.get(), 'system'); assert.equal(store.set('strong'), 'strong'); assert.equal(store.get(), 'strong');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('setup and pause subscribers receive one preference change and can be cleanly removed', () => {
  const store = createCameraMotionStore({ storage: null }), setup = [], pause = [];
  const removeSetup = store.subscribe((value, previous) => setup.push([value, previous]));
  store.subscribe((value, previous) => pause.push([value, previous]));
  store.set('normal'); store.set('normal'); assert.deepEqual(setup, [['normal', 'system']]); assert.deepEqual(pause, setup);
  removeSetup(); store.set('off'); assert.equal(setup.length, 1); assert.deepEqual(pause[1], ['off', 'normal']);
  store.destroy(); store.set('strong'); assert.equal(pause.length, 2, 'teardown drops all UI subscriptions');
  assert.throws(() => store.subscribe(null), TypeError);
});

test('device suppression is visible and explicit camera choices do not pretend to change the device setting', () => {
  assert.match(cameraMotionStatus('system', true), /Reduced motion is on/);
  assert.match(cameraMotionStatus('system', true), /Normal or Strong.*enables wobble.*aiming stays steady/);
  assert.match(cameraMotionStatus('system', false), /Follows your device preference.*natural/);
  for (const choice of ['normal', 'strong', 'off']) assert.equal(cameraMotionStatus(choice, true), cameraMotionStatus(choice, false));
  assert.match(cameraMotionStatus('normal', true), /Natural/); assert.match(cameraMotionStatus('strong', true), /Stronger/); assert.match(cameraMotionStatus('off', true), /Steady camera/);
  assert.equal(cameraMotionStatus('bad', true), cameraMotionStatus('system', true));
});

test('dojo setup and P pause expose identical accessible controls without adding to equipment or the live HUD', async () => {
  const html = await readFile(new URL('../public/voxel-practice.html', import.meta.url), 'utf8');
  for (const id of ['practice-camera-motion', 'practice-pause-camera-motion']) {
    assert.match(html, new RegExp(`<label for="${id}">Camera wobble</label>`));
    assert.match(html, new RegExp(`<select id="${id}" aria-describedby="${id}-status">`));
    assert.match(html, new RegExp(`<small id="${id}-status" role="status" aria-live="polite">`));
    assert.match(html, new RegExp(`id="${id}-field" hidden>`), 'camera controls wait for the real Dojo mode');
    const select = html.match(new RegExp(`<select id="${id}"[^>]*>([\\s\\S]*?)</select>`))[1];
    assert.deepEqual([...select.matchAll(/<option value="([^"]+)">/g)].map(match => match[1]), CAMERA_MOTION_CHOICES);
  }
  const equipmentEnd = html.indexOf('id="practice-melee-note"'), setupControl = html.indexOf('id="practice-camera-motion-field"');
  assert.ok(equipmentEnd < setupControl && setupControl < html.indexOf('id="practice-start"'));
  const pauseControl = html.indexOf('id="practice-pause-camera-motion-field"');
  assert.ok(html.indexOf('id="practice-pause-card"') < pauseControl && pauseControl < html.indexOf('id="practice-resume"'));
  const liveHud = html.slice(html.indexOf('id="practice-combat"'), html.indexOf('id="practice-overlay"'));
  assert.equal(liveHud.includes('camera-motion'), false);
  const css = await readFile(new URL('../public/voxel-practice.css', import.meta.url), 'utf8');
  assert.match(css, /\.practice-camera-motion\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(css, /\.practice-camera-motion select:focus-visible/);
  assert.match(css, /@media \(max-width: 460px\)/); assert.match(css, /\.practice-camera-motion select \{ min-height: 44px/);
});
