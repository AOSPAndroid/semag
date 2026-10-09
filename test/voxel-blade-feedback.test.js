import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { GameAudio, createVoxelParrySamples } from '../public/audio.js';
import { VOXEL_BLADE_IMPACT_AUDIO, VOXEL_SHOT_AUDIO, VOXEL_MELEE_AUDIO, createVoxelBladeImpactSamples, createVoxelShotSamples, createVoxelMeleeSamples } from '../public/voxel-shot-audio.js';
import { createMeleeImpactReporter } from '../public/voxel-client.js';
import { meleeActionReadout } from '../public/voxel-fps-feedback.js';
import { applyCombatDamage, createCombatPlayer, combatStep } from '../public/voxel-engine.js';
import { MELEE_IDS, MELEE_WEAPONS, MELEE_PRESS_BUFFER_TICKS, clearMeleeBuffer } from '../public/voxel-melee.js';
import { setInventoryMeleeLoadout, selectInventorySlot } from '../public/voxel-inventory.js';

const arena = { id: 'blade-feedback-arena', bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, colliders: [], sites: [] };
const contactIds = ['sword', 'katana', 'axe', 'tonfas'];
const energy = samples => samples.reduce((sum, value) => sum + value * value, 0);

function context() {
  const sources = [], buffers = [], node = () => ({ disconnects: 0, connections: [], connect(other) { this.connections.push(other); }, disconnect() { this.disconnects++; } });
  return { sources, buffers, state: 'running', sampleRate: 48000, currentTime: 10,
    createBuffer(channels, length, rate) { const samples = new Float32Array(length), buffer = { duration: length / rate, getChannelData: () => samples }; buffers.push(buffer); return buffer; },
    createBufferSource() { const source = { ...node(), playbackRate: {}, start() {}, stop() {} }; sources.push(source); return source; },
    createGain() { return { ...node(), gain: {} }; }, close() { this.state = 'closed'; return Promise.resolve(); } };
}
function enabledAudio() {
  const audio = new GameAudio(), ctx = context(); audio.context = ctx; audio.master = ctx.createGain(); audio.enabled = true;
  audio.tone = audio.noise = () => { throw Error('cached blade contacts must not use generic oscillators or noise'); };
  return { audio, ctx, reporter: createMeleeImpactReporter(audio) };
}
function fight(count = 20) {
  const players = Array.from({ length: count + 1 }, (_, id) => {
    const player = createCombatPlayer(id); player.team = id ? 1 : 0; player.lifeId = id + 10;
    Object.assign(player, { x: id ? id + 1 : 0, z: id ? -2 : 0 }); return player;
  });
  return { gameId: 'blade-feedback-test', phase: 'fight', map: arena, players, tick: 120, eventId: 0, events: [], eventLimit: 256, bolts: [], grenades: [], loot: [] };
}
function accepted(state, targetId, extra = {}) {
  const start = state.events.length;
  applyCombatDamage(state, [{ playerId: 0, targetId, damage: 55, attack: 'sword', weapon: 'sword', hitKind: 'body', meleeIndex: 7,
    meleeStartTick: 100, attackerLifeId: state.players[0].lifeId, attackerDeaths: 0, ...extra }]);
  const event = state.events.slice(start).find(event => event.type === 'damage');
  assert.ok(event, 'only an authoritative HP loss may supply a contact report'); return event;
}

test('each physical blade has a finite distinct weighted contact with clean edges at device sample rates', () => {
  assert.deepEqual(Object.keys(VOXEL_BLADE_IMPACT_AUDIO), contactIds);
  const fingerprints = new Set();
  for (const rate of [8000, 22050, 44100, 48000, 96000, 192000]) for (const id of contactIds) {
    const samples = createVoxelBladeImpactSamples(id, rate), profile = VOXEL_BLADE_IMPACT_AUDIO[id];
    assert.equal(samples.length, Math.ceil(rate * profile.duration));
    assert.ok(samples.every(value => Number.isFinite(value) && Math.abs(value) < .6));
    assert.equal(samples[0], 0); assert.equal(samples.at(-1), 0);
    assert.ok(energy(samples.subarray(0, Math.ceil(rate * .005))) > .05, `${id} contact is immediate`);
    assert.ok(energy(samples.subarray(Math.ceil(rate * .005), Math.ceil(rate * .035))) > .5, `${id} has a physical body after contact`);
    const tail = samples.subarray(-Math.ceil(rate * .005));
    assert.ok(Math.sqrt(energy(tail) / tail.length) < .002, `${id} fades below -54 dB before its silent endpoint`);
    assert.deepEqual(createVoxelBladeImpactSamples(id, rate), samples);
    if (rate === 48000) fingerprints.add(createHash('sha256').update(Buffer.from(samples.buffer)).digest('hex'));
  }
  assert.equal(fingerprints.size, 4);
  assert.ok(energy(createVoxelBladeImpactSamples('axe')) > energy(createVoxelBladeImpactSamples('katana')) * 2, 'the heavy chop carries a stronger body than a quick cut');
});

