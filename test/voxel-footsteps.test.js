import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio } from '../public/audio.js';
import { createPlayerAnimationPresenter } from '../public/voxel-player-animation.js';
import { createEnemyFootstepPresenter, createVoxelFootstepSamples, VOXEL_FOOTSTEP_AUDIO } from '../public/voxel-footsteps.js';

const listener = { id: 0, lifeId: 1, deaths: 0, x: 0, y: 0, z: 0, yaw: 0, team: 0, alive: true };
const actor = (patch = {}) => ({ id: 1, lifeId: 2, deaths: 0, alive: true, grounded: true, airborne: false, phase: 1.4, stride: 1, speed: 4,
  x: 3, y: 0, z: -3, yaw: 0, team: 1, ...patch });
function recorder() {
  const calls = [], audio = { enabled: true, stops: 0, footstep(type, options) { calls.push({ type, ...options }); return true; }, stopFootsteps() { this.stops++; } };
  return { audio, calls, presenter: createEnemyFootstepPresenter(audio) };
}
function cross(presenter, patch = {}, options = {}) {
  presenter.observe([actor(patch)], { now: 0, listener, context: 'a', ...options });
  presenter.observe([actor({ ...patch, phase: 1.7, x: 3.2 + (patch.x === undefined ? 0 : patch.x - 3) })], { now: 60, listener, context: 'a', ...options });
}
function fakeContext() {
  const sources = [], gains = [], panners = [], buffers = [];
  const node = () => ({ connections: [], disconnects: 0, connect(to) { this.connections.push(to); }, disconnect() { this.disconnects++; } });
  return { state: 'running', currentTime: 20, sampleRate: 48000, sources, gains, panners, buffers,
    createBuffer(channels, length, rate) { const samples = new Float32Array(length), buffer = { duration: length / rate, getChannelData: () => samples }; buffers.push(buffer); return buffer; },
    createBufferSource() { const source = { ...node(), playbackRate: { value: 1 }, starts: 0, stops: [], start() { this.starts++; }, stop(at) { this.stops.push(at); } }; sources.push(source); return source; },
    createGain() { const gain = { ...node(), gain: { value: 0 } }; gains.push(gain); return gain; },
    createStereoPanner() { const panner = { ...node(), pan: { value: 0 } }; panners.push(panner); return panner; },
    async close() { this.state = 'closed'; },
  };
}
function enabledAudio() { const audio = new GameAudio(), context = fakeContext(); audio.enabled = true; audio.context = context; audio.master = {}; return { audio, context }; }

test('four contacts are deterministic, finite, brief and distinct at supported sample rates', () => {
  const signatures = new Set();
  for (const type of Object.keys(VOXEL_FOOTSTEP_AUDIO)) {
    const a = createVoxelFootstepSamples(type), b = createVoxelFootstepSamples(type);
    assert.deepEqual(a, b); assert.equal(a[0], 0); assert.equal(a.at(-1), 0);
    assert.ok(a.length > 2500 && a.length < 8000); assert.ok(a.every(value => Number.isFinite(value) && Math.abs(value) < .5));
    assert.ok(a.reduce((sum, value) => sum + value * value, 0) > .01); signatures.add(`${a.length}:${a[50]}:${a[300]}`);
    for (const rate of [8000, 44100, 96000, 192000]) assert.ok(createVoxelFootstepSamples(type, rate).length > 0);
  }
  assert.equal(signatures.size, 4);
  for (const type of ['__proto__', 'constructor', '', null]) assert.equal(createVoxelFootstepSamples(type), null);
  for (const rate of [NaN, Infinity, 0, 7999, 192001]) assert.equal(createVoxelFootstepSamples('boot', rate), null);
});

test('real presented human gait creates one contact per planted foot, including phase wrap', () => {
  const { calls, presenter } = recorder(), gait = createPlayerAnimationPresenter();
  for (let frame = 0; frame <= 100; frame++) {
    const human = actor({ x: 3 + frame * .025, grounded: true }), motion = gait(human, frame * 16, 'round');
    presenter.observe([{ ...human, ...motion }], { now: frame * 16, listener, context: 'round' });
  }
  assert.equal(calls.length, 2, '2.5m travel crosses the first two actual foot contacts');
  assert.ok(calls.every(call => call.type === 'boot' && call.gain > 0));
});

test('contact presentation cannot change any player position, HP or input', () => {
  const { presenter } = recorder(), a = actor(), b = actor({ phase: 1.7, x: 3.2 }), before = structuredClone([a, b, listener]);
  presenter.observe([a], { now: 0, listener }); presenter.observe([b], { now: 60, listener });
  assert.deepEqual([a, b, listener], before);
});

