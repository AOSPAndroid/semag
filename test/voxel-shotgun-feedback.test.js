import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { GameAudio } from '../public/audio.js';
import { combatStep, createCombatPlayer, createState, emptyInput, WEAPONS } from '../public/voxel-engine.js';
import { hasGunshotReport } from '../public/voxel-client.js';
import { createWeaponShotPresenter, weaponCyclePose, weaponShotPose } from '../public/voxel-first-person-motion.js';
import { createVoxelShotSamples } from '../public/voxel-shot-audio.js';
import { VoxelRenderer } from '../public/voxel-renderer.js';

const shotguns = ['shotgun', 'autoshotgun', 'slugshotgun', 'shorty', 'bucky', 'judge'];
const pumps = ['shotgun', 'slugshotgun', 'bucky'];
const rate = 48000;
const energy = samples => samples.reduce((sum, value) => sum + value * value, 0);
const rms = (samples, start, end) => Math.sqrt(energy(samples.subarray(Math.round(start * rate), Math.round(end * rate))) / Math.round((end - start) * rate));
const arena = { id: 'shotgun-feedback', theme: 'custom', bounds: { minX: -24, maxX: 24, minZ: -24, maxZ: 24 }, colliders: [], sites: [] };

function firstShell(weapon) {
  const state = createState();
  Object.assign(state, { map: arena, mapId: arena.id, phase: 'fight', tick: 0, events: [] });
  state.players = [{ ...createCombatPlayer(0, 1, weapon), z: 6 }, { ...createCombatPlayer(1), z: 0 }];
  state.tick++;
  combatStep(state, state.players.map(player => ({ ...emptyInput(player), pitch: -.1, fire: player.id === 0 })), arena);
  assert.equal(state.players[0].ammo, WEAPONS[weapon].magazine - 1);
  return state;
}

function audioHarness() {
  const sources = [], buffers = [];
  const node = () => ({ connections: [], disconnects: 0, connect(target) { this.connections.push(target); }, disconnect() { this.disconnects++; } });
  const context = {
    state: 'running', currentTime: 12, sampleRate: rate,
    createBuffer(_channels, length) { const samples = new Float32Array(length), buffer = { duration: length / rate, getChannelData: () => samples }; buffers.push(buffer); return buffer; },
    createBufferSource() { const source = { ...node(), playbackRate: {}, start() {}, stop() {}, onended: null }; sources.push(source); return source; },
    createGain() { return { ...node(), gain: { value: 0 } }; },
  };
  const audio = new GameAudio(); audio.context = context; audio.master = context.createGain(); audio.enabled = true;
  return { audio, context, sources, buffers };
}

test('all six shotgun reports have their own sharp onset, weighty body and bounded clean ending', () => {
  const signatures = new Set(), pistol = createVoxelShotSamples('pistol');
  for (const weapon of shotguns) {
    const samples = createVoxelShotSamples(weapon);
    assert.ok(samples.length <= rate * .6, `${weapon}: one short cached shell report`);
    assert.ok(samples.every(value => Number.isFinite(value) && Math.abs(value) < .8), `${weapon}: no clipped or invalid samples`);
    assert.ok(rms(samples, .001, .008) > rms(pistol, .001, .008) * 1.2, `${weapon}: a dry readable initial crack`);
    assert.ok(rms(samples, .012, .055) > rms(pistol, .012, .055) * 1.8, `${weapon}: body weight, rather than only extra high-frequency noise`);
    assert.ok(rms(samples, .012, .055) > rms(samples, .10, .20) * 2, `${weapon}: report decays rather than ringing over later shots`);
    assert.ok(samples.at(-1) === 0); assert.ok(energy(samples.subarray(-240)) < .00002);
    signatures.add(createHash('sha256').update(Buffer.from(samples.buffer)).digest('hex'));
  }
  assert.equal(signatures.size, shotguns.length);
  assert.ok(energy(createVoxelShotSamples('slugshotgun')) > energy(createVoxelShotSamples('shorty')) * 2);
});

test('pump shells carry one quiet closing action during the real pump return; Shorty and automatics do not invent a delayed rack', () => {
  for (const weapon of pumps) {
    const samples = createVoxelShotSamples(weapon);
    assert.ok(rms(samples, .48, .515) > rms(samples, .4, .45) * 8, `${weapon}: dry closing clack remains audible after the blast decays`);
    assert.ok(weaponCyclePose(weapon, 480).pump > 0 && weaponCyclePose(weapon, 525).pump === 0);
    assert.equal(weaponCyclePose(weapon, 245).pump, 1);
  }
  for (const weapon of ['shorty', 'autoshotgun', 'judge']) {
    assert.ok(createVoxelShotSamples(weapon).length < rate * .35);
    assert.equal(weaponCyclePose(weapon, 245).pump, 0);
  }
  assert.deepEqual(weaponCyclePose('shorty', 19), { pump: 0, bolt: 0 }, 'break-action barrels stay closed until an actual reload');
});

