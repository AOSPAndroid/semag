import assert from 'node:assert/strict';
import test from 'node:test';
import * as Horde from '../public/voxel-horde-engine.js';
import { applyCombatDamage } from '../public/voxel-engine.js';
import { createHordeWaveClearPresentation, hordeFinalStandPresentation, hordeInputForPhase } from '../public/voxel-horde-client.js';

const snapshot = state => structuredClone({ ...state, map: undefined, fighters: undefined });
function active(participants = [0]) {
  const state = Horde.createState({ seed: 83191 });
  for (const id of participants) Horde.setConnected(state, id, true);
  Horde.startMatch(state, participants);
  while (state.phase === 'countdown') Horde.step(state);
  state.map = Horde.MAPS[state.mapId];
  return state;
}
function clearFirstWave(state) {
  for (let tick = 0; tick < 2000 && state.phase === 'fight'; tick++) {
    Horde.step(state);
    const targets = state.players.filter(player => player.monster && player.alive);
    if (targets.length) applyCombatDamage(state, targets.map(player => ({ targetId: player.id, playerId: 0, damage: player.maxHp + 1 })));
  }
  assert.equal(state.phase, 'intermission');
  assert.equal(state.horde.wavesCleared, 1);
  assert.ok(state.horde.totalKills > 0);
  assert.equal(state.horde.totalKills, state.horde.waveKills);
}

test('a natural wave clear celebrates the accepted kills, duration and arena exactly once', () => {
  const state = active(), presenter = createHordeWaveClearPresentation();
  assert.equal(presenter.observe(state), null);
  clearFirstWave(state);
  const before = snapshot(state), clear = presenter.observe(state);
  assert.equal(clear.started, true);
  assert.equal(clear.wave, 1);
  assert.equal(clear.kills, 10, 'the actual solo opening wave contains ten hostiles');
  assert.equal(clear.kills, state.horde.waveKills);
  assert.equal(clear.seconds, state.horde.waveTicks / Horde.TICK_RATE);
  assert.equal(clear.map, state.mapName);
  for (let sample = 0; sample < 240; sample++) assert.deepEqual(presenter.observe(state), { ...clear, started: false });
  assert.deepEqual(snapshot(state), before, 'display refreshes never advance the authoritative intermission');
});

test('joining during restock, a paused fight and a final overrun cannot invent a wave victory', () => {
  const state = active(); clearFirstWave(state);
  const late = createHordeWaveClearPresentation();
  assert.equal(late.observe(state), null, 'a first terminal-looking snapshot is not a confirmed transition');
  const paused = createHordeWaveClearPresentation();
  paused.observe({ ...state, phase: 'paused' });
  assert.equal(paused.observe(state), null);
  const lost = createHordeWaveClearPresentation();
  lost.observe({ ...state, phase: 'fight' });
  assert.equal(lost.observe({ ...state, phase: 'matchEnd', horde: { ...state.horde, result: 'lost' } }), null);
  const unconfirmed = createHordeWaveClearPresentation();
  unconfirmed.observe({ ...state, phase: 'fight' });
  assert.equal(unconfirmed.observe({ ...state, horde: { ...state.horde, wavesCleared: 0 } }), null);
});

test('a map, match, session or explicit reset forgets the prior wave announcement', () => {
  const state = active(); clearFirstWave(state);
  for (const change of [{ mapId: 'snow' }, { matchId: state.matchId + 1 }, { horde: { ...state.horde, sessionId: state.horde.sessionId + 1 } }]) {
    const presenter = createHordeWaveClearPresentation();
    presenter.observe({ ...state, phase: 'fight' });
    assert.equal(presenter.observe({ ...state, ...change }), null);
  }
  const presenter = createHordeWaveClearPresentation();
  presenter.observe({ ...state, phase: 'fight' });
  assert.equal(presenter.observe(state).started, true);
  presenter.reset(); assert.equal(presenter.observe(state), null);
  assert.equal(presenter.observe(null), null);
});