test('invalid contact IDs, starter knife and unbounded sample rates cannot allocate contact buffers', () => {
  for (const id of [null, undefined, 1, {}, 'knife', 'carbine', '__proto__', 'constructor', 'toString']) assert.equal(createVoxelBladeImpactSamples(id), null);
  for (const rate of [0, -1, NaN, Infinity, 7999, 192001]) assert.equal(createVoxelBladeImpactSamples('sword', rate), null);
});

test('all 36 firearm reports, all five miss whooshes and parry samples retain the released bytes', () => {
  // Independently captured from released 19a148b, over four normal device rates.
  const golden = [
    [Object.keys(VOXEL_SHOT_AUDIO), createVoxelShotSamples, 'cd7e8b55036478485dee0560e9de59f8779f644a6f9618cf72420ddadc22cb2f'],
    [Object.keys(VOXEL_MELEE_AUDIO), createVoxelMeleeSamples, 'aab20bc5bc39ed346423f3d5bd8c2feb63e81de4bdb9742b1621d7c13448a0f3'],
    [['parry'], (_, rate) => createVoxelParrySamples(rate), '55798782c08bbfa667d528d95d30d4ccd9e2aa6507eef1d9976eca4969d94385'],
  ];
  assert.equal(Object.keys(VOXEL_SHOT_AUDIO).length, 36);
  for (const [ids, factory, expected] of golden) {
    const hash = createHash('sha256');
    for (const rate of [8000, 44100, 48000, 96000]) for (const id of ids) {
      hash.update(`${id}:${rate}:`); const samples = factory(id, rate); hash.update(Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength));
    }
    assert.equal(hash.digest('hex'), expected);
  }
});

test('contacts require sound opt-in and a running context; invalid IDs or gains stay silent', () => {
  const audio = new GameAudio(); assert.equal(audio.meleeImpact('sword'), false); assert.equal(audio.context, null);
  const ctx = context(); audio.context = ctx; audio.master = ctx.createGain();
  assert.equal(audio.meleeImpact('sword'), false);
  audio.enabled = true; ctx.state = 'suspended'; assert.equal(audio.meleeImpact('sword'), false); ctx.state = 'running';
  for (const id of ['knife', '__proto__', 'carbine', null]) assert.equal(audio.meleeImpact(id), false);
  for (const gain of [0, -1, NaN, Infinity]) assert.equal(audio.meleeImpact('sword', { gain }), false);
  assert.equal(ctx.sources.length, 0); assert.equal(ctx.buffers.length, 0); assert.equal(audio.inspectBladeImpacts().played, 0);
});

test('one cached contact source per cut shares the same 24-voice cap with shots, parries and misses', () => {
  const { audio, ctx } = enabledAudio();
  for (let index = 0; index < 200; index++) {
    assert.equal(audio.meleeImpact(contactIds[index % 4], { gain: 99 }), true);
    assert.equal(audio.gunshot('carbine'), true); assert.equal(audio.meleeSwing('sword'), true); assert.equal(audio.meleeParry('katana'), true);
  }
  assert.equal(audio.inspectBladeImpacts().cachedBuffers, 4); assert.equal(audio.inspectBladeImpacts().played, 200);
  assert.equal(audio.inspectGunshots().played, 200); assert.equal(audio.inspectMelee().played, 200); assert.equal(audio.inspectParries().played, 200);
  assert.equal(ctx.buffers.length, 7); assert.equal(audio.gunshotVoices.size, 24);
  assert.ok(ctx.sources.every(source => source.buffer.getChannelData(0).every(Number.isFinite)));
  assert.equal(ctx.sources[0].connections[0].gain.value, 1, 'even arbitrary gain input stays within the shared mixer limit');
  assert.equal(ctx.sources[0].buffer, ctx.sources[16].buffer, 'the same blade reuses its contact buffer');
  assert.equal(audio.inspectBladeImpacts().maxVoices, 24);
  audio.resetEvents(); assert.equal(audio.gunshotVoices.size, 0); assert.equal(audio.inspectBladeImpacts().cachedBuffers, 4);
  assert.ok(ctx.sources.every(source => source.disconnects === 1));
  audio.destroy(); assert.equal(audio.inspectBladeImpacts().cachedBuffers, 0); assert.equal(audio.meleeImpact('sword'), false);
});