test('real accepted shells produce one cached sound and one impulse despite fifteen pellets and repeated snapshots', () => {
  const { audio, sources, buffers } = audioHarness();
  for (const weapon of shotguns) {
    const state = firstShell(weapon), reports = state.events.filter(event => event.type === 'shot'), before = JSON.stringify(state);
    assert.equal(reports.length, WEAPONS[weapon].pellets || 1);
    assert.equal(reports.filter(hasGunshotReport).length, 1, `${weapon}: each pellet keeps its contact but only one carries shell sound`);
    const presenter = createWeaponShotPresenter();
    for (const event of reports) if (presenter.report(event, 1000) && hasGunshotReport(event)) assert.equal(audio.gunshot(weapon), true);
    const pose = presenter.sample(weapon, 1025);
    assert.ok(pose.kick > .9 && pose.z > .11, `${weapon}: visible accepted-shell strike`);
    for (const event of [...reports, ...reports]) assert.equal(presenter.report(event, 1040), false);
    assert.deepEqual(presenter.getStats(), { acceptedShots: 1, activeShots: 1 });
    assert.equal(JSON.stringify(state), before, 'presentation cannot modify accepted damage, ammo, aim or contacts');
  }
  assert.equal(sources.length, shotguns.length); assert.equal(buffers.length, shotguns.length);
  assert.equal(audio.inspectGunshots().played, shotguns.length);
  audio.stopGunshots();
});

test('rapid shotgun firefights reuse six buffers and preserve the shared voice and remote-volume bounds', () => {
  const { audio, sources, buffers } = audioHarness();
  for (let index = 0; index < 120; index++) assert.equal(audio.gunshot(shotguns[index % shotguns.length], { gain: index % 2 ? .22 : 999 }), true);
  assert.equal(buffers.length, shotguns.length); assert.equal(audio.gunshotVoices.size, 24);
  assert.equal(sources.filter(source => source.disconnects === 1).length, 96);
  for (let index = 0; index < sources.length; index++) assert.equal(sources[index].connections[0].gain.value, index % 2 ? .22 : 1);
  audio.stopGunshots(); assert.equal(audio.gunshotVoices.size, 0);
});

test('shotgun kick and pump are analytic at high refresh rates and always settle without changing aim', () => {
  for (const weapon of shotguns) {
    const reference = weaponShotPose(weapon, 120), cycle = weaponCyclePose(weapon, 300);
    for (const hz of [60, 120, 144, 240]) {
      for (let frame = 0; frame < hz / 2; frame++) { weaponShotPose(weapon, frame * 1000 / hz); weaponCyclePose(weapon, frame * 1000 / hz); }
      assert.deepEqual(weaponShotPose(weapon, 120), reference); assert.deepEqual(weaponCyclePose(weapon, 300), cycle);
    }
    const aimed = weaponShotPose(weapon, 120, 1);
    assert.ok(Math.abs(aimed.pitch) < Math.abs(reference.pitch) * .3 && aimed.z < reference.z);
    assert.deepEqual(weaponShotPose(weapon, 400), { kick: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
    assert.deepEqual(weaponCyclePose(weapon, Infinity), { pump: 0, bolt: 0 });
  }
});

test('the actual world camera matrix stays fixed while each shotgun visibly kicks in the held pass', () => {
  for (const weapon of shotguns) {
    const calls = { views: [], eyes: [] };
    const gl = new Proxy({}, { get(_target, name) {
      if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
      if (name === 'getAttribLocation') return () => 0;
      if (name === 'getUniformLocation') return (_program, uniform) => uniform;
      if (name === 'uniformMatrix4fv') return (uniform, _transpose, value) => { if (uniform === 'uView') calls.views.push(Array.from(value)); };
      if (name === 'uniform3fv') return (uniform, value) => { if (uniform === 'uEye' && value[1] > 0) calls.eyes.push(Array.from(value)); };
      if (typeof name === 'string' && name.startsWith('create')) return () => ({});
      return () => {};
    } });
    const renderer = new VoxelRenderer({ getContext: () => gl, getBoundingClientRect: () => ({ width: 960, height: 540 }), addEventListener() {}, removeEventListener() {}, dispatchEvent() {} });
    const state = firstShell(weapon), events = state.events;
    try {
      state.events = [];
      renderer.render(state, { localId: 0, yaw: 0, pitch: -.1, time: 1000 });
      const camera = { view: calls.views[0], eye: calls.eyes[0] };
      calls.views.length = 0; calls.eyes.length = 0; state.events = events;
      renderer.render(state, { localId: 0, yaw: 0, pitch: -.1, time: 1025 });
      assert.deepEqual(calls.views[0], camera.view, `${weapon}: held recoil leaves world aim fixed`);
      assert.deepEqual(calls.eyes[0], camera.eye);
      assert.ok(renderer.stats.firstPerson.shot.kick > .2);
    } finally { renderer.destroy(); }
  }
});
