import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CAMERA_MOTION_STORAGE_KEY, CAMERA_MOTION_CHOICES, DEFAULT_CAMERA_MOTION, normalizeCameraMotion, cameraMotionStatus, createCameraMotionStore } from '../public/voxel-camera-motion-settings.js';
import { mountCameraMotionControls } from '../public/voxel-camera-motion-ui.js';

test('camera preference starts with strong sway and admits all four explicit choices', () => {
  assert.deepEqual(CAMERA_MOTION_CHOICES, ['system', 'normal', 'strong', 'off']); assert.ok(Object.isFrozen(CAMERA_MOTION_CHOICES));
  assert.equal(DEFAULT_CAMERA_MOTION, 'strong');
  for (const choice of CAMERA_MOTION_CHOICES) assert.equal(normalizeCameraMotion(choice), choice);
  for (const invalid of [undefined, null, '', 'NORMAL', 'true', '__proto__', 'constructor', ['normal'], new String('normal'), 1]) assert.equal(normalizeCameraMotion(invalid), 'strong');
  assert.equal(createCameraMotionStore({ storage: null }).get(), 'strong');
});

test('saved choice survives a new mode without writing or replacing existing explicit preferences on first read', () => {
  const saved = new Map(), writes = [];
  const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => { writes.push([key, value]); saved.set(key, value); } };
  const first = createCameraMotionStore({ storage }); assert.equal(first.get(), 'strong'); assert.deepEqual(writes, []);
  assert.equal(first.set('normal'), 'normal'); assert.deepEqual(writes, [[CAMERA_MOTION_STORAGE_KEY, 'normal']]);
  const reopened = createCameraMotionStore({ storage }); assert.equal(reopened.get(), 'normal'); assert.equal(writes.length, 1);
  first.set('normal'); assert.equal(writes.length, 1, 'selecting the current option neither writes again nor resets a session');
  for (const choice of CAMERA_MOTION_CHOICES) {
    saved.set(CAMERA_MOTION_STORAGE_KEY, choice);
    assert.equal(createCameraMotionStore({ storage }).get(), choice, 'new modes keep an explicit System or Off choice');
  }
  assert.equal(writes.length, 1, 'opening modes never overwrites the shared preference');
});

test('blocked, absent and corrupt browser storage retain usable safe in-memory choices', () => {
  for (const storage of [null, undefined, { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } }, { getItem() { return '{broken}'; } }]) {
    const store = createCameraMotionStore({ storage }); assert.equal(store.get(), 'strong');
    assert.equal(store.set('strong'), 'strong'); assert.equal(store.get(), 'strong');
    assert.equal(store.set('off'), 'off'); assert.equal(store.get(), 'off');
    assert.equal(store.set('corrupt'), 'strong'); assert.equal(store.get(), 'strong');
  }
});

test('a denied localStorage property getter cannot break the default browser store', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  try {
    const store = createCameraMotionStore();
    assert.equal(store.get(), 'strong'); assert.equal(store.set('strong'), 'strong'); assert.equal(store.get(), 'strong');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('setup and pause subscribers receive one preference change and can be cleanly removed', () => {
  const store = createCameraMotionStore({ storage: null }), setup = [], pause = [];
  const removeSetup = store.subscribe((value, previous) => setup.push([value, previous]));
  store.subscribe((value, previous) => pause.push([value, previous]));
  store.set('normal'); store.set('normal'); assert.deepEqual(setup, [['normal', 'strong']]); assert.deepEqual(pause, setup);
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
  assert.equal(cameraMotionStatus('bad', true), cameraMotionStatus('strong', true));
});

test('FPS practice setup and P pause expose identical accessible controls without adding to equipment or the live HUD', async () => {
  const html = await readFile(new URL('../public/voxel-practice.html', import.meta.url), 'utf8');
  for (const id of ['practice-camera-motion', 'practice-pause-camera-motion']) {
    assert.match(html, new RegExp(`<label for="${id}">Camera wobble</label>`));
    assert.match(html, new RegExp(`<select id="${id}" aria-describedby="${id}-status">`));
    assert.match(html, new RegExp(`<small id="${id}-status" role="status" aria-live="polite">`));
    assert.match(html, new RegExp(`id="${id}-field" hidden>`), 'camera controls wait for client initialization');
    const select = html.match(new RegExp(`<select id="${id}"[^>]*>([\\s\\S]*?)</select>`))[1];
    assert.match(select, /<option value="strong" selected>Strong<\/option>/);
    assert.deepEqual([...select.matchAll(/<option value="([^"]+)"(?: selected)?>/g)].map(match => match[1]), CAMERA_MOTION_CHOICES);
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

function controlsFixture() {
  const statuses = new Map([['setup-status', { textContent: '' }], ['pause-status', { textContent: '' }]]);
  const selects = ['setup-status', 'pause-status'].map(id => {
    const select = new EventTarget();
    select.value = ''; select.getAttribute = name => name === 'aria-describedby' ? id : null;
    return select;
  });
  const media = new EventTarget(); media.matches = false;
  const root = { querySelectorAll: selector => selector === '[data-camera-motion]' ? selects : [], getElementById: id => statuses.get(id) };
  return { root, selects, statuses, media };
}

test('native setup and pause changes share one choice and follow actual device changes without changing the saved value', () => {
  const fixture = controlsFixture(), store = createCameraMotionStore({ storage: null });
  const controls = mountCameraMotionControls(fixture.root, { store, reducedMotion: fixture.media });
  try {
    assert.deepEqual(fixture.selects.map(select => select.value), ['strong', 'strong']);
    fixture.selects[0].value = 'strong'; fixture.selects[0].dispatchEvent(new Event('change'));
    assert.equal(store.get(), 'strong'); assert.equal(fixture.selects[1].value, 'strong');
    assert.match(fixture.statuses.get('pause-status').textContent, /Stronger.*Aiming stays steady/);
    fixture.selects[1].value = 'system'; fixture.selects[1].dispatchEvent(new Event('change'));
    fixture.media.matches = true; fixture.media.dispatchEvent(new Event('change'));
    assert.equal(store.get(), 'system'); assert.equal(fixture.selects[0].value, 'system');
    assert.match(fixture.statuses.get('setup-status').textContent, /Reduced motion is on/);
    fixture.selects[0].value = 'normal'; fixture.selects[0].dispatchEvent(new Event('change'));
    assert.match(fixture.statuses.get('pause-status').textContent, /Natural/);
    assert.doesNotMatch(fixture.statuses.get('pause-status').textContent, /Reduced motion is on/);
  } finally { controls.destroy(); store.destroy(); }
});

test('camera fields remove listeners on teardown without destroying the caller preference or retaining UI subscriptions', () => {
  const fixture = controlsFixture(), store = createCameraMotionStore({ storage: null });
  const controls = mountCameraMotionControls(fixture.root, { store, reducedMotion: fixture.media });
  controls.destroy(); controls.destroy();
  const previousText = fixture.statuses.get('pause-status').textContent;
  fixture.selects[0].value = 'off'; fixture.selects[0].dispatchEvent(new Event('change'));
  assert.equal(store.get(), 'strong');
  store.set('normal'); assert.equal(store.get(), 'normal'); assert.equal(fixture.selects[1].value, 'strong');
  fixture.media.matches = true; fixture.media.dispatchEvent(new Event('change')); controls.sync();
  assert.equal(fixture.statuses.get('pause-status').textContent, previousText);
  store.destroy();
});