test('twenty authoritative staggered cleave contacts request one source and retain every individual HP event', () => {
  const state = fight(), { audio, ctx, reporter } = enabledAudio();
  for (const player of state.players.slice(1)) {
    state.tick++; const event = accepted(state, player.id), before = structuredClone(event);
    assert.equal(reporter.consume(event, 0, { lifeKey: 'stand-1', gain: .13 }), true);
    assert.equal(reporter.consume(structuredClone(event), 0, { lifeKey: 'stand-1', gain: .13 }), true);
    assert.deepEqual(event, before);
  }
  assert.equal(ctx.sources.length, 1); assert.equal(audio.inspectBladeImpacts().played, 1); assert.equal(reporter.inspect().reports, 1);
  assert.equal(reporter.inspect().trackedSwings, 1); assert.equal(state.events.filter(event => event.type === 'damage').length, 20);
  assert.ok(state.players.slice(1).every(player => player.hp === 145));
});

test('muted and paused partial cuts remain consumed across later snapshot batches and resume', () => {
  for (const paused of [false, true]) {
    const state = fight(), { audio, ctx, reporter } = enabledAudio(); if (!paused) audio.enabled = false;
    for (let target = 1; target <= 10; target++) reporter.consume(accepted(state, target), 0, { lifeKey: 'stand-1', active: !paused });
    audio.enabled = true;
    for (let target = 11; target <= 20; target++) reporter.consume(accepted(state, target), 0, { lifeKey: 'stand-1' });
    assert.equal(ctx.sources.length, 0); assert.equal(reporter.inspect().reports, 0);
    reporter.consume(accepted(state, 1, { meleeIndex: 8, meleeStartTick: 140 }), 0, { lifeKey: 'stand-1' });
    assert.equal(ctx.sources.length, 1); assert.equal(reporter.inspect().reports, 1);
  }
});

test('self, incoming, unseen, rejected and speculative contacts cannot trigger an offensive blade report', () => {
  const state = fight(1), { reporter, ctx } = enabledAudio(), event = accepted(state, 1);
  for (const patch of [{ type: 'meleeStart' }, { type: 'meleeHit' }, { type: 'kill' }, { type: 'meleeParry' }, { attack: 'gun', weapon: 'carbine' }, { playerId: 1, targetId: 0 }, { playerId: 0, targetId: 0 }, { playerId: 7, targetId: 8 }]) assert.equal(reporter.consume({ ...event, ...patch }, 0), false);
  for (const patch of [{ damage: 0 }, { damage: -1 }, { damage: NaN }, { damage: Infinity }, { hp: undefined }, { hp: NaN }, { hp: -1 }]) assert.equal(reporter.consume({ ...event, ...patch }, 0), true);
  assert.equal(ctx.sources.length, 0); assert.equal(reporter.inspect().trackedSwings, 0);
  reporter.consume(event, 0); assert.equal(ctx.sources.length, 1);
});

test('confirmed contacts respect each distinct blade, attacker life, watched teammate and session', () => {
  const state = fight(12), { audio, ctx, reporter } = enabledAudio();
  for (const [index, weapon] of contactIds.entries()) reporter.consume(accepted(state, index + 1, { attack: weapon, weapon, meleeIndex: index + 1 }), 0);
  assert.equal(ctx.sources.length, 4); assert.equal(new Set(ctx.sources.map(source => source.buffer)).size, 4);
  const event = accepted(state, 5);
  reporter.consume({ ...event, attackerLifeId: 11 }, 0); reporter.consume({ ...event, attackerDeaths: 1 }, 0);
  reporter.consume({ ...event, playerId: 7 }, 0, { viewedId: 7 });
  reporter.consume(event, 0, { lifeKey: 'another-round' });
  assert.equal(audio.inspectBladeImpacts().played, 8);
  reporter.reset(); assert.deepEqual(reporter.inspect(), { reports: 0, trackedSwings: 0, limit: 512 });
});

test('starter knife retains its exact brief legacy contact sound and never allocates a new blade report', () => {
  const state = fight(1), { audio, ctx, reporter } = enabledAudio(), calls = [];
  audio.tone = (...args) => calls.push(['tone', ...args]); audio.noise = (...args) => calls.push(['noise', ...args]);
  reporter.consume(accepted(state, 1, { attack: 'knife', weapon: 'knife' }), 0, { gain: .13 });
  assert.deepEqual(calls, [['tone', 285, .065, { end: 75, type: 'triangle', gain: .13 }], ['noise', .028, { highpass: 100, lowpass: 1500, gain: .13 * .38 }]]);
  assert.equal(ctx.sources.length, 0); assert.equal(audio.inspectBladeImpacts().cachedBuffers, 0); assert.equal(reporter.inspect().reports, 1);
});

