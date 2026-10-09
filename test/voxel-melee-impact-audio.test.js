import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio } from '../public/audio.js';
import { applyCombatDamage, createCombatPlayer, combatStep } from '../public/voxel-engine.js';
import { createMeleeImpactReporter, combatEventPerspective } from '../public/voxel-client.js';
import { createHitFeedback } from '../public/voxel-hit-feedback.js';
import { incomingDamageFeedback } from '../public/voxel-damage-feedback.js';
import { MELEE_IDS, MELEE_WEAPONS } from '../public/voxel-melee.js';
import { setInventoryMeleeLoadout, selectInventorySlot } from '../public/voxel-inventory.js';

const arena = { id: 'melee-impact-audio-arena', bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, colliders: [], sites: [] };
function recorder(enabled = true) {
  const audio = new GameAudio(), voices = []; audio.enabled = enabled;
  // Exercise compatibility with tone/noise-only audio; real cached blade
  // contacts are verified with an AudioContext in voxel-blade-feedback.test.js.
  audio.meleeImpact = undefined;
  audio.tone = (frequency, duration, options) => voices.push({ kind: 'tone', frequency, duration, ...options });
  audio.noise = (duration, options) => voices.push({ kind: 'noise', duration, ...options });
  return { audio, voices, reporter: createMeleeImpactReporter(audio) };
}
function fixture(count = 20) {
  const players = Array.from({ length: count + 1 }, (_, id) => {
    const player = createCombatPlayer(id); player.team = id ? 1 : 0; player.lifeId = id + 10;
    player.x = id ? id + 1 : 0; player.z = id ? -2 : 0; return player;
  });
  return { gameId: 'melee-audio-test', phase: 'fight', map: arena, players, tick: 120, eventId: 0, events: [], eventLimit: 256, bolts: [], grenades: [], loot: [] };
}
function accepted(state, targetId, extra = {}) {
  const start = state.events.length;
  applyCombatDamage(state, [{ playerId: 0, targetId, damage: 55, hp: undefined, attack: 'sword', weapon: 'sword', hitKind: 'body', meleeIndex: 7,
    meleeStartTick: 100, attackerLifeId: state.players[0].lifeId, attackerDeaths: 0, ...extra }]);
  const damage = state.events.slice(start).find(event => event.type === 'damage'); assert.ok(damage, 'the shared damage commit must confirm real HP loss'); return damage;
}

test('twenty accepted cleave victims retain individual HP/events and crosshair feedback but request one impact sound', () => {
  const state = fixture(), { audio, voices, reporter } = recorder();
  const contacts = state.players.slice(1).map(player => accepted(state, player.id));
  const before = structuredClone(state);
  for (const event of contacts) assert.equal(reporter.consume(event, 0, { lifeKey: 'stand-1', gain: .13 }), true);
  assert.equal(voices.filter(voice => voice.kind === 'tone').length, 1); assert.equal(voices.filter(voice => voice.kind === 'noise').length, 1);
  assert.equal(reporter.inspect().reports, 1); assert.equal(reporter.inspect().trackedSwings, 1); assert.equal(audio.context, null);
  assert.equal(state.events.filter(event => event.type === 'damage').length, 20); assert.ok(state.players.slice(1).every(player => player.hp === 145));
  assert.deepEqual(state, before, 'reporting cannot modify bodies, inventories, HP or the authoritative journal');
  const crosshair = createHitFeedback().consume(contacts, state.players[0], state.players, { now: 10, lifeKey: 'stand-1' });
  assert.equal(crosshair.visible, true); assert.equal(crosshair.kind, 'body'); assert.equal(crosshair.symbol, '×');
});

test('a real committed swing carries stable identity through its start, contact and accepted damage', () => {
  const state = fixture(1), attacker = state.players[0], target = state.players[1];
  Object.assign(target, { x: 0, z: -1.4 }); setInventoryMeleeLoadout(attacker, 'katana'); selectInventorySlot(attacker, 0);
  state.tick++; combatStep(state, [{ fire: true, yaw: 0 }, {}], arena);
  for (let i = 0; i < MELEE_WEAPONS.katana.startupTicks; i++) { state.tick++; combatStep(state, [{ fire: true, yaw: 0 }, {}], arena); }
  const start = state.events.find(event => event.type === 'meleeStart'), hit = state.events.find(event => event.type === 'meleeHit'), damage = state.events.find(event => event.type === 'damage');
  assert.ok(start && hit && damage, 'a real active blade must produce committed and accepted events');
  for (const event of [hit, damage]) for (const field of ['meleeIndex', 'meleeStartTick', 'attackerLifeId', 'attackerDeaths']) assert.equal(event[field], start[field], field);
  assert.ok(start.meleeIndex > 0); assert.equal(start.attackerLifeId, attacker.lifeId);
  const { voices, reporter } = recorder();
  assert.equal(reporter.consume(start, 0), false); assert.equal(reporter.consume(hit, 0), false); assert.equal(reporter.consume(damage, 0), true);
  assert.equal(voices.filter(voice => voice.kind === 'tone').length, 1);
});

