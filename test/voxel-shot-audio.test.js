import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio } from '../public/audio.js';
import { createVoxelShotSamples, VOXEL_SHOT_AUDIO } from '../public/voxel-shot-audio.js';
import { WEAPONS } from '../public/voxel-weapons.js';

const energy = values => values.reduce((sum, value) => sum + value * value, 0);

function context() {
  const sources = [], gains = [], buffers = [], compressors = [];
  const node = () => ({ connections: [], disconnects: 0, connect(other) { this.connections.push(other); }, disconnect() { this.disconnects++; } });
  return {
    state: 'running', currentTime: 40, sampleRate: 48000, destination: {}, sources, gains, buffers, compressors,
    createBuffer(channels, length, sampleRate) { const samples = new Float32Array(length), buffer = { duration: length / sampleRate, length, getChannelData: () => samples }; buffers.push(buffer); return buffer; },
    createBufferSource() { const source = { ...node(), playbackRate: { value: 1 }, starts: [], stops: [], start(time) { this.starts.push(time); }, stop(time) { this.stops.push(time); }, onended: null }; sources.push(source); return source; },
    createGain() { const gain = { ...node(), gain: { value: 0, setTargetAtTime() {} } }; gains.push(gain); return gain; },
    createDynamicsCompressor() { const compressor = { ...node(), threshold: {}, knee: {}, ratio: {} }; compressors.push(compressor); return compressor; },
    async resume() { this.state = 'running'; },
    async close() { this.state = 'closed'; },
  };
}

function enabled() {
  const audio = new GameAudio(), ctx = context(); audio.context = ctx; audio.master = ctx.createGain(); audio.enabled = true;
  return { audio, ctx };
}

test('each catalog weapon has an immediate finite, distinct report with a silent end', () => {
  assert.deepEqual(Object.keys(VOXEL_SHOT_AUDIO), Object.keys(WEAPONS));
  const reports = new Set();
  for (const id of Object.keys(WEAPONS)) {
    const samples = createVoxelShotSamples(id), profile = VOXEL_SHOT_AUDIO[id];
    assert.equal(samples.length, Math.ceil(48000 * profile.duration));
    assert.ok(samples.length <= 48000 * .6);
    assert.ok(samples.every(value => Number.isFinite(value) && Math.abs(value) < .8), `${id} remains below clipping`);
    assert.ok(energy(samples.subarray(0, 240)) > .08, `${id} starts in the first 5 ms`);
    assert.ok(samples.at(-1) === 0);
    assert.ok(energy(samples.subarray(-240)) < .00002, `${id} ends cleanly`);
    assert.deepEqual(createVoxelShotSamples(id), samples, 'cached timbre is repeatable without per-frame noise');
    reports.add(`${samples.length}:${energy(samples)}:${samples[8]}`);
  }
  assert.equal(reports.size, 9);
});

test('heavy guns carry a longer stronger body; the crossbow remains a quiet string report', () => {
  const samples = Object.fromEntries(Object.keys(WEAPONS).map(id => [id, createVoxelShotSamples(id)]));
  assert.ok(energy(samples.sniper) > energy(samples.smg) * 6);
  assert.ok(energy(samples.shotgun) > energy(samples.pistol) * 3);
  assert.ok(samples.sniper.length > samples.carbine.length && samples.carbine.length > samples.smg.length);
  const initial = id => energy(samples[id].subarray(0, 240));
  const highFrequencyEnergy = id => energy(samples[id].subarray(1, 240).map((value, index) => value - samples[id][index]));
  assert.ok(highFrequencyEnergy('crossbow') < highFrequencyEnergy('pistol') * .12, 'crossbow has no explosive broadband firearm crack');
  assert.ok(energy(samples.crossbow.subarray(240, 2400)) > initial('crossbow'), 'string vibration follows the small release snap');
});

test('synthesis supports normal device sample rates and rejects unbounded input', () => {
  for (const rate of [8000, 22050, 44100, 48000, 96000, 192000]) {
    const samples = createVoxelShotSamples('carbine', rate);
    assert.equal(samples.length, Math.ceil(rate * .3)); assert.ok(samples.every(Number.isFinite));
  }
  for (const rate of [0, -1, 7999, 192001, NaN, Infinity]) assert.equal(createVoxelShotSamples('carbine', rate), null);
  for (const id of [null, undefined, 1, {}, 'sword', '__proto__', 'constructor']) assert.equal(createVoxelShotSamples(id), null);
});