test('external legacy audio objects retain compatibility; present but unavailable contact methods cannot retry old cuts', () => {
  const state = fight(3), calls = [], legacy = { enabled: true, tone(...args) { calls.push(['tone', ...args]); }, noise(...args) { calls.push(['noise', ...args]); } };
  createMeleeImpactReporter(legacy).consume(accepted(state, 1), 0); assert.equal(calls.length, 2);
  const failures = [], modern = { ...legacy, meleeImpact(weapon) { failures.push(weapon); return false; } }, reporter = createMeleeImpactReporter(modern);
  reporter.consume(accepted(state, 2), 0); reporter.consume(accepted(state, 3), 0);
  assert.deepEqual(failures, ['sword']); assert.equal(calls.length, 2); assert.equal(reporter.inspect().reports, 0);
});

test('an unavailable source cleans resources and a failed cut remains consumed without blocking the next cut', () => {
  const state = fight(3), { audio, ctx, reporter } = enabledAudio(), create = ctx.createBufferSource.bind(ctx);
  ctx.createBufferSource = () => { const source = create(); source.start = () => { throw Error('device unavailable'); }; return source; };
  assert.doesNotThrow(() => reporter.consume(accepted(state, 1), 0));
  assert.equal(ctx.sources[0].disconnects, 1); assert.equal(audio.gunshotVoices.size, 0);
  ctx.createBufferSource = create; reporter.consume(accepted(state, 2), 0); assert.equal(ctx.sources.length, 1);
  reporter.consume(accepted(state, 3, { meleeIndex: 8 }), 0); assert.equal(ctx.sources.length, 2); assert.equal(reporter.inspect().reports, 1);
});

test('accepted primary recovery queues are visible in the existing readout for every physical blade', () => {
  for (const weapon of MELEE_IDS) {
    const state = fight(1), player = state.players[0]; state.players[1].x = 20;
    setInventoryMeleeLoadout(player, weapon); selectInventorySlot(player, 0);
    const step = fire => { state.tick++; combatStep(state, [{ fire, yaw: 0 }, {}], arena); };
    step(true);
    const maximum = MELEE_WEAPONS[weapon].startupTicks + MELEE_WEAPONS[weapon].activeTicks + MELEE_WEAPONS[weapon].recoveryTicks + 2;
    let elapsed = 0;
    while (player.meleeTicks > MELEE_PRESS_BUFFER_TICKS / 2 && elapsed++ < maximum) step(false);
    assert.ok(player.meleeTicks > 0 && player.meleeTicks <= MELEE_PRESS_BUFFER_TICKS);
    step(true); assert.ok(player.pendingMeleeTicks > 0);
    const before = structuredClone(player), view = meleeActionReadout(player);
    assert.match(view.status, /RECOVERING · NEXT STRIKE QUEUED$/); assert.equal(view.ammo, 'RECOVER'); assert.equal(view.state, 'recovery');
    assert.deepEqual(player, before, 'the readout does not consume the queued press');
    clearMeleeBuffer(player); assert.doesNotMatch(meleeActionReadout(player).status, /QUEUED/);
  }
});

test('stale queue fields never advertise cuts for wrong inventory, action, phase or canceled context', () => {
  const state = fight(1), player = state.players[0]; setInventoryMeleeLoadout(player, 'katana'); selectInventorySlot(player, 0);
  Object.assign(player, { meleeAction: 'primary', meleePhase: 'recovery', meleeTicks: 5, meleeCooldown: 5, pendingMeleeTicks: 5 });
  assert.match(meleeActionReadout(player).status, /NEXT STRIKE QUEUED/);
  const cases = [{ pendingMeleeTicks: 0 }, { pendingMeleeTicks: NaN }, { pendingMeleeTicks: Infinity }, { pendingMeleeTicks: 11 }, { pendingMeleeTicks: .5 },
    { meleeAction: 'secondary' }, { meleePhase: 'startup', meleeTicks: 50 }, { meleePhase: 'active', meleeTicks: MELEE_WEAPONS.katana.recoveryTicks + 1 }, { meleeTicks: 0, meleeCooldown: 0 },
    { reloadTicks: 1 }, { healTicks: 1 }, { healing: true }, { grenadeThrowTicks: 1 }, { parryTicks: 1 }, { triggerBlocked: true }, { alive: false },
    { slot: 'primary' }, { slot: 'potion' }, { slot: 'empty' }, { inventory: undefined }, { inventoryIndex: 1 }, { inventory: [{ kind: 'melee', weapon: 'sword' }] }];
  for (const patch of cases) {
    const actor = { ...player, ...patch }, before = structuredClone(actor), readout = meleeActionReadout(actor);
    assert.doesNotMatch(readout?.status || '', /QUEUED/, JSON.stringify(patch)); assert.deepEqual(actor, before);
  }
});