test('one swing stays one sound when later active-frame contacts arrive in separate snapshots', () => {
  const state = fixture(), { voices, reporter } = recorder();
  for (const player of state.players.slice(1)) {
    state.tick++; const event = accepted(state, player.id);
    reporter.consume(event, 0, { lifeKey: 'match-1' }); reporter.consume(structuredClone(event), 0, { lifeKey: 'match-1' });
  }
  assert.equal(reporter.inspect().reports, 1); assert.equal(voices.length, 2);
  assert.equal(new Set(state.events.filter(event => event.type === 'damage').map(event => event.tick)).size, 20);
});

test('separate simultaneous swings, attackers and lifetimes cannot suppress each other', () => {
  const state = fixture(6), { reporter } = recorder();
  const contacts = [accepted(state, 1), accepted(state, 2, { meleeIndex: 8 }), accepted(state, 3, { meleeStartTick: 101 }),
    accepted(state, 4, { attackerLifeId: 11 }), accepted(state, 5, { attackerDeaths: 1 })];
  for (const event of contacts) reporter.consume(event, 0, { lifeKey: 'match-1' });
  const allyHit = accepted(state, 6, { playerId: 1, attackerLifeId: state.players[1].lifeId });
  reporter.consume(allyHit, 0, { lifeKey: 'match-1', viewedId: 1 }); assert.equal(reporter.inspect().reports, 6);
});

test('the actual spectated attacker reports once without replacing incoming hurt or an unseen teammate impact', () => {
  const state = fixture(4), { voices, reporter } = recorder();
  const watched = accepted(state, 3, { playerId: 1, attackerLifeId: 11 });
  assert.equal(reporter.consume(watched, 0), false);
  assert.equal(reporter.consume(watched, 0, { viewedId: 1 }), true); assert.equal(reporter.consume(watched, 0, { viewedId: 1 }), true);
  const incoming = accepted(state, 0, { playerId: 1, attackerLifeId: 11 });
  assert.equal(combatEventPerspective(incoming, 0).incoming, true); assert.equal(reporter.consume(incoming, 0, { viewedId: 1 }), false);
  assert.ok(incomingDamageFeedback(incoming, state.players[0], state.players, { now: 10, lifeKey: 0 }));
  assert.equal(reporter.consume(accepted(state, 4, { playerId: 2, attackerLifeId: 12 }), 0, { viewedId: 1 }), false);
  assert.equal(voices.length, 2);
});

test('muted partial cleaves remain consumed across opt-in and a new swing still reports immediately', () => {
  const state = fixture(), { audio, voices, reporter } = recorder(false);
  for (let target = 1; target <= 10; target++) reporter.consume(accepted(state, target), 0, { lifeKey: 'stand-1' });
  audio.enabled = true;
  for (let target = 11; target <= 20; target++) reporter.consume(accepted(state, target), 0, { lifeKey: 'stand-1' });
  assert.equal(voices.length, 0); assert.equal(reporter.inspect().reports, 0);
  reporter.consume(accepted(state, 1, { meleeIndex: 8, meleeStartTick: 140 }), 0, { lifeKey: 'stand-1' }); assert.equal(voices.length, 2);
});

test('guns, projectiles, incoming damage, self damage and unaccepted contacts keep their independent audio paths', () => {
  const state = fixture(5), { reporter, voices } = recorder();
  const events = [accepted(state, 1, { attack: 'gun', weapon: 'carbine' }), accepted(state, 2, { attack: 'gun', weapon: 'shotgun' }),
    accepted(state, 3, { attack: 'bolt', weapon: 'crossbow' }), accepted(state, 0, { playerId: 4 }), accepted(state, 0),
    { type: 'shot', playerId: 0, targetId: 1 }, { type: 'meleeHit', playerId: 0, targetId: 1, attack: 'sword', weapon: 'sword', damage: 55 },
    { type: 'kill', playerId: 0, targetId: 1, attack: 'sword', weapon: 'sword', damage: 55 }];
  for (const event of events) assert.equal(reporter.consume(event, 0), false, event.type + ':' + event.attack);
  assert.equal(voices.length, 0); assert.equal(reporter.inspect().trackedSwings, 0);
});

