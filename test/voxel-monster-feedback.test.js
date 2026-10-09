import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { GameAudio, VOXEL_MONSTER_AUDIO, createVoxelMonsterSamples } from '../public/audio.js';
import { hordeMonsterSoundGain } from '../public/voxel-horde-client.js';
import * as Horde from '../public/voxel-horde-engine.js';

function context() {
  const sources = [], buffers = [], gains = [];
  const node = () => ({ disconnects: 0, connect() {}, disconnect() { this.disconnects++; } });
  return {
    state: 'running', currentTime: 20, sampleRate: 48000, destination: {}, sources, buffers, gains,
    createBuffer(channels, length, rate) { const samples = new Float32Array(length), buffer = { duration: length / rate, getChannelData: () => samples }; buffers.push(buffer); return buffer; },
    createBufferSource() { const source = { ...node(), playbackRate: { value: 1 }, starts: [], stops: [], start(time) { this.starts.push(time); }, stop(time) { this.stops.push(time); } }; sources.push(source); return source; },
    createGain() { const envelope = { ...node(), gain: { value: 0, setTargetAtTime() {} } }; gains.push(envelope); return envelope; },
    createDynamicsCompressor() { return { ...node(), threshold: {}, knee: {}, ratio: {} }; },
    async resume() { this.state = 'running'; }, async close() { this.state = 'closed'; },
  };
}
function enabled() { const audio = new GameAudio(), ctx = context(); audio.context = ctx; audio.master = ctx.createGain(); audio.enabled = true; return { audio, ctx }; }
const cues = [
  { type: 'monsterWindup', monsterType: 'hound', targetId: 0, x: 0, y: 0, z: -1 },
  { type: 'monsterLungeWindup', monsterType: 'leaper', targetId: 0, x: 0, y: 0, z: -4 },
  { type: 'monsterRoar', stage: 'windup', x: 0, y: 0, z: -5 },
  { type: 'monsterRoar', stage: 'release', x: 0, y: 0, z: -5 },
];

test('creature tells are distinct quiet deterministic samples with clean ends at every supported device rate', () => {
  const signatures = new Set();
  for (const id of Object.keys(VOXEL_MONSTER_AUDIO)) {
    const samples = createVoxelMonsterSamples(id);
    assert.equal(samples.length, Math.ceil(48000 * VOXEL_MONSTER_AUDIO[id].duration));
    assert.ok(samples.length <= 48000 * .6);
    assert.equal(samples[0], 0); assert.equal(samples.at(-1), 0);
    assert.ok(samples.every(value => Number.isFinite(value) && Math.abs(value) < .27));
    const energy = samples.reduce((sum, value) => sum + value ** 2, 0);
    assert.ok(energy > 1); signatures.add(`${samples.length}:${energy}`);
    assert.deepEqual(createVoxelMonsterSamples(id), samples);
    for (const rate of [8000, 22050, 44100, 96000, 192000]) {
      const scaled = createVoxelMonsterSamples(id, rate);
      assert.ok(scaled.every(Number.isFinite)); assert.equal(scaled.at(-1), 0);
    }
  }
  assert.equal(signatures.size, 4);
  for (const id of [null, undefined, {}, ['hound'], new String('hound'), '__proto__', 'constructor', 'missing']) assert.equal(createVoxelMonsterSamples(id), null);
  for (const rate of [0, NaN, Infinity, 7999, 192001]) assert.equal(createVoxelMonsterSamples('hound', rate), null);
});