test('distance attenuation and current camera yaw place contacts on the correct side', () => {
  const right = recorder(), left = recorder(), turned = recorder(), far = recorder();
  cross(right.presenter, { z: 0 }); cross(left.presenter, { x: -3, z: 0 }); cross(turned.presenter, { z: 0 }, { yaw: Math.PI }); cross(far.presenter, { x: 15, z: 0 });
  assert.ok(right.calls[0].pan > .8); assert.ok(left.calls[0].pan < -.8); assert.ok(turned.calls[0].pan < -.8);
  assert.ok(far.calls[0].gain < right.calls[0].gain / 4);
  const outside = recorder(); cross(outside.presenter, { x: 40 }); assert.equal(outside.calls.length, 0);
});

test('hound paws, brute impacts and humanoid shambles retain their distinct timbre', () => {
  for (const [monsterType, type] of [['hound', 'hound'], ['brute', 'brute'], ['runner', 'shamble'], [undefined, 'boot']]) {
    const { presenter, calls } = recorder(); cross(presenter, { monsterType }); assert.equal(calls[0].type, type);
  }
});

test('quiet walking and crouching reduce opponents', () => {
  const normal = recorder(), quiet = recorder(), crouch = recorder();
  cross(normal.presenter); cross(quiet.presenter, { walking: true }); cross(crouch.presenter, { crouching: true });
  assert.ok(quiet.calls[0].gain < normal.calls[0].gain * .15); assert.ok(crouch.calls[0].gain < normal.calls[0].gain * .15);
});

test('idle, airborne, dead, stationary and friendly actors stay silent', () => {
  for (const patch of [{ stride: 0 }, { speed: 0 }, { airborne: true }, { grounded: false }, { alive: false }, { paused: true }, { team: 0 }]) {
    const { presenter, calls } = recorder(); cross(presenter, patch); assert.equal(calls.length, 0, JSON.stringify(patch));
  }
  const stationary = recorder(); stationary.presenter.observe([actor()], { now: 0, listener });
  stationary.presenter.observe([actor({ phase: 1.7 })], { now: 60, listener }); assert.equal(stationary.calls.length, 0);
  const ffa = recorder(); cross(ffa.presenter, { team: 0 }, { freeForAll: true }); assert.equal(ffa.calls.length, 1);
});

test('landing primes silently and the next grounded foot contact remains audible', () => {
  const { presenter, calls } = recorder();
  presenter.observe([actor({ airborne: true, grounded: false })], { now: 0, listener });
  presenter.observe([actor({ phase: 1.7, x: 3.2 })], { now: 60, listener }); assert.equal(calls.length, 0);
  presenter.observe([actor({ phase: 4.8, x: 3.9 })], { now: 260, listener }); assert.equal(calls.length, 1);
});

test('mute consumes contacts so unmuting does not replay an old planted foot', () => {
  const { presenter, calls, audio } = recorder(); audio.enabled = false; cross(presenter); audio.enabled = true;
  presenter.observe([actor({ phase: 1.7, x: 3.2 })], { now: 80, listener, context: 'a' }); assert.equal(calls.length, 0);
  presenter.observe([actor({ phase: 4.8, x: 3.9 })], { now: 270, listener, context: 'a' }); assert.equal(calls.length, 1);
});

test('pause, menus, hidden frames and a dead listener clear histories and stop contact voices', () => {
  const { presenter, calls, audio } = recorder(); cross(presenter); const count = calls.length;
  presenter.observe([actor()], { now: 70, listener, active: false }); assert.equal(presenter.inspect().trackedActors, 0); assert.equal(presenter.inspect().active, false); assert.ok(audio.stops > 0);
  presenter.observe([actor({ phase: 4.8, x: 3.9 })], { now: 80, listener, context: 'a' }); assert.equal(calls.length, count, 'resume primes without an old contact');
  presenter.observe([actor()], { now: 100, listener: { ...listener, alive: false } }); assert.equal(presenter.inspect().trackedActors, 0);
});