test('invalid damage cannot create an impact or consume a legitimate future melee identity', () => {
  const state = fixture(1), { reporter, voices } = recorder(), event = accepted(state, 1);
  for (const patch of [{ damage: 0 }, { damage: -1 }, { damage: NaN }, { damage: Infinity }, { hp: undefined }, { hp: NaN }, { hp: -1 }]) {
    assert.equal(reporter.consume({ ...event, ...patch }, 0), true, 'invalid outgoing melee is handled silently, without a fallback hit tone');
  }
  assert.equal(voices.length, 0); assert.equal(reporter.inspect().trackedSwings, 0);
  assert.equal(reporter.consume(event, 0), true); assert.equal(voices.length, 2);
});

test('all five physical blades use brief bounded impact cues that differ from the old high-pitched hit beep', () => {
  const state = fixture(5), { voices, reporter } = recorder();
  for (const [index, weapon] of MELEE_IDS.entries()) reporter.consume(accepted(state, index + 1, { attack: weapon, weapon, meleeIndex: index + 1 }), 0, { gain: .13 });
  const tones = voices.filter(voice => voice.kind === 'tone'), noises = voices.filter(voice => voice.kind === 'noise');
  assert.equal(tones.length, 5); assert.equal(noises.length, 5); assert.equal(new Set(tones.map(voice => voice.frequency)).size, 5);
  assert.ok(tones.every(voice => voice.frequency >= 150 && voice.frequency <= 300 && voice.duration <= .085 && voice.gain === .13 && voice.end <= 75));
  assert.ok(noises.every(voice => voice.duration <= .04 && voice.gain <= .05 && voice.highpass === 100 && voice.lowpass === 1500));
});

test('legacy trigger grouping, new sessions and explicit resets preserve legitimate new impact reports', () => {
  const state = fixture(4), { reporter } = recorder();
  const first = accepted(state, 1, { meleeIndex: undefined, meleeStartTick: undefined });
  const second = accepted(state, 2, { meleeIndex: undefined, meleeStartTick: undefined });
  reporter.consume(first, 0, { lifeKey: 'old-1' }); reporter.consume(second, 0, { lifeKey: 'old-1' }); assert.equal(reporter.inspect().reports, 1);
  reporter.consume(first, 0, { lifeKey: 'new-1' }); assert.equal(reporter.inspect().reports, 2);
  reporter.reset(); assert.deepEqual(reporter.inspect(), { reports: 0, trackedSwings: 0, limit: 512 });
  reporter.consume(first, 0, { lifeKey: 'new-1' }); assert.equal(reporter.inspect().reports, 1);
});

test('endless waves retain at most 512 swing keys and readonly diagnostics cannot corrupt them', () => {
  const state = fixture(1), { reporter } = recorder(false), event = accepted(state, 1);
  for (let index = 1; index <= 3000; index++) reporter.consume({ ...event, meleeIndex: index, meleeStartTick: index * 100 }, 0, { lifeKey: 'long-stand' });
  assert.equal(reporter.inspect().trackedSwings, 512); assert.equal(reporter.inspect().reports, 0);
  assert.ok(Object.isFrozen(reporter.inspect())); assert.throws(() => { reporter.inspect().trackedSwings = 9000; }, TypeError);
});

test('a failed optional audio voice stays consumed and cannot interrupt later feedback or swings', () => {
  const state = fixture(3), { audio, voices, reporter } = recorder(); audio.tone = () => { throw new Error('device unavailable'); };
  assert.doesNotThrow(() => reporter.consume(accepted(state, 1), 0));
  audio.tone = (frequency, duration, options) => voices.push({ frequency, duration, ...options });
  reporter.consume(accepted(state, 2), 0); assert.equal(voices.length, 0, 'a second victim cannot retry a failed old swing');
  reporter.consume(accepted(state, 3, { meleeIndex: 8 }), 0); assert.equal(voices.length, 2); assert.equal(state.events.filter(event => event.type === 'damage').length, 3);
});