test('sound creates no context implicitly and muted tells cannot replay after the explicit sound toggle', async () => {
  const audio = new GameAudio();
  audio.playEvents(cues.map((event, id) => ({ ...event, id })));
  assert.equal(audio.monsterTell('hound'), false); assert.equal(audio.context, null);
  assert.equal(audio.inspectMonsters().played, 0); assert.equal(audio.monsterBuffers.size, 0);
  const old = globalThis.AudioContext, ctx = context();
  globalThis.AudioContext = class { constructor() { return ctx; } };
  try {
    assert.equal(await audio.setEnabled(true), true);
    audio.playEvents(cues.map((event, id) => ({ ...event, id })));
    assert.equal(ctx.sources.length, 0, 'muted snapshots are consumed, not deferred');
    audio.playEvents([{ ...cues[0], id: 10 }]);
    assert.equal(audio.inspectMonsters().played, 1); assert.equal(ctx.buffers.length, 1);
    assert.equal(await audio.setEnabled(false), false);
    assert.equal(audio.gunshotVoices.size, 0); assert.equal(audio.monsterTell('leaper'), false);
  } finally { audio.destroy(); if (old === undefined) delete globalThis.AudioContext; else globalThis.AudioContext = old; }
});

test('only committed windup and completed roar events play; repeated snapshots and interrupted roars are silent', () => {
  const { audio, ctx } = enabled(), events = cues.map((event, id) => ({ ...event, id }));
  audio.playEvents(events, { gain: .42 });
  assert.equal(audio.inspectMonsters().played, 4); assert.equal(ctx.sources.length, 4);
  assert.ok(ctx.sources.every(source => source.starts[0] === ctx.currentTime));
  assert.ok(ctx.gains.slice(1).every(envelope => envelope.gain.value === .42));
  audio.playEvents(events);
  audio.playEvents([
    { ...cues[2], id: 11, stage: 'interrupted' },
    { ...cues[1], id: 12, type: 'monsterLunge' },
    { ...cues[2], id: 13, type: 'monsterRally' },
    { id: 14, type: 'monsterSpawn', monsterType: 'hound' },
    { ...cues[1], id: 15, monsterType: 'runner' },
    { ...cues[0], id: undefined },
  ]);
  assert.equal(audio.inspectMonsters().played, 4, 'body poses, lunge starts, rally recipients and interrupts cannot duplicate the tell');
  assert.equal(audio.monsterBuffers.size, 4);
  audio.playEvents([{ ...cues[0], id: 20 }]);
  assert.equal(ctx.sources.at(-1).buffer, ctx.sources[0].buffer);
  assert.equal(ctx.buffers.length, 4, 'new bites reuse the cached growl');
});

test('creature tells share the existing 24-voice budget with guns and blades through a long session', () => {
  const { audio, ctx } = enabled();
  for (let index = 0; index < 1200; index++) {
    if (index % 3 === 0) audio.gunshot('smg');
    else if (index % 3 === 1) audio.meleeSwing('katana');
    else audio.playEvents([{ ...cues[index % cues.length], id: index }]);
  }
  assert.equal(audio.gunshotVoices.size, 24); assert.equal(audio.inspectMonsters().maxVoices, 24);
  assert.equal(ctx.buffers.length, 6); assert.equal(audio.inspectMonsters().played, 400);
  assert.ok(ctx.sources.slice(0, -24).every(source => source.disconnects === 1));
  assert.ok(ctx.sources.every(source => source.stops[0] - source.starts[0] < .62));
  assert.ok(audio.seen.size <= 512);
  audio.resetEvents(); assert.equal(audio.gunshotVoices.size, 0); assert.equal(audio.monsterBuffers.size, 4);
  assert.ok(ctx.sources.every(source => source.disconnects === 1));
  audio.destroy(); assert.equal(audio.monsterBuffers.size, 0); assert.equal(audio.context, null);
});

test('suspended and failed contexts consume tells safely without breaking subsequent gameplay events', () => {
  const { audio, ctx } = enabled(); ctx.state = 'suspended';
  audio.playEvents([{ ...cues[0], id: 1 }]); assert.equal(ctx.sources.length, 0);
  ctx.state = 'running'; audio.playEvents([{ ...cues[0], id: 1 }]); assert.equal(ctx.sources.length, 0);
  const original = ctx.createBufferSource; ctx.createBufferSource = () => { throw new Error('unavailable source'); };
  assert.doesNotThrow(() => audio.playEvents([{ ...cues[1], id: 2 }])); assert.equal(audio.gunshotVoices.size, 0);
  ctx.createBufferSource = original; audio.playEvents([{ ...cues[1], id: 3 }]); assert.equal(audio.inspectMonsters().played, 1);
  for (const gain of [0, -1, NaN, Infinity]) assert.equal(audio.monsterTell('hound', { gain }), false);
});