test('respawn, map/session change, teleports and long or reversed clocks prime silently', () => {
  const changes = [{ lifeId: 3 }, { deaths: 1 }, { monsterType: 'hound' }, { contextKey: 'new-actor-round' }, { x: 30 }];
  for (const patch of changes) {
    const { presenter, calls } = recorder(); presenter.observe([actor()], { now: 0, listener, context: 'a' });
    presenter.observe([actor({ phase: 1.7, x: 3.2, ...patch })], { now: 60, listener, context: 'a' }); assert.equal(calls.length, 0);
  }
  for (const options of [{ now: 400 }, { now: -1 }, { now: 60, context: 'b' }, { now: 60, listener: { ...listener, lifeId: 2 } }]) {
    const { presenter, calls } = recorder(); presenter.observe([actor()], { now: 0, listener, context: 'a' });
    presenter.observe([actor({ phase: 1.7, x: 3.2 })], { now: 60, listener, context: 'a', ...options }); assert.equal(calls.length, 0);
  }
});

test('same-time duplicate renders do not erase the contact cooldown', () => {
  const { presenter, calls } = recorder(); cross(presenter);
  const duplicate = actor({ phase: 1.7, x: 3.2 }); presenter.observe([duplicate], { now: 60, listener, context: 'a' });
  presenter.observe([actor({ phase: 4.8, x: 3.4 })], { now: 100, listener, context: 'a' }); assert.equal(calls.length, 1);
});

test('changing hordes retain at most64 actors and report no more18 contacts per second', () => {
  const { presenter, calls } = recorder();
  for (let frame = 0; frame < 12; frame++) {
    const actors = Array.from({ length: 200 }, (_, i) => actor({ id: i + 1, x: 3 + frame * .2, phase: (frame % 2 ? 1.7 : 4.8) }));
    presenter.observe(actors, { now: frame * 80, listener, context: 'a' }); assert.ok(presenter.inspect().trackedActors <= 64);
  }
  assert.ok(calls.length > 0 && calls.length <= 18); assert.ok(presenter.inspect().lastContacts.length <= 3);
  presenter.observe([], { now: 970, listener, context: 'a' }); assert.equal(presenter.inspect().trackedActors, 0);
  presenter.reset(); assert.equal(presenter.inspect().reports, 0); assert.equal(presenter.inspect().recentReports, 0);
});

test('a failing optional device does not retry a consumed contact or interrupt movement', () => {
  const { presenter, calls, audio } = recorder(); audio.footstep = () => { throw Error('device failed'); };
  assert.doesNotThrow(() => cross(presenter)); audio.footstep = (type, options) => { calls.push({ type, ...options }); return true; };
  presenter.observe([actor({ phase: 1.7, x: 3.2 })], { now: 90, listener, context: 'a' }); assert.equal(calls.length, 0);
  presenter.observe([actor({ phase: 4.8, x: 3.9 })], { now: 270, listener, context: 'a' }); assert.equal(calls.length, 1);
});

test('cached contact audio respects mute/unlock, stereo pan and six-voice cap', () => {
  const locked = new GameAudio(); assert.equal(locked.footstep('boot'), false); assert.equal(locked.context, null);
  const { audio, context } = enabledAudio();
  for (let i = 0; i < 6; i++) assert.equal(audio.footstep('boot', { gain: .4, pan: i % 2 ? -.7 : .7 }), true);
  assert.equal(context.buffers.length, 1); assert.equal(audio.footstep('hound'), false); assert.equal(audio.inspectFootsteps().activeVoices, 6);
  assert.deepEqual(context.panners.map(panner => panner.pan.value), [.7, -.7, .7, -.7, .7, -.7]);
  assert.ok(context.sources.every(source => source.stops[0] < context.currentTime + .2));
  audio.stopFootsteps(); assert.equal(audio.inspectFootsteps().activeVoices, 0); assert.ok(context.panners.every(panner => panner.disconnects === 1));
  audio.enabled = false; assert.equal(audio.footstep('boot'), false); audio.enabled = true; context.state = 'suspended'; assert.equal(audio.footstep('boot'), false);
  context.state = 'running'; assert.equal(audio.footstep('boot', { pan: NaN }), false); assert.equal(audio.footstep('boot', { gain: -1 }), false);
});

test('guns evict cosmetic steps first and steps cannot steal combat voices', () => {
  const { audio, context } = enabledAudio(); for (let i = 0; i < 6; i++) audio.footstep('boot');
  for (let i = 0; i < 24; i++) assert.equal(audio.gunshot('carbine'), true);
  assert.equal(audio.inspectFootsteps().activeVoices, 0); assert.equal(audio.inspectGunshots().activeVoices, 24);
  assert.equal(audio.footstep('boot'), false); assert.ok(context.sources.slice(0, 6).every(source => source.stops.length === 2));
  audio.destroy(); assert.equal(audio.inspectFootsteps().cachedBuffers, 0); assert.equal(audio.gunshotVoices.size, 0);
});