test('wave celebration leaves real intermission movement, loot and the eight-second clock running', () => {
  const state = active(), presenter = createHordeWaveClearPresentation();
  state.map = { ...state.map, id: 'wave-victory-open-fixture', colliders: [], bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 } };
  const player = state.players[0];
  Object.assign(player, { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, grounded: true });
  presenter.observe(state); clearFirstWave(state);
  const episode = presenter.observe(state), startTicks = state.phaseTicks, startZ = player.z;
  assert.equal(episode.started, true);
  // A real wave-clear supply is authored by the engine at the survivor's feet.
  const supply = state.loot.find(drop => drop.source === 'wave-clear');
  assert.ok(supply); assert.equal(Horde.findNearbyLoot(state, 0).id, supply.id);
  Horde.step(state, [hordeInputForPhase({ interact: true }, state.phase)]);
  assert.equal(state.loot.some(drop => drop.id === supply.id), false);
  assert.ok(state.events.some(event => event.type === 'lootPickup' && event.lootId === supply.id));
  for (let tick = 0; tick < 120; tick++) {
    const before = state.tick;
    assert.equal(presenter.observe(state).started, false);
    assert.equal(state.tick, before);
    Horde.step(state, [hordeInputForPhase({ up: true, yaw: 0, pitch: 0 }, state.phase)]);
  }
  assert.ok(player.z < startZ - 1, 'a cosmetic victory does not fence movement');
  assert.equal(state.phaseTicks, startTicks - 121);
  while (state.phase === 'intermission') Horde.step(state);
  assert.equal(state.phase, 'fight'); assert.equal(state.horde.wave, 2);
  assert.equal(presenter.observe(state), null);
});

test('a finished co-op stand keeps personal contribution separate from authoritative squad totals', () => {
  const state = active([0, 2]);
  let monster;
  for (let tick = 0; tick < 300 && !monster; tick++) { Horde.step(state); monster = state.players.find(player => player.monster && player.alive); }
  assert.ok(monster);
  const hp = monster.hp;
  applyCombatDamage(state, [
    { targetId: monster.id, playerId: 2, damage: 21 },
    { targetId: monster.id, playerId: 0, damage: hp + 900 },
  ]);
  Horde.step(state);
  assert.equal(state.players[2].damageDealt, 21);
  assert.equal(state.players[0].damageDealt, hp - 21);
  let attacker;
  for (let tick = 0; tick < 300 && !attacker; tick++) { Horde.step(state); attacker = state.players.find(player => player.monster && player.alive); }
  assert.ok(attacker);
  applyCombatDamage(state, [0, 2].map(targetId => ({ targetId, playerId: attacker.id, damage: 9000 })));
  Horde.step(state); assert.equal(state.phase, 'matchEnd');
  const before = snapshot(state), personal = hordeFinalStandPresentation(state, 2);
  assert.equal(personal.personalKills, 0); assert.equal(personal.kills, 1);
  assert.equal(personal.damage, 21); assert.equal(personal.teamDamageTaken, state.horde.teamstats.damageTaken);
  assert.equal(personal.wavesCleared, 0); assert.equal(personal.wave, 1);
  assert.equal(personal.teamRevives, state.horde.teamstats.revives);
  assert.equal(personal.shots, state.players[2].shots);
  assert.deepEqual(snapshot(state), before);
  assert.equal(hordeFinalStandPresentation({ ...state, players: [...state.players].reverse() }, 2).damage, personal.damage);
  assert.equal(hordeFinalStandPresentation(state, attacker.id).personalKills, 0, 'a creature cannot become a survivor score');
});

test('result counts safely handle absent players and never borrow another survivor score', () => {
  assert.deepEqual(hordeFinalStandPresentation(null), { wave: 0, kills: 0, elapsed: 0, damage: 0, wavesCleared: 0, personalKills: 0, shots: 0, teamDamageTaken: 0, teamRevives: 0 });
  const state = active([0, 2]); clearFirstWave(state);
  assert.equal(hordeFinalStandPresentation(state, 99).damage, 0);
  assert.equal(hordeFinalStandPresentation(state, 99).personalKills, 0);
  assert.equal(hordeFinalStandPresentation(state, 0).wavesCleared, state.horde.wavesCleared);
  assert.equal(hordeFinalStandPresentation(state, 0).kills, state.horde.totalKills);
});