test('an authoritative interrupted roar or monster kill immediately stops that creature tell without stopping another creature or gun', () => {
  const { audio, ctx } = enabled();
  audio.gunshot('carbine');
  audio.playEvents([{ ...cues[2], id: 1, playerId: 3 }, { ...cues[2], id: 2, playerId: 4 }, { ...cues[0], id: 3, playerId: 5 }]);
  assert.equal(audio.gunshotVoices.size, 4);
  audio.playEvents([{ id: 4, type: 'monsterRoar', stage: 'interrupted', playerId: 3 }]);
  assert.equal(audio.gunshotVoices.size, 3); assert.equal(ctx.sources[1].disconnects, 1);
  assert.equal(ctx.sources[0].disconnects, 0); assert.equal(ctx.sources[2].disconnects, 0);
  audio.playEvents([{ id: 5, type: 'kill', targetId: 4 }, { id: 6, type: 'elimination', targetId: 5 }]);
  assert.equal(audio.gunshotVoices.size, 1); assert.equal(ctx.sources[2].disconnects, 1); assert.equal(ctx.sources[3].disconnects, 1);
  assert.equal(audio.inspectGunshots().played, 1); assert.equal(audio.inspectMonsters().played, 3);
  audio.playEvents([{ id: 7, type: 'monsterRoar', stage: 'release', playerId: 3 }]);
  assert.equal(audio.inspectMonsters().played, 4);
});

test('nearby creature warnings attenuate with distance and never turn snapshot poses or distant roars into a cue', () => {
  const listener = { id: 0, x: 0, y: 0, z: 0 };
  for (let index = 0; index < cues.length; index++) {
    const event = { ...cues[index], id: index };
    const near = hordeMonsterSoundGain(event, listener), farther = hordeMonsterSoundGain({ ...event, z: -10 }, listener);
    assert.ok(near > 0 && near <= 1); assert.ok(farther > 0 && farther <= near);
    assert.equal(hordeMonsterSoundGain({ ...event, z: -100 }, listener), 0);
    assert.equal(hordeMonsterSoundGain({ ...event, y: 30 }, listener), 0);
    assert.equal(hordeMonsterSoundGain({ ...event, x: NaN }, listener), 0);
    assert.equal(hordeMonsterSoundGain({ ...event, id: undefined }, listener), 0);
  }
  assert.equal(hordeMonsterSoundGain({ ...cues[2], id: 20, stage: 'interrupted' }, listener), 0);
  assert.equal(hordeMonsterSoundGain({ id: 21, type: 'monsterSpawn', monsterType: 'hound', x: 0, y: 0, z: -1 }, listener), 0);
  assert.equal(hordeMonsterSoundGain({ id: 22, type: 'monsterAim', targetId: 0 }, listener), 1);
  assert.equal(hordeMonsterSoundGain({ id: 23, type: 'monsterAim', targetId: 1 }, listener), 0);
  assert.equal(hordeMonsterSoundGain({ id: 24, type: 'monsterWindup', monsterType: 'brute', targetId: 1 }, listener), 0);
});