test('gunshots cannot create an audio context before explicit opt-in or replay during suspension', () => {
  const audio = new GameAudio();
  assert.equal(audio.gunshot('carbine'), false); assert.equal(audio.context, null);
  const ctx = context(); audio.context = ctx; audio.master = ctx.createGain();
  assert.equal(audio.gunshot('carbine'), false);
  audio.enabled = true; ctx.state = 'suspended'; assert.equal(audio.gunshot('carbine'), false);
  ctx.state = 'running';
  for (const gain of [0, -1, NaN, Infinity]) assert.equal(audio.gunshot('carbine', { gain }), false);
  assert.equal(audio.gunshot('invalid'), false);
  assert.equal(ctx.sources.length, 0); assert.equal(ctx.buffers.length, 0); assert.equal(audio.inspectGunshots().played, 0);
});

test('each shell uses one source and a cached buffer, with quiet remote reports and bounded pitch variation', () => {
  const { audio, ctx } = enabled();
  for (let index = 0; index < 12; index++) assert.equal(audio.gunshot('carbine', { gain: index % 2 ? .22 : 1 }), true);
  assert.equal(ctx.buffers.length, 1); assert.equal(ctx.sources.length, 12); assert.equal(audio.inspectGunshots().played, 12);
  for (let index = 0; index < ctx.sources.length; index++) {
    const source = ctx.sources[index], envelope = source.connections[0];
    assert.equal(source.buffer, ctx.buffers[0]); assert.equal(source.starts[0], ctx.currentTime);
    assert.ok(source.playbackRate.value > .98 && source.playbackRate.value < 1.02);
    assert.equal(envelope.gain.value, index % 2 ? .22 : 1);
    assert.equal(envelope.connections[0], audio.master);
    assert.ok(source.stops[0] - source.starts[0] < .33);
  }
  assert.equal(audio.gunshot('pistol', { gain: 99 }), true); assert.equal(ctx.buffers.length, 2);
  assert.equal(ctx.sources.at(-1).connections[0].gain.value, 1, 'arbitrary callers cannot exceed local report volume');
  const stats = audio.inspectGunshots(); assert.ok(Object.isFrozen(stats)); assert.equal(stats.cachedBuffers, 2);
});

test('dense firefights, natural source endings and double callbacks stay bounded', () => {
  const { audio, ctx } = enabled();
  for (let index = 0; index < 500; index++) assert.equal(audio.gunshot('smg'), true);
  assert.equal(audio.gunshotVoices.size, 24); assert.equal(ctx.buffers.length, 1);
  assert.equal(ctx.sources.filter(source => source.disconnects === 1).length, 476);
  const ending = ctx.sources.at(-1), callback = ending.onended, envelope = ending.connections[0]; callback(); callback();
  assert.equal(audio.gunshotVoices.size, 23); assert.equal(ending.disconnects, 1); assert.equal(envelope.disconnects, 1);
  audio.stopGunshots(); assert.equal(audio.gunshotVoices.size, 0); assert.ok(ctx.sources.every(source => source.disconnects === 1));
});

test('mute, restart and destroy stop active reports; sound re-enable does not replay them', async t => {
  const { audio, ctx } = enabled(); audio.gunshot('sniper');
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  Object.defineProperty(globalThis, 'AudioContext', { value: function AudioContext() { return ctx; }, configurable: true });
  t.after(() => descriptor ? Object.defineProperty(globalThis, 'AudioContext', descriptor) : delete globalThis.AudioContext);
  assert.equal(await audio.setEnabled(false), false); assert.equal(audio.gunshotVoices.size, 0);
  assert.equal(audio.gunshot('pistol'), false); assert.equal(await audio.setEnabled(true), true);
  assert.equal(ctx.sources.length, 1); assert.equal(audio.inspectGunshots().played, 1);
  audio.gunshot('carbine'); audio.seen.add(12); audio.resetEvents();
  assert.equal(audio.gunshotVoices.size, 0); assert.equal(audio.seen.size, 0); assert.equal(audio.gunshotBuffers.size, 2);
  audio.gunshot('pistol'); audio.destroy();
  assert.equal(audio.gunshotVoices.size, 0); assert.equal(audio.gunshotBuffers.size, 0); assert.equal(audio.context, null);
  assert.equal(ctx.state, 'closed'); assert.equal(audio.gunshot('carbine'), false); assert.equal(await audio.setEnabled(true), false);
});

test('an unavailable audio source cleans its partial resources without affecting the caller', () => {
  const { audio, ctx } = enabled();
  const create = ctx.createBufferSource.bind(ctx);
  ctx.createBufferSource = () => { const source = create(); source.start = () => { throw new Error('detached context'); }; return source; };
  assert.equal(audio.gunshot('carbine'), false); assert.equal(audio.gunshotVoices.size, 0); assert.equal(ctx.sources[0].disconnects, 1);
  ctx.createBufferSource = create; assert.equal(audio.gunshot('carbine'), true); assert.equal(audio.inspectGunshots().played, 1);
});