const arena = { id: 'creature-sound-arena', bounds: { minX: -25, maxX: 25, minZ: -25, maxZ: 25 }, colliders: [], spawns: Horde.MAPS.courtyard.spawns };
function pose(player, x, z, yaw = 0) { Object.assign(player, { x, y: 0, z, yaw, pitch: 0, vx: 0, vy: 0, vz: 0, grounded: true }); player.previousInput = Horde.emptyInput(player); }
function creatureFixture(type) {
  const state = Horde.createState({ capacity: 1, seed: 39730 }); Horde.startMatch(state);
  for (let tick = state.phaseTicks; tick > 0; tick--) Horde.step(state);
  state.map = arena; state.horde.wave = type === 'screecher' ? 5 : type === 'leaper' ? 3 : 1;
  state.horde.pending = 1; state.horde.nextSpawnTick = Number.MAX_SAFE_INTEGER;
  const human = state.players[0]; pose(human, 0, 8);
  state.spawnWarnings = [{ id: 10, x: 0, y: 0, z: -8, ticksLeft: 1, monsterType: type }]; Horde.step(state);
  const creature = state.players.find(player => player.monster); assert.ok(creature);
  creature.emergenceTicks = 0; pose(creature, 0, type === 'hound' ? -1.1 : type === 'leaper' ? -3 : -5, Math.PI); pose(human, 0, 0);
  const brain = state.horde.brains[creature.id]; brain.targetId = human.id; brain.nextPlanTick = Number.MAX_SAFE_INTEGER; brain.path = [];
  if (type === 'screecher') {
    state.spawnWarnings = [{ id: 11, x: 8, y: 0, z: -8, ticksLeft: 1, monsterType: 'hound' }]; Horde.step(state);
    const ally = state.players.find(player => player.monster && player.id !== creature.id); assert.ok(ally);
    ally.emergenceTicks = 0; pose(ally, 3, -5, Math.PI);
    const allyBrain = state.horde.brains[ally.id]; allyBrain.targetId = human.id; allyBrain.nextPlanTick = Number.MAX_SAFE_INTEGER; allyBrain.path = [];
  }
  return { state, human, creature };
}

test('real Horde hound and leaper attack commitments produce one audible tell before their actual attacks', () => {
  for (const type of ['hound', 'leaper']) {
    const { state, human, creature } = creatureFixture(type), { audio } = enabled();
    for (let tick = 0; tick < 60; tick++) {
      Horde.step(state);
      for (const event of state.events) {
        const gain = hordeMonsterSoundGain(event, human); if (gain > 0) audio.playEvents([event], { gain });
      }
    }
    const typeName = type === 'hound' ? 'monsterWindup' : 'monsterLungeWindup';
    const windups = state.events.filter(event => event.type === typeName && event.playerId === creature.id);
    assert.equal(windups.length, 1, type); assert.equal(audio.inspectMonsters().played, 1, type);
    assert.ok(state.events.some(event => event.type === (type === 'hound' ? 'monsterAttack' : 'monsterLunge') && event.playerId === creature.id));
    assert.ok(windups[0].tick < state.events.find(event => event.type === (type === 'hound' ? 'monsterAttack' : 'monsterLunge') && event.playerId === creature.id).tick);
  }
});

test('a real Screecher roar produces separate windup and completed rally sounds exactly once', () => {
  const { state, human, creature } = creatureFixture('screecher'), { audio } = enabled();
  for (let tick = 0; tick < 210; tick++) {
    Horde.step(state);
    for (const event of state.events) { const gain = hordeMonsterSoundGain(event, human); if (gain > 0) audio.playEvents([event], { gain }); }
  }
  const roar = state.events.filter(event => event.type === 'monsterRoar' && event.playerId === creature.id);
  assert.deepEqual(roar.map(event => event.stage), ['windup', 'release']);
  assert.ok(state.events.some(event => event.type === 'monsterRally' && event.playerId === creature.id && event.targetIds.length > 0));
  assert.equal(audio.inspectMonsters().played, 2); assert.equal(audio.monsterBuffers.size, 2);
});

test('the existing help dialog explains creature counterplay without adding a combat HUD panel', () => {
  const html = readFileSync(new URL('../public/voxel-horde.html', import.meta.url), 'utf8');
  const help = html.slice(html.indexOf('id="horde-guide"'), html.indexOf('id="horde-guide-back"'));
  assert.match(help, /Grave Hounds.*fast but fragile/);
  assert.match(help, /Rift Leapers crouch.*sidestep.*solid cover/);
  assert.match(help, /Interrupt an Ash Screecher.*roar with a blade/);
  assert.match(help, /potions stack to two/); assert.match(help, /four weapons/);
  assert.equal((html.match(/id="horde-guide"/g) || []).length, 1);
  assert.doesNotMatch(html, /class="(?:monster-bestiary|monster-hud)"/);
});
